import { z } from "zod";
import { LEAD_PRIORITIES } from "@/features/leads/constants";
import { isValidPostalCode } from "@/features/postal-codes/spain";
import { PRODUCT_CODE_RE } from "@/features/products/catalog";
import { isValidEmail, isValidPhone } from "@/lib/validation/common";

/** Fila ya normalizada lista para insertar (se valida de nuevo en servidor). */
export const importRowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30).refine(isValidPhone).nullable(),
  email: z.string().trim().refine(isValidEmail).nullable(),
  postal_code: z.string().trim().refine(isValidPostalCode).nullable(),
  locality: z.string().trim().max(120).nullable(),
  // Número de póliza.
  customer_reference: z.string().trim().max(80).nullable(),
  has_funeral_insurance: z.boolean().nullable(),
  product_code: z.string().regex(PRODUCT_CODE_RE).nullable(),
  priority: z.enum(LEAD_PRIORITIES),
  notes: z.string().trim().max(5000).nullable(),
  received_at: z.iso.datetime({ offset: true }).nullable(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export const IMPORT_BATCH_SIZE = 500;

export const importBatchSchema = z.array(importRowSchema).min(1).max(IMPORT_BATCH_SIZE);

export const duplicateCheckSchema = z.object({
  phones: z.array(z.string().max(20)).max(20_000),
  emails: z.array(z.string().max(254)).max(20_000),
  references: z.array(z.string().max(80)).max(20_000),
});
