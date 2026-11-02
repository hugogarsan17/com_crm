/**
 * Escaneo de «Consulta abreviada» (noviembre 2026): pólizas del cliente, alta atómica
 * desde el escaneo, nuevas columnas de la ficha y aislamiento entre usuarios.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, createUser, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;

const lead = {
  full_name: "María Demo Ejemplo",
  phone: "600 111 222",
  secondary_phone: "911 222 333",
  address: "C/ Inventada 1, 2º B",
  postal_code: "08001",
  locality: "Barcelona",
  customer_reference: "0099887766",
  has_funeral_insurance: true,
  notes: null,
};

const policy = {
  policy_number: "0099887766",
  product_reference: "25001",
  effect_date: "2019-03-01",
  policy_type: "INDIVIDUAL",
  payment_frequency: "MEN",
  status_code: "VI",
  cancel_date: null,
  covered_until: "2026-12-31",
  annual_premium: 245.4,
  first_receipt_amount: 20.45,
  next_receipt_amount: 20.45,
  consulted_at: "2026-11-02T09:15:32Z",
  coverages: [{ nombre: "SER.DECESOS", estado: "SEG.POL." }],
  insured: [{ orden: 1, nombre: "DEMO EJEMPLO MARIA", edad_real: 54, edad_derecho: 54, baja: null, motivo: null }],
};

async function createFromScan(userId: string, task: unknown = null) {
  return asUser(db, userId, async () => {
    const res = await db.query<{ id: string }>("select public.create_lead_from_scan($1, $2, $3) as id", [
      JSON.stringify(lead),
      JSON.stringify(policy),
      task === null ? null : JSON.stringify(task),
    ]);
    return res.rows[0].id;
  });
}

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test", "Alicia");
  bob = await createUser(db, "bob@example.test", "Bob");
});

describe("create_lead_from_scan", () => {
  it("crea ficha (con domicilio y teléfono adicional) y póliza del cliente, sin tocar las pólizas vendidas", async () => {
    const id = await createFromScan(alice);
    const l = await db.query("select full_name, address, secondary_phone, postal_code, has_funeral_insurance, user_id from public.leads where id = $1", [id]);
    expect(l.rows[0]).toMatchObject({ full_name: lead.full_name, address: lead.address, secondary_phone: lead.secondary_phone, postal_code: "08001", has_funeral_insurance: true, user_id: alice });

    const p = await db.query<{ annual_premium: string; covered_until: Date; coverages: unknown; insured: unknown }>(
      "select annual_premium, covered_until, coverages, insured from public.customer_policies where lead_id = $1",
      [id],
    );
    expect(Number(p.rows[0].annual_premium)).toBe(245.4);
    expect(p.rows[0].coverages).toEqual(policy.coverages);
    expect(p.rows[0].insured).toEqual(policy.insured);

    const sold = await db.query("select count(*)::int as n from public.policies where lead_id = $1", [id]);
    expect(sold.rows[0]).toEqual({ n: 0 });
    // Sin tarea pedida no se crea ninguna (ni aviso por «cubierto hasta»).
    const tasks = await db.query("select count(*)::int as n from public.tasks where lead_id = $1", [id]);
    expect(tasks.rows[0]).toEqual({ n: 0 });
  });

  it("crea la primera tarea opcional y la ficha la toma como próxima acción", async () => {
    const due = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const id = await createFromScan(alice, { title: "Llamar para revisar coberturas", due_at: due });
    const l = await db.query<{ next_action: string; next_follow_up_at: Date }>("select next_action, next_follow_up_at from public.leads where id = $1", [id]);
    expect(l.rows[0].next_action).toBe("Llamar para revisar coberturas");
    expect(new Date(l.rows[0].next_follow_up_at).toISOString()).toBe(due);
  });

  it("es atómica: si falla la póliza no queda ficha", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int as n from public.leads where user_id = $1", [alice]);
    await expect(
      asUser(db, alice, () =>
        db.query("select public.create_lead_from_scan($1, $2, null)", [JSON.stringify(lead), JSON.stringify({ ...policy, annual_premium: -1 })]),
      ),
    ).rejects.toThrow(/customer_policies_annual_non_negative/);
    const after = await db.query<{ n: number }>("select count(*)::int as n from public.leads where user_id = $1", [alice]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("exige sesión", async () => {
    await expect(
      asUser(db, null, () => db.query("select public.create_lead_from_scan('{}', '{}', null)")),
    ).rejects.toThrow();
  });
});

describe("RLS de customer_policies", () => {
  it("otro usuario no ve, edita ni borra las pólizas del cliente", async () => {
    const id = await createFromScan(alice);
    await asUser(db, bob, async () => {
      expect((await db.query("select id from public.customer_policies where lead_id = $1", [id])).rows).toHaveLength(0);
      const upd = await db.query("update public.customer_policies set status_code = 'XX' where lead_id = $1 returning id", [id]);
      expect(upd.rows).toHaveLength(0);
      const del = await db.query("delete from public.customer_policies where lead_id = $1 returning id", [id]);
      expect(del.rows).toHaveLength(0);
    });
  });

  it("no permite vincular una póliza a la ficha de otro usuario", async () => {
    const id = await createFromScan(alice);
    await expect(
      asUser(db, bob, () => db.query("insert into public.customer_policies (lead_id) values ($1)", [id])),
    ).rejects.toThrow();
  });

  it("al borrar la ficha se borran sus pólizas del cliente", async () => {
    const id = await createFromScan(alice);
    await asUser(db, alice, () => db.query("delete from public.leads where id = $1", [id]));
    expect((await db.query("select id from public.customer_policies where lead_id = $1", [id])).rows).toHaveLength(0);
  });
});
