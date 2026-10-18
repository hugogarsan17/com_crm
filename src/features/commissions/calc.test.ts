import { describe, expect, it } from "vitest";
import { calculateCommission, findCommissionRate, previewCommission, sumCommissions } from "./calc";

describe("cálculo de comisión", () => {
  const rules = [
    { product_code: null, rate_percent: 10 },
    { product_code: "decesos", rate_percent: 12.5 },
  ];

  it("usa la regla del producto y, si no hay, la general", () => {
    expect(findCommissionRate(rules, "decesos")).toBe(12.5);
    expect(findCommissionRate(rules, "hogar")).toBe(10);
    expect(findCommissionRate([], "hogar")).toBeNull();
  });

  it("redondea a céntimos sin errores de coma flotante", () => {
    expect(calculateCommission(1000, 12.5)).toBe(125);
    expect(calculateCommission(0.1 + 0.2, 100)).toBe(0.3);
    // 10,05 × 50 % = 5,025 → 5,03 (mitad hacia arriba, como round() de Postgres)
    expect(calculateCommission(10.05, 50)).toBe(5.03);
    expect(calculateCommission(333.33, 3.33)).toBe(11.1);
    expect(calculateCommission(9_999_999_999.99, 99.99)).toBe(9_998_999_999.99);
  });

  it("se recalcula al cambiar el valor de póliza", () => {
    expect(calculateCommission(200, 10)).toBe(20);
    expect(calculateCommission(250, 10)).toBe(25);
  });

  it("indica por qué no se puede calcular", () => {
    expect(previewCommission(rules, "hogar", null)).toEqual({ status: "missing_value" });
    expect(previewCommission([], "hogar", 100)).toEqual({ status: "missing_rule" });
    expect(previewCommission(rules, "decesos", 80)).toEqual({ status: "ok", rate: 12.5, commission: 10 });
    expect(calculateCommission(100, null)).toBeNull();
  });

  it("suma en céntimos y cuenta las pólizas sin comisión", () => {
    const totals = sumCommissions([
      { calculated_commission: 0.1, confirmed_commission: null, commission_status: "pending" },
      { calculated_commission: 0.2, confirmed_commission: 0.2, commission_status: "confirmed" },
      { calculated_commission: null, confirmed_commission: 5, commission_status: "pending" },
    ]);
    expect(totals).toEqual({ calculated: 0.3, confirmed: 0.2, missing: 1 });
  });
});
