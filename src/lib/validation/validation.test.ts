import { describe, expect, it } from "vitest";
import { emptyLeadFormValues } from "@/features/leads/form-values";
import { logActivitySchema } from "./activity";
import { changePasswordSchema, registerSchema } from "./auth";
import { parsePercent } from "./commission";
import { parseMoney } from "./common";
import { leadSchema } from "./lead";
import { policySchema } from "./policy";

const lead = (patch: Record<string, unknown> = {}) => ({ ...emptyLeadFormValues(), full_name: "Ana Demo", ...patch });

function errorPaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.success ? [] : result.error!.issues.map((i) => i.path.join("."));
}

describe("leadSchema", () => {
  it("exige el nombre", () => {
    expect(errorPaths(leadSchema.safeParse(lead({ full_name: "  " })))).toContain("full_name");
  });

  it("valida email y teléfono solo si se introducen", () => {
    expect(leadSchema.safeParse(lead()).success).toBe(true);
    expect(errorPaths(leadSchema.safeParse(lead({ email: "no-es-email" })))).toContain("email");
    expect(errorPaths(leadSchema.safeParse(lead({ phone: "12ab" })))).toContain("phone");
    expect(errorPaths(leadSchema.safeParse(lead({ phone: "123" })))).toContain("phone");
    expect(leadSchema.safeParse(lead({ phone: "+34 (600) 12-34.56" })).success).toBe(true);
  });

  it("convierte vacíos en null", () => {
    const out = leadSchema.parse(lead({ email: "ANA@EXAMPLE.COM" }));
    expect(out.email).toBe("ana@example.com");
    expect(out.phone).toBeNull();
    expect(out.postal_code).toBeNull();
    expect(out.customer_reference).toBeNull();
    expect(out.product_code).toBeNull();
  });

  it("guarda el número de póliza", () => {
    expect(leadSchema.parse(lead({ customer_reference: "  POL-2026-001 " })).customer_reference).toBe("POL-2026-001");
    expect(errorPaths(leadSchema.safeParse(lead({ customer_reference: "x".repeat(81) })))).toContain("customer_reference");
  });

  it("acepta sí, no y sin indicar en el seguro de decesos", () => {
    for (const v of ["yes", "no", "unknown"]) {
      expect(leadSchema.parse(lead({ has_funeral_insurance: v })).has_funeral_insurance).toBe(v);
    }
    expect(errorPaths(leadSchema.safeParse(lead({ has_funeral_insurance: "" })))).toContain("has_funeral_insurance");
    expect(errorPaths(leadSchema.safeParse(lead({ has_funeral_insurance: true })))).toContain("has_funeral_insurance");
  });

  it("valida el código postal español sin bloquear los extranjeros", () => {
    expect(leadSchema.parse(lead({ postal_code: " 28001 " })).postal_code).toBe("28001");
    expect(leadSchema.parse(lead({ postal_code: "sw1a 1aa" })).postal_code).toBe("SW1A 1AA");
    expect(leadSchema.parse(lead({ postal_code: "1000" })).postal_code).toBe("1000");
    expect(errorPaths(leadSchema.safeParse(lead({ postal_code: "28/001" })))).toContain("postal_code");
    expect(errorPaths(leadSchema.safeParse(lead({ postal_code: "1" })))).toContain("postal_code");
  });

  it("solo admite productos con código de catálogo", () => {
    expect(leadSchema.parse(lead({ product_code: "decesos" })).product_code).toBe("decesos");
    expect(errorPaths(leadSchema.safeParse(lead({ product_code: "Seguro de lo que sea" })))).toContain("product_code");
  });

  it("no admite los estados retirados", () => {
    for (const status of ["interested", "keeps_current_conditions", "do_not_contact"]) {
      expect(errorPaths(leadSchema.safeParse(lead({ status })))).toContain("status");
    }
  });

  it("rechaza fechas no válidas", () => {
    expect(errorPaths(leadSchema.safeParse(lead({ received_at: "2026-02-30T10:00" })))).toContain("received_at");
  });

  it("descarta el motivo de cierre en estados abiertos", () => {
    expect(leadSchema.parse(lead({ status: "follow_up", closed_reason: "x" })).closed_reason).toBeNull();
    expect(leadSchema.parse(lead({ status: "rejected", closed_reason: "Precio" })).closed_reason).toBe("Precio");
  });
});

