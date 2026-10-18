import { z } from "zod";
import { PRODUCT_CODE_RE } from "@/features/products/catalog";

const PERCENT_RE = /^\d{1,3}([.,]\d{1,2})?$/;

/** "2,5" / "2.5" / "10" → número; null si no es un porcentaje válido (0–100, máx. 2 decimales). */
export function parsePercent(raw: string): number | null {
  const v = raw.trim().replace(/\s|%/g, "");
  if (!PERCENT_RE.test(v)) return null;
  const n = Number(v.replace(",", "."));
  return n >= 0 && n <= 100 ? n : null;
}

export const commissionRuleSchema = z.object({
  // "" = regla general.
  product_code: z.union([z.literal(""), z.string().regex(PRODUCT_CODE_RE)]).transform((v) => (v === "" ? null : v)),
  rate_percent: z
    .string()
    .trim()
    .refine((v) => v === "" || parsePercent(v) !== null, "Porcentaje no válido (de 0 a 100, hasta 2 decimales)")
    .transform((v) => (v === "" ? null : parsePercent(v))),
});

export const commissionRulesSchema = z.object({
  rules: z.array(commissionRuleSchema).max(100),
});

export type CommissionRulesInput = z.input<typeof commissionRulesSchema>;
