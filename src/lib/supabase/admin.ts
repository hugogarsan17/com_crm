import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cleanEnvValue } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Cliente con la clave service_role (salta RLS). SOLO para tareas programadas de
 * servidor sin sesión de usuario (avisos por email). Nunca se importa desde
 * componentes de cliente ("server-only" lo impide) ni se usa en peticiones de usuario.
 */
export function createAdminClient() {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type AdminSupabaseClient = ReturnType<typeof createAdminClient>;
