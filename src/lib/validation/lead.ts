import { z } from "zod";
import { LEAD_PRIORITIES, LEAD_STATUSES, isClosedStatus } from "@/features/leads/constants";
import {
  listFromText,
  optionalEmail,
  optionalLocalDateTime,
  optionalPhone,
  optionalText,
  requiredText,
} from "@/lib/validation/common";

export const leadSchema = z
  .object({
    full_name: requiredText(200, "El nombre es obligatorio"),
    phone: optionalPhone,
    email: optionalEmail,
    locality: optionalText(120),
    customer_reference: optionalText(80),
    current_policies: listFromText,
    product_to_offer: optionalText(120),
    source: optionalText(120),
    status: z.enum(LEAD_STATUSES, "Selecciona un estado"),
    priority: z.enum(LEAD_PRIORITIES, "Selecciona una prioridad"),
    notes: optionalText(5000),
    received_at: optionalLocalDateTime,
    closed_reason: optionalText(500),
    // Solo al crear: primer seguimiento opcional.
    follow_up_title: optionalText(200),
    follow_up_due_at: optionalLocalDateTime,
  })
  .superRefine((v, ctx) => {
    if (v.follow_up_title && !v.follow_up_due_at) {
      ctx.addIssue({ code: "custom", path: ["follow_up_due_at"], message: "Indica cuándo hacer el seguimiento" });
    }
    if (v.follow_up_due_at && v.status === "do_not_contact") {
      ctx.addIssue({
        code: "custom",
        path: ["follow_up_due_at"],
        message: 'No se pueden programar seguimientos para "No contactar"',
      });
    }
  })
  // El motivo de cierre solo tiene sentido en estados de cierre (la BD también lo limpia).
  .transform((v) => (isClosedStatus(v.status) ? v : { ...v, closed_reason: null }));

export type LeadFormInput = z.input<typeof leadSchema>;
export type LeadFormOutput = z.output<typeof leadSchema>;

export const setLeadStatusSchema = z.object({
  lead_id: z.uuid(),
  status: z.enum(LEAD_STATUSES),
  closed_reason: optionalText(500),
});

export type SetLeadStatusInput = z.input<typeof setLeadStatusSchema>;
