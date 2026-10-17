"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { policySchema, type PolicyInput } from "@/lib/validation/policy";

function toPolicyRow(v: z.output<typeof policySchema>) {
  return {
    product_name: v.product_name,
    contracted_at: v.contracted_at,
    premium_amount: v.premium_amount,
    estimated_commission: v.estimated_commission,
    confirmed_commission: v.confirmed_commission,
    commission_status: v.commission_status,
    notes: v.notes,
  };
}

/** Registra una póliza con importes introducidos manualmente (sin cálculo automático de comisión). */
export async function savePolicy(policyId: string | null, input: PolicyInput): Promise<ActionResult<{ id: string }>> {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  if (policyId !== null && !z.uuid().safeParse(policyId).success) return fail("Póliza no válida.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { supabase, user } = ctx;
  const v = parsed.data;

  let id: string;
  if (policyId) {
    const { data, error } = await supabase
      .from("policies")
      .update(toPolicyRow(v))
      .eq("id", policyId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(databaseErrorMessage(error));
    if (!data) return fail("No se ha encontrado la póliza.");
    id = data.id;
  } else {
    const { data, error } = await supabase
      .from("policies")
      .insert({ ...toPolicyRow(v), lead_id: v.lead_id, user_id: user.id })
      .select("id")
      .single();
    if (error || !data) return fail(databaseErrorMessage(error));
    id = data.id;
  }

  if (v.mark_lead_contracted) {
    const { error } = await supabase
      .from("leads")
      .update({ status: "policy_contracted" })
      .eq("id", v.lead_id)
      .eq("user_id", user.id)
      .neq("status", "policy_contracted");
    if (error) {
      refresh();
      return ok({ id }, "Póliza guardada, pero no se pudo actualizar el estado de la ficha.");
    }
  }

  refresh();
  return ok({ id }, policyId ? "Póliza actualizada" : "Póliza registrada");
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
