/**
 * Cálculo de comisión: valor de póliza × porcentaje / 100, redondeado a 2 decimales
 * (mitades alejándose de cero), con aritmética entera en céntimos para evitar errores
 * de coma flotante. La fuente de verdad es el trigger policies_calculate_commission
 * (SQL numeric); esta función replica exactamente su resultado para la vista previa.
 */
export type CommissionRule = { product_code: string | null; rate_percent: number };

export function toCents(amount: number) {
  return Math.round(amount * 100);
}

/** Regla aplicable: la del producto y, si no existe, la general (product_code null). */
export function findCommissionRate(rules: readonly CommissionRule[], productCode: string | null | undefined): number | null {
  const specific = productCode ? rules.find((r) => r.product_code === productCode) : undefined;
  const general = rules.find((r) => r.product_code === null);
  return (specific ?? general)?.rate_percent ?? null;
}

export function calculateCommission(policyValue: number | null | undefined, ratePercent: number | null | undefined): number | null {
  if (policyValue == null || ratePercent == null) return null;
  if (policyValue < 0 || ratePercent < 0) return null;
  const valueCents = BigInt(toCents(policyValue));
  const rateBasisPoints = BigInt(Math.round(ratePercent * 100));
  // céntimos × puntos básicos / 10 000, redondeo de la mitad hacia arriba (valores no negativos).
  const scaled = valueCents * rateBasisPoints;
  // (Sin literales 10n: el target de TypeScript es ES2017.)
  const cents = (scaled * BigInt(2) + BigInt(10_000)) / BigInt(20_000);
  return Number(cents) / 100;
}

export type CommissionPreview =
  | { status: "ok"; rate: number; commission: number }
  | { status: "missing_value" }
  | { status: "missing_rule" };

export function previewCommission(rules: readonly CommissionRule[], productCode: string | null | undefined, policyValue: number | null): CommissionPreview {
  if (policyValue == null) return { status: "missing_value" };
  const rate = findCommissionRate(rules, productCode);
  if (rate == null) return { status: "missing_rule" };
  return { status: "ok", rate, commission: calculateCommission(policyValue, rate)! };
}

/** Totales de una lista de pólizas, sumando en céntimos. */
export function sumCommissions(
  policies: readonly { calculated_commission: number | null; confirmed_commission: number | null; commission_status: string }[],
) {
  let calculated = 0;
  let confirmed = 0;
  let missing = 0;
  for (const p of policies) {
    if (p.calculated_commission == null) missing += 1;
    else calculated += toCents(p.calculated_commission);
    if (p.commission_status !== "pending" && p.confirmed_commission != null) confirmed += toCents(p.confirmed_commission);
  }
  return { calculated: calculated / 100, confirmed: confirmed / 100, missing };
}
