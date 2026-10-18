"use server";

import { redirect } from "next/navigation";
import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { authErrorMessage } from "./errors";

export async function signIn(input: LoginInput, next?: string | null): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authErrorMessage(error), undefined, error.code);
  redirect(safeNextPath(next));
}

export async function signUp(input: RegisterInput): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) return fail(authErrorMessage(error));

  // Con la confirmación de email desactivada, Supabase devuelve ya una sesión.
  if (data.session) redirect("/dashboard");
  return ok({ needsConfirmation: true });
}

export async function resendConfirmation(email: string): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard` },
  });
  if (error) return fail(authErrorMessage(error));
  return ok(undefined, "Te hemos reenviado el email de confirmación.");
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });
  // No revelamos si el email existe; solo informamos de errores de red o límites.
  if (error && (error.code === "over_email_send_rate_limit" || error.status === 0 || error.name === "AuthRetryableFetchError")) {
    return fail(authErrorMessage(error));
  }
  return ok(undefined);
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return fail("El enlace de recuperación ha caducado. Solicita uno nuevo desde «He olvidado mi contraseña».");
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorMessage(error));
  redirect("/dashboard?password=updated");
}

/**
 * Cambio de contraseña desde Ajustes con Supabase Auth.
 * 1. Comprueba la contraseña actual con un cliente aislado (sin cookies), cuya sesión
 *    temporal se cierra después; la sesión del usuario no se toca.
 * 2. Actualiza la contraseña con la sesión del usuario (updateUser). Se envía también
 *    current_password por si el proyecto exige la contraseña actual en Supabase.
 * Las contraseñas no se guardan ni se registran en ningún log.
 */
export async function changePassword(input: ChangePasswordInput): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  if (!ctx.user.email) return fail("Tu cuenta no tiene email; usa «He olvidado mi contraseña».");

  const { url, anonKey } = getSupabaseEnv();
  const verifier = createIsolatedClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: ctx.user.email,
    password: parsed.data.current_password,
  });
  if (verifyError) {
    if (verifyError.code === "invalid_credentials") {
      return fail("Revisa los campos marcados.", { current_password: ["La contraseña actual no es correcta"] });
    }
    return fail(authErrorMessage(verifyError));
  }
  // Cierra solo la sesión temporal de verificación.
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await ctx.supabase.auth.updateUser({
    password: parsed.data.password,
    current_password: parsed.data.current_password,
  });
  if (error) {
    if (error.code === "same_password") {
      return fail("Revisa los campos marcados.", { password: [authErrorMessage(error)] });
    }
    return fail(authErrorMessage(error), undefined, error.code);
  }
  return ok(undefined, "Contraseña cambiada correctamente.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
