import { z } from "zod";
import { FUNERAL_INSURANCE_OPTIONS, LEAD_PRIORITIES } from "@/features/leads/constants";
import { PRODUCT_CODE_RE } from "@/features/products/catalog";
import {
  optionalLocalDate,
  optionalLocalDateTime,
  optionalMoney,
  optionalPhone,
  optionalPostalCode,
  optionalText,
  requiredText,
} from "@/lib/validation/common";

const optionalAge = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) <= 130), "Edad no válida")
  .transform((v) => (v === "" ? null : Number(v)));

const optionalOrder = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[1-9]\d?$/.test(v), "Número de orden no válido")
  .transform((v) => (v === "" ? null : Number(v)));

export const coverageRowSchema = z.object({
  nombre: requiredText(80, "Indica la garantía"),
  estado: optionalText(20),
});

export const insuredRowSchema = z.object({
  orden: optionalOrder,
  nombre: requiredText(80, "Indica el nombre"),
  edad_real: optionalAge,
  edad_derecho: optionalAge,
  baja: optionalLocalDate,
  motivo: optionalText(10),
});

/**
 * Pantalla de revisión del escaneo de «Consulta abreviada». Los mismos datos se
 * validan en el cliente y en el servidor. No incluye DNI, IBAN ni domicilio de cobro.
 */
export const scanReviewSchema = z
  .object({
    lead: z.object({
      full_name: requiredText(200, "El nombre es obligatorio"),
      phone: optionalPhone,
      secondary_phone: optionalPhone,
      address: optionalText(200),
      postal_code: optionalPostalCode,
      locality: optionalText(120),
      // Número de póliza: se guarda en la ficha (customer_reference) y en la póliza del cliente.
      customer_reference: optionalText(40),
      has_funeral_insurance: z.enum(FUNERAL_INSURANCE_OPTIONS, "Indica si tiene seguro de decesos"),
      product_code: z
        .union([z.literal(""), z.string().regex(PRODUCT_CODE_RE, "Selecciona un producto del catálogo")])
        .transform((v) => (v === "" ? null : v)),
      priority: z.enum(LEAD_PRIORITIES, "Selecciona una prioridad"),
      notes: optionalText(5000),
    }),
    policy: z.object({
      product_reference: z
        .string()
        .trim()
        .refine((v) => v === "" || /^\d{1,20}$/.test(v), "Código de producto no válido (solo números)")
        .transform((v) => (v === "" ? null : v)),
      effect_date: optionalLocalDate,
      policy_type: optionalText(60),
      payment_frequency: optionalText(10),
      status_code: optionalText(10),
      cancel_date: optionalLocalDate,
      covered_until: optionalLocalDate,
      annual_premium: optionalMoney,
      first_receipt_amount: optionalMoney,
      next_receipt_amount: optionalMoney,
      consulted_at: optionalLocalDateTime,
    }),
    coverages: z.array(coverageRowSchema).max(100),
    insured: z.array(insuredRowSchema).max(100),
    task: z.object({
      enabled: z.boolean(),
      title: optionalText(200),
      due_at: optionalLocalDateTime,
    }),
  })
  .superRefine((v, ctx) => {
    if (v.task.enabled && !v.task.title) {
      ctx.addIssue({ code: "custom", path: ["task", "title"], message: "Indica qué hay que hacer" });
    }
    if (v.task.enabled && !v.task.due_at) {
      ctx.addIssue({ code: "custom", path: ["task", "due_at"], message: "Indica el día y la hora" });
    }
  });

export type ScanReviewInput = z.input<typeof scanReviewSchema>;
export type ScanReviewOutput = z.output<typeof scanReviewSchema>;
