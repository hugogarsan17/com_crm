import "server-only";
import { requireUser } from "@/lib/auth";
import { dayBoundsInTimeZone } from "@/lib/dates";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { TaskView } from "./constants";

const TASK_WITH_LEAD =
  "id, title, description, due_at, status, completed_at, lead_id, lead:leads!inner(id, full_name, phone, product_code, status, legacy_status, last_outcome, archived_at)" as const;

function pendingTasks(supabase: ServerSupabaseClient, userId: string) {
  return supabase
    .from("tasks")
    .select(TASK_WITH_LEAD)
    .eq("user_id", userId)
    .eq("status", "pending")
    .is("lead.archived_at", null);
}

export async function listTasks(view: TaskView) {
  const { user, supabase } = await requireUser();
  const { start, end } = dayBoundsInTimeZone(user.timezone);

  let query;
  switch (view) {
    case "today":
      query = pendingTasks(supabase, user.id).gte("due_at", start.toISOString()).lt("due_at", end.toISOString()).order("due_at");
      break;
    case "overdue":
      query = pendingTasks(supabase, user.id).lt("due_at", start.toISOString()).order("due_at");
      break;
    case "upcoming":
      query = pendingTasks(supabase, user.id).gte("due_at", end.toISOString()).order("due_at");
      break;
    case "completed":
      query = supabase
        .from("tasks")
        .select(TASK_WITH_LEAD)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      break;
    case "cancelled":
      query = supabase
        .from("tasks")
        .select(TASK_WITH_LEAD)
        .eq("user_id", user.id)
        .eq("status", "cancelled")
        .order("updated_at", { ascending: false });
      break;
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error("No se pudieron cargar los seguimientos.");
  return { tasks: data ?? [], timezone: user.timezone };
}

export type TaskWithLead = Awaited<ReturnType<typeof listTasks>>["tasks"][number];

export async function getTaskCounts() {
  const { user, supabase } = await requireUser();
  const { start, end } = dayBoundsInTimeZone(user.timezone);
  const head = () =>
    supabase
      .from("tasks")
      .select("id, lead:leads!inner(archived_at)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .is("lead.archived_at", null);

  const [today, overdue, upcoming] = await Promise.all([
    head().gte("due_at", start.toISOString()).lt("due_at", end.toISOString()),
    head().lt("due_at", start.toISOString()),
    head().gte("due_at", end.toISOString()),
  ]);
  return { today: today.count ?? 0, overdue: overdue.count ?? 0, upcoming: upcoming.count ?? 0 };
}

/** Bandeja "Para hoy": vencidas + hoy, con datos del lead. */
export async function getTodayQueue() {
  const { user, supabase } = await requireUser();
  const { end } = dayBoundsInTimeZone(user.timezone);
  const [tasks, firstContact] = await Promise.all([
    pendingTasks(supabase, user.id).lt("due_at", end.toISOString()).order("due_at").limit(50),
    supabase
      .from("leads")
      .select("id, full_name, phone, postal_code, locality, has_funeral_insurance, status, priority, received_at, last_outcome")
      .eq("user_id", user.id)
      .eq("status", "pending_contact")
      .is("archived_at", null)
      .is("next_follow_up_at", null)
      .order("priority", { ascending: false })
      .order("received_at", { ascending: true })
      .limit(15),
  ]);
  if (tasks.error || firstContact.error) throw new Error("No se pudo cargar la bandeja de hoy.");
  return { tasks: tasks.data ?? [], firstContact: firstContact.data ?? [], timezone: user.timezone };
}

const CALENDAR_LIMIT = 1000;

/**
 * Tareas (de cualquier estado) con vencimiento en [startIso, endIso), para el calendario.
 * Usa la misma tabla y relación que la bandeja «Para hoy».
 */
export async function listTasksInRange(startIso: string, endIso: string) {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_WITH_LEAD)
    .eq("user_id", user.id)
    .is("lead.archived_at", null)
    .gte("due_at", startIso)
    .lt("due_at", endIso)
    .order("due_at")
    .limit(CALENDAR_LIMIT);
  if (error) throw new Error("No se pudieron cargar las tareas del calendario.");
  return { tasks: data ?? [], timezone: user.timezone, truncated: (data?.length ?? 0) >= CALENDAR_LIMIT };
}
