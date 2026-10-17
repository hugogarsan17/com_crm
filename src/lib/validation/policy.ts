import { z } from "zod";
import { COMMISSION_STATUSES } from "@/features/policies/constants";
import { optionalLocalDate, optionalMoney, optionalText, requiredText } from "@/lib/validation/common";

export const policySchema = z
  .object({
    lead_id: z.uuid(),
    product_name: requiredText(120, "Indica el producto contratado"),
    contracted_at: optionalLocalDate,
    premium_amount: optionalMoney,
    estimated_commission: optionalMoney,
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
