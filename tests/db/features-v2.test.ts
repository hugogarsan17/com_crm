/**
 * Funciones de octubre 2026 sobre PGlite: comisión calculada, catálogo,
 * panel mensual, tareas del calendario en «Para hoy», avisos y RLS de las tablas nuevas.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, createUser, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;

async function insertLead(userId: string, values: Record<string, unknown> = {}) {
  return asUser(db, userId, async () => {
    const cols = ["full_name", ...Object.keys(values)];
    const params = ["Cliente Demo", ...Object.values(values)];
    const res = await db.query<{ id: string }>(
      `insert into public.leads (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      params,
    );
    return res.rows[0].id;
  });
}

async function insertPolicy(userId: string, leadId: string, values: Record<string, unknown>) {
  return asUser(db, userId, async () => {
    const cols = ["lead_id", "product_name", ...Object.keys(values)];
    const params = [leadId, "Producto", ...Object.values(values)];
    const res = await db.query<{ id: string }>(
      `insert into public.policies (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      params,
    );
    return res.rows[0].id;
  });
}

async function policy(id: string) {
  const res = await db.query<{ policy_value: string | null; commission_rate: string | null; calculated_commission: string | null }>(
    "select policy_value, commission_rate, calculated_commission from public.policies where id = $1",
    [id],
  );
  const r = res.rows[0];
  const n = (v: string | null) => (v == null ? null : Number(v));
  return { value: n(r.policy_value), rate: n(r.commission_rate), commission: n(r.calculated_commission) };
}

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test", "Alicia");
  bob = await createUser(db, "bob@example.test", "Bob");
});

describe("ficha: número de póliza, decesos, código postal y producto", () => {
  it("guarda y busca por número de póliza", async () => {
    await insertLead(alice, { customer_reference: "POL-2026-0042" });
    await asUser(db, alice, async () => {
      const res = await db.query<{ customer_reference: string }>(
        "select customer_reference from public.leads where customer_reference ilike '%2026-0042%'",
      );
      expect(res.rows).toEqual([{ customer_reference: "POL-2026-0042" }]);
      const dup = await db.query<{ r: unknown[] }>("select public.find_lead_duplicates('{}', '{}', array['pol-2026-0042']) as r");
      expect(dup.rows[0].r).toHaveLength(1);
    });
  });

  it("el seguro de decesos admite sí, no y sin indicar (null por defecto)", async () => {
    const yes = await insertLead(alice, { has_funeral_insurance: true });
    const no = await insertLead(alice, { has_funeral_insurance: false });
    const unknown = await insertLead(alice);
    const res = await db.query<{ id: string; has_funeral_insurance: boolean | null }>(
      "select id, has_funeral_insurance from public.leads where id = any($1)",
      [[yes, no, unknown]],
    );
    const byId = Object.fromEntries(res.rows.map((r) => [r.id, r.has_funeral_insurance]));
    expect([byId[yes], byId[no], byId[unknown]]).toEqual([true, false, null]);
  });

  it("valida el formato del código postal", async () => {
    await insertLead(alice, { postal_code: "28001", locality: "Madrid" });
    await insertLead(alice, { postal_code: "SW1A 1AA" });
    await asUser(db, alice, async () => {
      await expect(db.query("insert into public.leads (full_name, postal_code) values ('X', '28/001')")).rejects.toThrow(
        /leads_postal_code_format/,
      );
    });
  });

  it("el producto de la ficha tiene que estar en el catálogo", async () => {
    await insertLead(alice, { product_code: "decesos" });
    await asUser(db, alice, async () => {
      await expect(db.query("insert into public.leads (full_name, product_code) values ('X', 'inventado')")).rejects.toThrow(
        /foreign key/,
      );
    });
  });
});

describe("catálogo de productos", () => {
  it("lo leen los usuarios autenticados pero no lo pueden modificar", async () => {
    await asUser(db, alice, async () => {
      const res = await db.query<{ code: string }>("select code from public.products order by sort_order");
      expect(res.rows.map((r) => r.code)).toEqual(["decesos", "hogar", "auto", "vida"]);
      await expect(db.query("insert into public.products (code, label) values ('x', 'X')")).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.products set label = 'Y' where code = 'vida'")).rejects.toThrow(/permission denied/);
    });
    await asUser(db, null, async () => {
      await expect(db.query("select * from public.products")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("comisión calculada", () => {
  it("sin regla no se calcula (no se inventa un porcentaje)", async () => {
    const lead = await insertLead(bob);
    const id = await insertPolicy(bob, lead, { product_code: "hogar", policy_value: 500 });
    expect(await policy(id)).toEqual({ value: 500, rate: null, commission: null });
  });

  it("aplica la regla del producto o la general y redondea a céntimos", async () => {
    const lead = await insertLead(alice);
    await asUser(db, alice, async () => {
      await db.query("insert into public.commission_rules (product_code, rate_percent) values (null, 10), ('decesos', 12.5)");
    });
    const decesos = await insertPolicy(alice, lead, { product_code: "decesos", policy_value: 333.33 });
    const hogar = await insertPolicy(alice, lead, { product_code: "hogar", policy_value: 10.05 });
    expect(await policy(decesos)).toEqual({ value: 333.33, rate: 12.5, commission: 41.67 });
    expect(await policy(hogar)).toEqual({ value: 10.05, rate: 10, commission: 1.01 });
  });

  it("recalcula al cambiar el valor de póliza y no admite fijarla a mano", async () => {
    const lead = await insertLead(alice);
    const id = await insertPolicy(alice, lead, { product_code: "auto", policy_value: 200 });
    expect((await policy(id)).commission).toBe(20);
    await asUser(db, alice, () => db.query("update public.policies set policy_value = 250.10 where id = $1", [id]));
    expect(await policy(id)).toEqual({ value: 250.1, rate: 10, commission: 25.01 });
    await asUser(db, alice, () => db.query("update public.policies set calculated_commission = 9999 where id = $1", [id]));
    expect((await policy(id)).commission).toBe(25.01);
    await asUser(db, alice, () => db.query("update public.policies set policy_value = null where id = $1", [id]));
    expect(await policy(id)).toEqual({ value: null, rate: null, commission: null });
  });

  it("cambiar una regla no altera las comisiones ya calculadas; recalculate_missing completa las pendientes", async () => {
    const carol = await createUser(db, "carol@example.test");
    const lead = await insertLead(carol);
    const pending = await insertPolicy(carol, lead, { product_code: "vida", policy_value: 1000 });
    expect((await policy(pending)).commission).toBeNull();
    await asUser(db, carol, async () => {
      await db.query("insert into public.commission_rules (product_code, rate_percent) values ('vida', 3)");
      const r = await db.query<{ n: number }>("select public.recalculate_missing_commissions() as n");
      expect(r.rows[0].n).toBe(1);
    });
    expect((await policy(pending)).commission).toBe(30);
    await asUser(db, carol, () => db.query("update public.commission_rules set rate_percent = 5 where product_code = 'vida'"));
    expect((await policy(pending)).commission).toBe(30);
  });

  it("las reglas de comisión están aisladas por usuario", async () => {
    await asUser(db, bob, async () => {
      const res = await db.query("select * from public.commission_rules");
      expect(res.rows).toEqual([]);
      const upd = await db.query("update public.commission_rules set rate_percent = 99");
      expect(upd.affectedRows).toBe(0);
      await expect(
        db.query("insert into public.commission_rules (user_id, rate_percent) values ($1, 50)", [alice]),
      ).rejects.toThrow(/row-level security/);
      await expect(db.query("insert into public.commission_rules (rate_percent) values (150)")).rejects.toThrow(
        /commission_rules_rate_range/,
      );
    });
    // Las reglas de Alicia no se aplican a las pólizas de Bob.
    const lead = await insertLead(bob);
    const id = await insertPolicy(bob, lead, { product_code: "decesos", policy_value: 100 });
    expect((await policy(id)).commission).toBeNull();
  });
});

describe("panel mensual y calendario", () => {
  it("las métricas son del mes consultado y los meses anteriores no se borran", async () => {
    const dave = await createUser(db, "dave@example.test");
    const lead = await insertLead(dave);
    await asUser(db, dave, () => db.query("insert into public.commission_rules (rate_percent) values (10)"));
    await insertPolicy(dave, lead, { product_code: "hogar", contracted_at: "2026-09-10", policy_value: 100 });
    await insertPolicy(dave, lead, { product_code: "hogar", contracted_at: "2026-10-05", policy_value: 300 });
    await insertPolicy(dave, lead, { product_code: "vida", contracted_at: "2026-10-20", policy_value: 50 });

    await asUser(db, dave, async () => {
      const summary = async (from: string, to: string) =>
        (await db.query<{ r: Record<string, unknown> }>("select public.get_dashboard_summary($1, $2, 'Europe/Madrid') as r", [from, to]))
          .rows[0].r;
      const sept = await summary("2026-09-01", "2026-09-30");
      const oct = await summary("2026-10-01", "2026-10-31");
      expect([sept.policies_contracted, Number(sept.calculated_commission), Number(sept.policy_value_total)]).toEqual([1, 10, 100]);
      expect([oct.policies_contracted, Number(oct.calculated_commission), Number(oct.policy_value_total)]).toEqual([2, 35, 350]);
    });
    const all = await db.query<{ n: number }>("select count(*)::int as n from public.policies where user_id = $1", [dave]);
    expect(all.rows[0].n).toBe(3);
  });

  it("los seguimientos vencidos de meses anteriores siguen pendientes en cualquier mes", async () => {
    const erin = await createUser(db, "erin@example.test");
    const lead = await insertLead(erin);
    await asUser(db, erin, async () => {
      await db.query("insert into public.tasks (lead_id, title, due_at) values ($1, 'Vencida antigua', now() - interval '45 days')", [lead]);
      const r = await db.query<{ r: Record<string, number> }>(
        "select public.get_dashboard_summary(date_trunc('month', current_date)::date, current_date, 'Europe/Madrid') as r",
      );
      expect(r.rows[0].r.follow_ups_overdue).toBe(1);
    });
  });

  it("una tarea creada desde el calendario para hoy cuenta en «Para hoy»", async () => {
    const frank = await createUser(db, "frank@example.test");
    const lead = await insertLead(frank);
    await asUser(db, frank, async () => {
      // Misma tabla tasks: el calendario no usa una tabla paralela.
      await db.query(
        `insert into public.tasks (lead_id, title, due_at)
         values ($1, 'Llamar desde calendario', (((now() at time zone 'Europe/Madrid')::date)::timestamp + interval '23 hours 59 minutes') at time zone 'Europe/Madrid')`,
        [lead],
      );
      const r = await db.query<{ r: Record<string, number> }>(
        "select public.get_dashboard_summary(current_date, current_date, 'Europe/Madrid') as r",
      );
      expect(r.rows[0].r.follow_ups_today).toBe(1);
      // Reprogramar y cancelar desde el calendario actualiza la próxima acción de la ficha.
      await db.query("update public.tasks set status = 'cancelled' where lead_id = $1", [lead]);
      const after = await db.query<{ next_action: string | null }>("select next_action from public.leads where id = $1", [lead]);
      expect(after.rows[0].next_action).toBeNull();
    });
  });

  it("una tarea no se puede vincular a la ficha de otro usuario al editarla", async () => {
    const own = await insertLead(bob);
    const foreign = await insertLead(alice);
    await asUser(db, bob, async () => {
      const t = await db.query<{ id: string }>("insert into public.tasks (lead_id, title, due_at) values ($1, 'X', now()) returning id", [own]);
      await expect(db.query("update public.tasks set lead_id = $1 where id = $2", [foreign, t.rows[0].id])).rejects.toThrow(
        /row-level security|foreign key/,
      );
    });
  });
});

describe("avisos por email", () => {
  it("cada usuario gestiona solo sus preferencias", async () => {
    await asUser(db, alice, () => db.query("insert into public.notification_preferences (email_enabled) values (true)"));
    await asUser(db, bob, async () => {
      expect((await db.query("select * from public.notification_preferences")).rows).toEqual([]);
      const upd = await db.query("update public.notification_preferences set email_enabled = false");
      expect(upd.affectedRows).toBe(0);
      await expect(
        db.query("insert into public.notification_preferences (user_id, email_enabled) values ($1, true)", [alice]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("el registro de avisos es de solo lectura para el usuario y no admite duplicados", async () => {
    const lead = await insertLead(alice);
    const task = await asUser(db, alice, () =>
      db.query<{ id: string; due_at: Date }>("insert into public.tasks (lead_id, title, due_at) values ($1, 'X', now()) returning id, due_at", [lead]),
    );
    const { id: taskId, due_at: dueAt } = task.rows[0];
    // La tarea programada (service_role) escribe el registro; aquí, como superusuario.
    await db.query("insert into public.notification_log (user_id, task_id, kind, due_at, status) values ($1, $2, 'overdue', $3, 'sent')", [
      alice,
      taskId,
      dueAt,
    ]);
    await expect(
      db.query("insert into public.notification_log (user_id, task_id, kind, due_at) values ($1, $2, 'overdue', $3)", [alice, taskId, dueAt]),
    ).rejects.toThrow(/notification_log_once/);

    await asUser(db, alice, async () => {
      expect((await db.query("select id from public.notification_log")).rows).toHaveLength(1);
      await expect(
        db.query("insert into public.notification_log (user_id, task_id, kind, due_at) values ($1, $2, 'upcoming', now())", [alice, taskId]),
      ).rejects.toThrow(/permission denied/);
    });
    await asUser(db, bob, async () => {
      expect((await db.query("select id from public.notification_log")).rows).toEqual([]);
    });
  });
});
