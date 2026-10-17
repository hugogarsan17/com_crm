/**
 * Pruebas de base de datos sobre PGlite (Postgres real en WASM) con las
 * migraciones de supabase/migrations y un stub mínimo de Supabase Auth.
 * Verifican RLS (aislamiento entre usuarios), restricciones y triggers.
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

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test", "Alicia Prueba");
  bob = await createUser(db, "bob@example.test");
});

describe("profiles", () => {
  it("crea el perfil automáticamente al registrar el usuario", async () => {
    const res = await db.query<{ id: string; full_name: string }>(
      "select id, full_name from public.profiles order by full_name",
    );
    expect(res.rows).toHaveLength(2);
    expect(res.rows.find((r) => r.id === alice)?.full_name).toBe("Alicia Prueba");
    // Sin nombre en metadatos usa la parte local del email.
    expect(res.rows.find((r) => r.id === bob)?.full_name).toBe("bob");
  });

  it("cada usuario solo ve y actualiza su propio perfil", async () => {
    await asUser(db, alice, async () => {
      const visible = await db.query("select id from public.profiles");
      expect(visible.rows).toEqual([{ id: alice }]);

      const upd = await db.query("update public.profiles set full_name = 'Hackeado' where id = $1", [bob]);
      expect(upd.affectedRows).toBe(0);
    });
    const bobProfile = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [bob]);
    expect(bobProfile.rows[0].full_name).toBe("bob");
  });

  it("no permite cambiar el id del perfil ni insertar perfiles", async () => {
    await asUser(db, alice, async () => {
      await expect(db.query("update public.profiles set id = $1 where id = $2", [bob, alice])).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query("insert into public.profiles (id, full_name) values (gen_random_uuid(), 'x')"),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("RLS de leads y tablas relacionadas", () => {
  it("un usuario anónimo no puede leer nada", async () => {
    await insertLead(alice);
    await asUser(db, null, async () => {
      await expect(db.query("select * from public.leads")).rejects.toThrow(/permission denied/);
    });
  });

  it("aísla las fichas entre usuarios (select, update, delete)", async () => {
    const leadId = await insertLead(alice, { phone: "600 111 222" });

    await asUser(db, bob, async () => {
      const visible = await db.query("select id from public.leads where id = $1", [leadId]);
      expect(visible.rows).toHaveLength(0);

      const upd = await db.query("update public.leads set full_name = 'X' where id = $1", [leadId]);
      expect(upd.affectedRows).toBe(0);

      const del = await db.query("delete from public.leads where id = $1", [leadId]);
      expect(del.affectedRows).toBe(0);
    });

    const still = await db.query<{ full_name: string }>("select full_name from public.leads where id = $1", [leadId]);
    expect(still.rows[0].full_name).toBe("Cliente Demo");
  });

  it("impide insertar filas a nombre de otro usuario", async () => {
    await asUser(db, bob, async () => {
      await expect(
        db.query("insert into public.leads (user_id, full_name) values ($1, 'Intruso')", [alice]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("impide transferir una ficha a otro usuario", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, alice, async () => {
      await expect(db.query("update public.leads set user_id = $1 where id = $2", [bob, leadId])).rejects.toThrow(
        /row-level security/,
      );
    });
  });

  it("impide crear actividades, tareas o pólizas sobre el lead de otro usuario", async () => {
    const aliceLead = await insertLead(alice);

    await asUser(db, bob, async () => {
      await expect(
        db.query(
          "insert into public.activities (user_id, lead_id, channel, outcome) values ($1, $2, 'call', 'spoke')",
          [bob, aliceLead],
        ),
      ).rejects.toThrow(/row-level security|foreign key/);

      await expect(
        db.query(
          "insert into public.tasks (user_id, lead_id, title, due_at) values ($1, $2, 'x', now())",
          [bob, aliceLead],
        ),
      ).rejects.toThrow(/row-level security|foreign key/);

      await expect(
        db.query("insert into public.policies (user_id, lead_id, product_name) values ($1, $2, 'Hogar')", [
          bob,
          aliceLead,
        ]),
      ).rejects.toThrow(/row-level security|foreign key/);
    });
  });

  it("la FK compuesta impide vincular filas a un lead ajeno incluso sin RLS", async () => {
    const aliceLead = await insertLead(alice);
    // Como superusuario (sin RLS) la restricción sigue bloqueando la incoherencia.
    await expect(
      db.query("insert into public.tasks (user_id, lead_id, title, due_at) values ($1, $2, 'x', now())", [
        bob,
        aliceLead,
      ]),
    ).rejects.toThrow(/foreign key/);
  });

  it("las funciones RPC solo devuelven datos del usuario que llama", async () => {
    await insertLead(alice, { email: "Dup@Example.test", customer_reference: "REF-1" });
    await asUser(db, bob, async () => {
      const res = await db.query<{ r: unknown[] }>(
        "select public.find_lead_duplicates('{}', array['dup@example.test'], array['ref-1']) as r",
      );
      expect(res.rows[0].r).toEqual([]);
    });
    await asUser(db, alice, async () => {
      const res = await db.query<{ r: unknown[] }>(
        "select public.find_lead_duplicates('{}', array['dup@example.test'], '{}') as r",
      );
      expect(res.rows[0].r).toHaveLength(1);
    });
  });
});

describe("restricciones", () => {
  it("rechaza importes negativos y emails inválidos", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, alice, async () => {
      await expect(
        db.query(
          "insert into public.policies (lead_id, product_name, premium_amount) values ($1, 'Vida', -1)",
          [leadId],
        ),
      ).rejects.toThrow(/policies_premium_non_negative/);
      await expect(
        db.query("insert into public.leads (full_name, email) values ('X', 'no-es-email')"),
      ).rejects.toThrow(/leads_email_format/);
    });
  });

  it("exige comisión confirmada cuando el estado es confirmada o pagada", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, alice, async () => {
      await expect(
        db.query(
          "insert into public.policies (lead_id, product_name, commission_status) values ($1, 'Vida', 'paid')",
          [leadId],
        ),
      ).rejects.toThrow(/policies_confirmed_amount_required/);
    });
  });

  it("normaliza teléfonos y emails para detectar duplicados", async () => {
    const leadId = await insertLead(alice, { phone: "+34 600-12-34-56", email: "Ana@Example.TEST" });
    const res = await db.query<{ phone_normalized: string; email_normalized: string }>(
      "select phone_normalized, email_normalized from public.leads where id = $1",
      [leadId],
    );
    expect(res.rows[0]).toEqual({ phone_normalized: "600123456", email_normalized: "ana@example.test" });
  });
});

describe("triggers", () => {
  it("actualiza updated_at al modificar", async () => {
    const leadId = await insertLead(alice);
    await db.query("update public.leads set updated_at = now() - interval '1 day' where id = $1", [leadId]);
    await asUser(db, alice, () => db.query("update public.leads set notes = 'nota' where id = $1", [leadId]));
    const res = await db.query<{ fresh: boolean }>(
      "select updated_at > now() - interval '1 minute' as fresh from public.leads where id = $1",
      [leadId],
    );
    expect(res.rows[0].fresh).toBe(true);
  });

  it("gestiona closed_at según el estado", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, alice, () =>
      db.query("update public.leads set status = 'rejected', closed_reason = 'Precio' where id = $1", [leadId]),
    );
    let res = await db.query<{ closed_at: Date | null; closed_reason: string | null }>(
      "select closed_at, closed_reason from public.leads where id = $1",
      [leadId],
    );
    expect(res.rows[0].closed_at).not.toBeNull();
    expect(res.rows[0].closed_reason).toBe("Precio");

    await asUser(db, alice, () => db.query("update public.leads set status = 'follow_up' where id = $1", [leadId]));
    res = await db.query("select closed_at, closed_reason from public.leads where id = $1", [leadId]);
    expect(res.rows[0]).toEqual({ closed_at: null, closed_reason: null });
  });

  it("sincroniza la próxima acción con la tarea pendiente más próxima", async () => {
    const leadId = await insertLead(alice);
    const ids = await asUser(db, alice, async () => {
      const a = await db.query<{ id: string }>(
        "insert into public.tasks (lead_id, title, due_at) values ($1, 'Llamar tarde', now() + interval '3 days') returning id",
        [leadId],
      );
      const b = await db.query<{ id: string }>(
        "insert into public.tasks (lead_id, title, due_at) values ($1, 'Enviar propuesta', now() + interval '1 day') returning id",
        [leadId],
      );
      return { later: a.rows[0].id, sooner: b.rows[0].id };
    });

    const next = () =>
      db.query<{ next_action: string | null }>("select next_action from public.leads where id = $1", [leadId]);
    expect((await next()).rows[0].next_action).toBe("Enviar propuesta");

    await asUser(db, alice, () =>
      db.query("update public.tasks set status = 'completed' where id = $1", [ids.sooner]),
    );
    expect((await next()).rows[0].next_action).toBe("Llamar tarde");

    const completed = await db.query<{ completed_at: Date | null }>(
      "select completed_at from public.tasks where id = $1",
      [ids.sooner],
    );
    expect(completed.rows[0].completed_at).not.toBeNull();

    await asUser(db, alice, () => db.query("update public.tasks set status = 'cancelled' where id = $1", [ids.later]));
    expect((await next()).rows[0].next_action).toBeNull();
  });

  it("'No contactar' cancela seguimientos pendientes e impide crear nuevos", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, alice, async () => {
      await db.query("insert into public.tasks (lead_id, title, due_at) values ($1, 'Llamar', now())", [leadId]);
      await db.query("update public.leads set status = 'do_not_contact' where id = $1", [leadId]);
      const tasks = await db.query<{ status: string }>("select status from public.tasks where lead_id = $1", [leadId]);
      expect(tasks.rows.map((t) => t.status)).toEqual(["cancelled"]);
      await expect(
        db.query("insert into public.tasks (lead_id, title, due_at) values ($1, 'Otra', now())", [leadId]),
      ).rejects.toThrow(/No contactar/);
    });
    const lead = await db.query<{ next_follow_up_at: Date | null }>(
      "select next_follow_up_at from public.leads where id = $1",
      [leadId],
    );
    expect(lead.rows[0].next_follow_up_at).toBeNull();
  });
});

describe("RPC", () => {
  it("log_activity registra actividad, estado y seguimiento de forma atómica", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, alice, async () => {
      const res = await db.query<{ r: { activity_id: string; task_id: string } }>(
        `select public.log_activity($1, 'call', 'interested', now(), 'Le interesa hogar',
                'interested', null, 'Enviar presupuesto', now() + interval '2 days') as r`,
        [leadId],
      );
      expect(res.rows[0].r.activity_id).toBeTruthy();
      expect(res.rows[0].r.task_id).toBeTruthy();
    });
    const lead = await db.query<{ status: string; last_outcome: string; next_action: string }>(
      "select status, last_outcome, next_action from public.leads where id = $1",
      [leadId],
    );
    expect(lead.rows[0]).toEqual({ status: "interested", last_outcome: "interested", next_action: "Enviar presupuesto" });

    // Si falla una parte (seguimiento para 'No contactar'), no queda nada a medias.
    await asUser(db, alice, async () => {
      await expect(
        db.query(
          `select public.log_activity($1, 'call', 'do_not_contact', now(), null,
                  'do_not_contact', null, 'x', now() + interval '1 day')`,
          [leadId],
        ),
      ).rejects.toThrow(/No contactar/);
    });
    const count = await db.query<{ n: number }>(
      "select count(*)::int as n from public.activities where lead_id = $1",
      [leadId],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("log_activity no permite registrar contactos en fichas ajenas", async () => {
    const leadId = await insertLead(alice);
    await asUser(db, bob, async () => {
      await expect(
        db.query("select public.log_activity($1, 'call', 'spoke', now())", [leadId]),
      ).rejects.toThrow(/Ficha no encontrada/);
    });
  });

  it("import_leads inserta el lote completo o nada", async () => {
    const before = await db.query<{ n: number }>(
      "select count(*)::int as n from public.leads where user_id = $1",
      [bob],
    );
    await asUser(db, bob, async () => {
      const ok = await db.query<{ n: number }>("select public.import_leads($1::jsonb) as n", [
        JSON.stringify([
          { full_name: "Uno", phone: "611000001", current_policies: ["Auto", "Hogar"], priority: "high" },
          { full_name: "Dos", email: "dos@example.test" },
        ]),
      ]);
      expect(ok.rows[0].n).toBe(2);

      await expect(
        db.query("select public.import_leads($1::jsonb)", [
          JSON.stringify([{ full_name: "Tres" }, { full_name: "Cuatro", email: "mal" }]),
        ]),
      ).rejects.toThrow(/leads_email_format/);
    });
    const after = await db.query<{ n: number }>(
      "select count(*)::int as n from public.leads where user_id = $1",
      [bob],
    );
    expect(after.rows[0].n).toBe(before.rows[0].n + 2);
    const imported = await db.query<{ current_policies: string[]; priority: string }>(
      "select current_policies, priority from public.leads where user_id = $1 and full_name = 'Uno'",
      [bob],
    );
    expect(imported.rows[0]).toEqual({ current_policies: ["Auto", "Hogar"], priority: "high" });
  });

  it("get_report y get_dashboard_summary resumen comisiones sin calcularlas", async () => {
    const carol = await createUser(db, "carol@example.test", "Carol");
    const leadId = await insertLead(carol, { product_to_offer: "Hogar" });
    await asUser(db, carol, async () => {
      await db.query("select public.log_activity($1, 'call', 'contracted', now(), null, 'policy_contracted')", [leadId]);
      await db.query(
        `insert into public.policies (lead_id, product_name, contracted_at, premium_amount, estimated_commission, confirmed_commission, commission_status)
         values ($1, 'Hogar', current_date, 300, 30, 28.5, 'confirmed'),
                ($1, 'hogar ', current_date, 100, 10, 10, 'paid'),
                ($1, 'Vida', current_date, 500, 50, null, 'pending')`,
        [leadId],
      );
      const report = await db.query<{ r: Record<string, unknown> }>(
        "select public.get_report(current_date - 7, current_date, 'Europe/Madrid', 'HOGAR') as r",
      );
      const r = report.rows[0].r;
      expect(r.policies_contracted).toBe(2);
      expect(Number(r.estimated_commission)).toBe(40);
      expect(Number(r.confirmed_commission)).toBe(38.5);
      expect(Number(r.paid_commission)).toBe(10);
      expect(r.leads_contacted).toBe(1);
      expect(r.by_product).toHaveLength(1);

      const dash = await db.query<{ r: Record<string, unknown> }>(
        "select public.get_dashboard_summary(current_date - 30, current_date, 'Europe/Madrid') as r",
      );
      expect(dash.rows[0].r.policies_contracted).toBe(3);
      expect(Number(dash.rows[0].r.estimated_commission)).toBe(90);

      const series = await db.query<{ r: Array<{ contracted: number }> }>(
        "select public.get_results_series(current_date - 6, current_date, 'Europe/Madrid', 'day') as r",
      );
      expect(series.rows[0].r).toHaveLength(7);
      expect(series.rows[0].r.reduce((s, b) => s + b.contracted, 0)).toBe(3);
    });
  });

  it("delete_my_account elimina solo la cuenta propia y sus datos", async () => {
    const dave = await createUser(db, "dave@example.test");
    await insertLead(dave);
    await asUser(db, dave, () => db.query("select public.delete_my_account()"));
    const users = await db.query("select id from auth.users where id = $1", [dave]);
    const leads = await db.query("select id from public.leads where user_id = $1", [dave]);
    expect(users.rows).toHaveLength(0);
    expect(leads.rows).toHaveLength(0);
    const aliceStill = await db.query("select id from auth.users where id = $1", [alice]);
    expect(aliceStill.rows).toHaveLength(1);
  });

  it("anon no puede ejecutar las funciones RPC", async () => {
    await asUser(db, null, async () => {
      await expect(db.query("select public.get_product_options()")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.delete_my_account()")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("paridad de normalización TS ↔ SQL", () => {
  it("normalize_phone coincide con normalizePhone()", async () => {
    const { normalizePhone } = await import("@/lib/normalize");
    const samples = ["+34 600 12 34 56", "0034600123456", "34600123456", "600-123-456", "+44 20 7946 0958", "", "abc"];
    for (const s of samples) {
      const res = await db.query<{ n: string | null }>("select public.normalize_phone($1) as n", [s]);
      expect(res.rows[0].n).toBe(normalizePhone(s));
    }
  });
});
