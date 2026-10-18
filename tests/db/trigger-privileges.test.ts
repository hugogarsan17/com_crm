import { expect, it } from "vitest";
import { asUser, createTestDatabase, createUser } from "./harness";

// Los triggers deben seguir funcionando aunque el rol no tenga EXECUTE sobre la función
// (migración de hardening). Se revoca también a PUBLIC para simular el caso más estricto.
it("los triggers se ejecutan sin EXECUTE sobre sus funciones", async () => {
  const db = await createTestDatabase();
  await db.exec(`
    revoke execute on function public.set_updated_at(), public.leads_handle_status(), public.sync_lead_last_contact(),
      public.sync_lead_next_follow_up(), public.tasks_before_write(), public.policies_calculate_commission() from public;
  `);
  const uid = await createUser(db, "triggers@example.test");
  await asUser(db, uid, async () => {
    const lead = await db.query<{ id: string }>("insert into public.leads (full_name) values ('X') returning id");
    await db.query("insert into public.tasks (lead_id, title, due_at) values ($1, 'Llamar', now())", [lead.rows[0].id]);
    await db.query("update public.leads set status = 'rejected' where id = $1", [lead.rows[0].id]);
    await db.query("insert into public.policies (lead_id, product_code, product_name, policy_value) values ($1, 'vida', 'Vida', 100)", [
      lead.rows[0].id,
    ]);
    const res = await db.query<{ next_action: string; closed: boolean }>(
      "select next_action, closed_at is not null as closed from public.leads where id = $1",
      [lead.rows[0].id],
    );
    expect(res.rows[0]).toEqual({ next_action: "Llamar", closed: true });
  });
});