describe("importes", () => {
  it("interpreta formatos españoles", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("125,5")).toBe(125.5);
    expect(parseMoney("99.90")).toBe(99.9);
    expect(parseMoney("12,345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });

  const policy = (patch: Record<string, unknown> = {}) => ({
    lead_id: "6f1c2a52-1d1e-4a3b-9c55-0f4f0f0f0f0f",
    product_code: "hogar",
    contracted_at: "",
    premium_amount: "",
    policy_value: "",
    confirmed_commission: "",
    commission_status: "pending",
    notes: "",
    mark_lead_contracted: true,
    ...patch,
  });

  it("rechaza importes negativos", () => {
    const r = policySchema.safeParse(policy({ premium_amount: "-10" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/negativo/);
  });

  it("exige comisión confirmada para estados confirmada/pagada", () => {
    expect(errorPaths(policySchema.safeParse(policy({ commission_status: "paid" })))).toContain("confirmed_commission");
    const ok = policySchema.parse(policy({ commission_status: "paid", confirmed_commission: "30,00", policy_value: "1.200,50" }));
    expect(ok.confirmed_commission).toBe(30);
    expect(ok.policy_value).toBe(1200.5);
  });

  it("exige un producto del catálogo", () => {
    expect(errorPaths(policySchema.safeParse(policy({ product_code: "" })))).toContain("product_code");
    expect(errorPaths(policySchema.safeParse(policy({ product_code: "Texto libre" })))).toContain("product_code");
  });

  it("interpreta porcentajes de comisión", () => {
    expect(parsePercent("2,5")).toBe(2.5);
    expect(parsePercent("10 %")).toBe(10);
    expect(parsePercent("100")).toBe(100);
    expect(parsePercent("100,01")).toBeNull();
    expect(parsePercent("1,234")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
});

describe("logActivitySchema", () => {
  const base = {
    lead_id: "6f1c2a52-1d1e-4a3b-9c55-0f4f0f0f0f0f",
    channel: "call",
    outcome: "call_back",
    occurred_at: "2026-10-17T10:00",
    summary: "",
    new_status: "",
    closed_reason: "",
    schedule_follow_up: true,
    follow_up_title: "",
    follow_up_due_at: "",
  };

  it("exige fecha de seguimiento si se programa", () => {
    expect(errorPaths(logActivitySchema.safeParse(base))).toContain("follow_up_due_at");
    expect(logActivitySchema.safeParse({ ...base, follow_up_due_at: "2026-10-18T10:00" }).success).toBe(true);
  });

  it("no admite estados retirados como nuevo estado", () => {
    const r = logActivitySchema.safeParse({ ...base, new_status: "do_not_contact", follow_up_due_at: "2026-10-18T10:00" });
    expect(errorPaths(r)).toContain("new_status");
  });
});

describe("changePasswordSchema", () => {
  const base = { current_password: "actual123", password: "nueva1234", confirm_password: "nueva1234" };
  it("valida la nueva contraseña, su confirmación y que sea distinta de la actual", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
    expect(errorPaths(changePasswordSchema.safeParse({ ...base, current_password: "" }))).toContain("current_password");
    expect(errorPaths(changePasswordSchema.safeParse({ ...base, password: "corta", confirm_password: "corta" }))).toContain("password");
    expect(errorPaths(changePasswordSchema.safeParse({ ...base, confirm_password: "otra12345" }))).toContain("confirm_password");
    expect(
      errorPaths(changePasswordSchema.safeParse({ current_password: "igual1234", password: "igual1234", confirm_password: "igual1234" })),
    ).toContain("password");
  });
});

describe("registerSchema", () => {
  const base = { full_name: "Ana", email: "ana@example.com", password: "secreto123", confirm_password: "secreto123" };
  it("exige contraseña fuerte y coincidente", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(errorPaths(registerSchema.safeParse({ ...base, password: "corta", confirm_password: "corta" }))).toContain("password");
    expect(errorPaths(registerSchema.safeParse({ ...base, password: "soloLetras", confirm_password: "soloLetras" }))).toContain("password");
    expect(errorPaths(registerSchema.safeParse({ ...base, confirm_password: "otra12345" }))).toContain("confirm_password");
  });
});
