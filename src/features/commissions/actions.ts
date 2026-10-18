"use server";

import { refresh } from "next/cache";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { commissionRulesSchema, type CommissionRulesInput } from "@/lib/validation/commission";

/**
 * Guarda las reglas de comisión del usuario: un porcentaje vacío elimina la regla.
 * Cambiar una regla no altera las comisiones ya calculadas (histórico estable).
 */
export async function saveCommissionRules(input: CommissionRulesInput): Promise<ActionResult> {
  const parsed = commissionRulesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { supabase, user } = ctx;

  for (const rule of parsed.data.rules) {
    let existing = supabase.from("commission_rules").select("id").eq("user_id", user.id);
    existing = rule.product_code ? existing.eq("product_code", rule.product_code) : existing.is("product_code", null);
    const { data: found, error: findError } = await existing.maybeSingle();
    if (findError) return fail(databaseErrorMessage(findError));

    if (rule.rate_percent === null) {
      if (found) {
        const { error } = await supabase.from("commission_rules").delete().eq("id", found.id).eq("user_id", user.id);
        if (error) return fail(databaseErrorMessage(error));
      }
    } else if (found) {
      const { error } = await supabase
        .from("commission_rules")
        .update({ rate_percent: rule.rate_percent })
        .eq("id", found.id)
        .eq("user_id", user.id);
      if (error) return fail(databaseErrorMessage(error));
    } else {
      const { error } = await supabase
        .from("commission_rules")
        .insert({ user_id: user.id, product_code: rule.product_code, rate_percent: rule.rate_percent });
      if (error) return fail(databaseErrorMessage(error));
    }
  }

  refresh();
  return ok(undefined, "Reglas de comisión guardadas");
}

/** Calcula la comisión de las pólizas que tienen valor pero aún no comisión (p. ej. tras crear la primera regla). */
export async function recalculateMissingCommissions(): Promise<ActionResult<{ updated: number }>> {
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { data, error } = await ctx.supabase.rpc("recalculate_missing_commissions");
  if (error) return fail(databaseErrorMessage(error));
  const updated = typeof data === "number" ? data : 0;
  refresh();
  return ok(
    { updated },
    updated === 0 ? "No había pólizas pendientes que se pudieran calcular." : `Comisión calculada en ${updated} ${updated === 1 ? "póliza" : "pólizas"}.`,
  );
}
