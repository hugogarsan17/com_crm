/**
 * Vencimiento de pólizas (noviembre 2026): seguimiento automático una semana antes,
 * ajuste al cambiar la fecha, cancelación y aislamiento entre usuarios.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, createUser, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;

const DAY = 86_400_000;

function isoDate(offsetDays: number) {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}

async function insertLead(userId: string) {
  return asUser(db, userId, async () => {
    const res = await db.query<{ id: string }>("insert into public.leads (full_name) values ('Cliente Demo') returning id");
    return res.rows[0].id;
  });
}

async function insertPolicy(userId: string, leadId: string, expiresOn: string | null) {
  return asUser(db, userId, async () => {
    const res = await db.query<{ id: string }>(
      "insert into public.policies (lead_id, product_name, expires_on) values ($1, 'Hogar', $2) returning id",
      [leadId, expiresOn],
    );
    return res.rows[0].id;
  });
}

async function expiryTasks(policyId: string) {
  const res = await db.query<{ id: string; status: string; due_at: Date; title: string; description: string; user_id: string }>(
    "select id, status, due_at, title, description, user_id from public.tasks where policy_id = $1 order by created_at",
    [policyId],
  );
  return res.rows;
}

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test", "Alicia");
  bob = await createUser(db, "bob@example.test", "Bob");
});

describe("seguimiento automático por vencimiento de póliza", () => {
  it("crea una tarea pendiente 7 días antes a las 10:00 (hora del perfil) y actualiza la próxima acción de la ficha", async () => {
    const lead = await insertLead(alice);
    const expires = isoDate(40);
    const policy = await insertPolicy(alice, lead, expires);

    const tasks = await expiryTasks(policy);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ status: "pending", title: "Vencimiento de póliza: Hogar", user_id: alice });
    expect(tasks[0].description).toContain("vence el");
    const local = await db.query<{ d: string }>(
      "select to_char(due_at at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') as d from public.tasks where id = $1",
      [tasks[0].id],
    );
    const expected = new Date(new Date(`${expires}T00:00:00Z`).getTime() - 7 * DAY).toISOString().slice(0, 10);
    expect(local.rows[0].d).toBe(`${expected} 10:00`);

    const leadRow = await db.query<{ next_action: string }>("select next_action from public.leads where id = $1", [lead]);
    expect(leadRow.rows[0].next_action).toBe("Vencimiento de póliza: Hogar");
  });

  it("sin fecha de vencimiento no crea tarea", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), null);
    expect(await expiryTasks(policy)).toHaveLength(0);
  });

  it("si vence en menos de una semana, el aviso queda para pronto (no en el pasado)", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), isoDate(3));
    const [task] = await expiryTasks(policy);
    expect(task.status).toBe("pending");
    expect(new Date(task.due_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("al cambiar la fecha mueve el aviso pendiente; al quitarla lo cancela", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), isoDate(30));
    const [before] = await expiryTasks(policy);
    await asUser(db, alice, () => db.query("update public.policies set expires_on = $1 where id = $2", [isoDate(60), policy]));
    const moved = await expiryTasks(policy);
    expect(moved).toHaveLength(1);
    expect(new Date(moved[0].due_at).getTime() - new Date(before.due_at).getTime()).toBeGreaterThan(29 * DAY);

    await asUser(db, alice, () => db.query("update public.policies set expires_on = null where id = $1", [policy]));
    expect((await expiryTasks(policy)).map((t) => t.status)).toEqual(["cancelled"]);
  });

  it("editar otros datos no recrea un aviso ya completado ni pisa una fecha reprogramada", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), isoDate(30));
    const [task] = await expiryTasks(policy);
    const rescheduled = new Date(Date.now() + 2 * DAY).toISOString();
    await asUser(db, alice, async () => {
      await db.query("update public.tasks set due_at = $1 where id = $2", [rescheduled, task.id]);
      // La aplicación reenvía todos los campos al editar, incluida la misma fecha.
      await db.query("update public.policies set expires_on = expires_on, notes = 'Llamar antes' where id = $1", [policy]);
    });
    expect(new Date((await expiryTasks(policy))[0].due_at).toISOString()).toBe(rescheduled);

    await asUser(db, alice, async () => {
      await db.query("update public.tasks set status = 'completed' where id = $1", [task.id]);
      await db.query("update public.policies set expires_on = expires_on, notes = 'Renovada' where id = $1", [policy]);
    });
    expect((await expiryTasks(policy)).map((t) => t.status)).toEqual(["completed"]);
  });

  it("una nueva fecha tras completar el aviso (renovación) crea otro seguimiento", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), isoDate(20));
    const [task] = await expiryTasks(policy);
    await asUser(db, alice, async () => {
      await db.query("update public.tasks set status = 'completed' where id = $1", [task.id]);
      await db.query("update public.policies set expires_on = $1 where id = $2", [isoDate(385), policy]);
    });
    expect((await expiryTasks(policy)).map((t) => t.status)).toEqual(["completed", "pending"]);
  });

  it("al borrar la póliza se borra su seguimiento", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), isoDate(30));
    await asUser(db, alice, () => db.query("delete from public.policies where id = $1", [policy]));
    expect(await expiryTasks(policy)).toHaveLength(0);
  });

  it("el vencimiento no puede ser anterior a la contratación", async () => {
    const lead = await insertLead(alice);
    await expect(
      asUser(db, alice, () =>
        db.query("insert into public.policies (lead_id, product_name, contracted_at, expires_on) values ($1, 'Hogar', $2, $3)", [
          lead,
          isoDate(10),
          isoDate(5),
        ]),
      ),
    ).rejects.toThrow(/policies_expires_after_contract/);
  });

  it("los avisos son privados y una tarea no puede apuntar a la póliza de otra ficha", async () => {
    const policy = await insertPolicy(alice, await insertLead(alice), isoDate(30));
    const visibleToBob = await asUser(db, bob, () => db.query("select id from public.tasks where policy_id = $1", [policy]));
    expect(visibleToBob.rows).toHaveLength(0);

    const otherLead = await insertLead(alice);
    await expect(
      asUser(db, alice, () =>
        db.query("insert into public.tasks (lead_id, policy_id, title, due_at, status) values ($1, $2, 'x', now(), 'completed')", [otherLead, policy]),
      ),
    ).rejects.toThrow(/tasks_policy_fkey/);
  });
});
