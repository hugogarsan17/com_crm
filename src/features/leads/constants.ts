import type { Enums } from "@/types/database.types";

export type LeadStatus = Enums<"lead_status">;
export type LeadPriority = Enums<"lead_priority">;

export const LEAD_STATUSES = [
  "pending_contact",
  "no_answer",
  "follow_up",
  "proposal_in_progress",
  "policy_contracted",
  "rejected",
] as const satisfies readonly LeadStatus[];

export const LEAD_PRIORITIES = ["low", "normal", "high"] as const satisfies readonly LeadPriority[];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  pending_contact: "Pendiente de contactar",
  no_answer: "No contesta",
  follow_up: "En seguimiento",
  proposal_in_progress: "Propuesta en curso",
  policy_contracted: "Póliza contratada",
  rejected: "Rechazado",
};

/** Clases de color por estado (badge). */
export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  pending_contact: "border-[#8fb8ff]/30 bg-[#8fb8ff]/10 text-[#b7d0ff] before:bg-[#8fb8ff]",
  no_answer: "border-white/12 bg-white/[0.05] text-foreground/80 before:bg-[#a8aea3]",
  follow_up: "border-[#f5c453]/30 bg-[#f5c453]/10 text-[#f8d98a] before:bg-[#f5c453]",
  proposal_in_progress: "border-[#c9b6f2]/30 bg-[#c9b6f2]/10 text-[#dccff8] before:bg-[#c9b6f2]",
  policy_contracted: "border-primary/35 bg-primary/12 text-primary before:bg-primary",
  rejected: "border-[#ff8f80]/30 bg-[#ff8f80]/10 text-[#ffb3a9] before:bg-[#ff8f80]",
};

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
};

export const CLOSED_LEAD_STATUSES: readonly LeadStatus[] = ["policy_contracted", "rejected"];

/** Estados abiertos que deberían tener siempre una próxima acción programada. */
export const OPEN_NEEDS_FOLLOW_UP: readonly LeadStatus[] = ["no_answer", "follow_up", "proposal_in_progress"];

/**
 * Estados retirados en la migración 20261018000100. Las fichas que los tenían se
 * migraron (ver docs/database.md) y conservan el valor original en `legacy_status`.
 */
export const RETIRED_LEAD_STATUS_LABELS: Record<string, string> = {
  interested: "Interesado",
  keeps_current_conditions: "Mantiene condiciones",
  do_not_contact: "No contactar",
};

export type FuneralInsurance = "yes" | "no" | "unknown";

export const FUNERAL_INSURANCE_OPTIONS = ["unknown", "yes", "no"] as const satisfies readonly FuneralInsurance[];

export const FUNERAL_INSURANCE_LABELS: Record<FuneralInsurance, string> = {
  unknown: "Sin indicar",
  yes: "Sí",
  no: "No",
};

export function funeralInsuranceFromDb(value: boolean | null): FuneralInsurance {
  return value === null ? "unknown" : value ? "yes" : "no";
}

export function funeralInsuranceToDb(value: FuneralInsurance): boolean | null {
  return value === "unknown" ? null : value === "yes";
}

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
