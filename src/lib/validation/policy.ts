import { z } from "zod";
import { COMMISSION_STATUSES } from "@/features/policies/constants";
import { PRODUCT_CODE_RE } from "@/features/products/catalog";
import { optionalLocalDate, optionalMoney, optionalText } from "@/lib/validation/common";

export const policySchema = z
  .object({
    lead_id: z.uuid(),
    product_code: z.string().trim().regex(PRODUCT_CODE_RE, "Selecciona un producto del catálogo"),
    contracted_at: optionalLocalDate,
    premium_amount: optionalMoney,
    // Valor de póliza: base del cálculo automático de comisión.
    policy_value: optionalMoney,
    confirmed_commission: optionalMoney,
    commission_status: z.enum(COMMISSION_STATUSES, "Selecciona el estado de la comisión"),
    notes: optionalText(2000),
    mark_lead_contracted: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.commission_status !== "pending" && v.confirmed_commission == null) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmed_commission"],
        message: "Indica la comisión confirmada para marcarla como confirmada o pagada",
      });
    }
  });

export type PolicyInput = z.input<typeof policySchema>;
