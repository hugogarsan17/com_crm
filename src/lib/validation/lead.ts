import { z } from "zod";
import { PRODUCT_CODE_RE } from "@/features/products/catalog";
import { FUNERAL_INSURANCE_OPTIONS, LEAD_PRIORITIES, LEAD_STATUSES, isClosedStatus } from "@/features/leads/constants";
import {
  optionalEmail,
  optionalLocalDateTime,
  optionalPhone,
  optionalText,
  optionalPostalCode,
  requiredText,
} from "@/lib/validation/common";

export const leadSchema = z
  .object({
    full_name: requiredText(200, "El nombre es obligatorio"),
    phone: optionalPhone,
    email: optionalEmail,
    postal_code: optionalPostalCode,
    locality: optionalText(120),
    // Número de póliza (columna customer_reference).
    customer_reference: optionalText(80),
    has_funeral_insurance: z.enum(FUNERAL_INSURANCE_OPTIONS, "Indica si tiene seguro de decesos"),
    // Producto del catálogo ("" = sin producto). La FK de la base de datos garantiza que existe.
    product_code: z
      .union([z.literal(""), z.string().regex(PRODUCT_CODE_RE, "Selecciona un producto del catálogo")])
      .transform((v) => (v === "" ? null : v)),
    status: z.enum(LEAD_STATUSES, "Selecciona un estado"),
    priority: z.enum(LEAD_PRIORITIES, "Selecciona una prioridad"),
    notes: optionalText(5000),
    received_at: optionalLocalDateTime,
    closed_reason: optionalText(500),
    // Solo al crear: fecha del primer seguimiento opcional.
    follow_up_due_at: optionalLocalDateTime,
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
