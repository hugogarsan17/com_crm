import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { ResolvedPeriod } from "./period";

const num = z.coerce.number().catch(0);

const reportSchema = z.object({
  leads_received: num,
  contact_attempts: num,
  leads_contacted: num,
  leads_reached: num,
  policies_contracted: num,
  leads_with_policy: num,
  rejected: num,
  keeps_conditions: num,
  premium_total: num,
  estimated_commission: num,
  confirmed_commission: num,
  paid_commission: num,
  by_product: z
    .array(
      z.object({
        product: z.string(),
        policies: num,
        premium_total: num,
        estimated_commission: num,
        confirmed_commission: num,
        paid_commission: num,
      }),
    )
    .catch([]),
});

export type Report = z.infer<typeof reportSchema>;

const dashboardSchema = z.object({
  pending_contact: num,
  interested: num,
  open_without_next_action: num,
  follow_ups_today: num,
  follow_ups_overdue: num,
  leads_received: num,
  policies_contracted: num,
  rejected: num,
  keeps_conditions: num,
  estimated_commission: num,
  confirmed_commission: num,
  paid_commission: num,
});

export type DashboardSummary = z.infer<typeof dashboardSchema>;

const seriesSchema = z.array(
  z.object({
    bucket: z.string(),
    contacted: num,
    contracted: num,
    rejected: num,
    keeps_conditions: num,
  }),
);

export type ResultsSeries = z.infer<typeof seriesSchema>;

export async function getReport(period: ResolvedPeriod, product?: string) {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_report", {
    p_from: period.from,
    p_to: period.to,
    p_tz: user.timezone,
    p_product: product ?? null,
  });
  if (error) throw new Error("No se pudo generar el informe.");
  return reportSchema.parse(data);
}

export async function getDashboardSummary(period: ResolvedPeriod) {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_from: period.from,
    p_to: period.to,
    p_tz: user.timezone,
  });
  if (error) throw new Error("No se pudo cargar el resumen.");
  return dashboardSchema.parse(data);
}

export async function getResultsSeries(period: ResolvedPeriod) {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_results_series", {
    p_from: period.from,
    p_to: period.to,
    p_tz: user.timezone,
    p_bucket: period.bucket,
  });
  if (error) throw new Error("No se pudo cargar la evolución.");
  return seriesSchema.parse(data);
}
