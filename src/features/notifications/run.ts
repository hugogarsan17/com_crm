import {
  selectCandidates,
  renderNotificationEmail,
  type Candidate,
  type LogEntry,
  type NotificationPreferences,
  type PendingTask,
} from "./select";
import type { EmailSender } from "./email";

/** Acceso a datos que necesita el envío de avisos (Supabase en producción, memoria en pruebas). */
export interface NotificationStore {
  listEnabledPreferences(): Promise<NotificationPreferences[]>;
  listPendingTasks(userId: string, untilIso: string): Promise<PendingTask[]>;
  listLog(taskIds: string[]): Promise<LogEntry[]>;
  /** Reserva los avisos (inserción con restricción única / reintento optimista). Devuelve solo los reservados. */
  claim(userId: string, candidates: Candidate[]): Promise<{ candidate: Candidate; logId: string }[]>;
  markSent(logIds: string[], providerMessageId: string | null): Promise<void>;
  markFailed(logIds: string[], error: string): Promise<void>;
  getRecipient(userId: string): Promise<{ email: string | null; timezone: string }>;
}

export type RunSummary = {
  status: "ok" | "not_configured";
  users: number;
  emailsSent: number;
  emailsFailed: number;
  itemsNotified: number;
  errors: string[];
};

export async function runNotifications({
  store,
  send,
  emailConfigured,
  appUrl,
  appName,
  now = new Date(),
}: {
  store: NotificationStore;
  send: EmailSender;
  emailConfigured: boolean;
  appUrl: string;
  appName: string;
  now?: Date;
}): Promise<RunSummary> {
  const summary: RunSummary = { status: "ok", users: 0, emailsSent: 0, emailsFailed: 0, itemsNotified: 0, errors: [] };
  // Sin proveedor no se reserva nada: los avisos quedan pendientes para cuando se configure.
  if (!emailConfigured) return { ...summary, status: "not_configured" };

  const preferences = await store.listEnabledPreferences();
  for (const prefs of preferences) {
    try {
      const horizon = new Date(now.getTime() + (prefs.notify_upcoming ? prefs.upcoming_hours : 0) * 3_600_000);
      const tasks = await store.listPendingTasks(prefs.user_id, horizon.toISOString());
      if (!tasks.length) continue;
      const log = await store.listLog(tasks.map((t) => t.id));
      const candidates = selectCandidates(tasks, prefs, log, now);
      if (!candidates.length) continue;

      const recipient = await store.getRecipient(prefs.user_id);
      if (!recipient.email) {
        summary.errors.push(`Usuario ${prefs.user_id.slice(0, 8)}…: sin email`);
        continue;
      }
      const claimed = await store.claim(prefs.user_id, candidates);
      if (!claimed.length) continue;
      summary.users += 1;

      const message = renderNotificationEmail(
        claimed.map((c) => c.candidate),
        { appUrl, timezone: recipient.timezone, appName },
      );
      const logIds = claimed.map((c) => c.logId);
      const result = await send({ to: recipient.email, ...message, idempotencyKey: logIds.slice().sort().join(",").slice(0, 256) });
      if (result.ok) {
        await store.markSent(logIds, result.id);
        summary.emailsSent += 1;
        summary.itemsNotified += claimed.length;
      } else {
        await store.markFailed(logIds, result.error);
        summary.emailsFailed += 1;
        summary.errors.push(result.error);
      }
    } catch (error) {
      summary.errors.push(error instanceof Error ? error.message : "Error desconocido");
    }
  }
  return summary;
}
