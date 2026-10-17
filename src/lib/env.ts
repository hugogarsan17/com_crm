/**
 * Variables públicas de Supabase. Se aceptan la anon key clásica o la nueva
 * publishable key; ambas son seguras en el navegador porque los datos están
 * protegidos por RLS. Nunca añadir aquí la clave service_role.
 *
 * Las referencias a process.env.NEXT_PUBLIC_* deben ser literales: Next.js las
 * sustituye por su valor al compilar.
 */

/** Limpia espacios y comillas copiadas por error; un valor en blanco cuenta como ausente. */
export function cleanEnvValue(value: string | undefined) {
  const v = value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return v ? v : undefined;
}

export function resolveSupabaseEnv(values: { url?: string; anonKey?: string; publishableKey?: string }) {
  return {
    url: cleanEnvValue(values.url),
    anonKey: cleanEnvValue(values.anonKey) ?? cleanEnvValue(values.publishableKey),
  };
}

function readEnv() {
  return resolveSupabaseEnv({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getSupabaseEnv() {
  const { url, anonKey } = readEnv();
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Copia .env.example a .env.local y rellénalas.",
    );
  }
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = readEnv();
  return Boolean(url && anonKey);
}
