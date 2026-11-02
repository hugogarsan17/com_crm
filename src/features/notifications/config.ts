import { cleanEnvValue } from "@/lib/env";

/**
 * Configuración del email de PRUEBA de Ajustes (solo servidor, Vercel). Los avisos
 * programados no dependen de esto: los envía Supabase (pg_cron + Edge Function
 * send-reminders) con sus propios secretos (ver README → Avisos por email).
 *  - RESEND_API_KEY: clave de la API de Resend (https://resend.com).
 *  - NOTIFICATIONS_FROM_EMAIL: remitente verificado en Resend, p. ej. "Cartera CRM <avisos@tu-dominio.com>".
 * Se devuelven solo los NOMBRES de las variables que faltan, nunca sus valores.
 */
export const EMAIL_ENV_VARS = ["RESEND_API_KEY", "NOTIFICATIONS_FROM_EMAIL"] as const;

type Env = Record<string, string | undefined>;

export function missingEnv(names: readonly string[], env: Env = process.env) {
  return names.filter((n) => !cleanEnvValue(env[n]));
}

export function notificationsConfigStatus(env: Env = process.env) {
  const missing = missingEnv(EMAIL_ENV_VARS, env);
  return { emailConfigured: missing.length === 0, missing };
}
