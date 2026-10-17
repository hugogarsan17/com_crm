import { describe, expect, it } from "vitest";
import { emptyLeadFormValues } from "@/features/leads/form-values";
import { logActivitySchema } from "./activity";
import { registerSchema } from "./auth";
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

  it("convierte vacíos en null y la lista de pólizas en array", () => {
    const out = leadSchema.parse(lead({ current_policies: "Auto, hogar; Auto", email: "ANA@EXAMPLE.COM" }));
    expect(out.current_policies).toEqual(["Auto", "hogar"]);
    expect(out.email).toBe("ana@example.com");
    expect(out.phone).toBeNull();
  });

  it("rechaza fechas no válidas y seguimientos para 'No contactar'", () => {
    expect(errorPaths(leadSchema.safeParse(lead({ received_at: "2026-02-30T10:00" })))).toContain("received_at");
    expect(
      errorPaths(leadSchema.safeParse(lead({ status: "do_not_contact", follow_up_due_at: "2026-11-01T10:00" }))),
    ).toContain("follow_up_due_at");
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
    product_name: "Hogar",
    contracted_at: "",
    premium_amount: "",
    estimated_commission: "",
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
    const ok = policySchema.parse(policy({ commission_status: "paid", confirmed_commission: "30,00", estimated_commission: "32" }));
    expect(ok.confirmed_commission).toBe(30);
    expect(ok.estimated_commission).toBe(32);
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

  it("no permite seguimiento si el nuevo estado es 'No contactar'", () => {
    const r = logActivitySchema.safeParse({ ...base, new_status: "do_not_contact", follow_up_due_at: "2026-10-18T10:00" });
    expect(errorPaths(r)).toContain("schedule_follow_up");
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
