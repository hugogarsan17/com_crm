/**
 * Migración de octubre 2026 sobre datos existentes: estados retirados, pólizas
 * actuales → seguro de decesos, productos de texto libre → catálogo.
 * Se crea la base con el esquema anterior, se insertan datos y se aplican las
 * migraciones nuevas, comprobando que no se pierde ni invalida ningún registro.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrationsFrom, asUser, createTestDatabase, createUser, type TestDb } from "./harness";

const FIRST_NEW_MIGRATION = "20261018000100";

let db: TestDb;
let uid: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  db = await createTestDatabase({ before: FIRST_NEW_MIGRATION });
  uid = await createUser(db, "legacy@example.test", "Comercial Antiguo");

  const insert = async (key: string, sql: string, params: unknown[] = []) => {
    const res = await asUser(db, uid, () => db.query<{ id: string }>(sql, params));
    ids[key] = res.rows[0].id;
  };
  await insert("interested", "insert into public.leads (full_name, status, current_policies) values ('Interesado', 'interested', array['Decesos','Hogar']) returning id");
  await insert("keeps", "insert into public.leads (full_name, status, closed_reason, current_policies) values ('Mantiene', 'keeps_current_conditions', 'Contento', array['Ninguna']) returning id");
  await insert("dnc", "insert into public.leads (full_name, status, product_to_offer) values ('No llamar', 'do_not_contact', 'Seguro de Vida') returning id");
  await insert("normal", "insert into public.leads (full_name, status, customer_reference, product_to_offer, source) values ('Normal', 'follow_up', 'POL-77', 'Mascotas', 'Listado') returning id");
  await insert(
    "policy_legacy",
    "insert into public.policies (lead_id, product_name, premium_amount, estimated_commission) values ($1, 'test', 100, 9.99) returning id",
    [ids.normal],
  );
  await insert(
    "policy_vida",
    "insert into public.policies (lead_id, product_name, estimated_commission) values ($1, 'Seguro de vida', 12) returning id",
    [ids.normal],
  );
  // Fecha de cierre antigua para comprobar que no se mueve.
  await db.query("update public.leads set closed_at = '2026-09-15T10:00:00Z' where id = $1", [ids.keeps]);

  await applyMigrationsFrom(db, FIRST_NEW_MIGRATION);
});

describe("migración de estados retirados", () => {
  it("transforma cada estado con la correspondencia documentada y guarda el original", async () => {
    const res = await db.query<{ full_name: string; status: string; legacy_status: string | null }>(
      "select full_name, status::text, legacy_status from public.leads where user_id = $1 order by full_name",
      [uid],
    );
    expect(res.rows).toEqual([
      { full_name: "Interesado", status: "follow_up", legacy_status: "interested" },
      { full_name: "Mantiene", status: "rejected", legacy_status: "keeps_current_conditions" },
      { full_name: "No llamar", status: "rejected", legacy_status: "do_not_contact" },
      { full_name: "Normal", status: "follow_up", legacy_status: null },
    ]);
  });

  it("conserva la fecha y el motivo de cierre", async () => {
    const res = await db.query<{ closed_at: Date; closed_reason: string }>(
      "select closed_at, closed_reason from public.leads where id = $1",
      [ids.keeps],
    );
    expect(res.rows[0].closed_at.toISOString()).toBe("2026-09-15T10:00:00.000Z");
    expect(res.rows[0].closed_reason).toBe("Contento");
  });

  it("los estados retirados ya no se pueden usar", async () => {
    await asUser(db, uid, async () => {
      await expect(db.query("update public.leads set status = 'interested' where id = $1", [ids.normal])).rejects.toThrow(
        /invalid input value for enum/,
      );
    });
    const values = await db.query<{ v: string }>("select unnest(enum_range(null::public.lead_status))::text as v");
    expect(values.rows.map((r) => r.v)).toEqual([
      "pending_contact",
      "no_answer",
      "follow_up",
      "proposal_in_progress",
      "policy_contracted",
      "rejected",
    ]);
  });

  it("las fichas antes «No contactar» admiten seguimientos (ya no hay bloqueo)", async () => {
    await asUser(db, uid, () =>
      db.query("insert into public.tasks (lead_id, title, due_at) values ($1, 'Revisar', now() + interval '1 day')", [ids.dnc]),
    );
  });
});

describe("migración de campos", () => {
  it("deduce el seguro de decesos solo de datos explícitos", async () => {
    const res = await db.query<{ full_name: string; has_funeral_insurance: boolean | null }>(
      "select full_name, has_funeral_insurance from public.leads where user_id = $1 order by full_name",
      [uid],
    );
    expect(Object.fromEntries(res.rows.map((r) => [r.full_name, r.has_funeral_insurance]))).toEqual({
      Interesado: true,
      Mantiene: false,
      "No llamar": null,
      Normal: null,
    });
  });

  it("no borra las columnas antiguas ni sus datos", async () => {
    const res = await db.query<{ current_policies: string[]; source: string | null; product_to_offer: string | null; customer_reference: string | null }>(
      "select current_policies, source, product_to_offer, customer_reference from public.leads where id = $1",
      [ids.normal],
    );
    expect(res.rows[0]).toEqual({ current_policies: [], source: "Listado", product_to_offer: "Mascotas", customer_reference: "POL-77" });
    const legacy = await db.query<{ estimated_commission: string }>("select estimated_commission from public.policies where id = $1", [
      ids.policy_legacy,
    ]);
    expect(Number(legacy.rows[0].estimated_commission)).toBe(9.99);
  });

  it("asigna el producto del catálogo solo cuando el texto coincide", async () => {
    const leads = await db.query<{ full_name: string; product_code: string | null }>(
      "select full_name, product_code from public.leads where user_id = $1 order by full_name",
      [uid],
    );
    expect(leads.rows.find((r) => r.full_name === "No llamar")?.product_code).toBe("vida");
    expect(leads.rows.find((r) => r.full_name === "Normal")?.product_code).toBeNull();

    const policies = await db.query<{ id: string; product_code: string | null; product_name: string }>(
      "select id, product_code, product_name from public.policies where user_id = $1",
      [uid],
    );
    const byId = Object.fromEntries(policies.rows.map((p) => [p.id, p]));
    expect(byId[ids.policy_vida]).toMatchObject({ product_code: "vida", product_name: "Seguro de vida" });
    expect(byId[ids.policy_legacy]).toMatchObject({ product_code: null, product_name: "test" });
  });
});
