import "server-only";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/dates";
import type { NotificationStore } from "./run";
import type { LogEntry } from "./select";

/** Implementación con Supabase (service_role). Solo se usa desde la tarea programada. */
export function supabaseNotificationStore(admin: AdminSupabaseClient): NotificationStore {
  return {
    async listEnabledPreferences() {
      const { data, error } = await admin
        .from("notification_preferences")
        .select("user_id, email_enabled, notify_upcoming, upcoming_hours, notify_overdue")
        .eq("email_enabled", true);
      if (error) throw new Error("No se pudieron leer las preferencias de avisos.");
      return data;
    },

    async listPendingTasks(userId, untilIso) {
      const { data, error } = await admin
        .from("tasks")
        .select("id, due_at, title, lead:leads!inner(id, full_name, archived_at)")
        .eq("user_id", userId)
        .eq("status", "pending")
        .is("lead.archived_at", null)
        .lte("due_at", untilIso)
        .order("due_at")
        .limit(500);
      if (error) throw new Error("No se pudieron leer los seguimientos.");
      return data.map((t) => ({ id: t.id, due_at: t.due_at, title: t.title, lead: { id: t.lead.id, full_name: t.lead.full_name } }));
    },

    async listLog(taskIds) {
      if (!taskIds.length) return [];
      const out: LogEntry[] = [];
      for (let i = 0; i < taskIds.length; i += 200) {
        const { data, error } = await admin
          .from("notification_log")
          .select("id, task_id, kind, due_at, status, attempts")
          .in("task_id", taskIds.slice(i, i + 200));
        if (error) throw new Error("No se pudo leer el registro de avisos.");
        out.push(...data);
      }
      return out;
    },

    async claim(userId, candidates) {
      const claimed: Awaited<ReturnType<NotificationStore["claim"]>> = [];
      const fresh = candidates.filter((c) => !c.retryLogId);
      if (fresh.length) {
        // La restricción única (task_id, kind, due_at) impide duplicados aunque dos ejecuciones coincidan.
        const { data, error } = await admin
          .from("notification_log")
          .upsert(
            fresh.map((c) => ({ user_id: userId, task_id: c.task.id, kind: c.kind, due_at: c.task.due_at, status: "sending" })),
            { onConflict: "task_id,kind,due_at", ignoreDuplicates: true },
          )
          .select("id, task_id, kind");
        if (error) throw new Error("No se pudieron reservar los avisos.");
        for (const row of data) {
          const candidate = fresh.find((c) => c.task.id === row.task_id && c.kind === row.kind);
          if (candidate) claimed.push({ candidate, logId: row.id });
        }
      }
      for (const c of candidates.filter((x) => x.retryLogId)) {
        // Reintento optimista: solo si sigue en "failed" (otra ejecución no lo ha tomado).
        const { data: current } = await admin.from("notification_log").select("attempts").eq("id", c.retryLogId!).maybeSingle();
        if (!current) continue;
        const { data } = await admin
          .from("notification_log")
          .update({ status: "sending", attempts: current.attempts + 1, error: null })
          .eq("id", c.retryLogId!)
          .eq("status", "failed")
          .eq("attempts", current.attempts)
          .select("id");
        if (data?.length) claimed.push({ candidate: c, logId: c.retryLogId! });
      }
      return claimed;
    },

    async markSent(logIds, providerMessageId) {
      const { error } = await admin
        .from("notification_log")
        .update({ status: "sent", provider_message_id: providerMessageId, error: null })
        .in("id", logIds);
      if (error) throw new Error("Email enviado, pero no se pudo actualizar el registro de avisos.");
    },

    async markFailed(logIds, message) {
      await admin.from("notification_log").update({ status: "failed", error: message.slice(0, 500) }).in("id", logIds);
    },

    async getRecipient(userId) {
      const [{ data: userData }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
      ]);
      const tz = profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE;
      return { email: userData.user?.email ?? null, timezone: tz };
    },
  };
}
