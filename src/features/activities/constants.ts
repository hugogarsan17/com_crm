import type { Enums } from "@/types/database.types";
import type { LeadStatus } from "@/features/leads/constants";

export type ActivityChannel = Enums<"activity_channel">;
export type ActivityOutcome = Enums<"activity_outcome">;

export const ACTIVITY_CHANNELS = ["call", "whatsapp", "sms", "email", "visit", "other"] as const satisfies readonly ActivityChannel[];

export const ACTIVITY_CHANNEL_LABELS: Record<ActivityChannel, string> = {
  call: "Llamada",
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  visit: "Visita",
  other: "Otro",
};

export const ACTIVITY_OUTCOMES = [
  "no_answer",
  "spoke",
  "interested",
  "info_requested",
  "call_back",
  "proposal_sent",
  "contracted",
  "rejected",
  "keeps_conditions",
  "wrong_contact",
  "do_not_contact",
  "other",
] as const satisfies readonly ActivityOutcome[];

export const ACTIVITY_OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  no_answer: "No contesta",
  spoke: "He hablado con el cliente",
  interested: "Interesado",
  info_requested: "Solicita información",
  call_back: "Pide que le vuelva a llamar",
  proposal_sent: "Propuesta enviada",
  contracted: "Contrata",
  rejected: "Rechaza la oferta",
  keeps_conditions: "Mantiene sus condiciones",
  wrong_contact: "Datos de contacto erróneos",
  do_not_contact: "No quiere que le contacten",
  other: "Otro",
};

/** Estado sugerido del lead tras un resultado (el comercial puede cambiarlo). */
export const SUGGESTED_STATUS_BY_OUTCOME: Record<ActivityOutcome, LeadStatus | null> = {
  no_answer: "no_answer",
  spoke: "follow_up",
  interested: "follow_up",
  info_requested: "follow_up",
  call_back: "follow_up",
  proposal_sent: "proposal_in_progress",
  contracted: "policy_contracted",
  rejected: "rejected",
  keeps_conditions: "rejected",
  wrong_contact: null,
  do_not_contact: "rejected",
  other: null,
};

/** Resultados tras los que conviene proponer un seguimiento. */
export const OUTCOMES_SUGGESTING_FOLLOW_UP: readonly ActivityOutcome[] = [
  "no_answer",
  "spoke",
  "interested",
  "info_requested",
  "call_back",
  "proposal_sent",
];
