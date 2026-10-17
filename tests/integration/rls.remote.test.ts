/**
 * Verificación de RLS contra un proyecto Supabase real, con dos usuarios de prueba.
 * Requiere .env (URL + clave pública) y .env.test.local (credenciales E2E_*).
 * Ejecutar con: npm run test:integration
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds = {
  a: { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD },
  b: { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD },
};
const configured = Boolean(url && key && creds.a.email && creds.a.password && creds.b.email && creds.b.password);

async function signIn(c: { email?: string; password?: string }) {
  const client = createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: c.email!, password: c.password! });
  if (error) throw error;
  return { client, userId: data.user.id };
}

describe.skipIf(!configured)("RLS en Supabase real", () => {
  let a: { client: SupabaseClient<Database>; userId: string };
  let b: { client: SupabaseClient<Database>; userId: string };
  let leadId: string;

  beforeAll(async () => {
    a = await signIn(creds.a);
    b = await signIn(creds.b);
    const { data, error } = await a.client
      .from("leads")
      .insert({ full_name: "RLS Prueba", phone: "600000001", user_id: a.userId })
      .select("id")
      .single();
    if (error) throw error;
    leadId = data.id;
    const task = await a.client.from("tasks").insert({ lead_id: leadId, user_id: a.userId, title: "Llamar", due_at: new Date().toISOString() });
    if (task.error) throw task.error;
  });

  afterAll(async () => {
    if (leadId) await a.client.from("leads").delete().eq("id", leadId);
  });

  it("el propietario ve su ficha y su perfil", async () => {
    const { data } = await a.client.from("leads").select("id, next_action").eq("id", leadId).single();
    expect(data?.next_action).toBe("Llamar");
    const profiles = await a.client.from("profiles").select("id");
    expect(profiles.data).toEqual([{ id: a.userId }]);
  });

  it("otro usuario no puede leer, modificar ni borrar la ficha", async () => {
    const read = await b.client.from("leads").select("id").eq("id", leadId);
    expect(read.data).toEqual([]);
    const tasks = await b.client.from("tasks").select("id").eq("lead_id", leadId);
    expect(tasks.data).toEqual([]);

    const upd = await b.client.from("leads").update({ full_name: "Hackeado" }).eq("id", leadId).select("id");
    expect(upd.data).toEqual([]);
    const del = await b.client.from("leads").delete().eq("id", leadId).select("id");
    expect(del.data).toEqual([]);

    const still = await a.client.from("leads").select("full_name").eq("id", leadId).single();
    expect(still.data?.full_name).toBe("RLS Prueba");
  });

  it("otro usuario no puede insertar datos vinculados a la ficha ajena", async () => {
    const asOther = await b.client.from("activities").insert({ lead_id: leadId, user_id: b.userId, channel: "call", outcome: "spoke" });
    expect(asOther.error).not.toBeNull();
    const spoofed = await b.client.from("leads").insert({ full_name: "Suplantado", user_id: a.userId });
    expect(spoofed.error).not.toBeNull();
    const rpc = await b.client.rpc("log_activity", {
      p_lead_id: leadId,
      p_channel: "call",
      p_outcome: "spoke",
      p_occurred_at: new Date().toISOString(),
    });
    expect(rpc.error).not.toBeNull();
  });

  it("un cliente anónimo no accede a nada", async () => {
    const anon = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const leads = await anon.from("leads").select("id").limit(1);
    expect(leads.error ?? leads.data).toBeTruthy();
    expect(leads.data ?? []).toEqual([]);
    const rpc = await anon.rpc("get_product_options");
    expect(rpc.error).not.toBeNull();
  });
});
