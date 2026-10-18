import "server-only";
import { requireUser } from "@/lib/auth";
import { notificationsConfigStatus } from "./config";

export async function getNotificationSettings() {
  const { user, supabase } = await requireUser();
  const [prefs, log] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("email_enabled, notify_upcoming, upcoming_hours, notify_overdue")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("notification_log")
      .select("id, kind, due_at, status, created_at, error")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (prefs.error || log.error) throw new Error("No se pudieron cargar los avisos.");
  return {
    email: user.email,
    timezone: user.timezone,
    preferences: prefs.data ?? { email_enabled: false, notify_upcoming: true, upcoming_hours: 24, notify_overdue: true },
    recent: log.data,
    config: notificationsConfigStatus(),
  };
}
