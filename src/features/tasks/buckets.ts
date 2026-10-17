import { dayBoundsInTimeZone } from "@/lib/dates";
import type { TaskStatus } from "./constants";

export type TaskBucket = "overdue" | "today" | "upcoming" | "completed" | "cancelled";

/** Clasifica una tarea según su vencimiento relativo al día local del usuario. */
export function classifyTask(dueAt: string, status: TaskStatus, tz: string, now: Date = new Date()): TaskBucket {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  const { start, end } = dayBoundsInTimeZone(tz, now);
  const due = new Date(dueAt);
  if (due < start) return "overdue";
  if (due < end) return "today";
  return "upcoming";
}
