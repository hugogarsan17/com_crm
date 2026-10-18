import { describe, expect, it, vi } from "vitest";
import { notificationsConfigStatus } from "./config";
import type { EmailSender } from "./email";
import { runNotifications, type NotificationStore } from "./run";
import {
  classifyForNotification,
  MAX_ATTEMPTS,
  notificationKey,
  renderNotificationEmail,
  selectCandidates,
  type LogEntry,
  type NotificationPreferences,
  type PendingTask,
} from "./select";

const NOW = new Date("2026-10-18T08:00:00Z");
const USER = "11111111-1111-1111-1111-111111111111";
const prefs: NotificationPreferences = { user_id: USER, email_enabled: true, notify_upcoming: true, upcoming_hours: 24, notify_overdue: true };

const task = (id: string, dueAt: string): PendingTask => ({ id, due_at: dueAt, title: `Llamar ${id}`, lead: { id: `lead-${id}`, full_name: `Cliente <${id}>` } });

const TASKS = [
  task("vencida", "2026-10-17T10:00:00Z"),
  task("proxima", "2026-10-18T20:00:00Z"),
  task("lejana", "2026-10-25T10:00:00Z"),
];

/** Almacén en memoria con la misma restricción única que la tabla notification_log. */
function memoryStore(tasks: PendingTask[], preferences: NotificationPreferences[] = [prefs]) {
  const log: (LogEntry & { provider_message_id: string | null; error: string | null })[] = [];
  let seq = 0;
  const store: NotificationStore = {
    listEnabledPreferences: async () => preferences.filter((p) => p.email_enabled),
    listPendingTasks: async (_userId, untilIso) => tasks.filter((t) => t.due_at <= untilIso),
    listLog: async (ids) => log.filter((l) => ids.includes(l.task_id)),
    claim: async (_userId, candidates) => {
      const out: Awaited<ReturnType<NotificationStore["claim"]>> = [];
      for (const c of candidates) {
        const key = notificationKey(c.task.id, c.kind, c.task.due_at);
        const existing = log.find((l) => notificationKey(l.task_id, l.kind, l.due_at) === key);
        if (!existing) {
          const entry = { id: `log-${++seq}`, task_id: c.task.id, kind: c.kind, due_at: c.task.due_at, status: "sending", attempts: 1, provider_message_id: null, error: null };
          log.push(entry);
          out.push({ candidate: c, logId: entry.id });
        } else if (c.retryLogId === existing.id && existing.status === "failed") {
          existing.status = "sending";
          existing.attempts += 1;
          out.push({ candidate: c, logId: existing.id });
        }
      }
      return out;
    },
    markSent: async (ids, providerId) => {
      for (const l of log) if (ids.includes(l.id)) Object.assign(l, { status: "sent", provider_message_id: providerId });
    },
    markFailed: async (ids, error) => {
      for (const l of log) if (ids.includes(l.id)) Object.assign(l, { status: "failed", error });
    },
    getRecipient: async () => ({ email: "comercial@example.test", timezone: "Europe/Madrid" }),
  };
  return { store, log };
}

const run = (store: NotificationStore, send: EmailSender, emailConfigured = true, now = NOW) =>
  runNotifications({ store, send, emailConfigured, appUrl: "https://crm.example.test", appName: "Cartera CRM", now });

