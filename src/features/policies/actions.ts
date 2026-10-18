"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { policySchema, type PolicyInput } from "@/lib/validation/policy";

function toPolicyRow(v: z.output<typeof policySchema>, productLabel: string) {
  return {
    product_code: v.product_code,
    // Copia de la etiqueta del catálogo (compatibilidad con exportaciones e informes antiguos).
    product_name: productLabel,
    contracted_at: v.contracted_at,
    premium_amount: v.premium_amount,
    policy_value: v.policy_value,
    confirmed_commission: v.confirmed_commission,
    commission_status: v.commission_status,
    notes: v.notes,
  };
}

/**
 * Registra o edita una póliza. La comisión calculada la obtiene la base de datos
 * (trigger) a partir del valor de póliza y la regla configurada del usuario.
 */
export async function savePolicy(
  policyId: string | null,
  input: PolicyInput,
): Promise<ActionResult<{ id: string; calculatedCommission: number | null }>> {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  if (policyId !== null && !z.uuid().safeParse(policyId).success) return fail("Póliza no válida.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { supabase, user } = ctx;
  const v = parsed.data;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("label, active")
    .eq("code", v.product_code)
    .maybeSingle();
  if (productError) return fail(databaseErrorMessage(productError));
  if (!product) return fail("Revisa los campos marcados.", { product_code: ["Selecciona un producto del catálogo"] });

  let saved: { id: string; policy_value: number | null; calculated_commission: number | null };
  if (policyId) {
    const { data, error } = await supabase
      .from("policies")
      .update(toPolicyRow(v, product.label))
      .eq("id", policyId)
      .eq("user_id", user.id)
      .select("id, policy_value, calculated_commission")
      .maybeSingle();
    if (error) return fail(databaseErrorMessage(error));
    if (!data) return fail("No se ha encontrado la póliza.");
    saved = data;
  } else {
    if (!product.active) return fail("Revisa los campos marcados.", { product_code: ["Este producto ya no está disponible"] });
    const { data, error } = await supabase
      .from("policies")
      .insert({ ...toPolicyRow(v, product.label), lead_id: v.lead_id, user_id: user.id })
      .select("id, policy_value, calculated_commission")
      .single();
    if (error || !data) return fail(databaseErrorMessage(error));
    saved = data;
  }
  const id = saved.id;
  const calculatedCommission = saved.calculated_commission == null ? null : Number(saved.calculated_commission);
  const commissionNote =
    saved.policy_value != null && calculatedCommission == null
      ? " La comisión no se ha calculado porque no hay ningún porcentaje configurado para este producto (Ajustes → Comisiones)."
      : "";

  if (v.mark_lead_contracted) {
    const { error } = await supabase
      .from("leads")
      .update({ status: "policy_contracted" })
      .eq("id", v.lead_id)
      .eq("user_id", user.id)
      .neq("status", "policy_contracted");
    if (error) {
      refresh();
      return ok({ id, calculatedCommission }, `Póliza guardada, pero no se pudo actualizar el estado de la ficha.${commissionNote}`);
    }
  }

  refresh();
  return ok({ id, calculatedCommission }, `${policyId ? "Póliza actualizada" : "Póliza registrada"}.${commissionNote}`);
}

export async function deletePolicy(policyId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(policyId).success) return fail("Póliza no válida.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { data, error } = await ctx.supabase
    .from("policies")
    .delete()
    .eq("id", policyId)
    .eq("user_id", ctx.user.id)
    .select("id");
  if (error) return fail(databaseErrorMessage(error));
  if (!data?.length) return fail("No se ha encontrado la póliza.");
  refresh();
  return ok(undefined, "Póliza eliminada");
}
