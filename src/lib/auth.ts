import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/dates";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  timezone: string;
};

/**
 * Lee y valida la sesión en servidor (Data Access Layer). Devuelve null si no hay sesión.
 * Memoizada por petición con React.cache.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .eq("id", claims.sub)
    .maybeSingle();

  const timezone = profile?.timezone && isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? "",
    timezone,
  };
});

/** Para páginas privadas: redirige a /login si no hay sesión válida. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  return { user, supabase };
}

/** Para Server Actions: no redirige; devuelve null si no hay sesión. */
export async function getActionContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  return { user, supabase };
}

export const UNAUTHENTICATED_MESSAGE = "Tu sesión ha caducado. Vuelve a iniciar sesión.";
