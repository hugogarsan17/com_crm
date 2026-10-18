/**
 * Selección de avisos (lógica pura, probada con Vitest).
 * - "upcoming": tarea pendiente que vence dentro de las próximas `upcoming_hours`.
 * - "overdue": tarea pendiente ya vencida.
 * Idempotencia: un aviso se identifica por (tarea, tipo, vencimiento). Si ya hay uno
 * enviado o en curso, no se repite; uno fallido se reintenta hasta MAX_ATTEMPTS.
 */
export type NotificationKind = "upcoming" | "overdue";

export type NotificationPreferences = {
  user_id: string;
  email_enabled: boolean;
  notify_upcoming: boolean;
  upcoming_hours: number;
  notify_overdue: boolean;
};

export type PendingTask = { id: string; due_at: string; title: string; lead: { id: string; full_name: string } };

export type LogEntry = { id: string; task_id: string; kind: string; due_at: string; status: string; attempts: number };

export type Candidate = { task: PendingTask; kind: NotificationKind; retryLogId: string | null };

export const MAX_ATTEMPTS = 3;
export const MAX_ITEMS_PER_EMAIL = 50;

export function notificationKey(taskId: string, kind: string, dueAt: string) {
  return `${taskId}:${kind}:${new Date(dueAt).toISOString()}`;
}

export function classifyForNotification(task: PendingTask, prefs: NotificationPreferences, now: Date): NotificationKind | null {
  const due = new Date(task.due_at).getTime();
  const t = now.getTime();
  if (due <= t) return prefs.notify_overdue ? "overdue" : null;
  if (prefs.notify_upcoming && due <= t + prefs.upcoming_hours * 3_600_000) return "upcoming";
  return null;
}

/** Tareas que hay que avisar ahora, descontando las ya avisadas para el mismo vencimiento. */
export function selectCandidates(
  tasks: readonly PendingTask[],
  prefs: NotificationPreferences,
  log: readonly LogEntry[],
  now: Date,
): Candidate[] {
  if (!prefs.email_enabled) return [];
  const byKey = new Map(log.map((l) => [notificationKey(l.task_id, l.kind, l.due_at), l]));
  const out: Candidate[] = [];
  for (const task of [...tasks].sort((a, b) => a.due_at.localeCompare(b.due_at))) {
    const kind = classifyForNotification(task, prefs, now);
    if (!kind) continue;
    const previous = byKey.get(notificationKey(task.id, kind, task.due_at));
    if (previous) {
      if (previous.status !== "failed" || previous.attempts >= MAX_ATTEMPTS) continue;
      out.push({ task, kind, retryLogId: previous.id });
    } else {
      out.push({ task, kind, retryLogId: null });
    }
    if (out.length >= MAX_ITEMS_PER_EMAIL) break;
  }
  return out;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Email resumen para el comercial (nunca se envía nada a los clientes). */
export function renderNotificationEmail(candidates: readonly Candidate[], opts: { appUrl: string; timezone: string; appName: string }) {
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: opts.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const overdue = candidates.filter((c) => c.kind === "overdue");
  const upcoming = candidates.filter((c) => c.kind === "upcoming");
  const parts = [
    overdue.length ? `${overdue.length} ${overdue.length === 1 ? "vencido" : "vencidos"}` : null,
    upcoming.length ? `${upcoming.length} ${upcoming.length === 1 ? "próximo" : "próximos"}` : null,
  ].filter(Boolean);
  const subject = `${opts.appName}: seguimientos ${parts.join(" y ")}`;

  const section = (title: string, list: readonly Candidate[]) =>
    list.length
      ? {
          html: `<h2 style="font-size:16px;margin:16px 0 8px">${escapeHtml(title)}</h2><ul style="padding-left:18px;margin:0">${list
            .map(
              (c) =>
                `<li style="margin:4px 0"><strong>${escapeHtml(fmt.format(new Date(c.task.due_at)))}</strong> · <a href="${escapeHtml(
                  `${opts.appUrl}/leads/${c.task.lead.id}`,
                )}">${escapeHtml(c.task.lead.full_name)}</a> · ${escapeHtml(c.task.title)}</li>`,
            )
            .join("")}</ul>`,
          text: `${title}\n${list.map((c) => `- ${fmt.format(new Date(c.task.due_at))} · ${c.task.lead.full_name} · ${c.task.title}`).join("\n")}\n`,
        }
      : { html: "", text: "" };

  const a = section("Vencidos", overdue);
  const b = section("Próximos", upcoming);
  const footer = `Recibes este aviso porque lo activaste en ${opts.appName} → Ajustes → Avisos por email.`;
  return {
    subject,
    html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">${a.html}${b.html}<p style="margin-top:16px"><a href="${escapeHtml(
      `${opts.appUrl}/calendar`,
    )}">Abrir el calendario</a></p><p style="color:#666;font-size:12px">${escapeHtml(footer)}</p></div>`,
    text: `${a.text}\n${b.text}\nCalendario: ${opts.appUrl}/calendar\n\n${footer}\n`,
  };
}
