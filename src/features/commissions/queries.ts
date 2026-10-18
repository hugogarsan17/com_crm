import "server-only";
import { requireUser } from "@/lib/auth";
import type { CommissionRule } from "./calc";

/** Reglas de comisión del usuario (RLS: solo las propias). */
export async function getCommissionRules(): Promise<(CommissionRule & { id: string })[]> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("commission_rules")
    .select("id, product_code, rate_percent")
    .eq("user_id", user.id)
    .order("product_code", { ascending: true, nullsFirst: true });
  if (error) throw new Error("No se pudieron cargar las reglas de comisión.");
  return data.map((r) => ({ ...r, rate_percent: Number(r.rate_percent) }));
}
