/**
 * Avisos por email con pg_cron + Edge Function send-reminders (noviembre 2026):
 * secreto de Vault, reserva idempotente de avisos, reintentos y permisos.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, createUser, type TestDb } from "./harness";

let db: TestDb;
let alice: string;
let bob: string;
const HOUR = 3_600_000;

async function asServiceRole<T>(fn: () => Promise<T>) {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function claim() {
  return asServiceRole(async () => (await db.query<{ log_id: string; kind: string; task_title: string; user_email: string }>("select * from public.notify_claim_due()")).rows);
}

async function addTask(userId: string, title: string, dueOffsetMs: number, status = "pending") {
  return asUser(db, userId, async () => {
    const lead = await db.query<{ id: string }>("insert into public.leads (full_name) values ('Cliente Demo') returning id");
    const task = await db.query<{ id: string }>(
      "insert into public.tasks (lead_id, title, due_at, status) values ($1, $2, $3, $4) returning id",
      [lead.rows[0].id, title, new Date(Date.now() + dueOffsetMs).toISOString(), status],
    );
    return task.rows[0].id;
  });
}

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test", "Alicia");
  bob = await createUser(db, "bob@example.test", "Bob");
  await asUser(db, alice, () =>
    db.query("insert into public.notification_preferences (email_enabled, notify_upcoming, upcoming_hours, notify_overdue) values (true, true, 24, true)"),
  );
  // Bob no tiene avisos activados.
  await addTask(alice, "Próxima", 2 * HOUR);
  await addTask(alice, "Vencida", -HOUR);
  await addTask(alice, "Vencida hace días", -5 * 24 * HOUR);
  await addTask(alice, "Lejana", 72 * HOUR);
  await addTask(alice, "Hecha", -HOUR, "completed");
  await addTask(bob, "De Bob", HOUR);
});

describe("notify_claim_due", () => {
  it("reserva solo los avisos que tocan (próximos en la ventana, vencidos de los últimos 3 días) de usuarios con avisos activos", async () => {
    const rows = await claim();
    expect(rows.map((r) => `${r.task_title}:${r.kind}`).sort()).toEqual(["Próxima:upcoming", "Vencida:overdue"]);
    expect(rows.every((r) => r.user_email === "alice@example.test")).toBe(true);
  });

  it("es idempotente: un segundo ciclo no vuelve a enviar lo ya reservado", async () => {
    expect(await claim()).toEqual([]);
  });

  it("reintenta los fallidos hasta 3 intentos", async () => {
    const [log] = (await db.query<{ id: string }>("select id from public.notification_log where kind = 'overdue'")).rows;
    for (let attempt = 0; attempt < 3; attempt++) {
      await asServiceRole(() => db.query("select public.notify_mark($1, false, null, 'error de prueba')", [log.id]));
      const retried = await claim();
      expect(retried.map((r) => r.log_id)).toEqual(attempt < 2 ? [log.id] : []);
    }
    const final = await db.query<{ attempts: number; status: string }>("select attempts, status from public.notification_log where id = $1", [log.id]);
    expect(final.rows[0]).toEqual({ attempts: 3, status: "failed" });
  });
});

describe("notify_check_secret y permisos", () => {
  it("solo acepta el secreto guardado en Vault", async () => {
    const [{ decrypted_secret }] = (await db.query<{ decrypted_secret: string }>("select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret'")).rows;
    const check = (s: string) => asServiceRole(async () => (await db.query<{ ok: boolean }>("select public.notify_check_secret($1) as ok", [s])).rows[0].ok);
    expect(await check(decrypted_secret)).toBe(true);
    expect(await check("otro")).toBe(false);
    expect(await check("")).toBe(false);
  });

  it("los usuarios no pueden ejecutar las funciones de avisos", async () => {
    for (const fn of ["public.notify_claim_due()", "public.notify_check_secret('x')"]) {
      await expect(asUser(db, alice, () => db.query(`select ${fn}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("el job de pg_cron está programado cada 15 minutos", async () => {
    const job = await db.query<{ schedule: string; command: string }>("select schedule, command from cron.job where jobname = 'send-reminders'");
    expect(job.rows[0].schedule).toBe("*/15 * * * *");
    expect(job.rows[0].command).toContain("/functions/v1/send-reminders");
  });
});
