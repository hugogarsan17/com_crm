import { z } from "zod";
import { LEAD_PRIORITIES } from "@/features/leads/constants";
import { isValidEmail, isValidPhone } from "@/lib/validation/common";

/** Fila ya normalizada lista para insertar (se valida de nuevo en servidor). */
export const importRowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30).refine(isValidPhone).nullable(),
  email: z.string().trim().refine(isValidEmail).nullable(),
  locality: z.string().trim().max(120).nullable(),
  customer_reference: z.string().trim().max(80).nullable(),
  current_policies: z.array(z.string().trim().min(1).max(80)).max(30),
  product_to_offer: z.string().trim().max(120).nullable(),
  source: z.string().trim().max(120).nullable(),
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
