import type { NextRequest } from "next/server";
import { conversionRate, resolvePeriod } from "@/features/reports/period";
import { getReport } from "@/features/reports/queries";
import { PRODUCT_CODE_RE, productLabel } from "@/features/products/catalog";
import { getProducts } from "@/features/products/queries";
import { getCurrentUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(
    {
      period: sp.get("period") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      month: sp.get("month") ?? undefined,
    },
    user.timezone,
  );
  const rawProduct = sp.get("product");
  const product = rawProduct && PRODUCT_CODE_RE.test(rawProduct) ? rawProduct : undefined;
  const [r, products] = await Promise.all([getReport(period, product), getProducts()]);
  const conv = conversionRate(r.leads_with_policy, r.leads_contacted);

  const rows: (string | number)[][] = [
    ["Periodo", `${period.from} a ${period.to}`],
    ["Producto", product ? productLabel(products, product) : "Todos"],
    ["Fichas recibidas", r.leads_received],
    ["Intentos de contacto", r.contact_attempts],
    ["Fichas contactadas", r.leads_contacted],
    ["Fichas con las que se habló", r.leads_reached],
    ["Pólizas contratadas", r.policies_contracted],
    ["Fichas con póliza", r.leads_with_policy],
    ["Rechazos", r.rejected],
    ["Conversión (fichas con póliza / contactadas)", conv == null ? "" : `${(conv * 100).toFixed(1).replace(".", ",")} %`],
    ["Primas", r.premium_total],
    ["Valor de pólizas", r.policy_value_total],
    ["Comisión calculada", r.calculated_commission],
    ["Pólizas sin comisión calculada", r.policies_without_commission],
    ["Comisión confirmada", r.confirmed_commission],
    ["Comisión pagada", r.paid_commission],
    [],
    ["Producto", "Pólizas", "Primas", "Valor de póliza", "Comisión calculada", "Comisión confirmada", "Comisión pagada"],
    ...r.by_product.map((p) => [
      p.product, p.policies, p.premium_total, p.policy_value_total, p.calculated_commission, p.confirmed_commission, p.paid_commission,
    ]),
  ];
  return csvResponse(`informe-${period.from}-${period.to}.csv`, toCsv(["Indicador", "Valor"], rows));
}
