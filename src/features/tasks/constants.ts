import type { Enums } from "@/types/database.types";

export type TaskStatus = Enums<"task_status">;

export const TASK_STATUSES = ["pending", "completed", "cancelled"] as const satisfies readonly TaskStatus[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const TASK_VIEWS = {
  today: "Hoy",
  overdue: "Vencidas",
  upcoming: "Próximas",
  completed: "Completadas",
  cancelled: "Canceladas",
} as const;

export type TaskView = keyof typeof TASK_VIEWS;

export const POSTPONE_OPTIONS = [
  { days: 1, label: "Mañana" },
  { days: 3, label: "En 3 días" },
  { days: 7, label: "En 1 semana" },
  { days: 14, label: "En 2 semanas" },
] as const;