describe("selección de avisos", () => {
  it("clasifica vencidas y próximas según las preferencias", () => {
    expect(classifyForNotification(TASKS[0], prefs, NOW)).toBe("overdue");
    expect(classifyForNotification(TASKS[1], prefs, NOW)).toBe("upcoming");
    expect(classifyForNotification(TASKS[2], prefs, NOW)).toBeNull();
    expect(classifyForNotification(TASKS[0], { ...prefs, notify_overdue: false }, NOW)).toBeNull();
    expect(classifyForNotification(TASKS[1], { ...prefs, upcoming_hours: 2 }, NOW)).toBeNull();
  });

  it("no repite un aviso enviado y reintenta los fallidos hasta el límite", () => {
    const sent: LogEntry = { id: "l1", task_id: "vencida", kind: "overdue", due_at: TASKS[0].due_at, status: "sent", attempts: 1 };
    expect(selectCandidates(TASKS, prefs, [sent], NOW).map((c) => c.task.id)).toEqual(["proxima"]);
    const failed = { ...sent, status: "failed" };
    expect(selectCandidates(TASKS, prefs, [failed], NOW)[0]).toMatchObject({ retryLogId: "l1" });
    const exhausted = { ...failed, attempts: MAX_ATTEMPTS };
    expect(selectCandidates(TASKS, prefs, [exhausted], NOW).map((c) => c.task.id)).toEqual(["proxima"]);
  });

  it("vuelve a avisar si el seguimiento se reprograma", () => {
    const sent: LogEntry = { id: "l1", task_id: "proxima", kind: "upcoming", due_at: "2026-10-18T19:00:00Z", status: "sent", attempts: 1 };
    expect(selectCandidates(TASKS, prefs, [sent], NOW).map((c) => c.task.id)).toContain("proxima");
  });

  it("no hace nada con los avisos desactivados", () => {
    expect(selectCandidates(TASKS, { ...prefs, email_enabled: false }, [], NOW)).toEqual([]);
  });

  it("escapa el HTML de los datos del cliente", () => {
    const email = renderNotificationEmail(selectCandidates(TASKS, prefs, [], NOW), {
      appUrl: "https://crm.example.test",
      timezone: "Europe/Madrid",
      appName: "Cartera CRM",
    });
    expect(email.subject).toBe("Cartera CRM: seguimientos 1 vencido y 1 próximo");
    expect(email.html).toContain("Cliente &lt;vencida&gt;");
    expect(email.html).not.toContain("<vencida>");
  });
});

describe("envío de avisos", () => {
  it("no envía duplicados en ejecuciones sucesivas", async () => {
    const { store, log } = memoryStore(TASKS);
    const send = vi.fn<EmailSender>(async () => ({ ok: true, id: "msg-1" }));
    const first = await run(store, send);
    expect(first).toMatchObject({ status: "ok", emailsSent: 1, itemsNotified: 2 });
    const second = await run(store, send);
    expect(second).toMatchObject({ emailsSent: 0, itemsNotified: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(log.map((l) => l.status)).toEqual(["sent", "sent"]);
  });

  it("dos ejecuciones simultáneas no duplican el aviso (restricción única)", async () => {
    const { store } = memoryStore([TASKS[0]]);
    const send = vi.fn<EmailSender>(async () => ({ ok: true, id: null }));
    await Promise.all([run(store, send), run(store, send)]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sin proveedor configurado no envía, no reserva y lo indica", async () => {
    const { store, log } = memoryStore(TASKS);
    const send = vi.fn<EmailSender>();
    const result = await run(store, send, false);
    expect(result.status).toBe("not_configured");
    expect(send).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("un fallo de envío queda registrado (no se marca como enviado) y se reintenta después", async () => {
    const { store, log } = memoryStore([TASKS[0]]);
    const failing = vi.fn<EmailSender>(async () => ({ ok: false, error: "Resend respondió 500: error" }));
    const r1 = await run(store, failing);
    expect(r1).toMatchObject({ emailsSent: 0, emailsFailed: 1 });
    expect(r1.errors[0]).toMatch(/Resend/);
    expect(log[0]).toMatchObject({ status: "failed", attempts: 1 });

    const ok = vi.fn<EmailSender>(async () => ({ ok: true, id: "msg-2" }));
    const r2 = await run(store, ok);
    expect(r2.emailsSent).toBe(1);
    expect(log[0]).toMatchObject({ status: "sent", attempts: 2, provider_message_id: "msg-2" });
  });

  it("informa de las variables que faltan sin mostrar valores", () => {
    expect(notificationsConfigStatus({})).toEqual({
      emailConfigured: false,
      cronConfigured: false,
      missing: ["RESEND_API_KEY", "NOTIFICATIONS_FROM_EMAIL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"],
    });
    const full = { RESEND_API_KEY: "re_x", NOTIFICATIONS_FROM_EMAIL: "a@b.c", SUPABASE_SERVICE_ROLE_KEY: "k", CRON_SECRET: "s" };
    expect(notificationsConfigStatus(full)).toEqual({ emailConfigured: true, cronConfigured: true, missing: [] });
  });
});
