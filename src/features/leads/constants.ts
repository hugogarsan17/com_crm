import type { Enums } from "@/types/database.types";

export type LeadStatus = Enums<"lead_status">;
export type LeadPriority = Enums<"lead_priority">;

export const LEAD_STATUSES = [
  "pending_contact",
  "no_answer",
  "follow_up",
  "interested",
  "proposal_in_progress",
  "policy_contracted",
  "rejected",
  "keeps_current_conditions",
  "do_not_contact",
] as const satisfies readonly LeadStatus[];

export const LEAD_PRIORITIES = ["low", "normal", "high"] as const satisfies readonly LeadPriority[];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  pending_contact: "Pendiente de contactar",
  no_answer: "No contesta",
  follow_up: "En seguimiento",
  interested: "Interesado",
  proposal_in_progress: "Propuesta en curso",
  policy_contracted: "Póliza contratada",
  rejected: "Rechazado",
  keeps_current_conditions: "Mantiene condiciones",
  do_not_contact: "No contactar",
};

/** Clases de color por estado (badge). */
export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  pending_contact: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  no_answer: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  follow_up: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  interested: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  proposal_in_progress: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  policy_contracted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  keeps_current_conditions: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  do_not_contact: "bg-red-600 text-white dark:bg-red-700",
};

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
};

export const CLOSED_LEAD_STATUSES: readonly LeadStatus[] = [
  "policy_contracted",
  "rejected",
  "keeps_current_conditions",
  "do_not_contact",
];

/** Estados abiertos que deberían tener siempre una próxima acción programada. */
export const OPEN_NEEDS_FOLLOW_UP: readonly LeadStatus[] = ["no_answer", "follow_up", "interested", "proposal_in_progress"];

export function isClosedStatus(status: LeadStatus) {
  return CLOSED_LEAD_STATUSES.includes(status);
}

export const LEAD_SORTS = {
  received_desc: "Recibidos (más recientes)",
  received_asc: "Recibidos (más antiguos)",
  follow_up_asc: "Próximo seguimiento",
  updated_desc: "Últimos modificados",
} as const;

export type LeadSort = keyof typeof LEAD_SORTS;

export const LEADS_PAGE_SIZE = 25;
