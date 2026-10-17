import type { NextRequest } from "next/server";
import { conversionRate, resolvePeriod } from "@/features/reports/period";
import { getReport } from "@/features/reports/queries";
import { getCurrentUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(
    { period: sp.get("period") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined },
    user.timezone,
  );
  const product = sp.get("product") || undefined;
  const r = await getReport(period, product);
  const conv = conversionRate(r.leads_with_policy, r.leads_contacted);

  const rows: (string | number)[][] = [
    ["Periodo", `${period.from} a ${period.to}`],
    ["Producto", product ?? "Todos"],
    ["Fichas recibidas", r.leads_received],
    ["Intentos de contacto", r.contact_attempts],
    ["Fichas contactadas", r.leads_contacted],
    ["Fichas con las que se habló", r.leads_reached],
    ["Pólizas contratadas", r.policies_contracted],
    ["Fichas con póliza", r.leads_with_policy],
    ["Rechazos", r.rejected],
    ["Mantienen condiciones", r.keeps_conditions],
    ["Conversión (fichas con póliza / contactadas)", conv == null ? "" : `${(conv * 100).toFixed(1).replace(".", ",")} %`],
    ["Primas", r.premium_total],
    ["Comisión estimada", r.estimated_commission],
    ["Comisión confirmada", r.confirmed_commission],
    ["Comisión pagada", r.paid_commission],
    [],
    ["Producto", "Pólizas", "Primas", "Comisión estimada", "Comisión confirmada", "Comisión pagada"],
    ...r.by_product.map((p) => [p.product, p.policies, p.premium_total, p.estimated_commission, p.confirmed_commission, p.paid_commission]),
  ];
  return csvResponse(`informe-${period.from}-${period.to}.csv`, toCsv(["Indicador", "Valor"], rows));
}
