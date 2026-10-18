import { cleanEnvValue } from "@/lib/env";

/**
 * Configuración de los avisos por email (solo servidor). Variables:
 *  - RESEND_API_KEY: clave de la API de Resend (https://resend.com).
 *  - NOTIFICATIONS_FROM_EMAIL: remitente verificado en Resend, p. ej. "Cartera CRM <avisos@tu-dominio.com>".
 *  - SUPABASE_SERVICE_ROLE_KEY: para que la tarea programada lea las tareas de todos los usuarios.
 *  - CRON_SECRET: protege /api/cron/notifications (Vercel Cron lo envía como Bearer).
 * Se devuelven solo los NOMBRES de las variables que faltan, nunca sus valores.
 */
export const EMAIL_ENV_VARS = ["RESEND_API_KEY", "NOTIFICATIONS_FROM_EMAIL"] as const;
export const CRON_ENV_VARS = ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"] as const;

type Env = Record<string, string | undefined>;

export function missingEnv(names: readonly string[], env: Env = process.env) {
  return names.filter((n) => !cleanEnvValue(env[n]));
}

export function notificationsConfigStatus(env: Env = process.env) {
  const missingEmail = missingEnv(EMAIL_ENV_VARS, env);
  const missingCron = missingEnv(CRON_ENV_VARS, env);
  return {
    emailConfigured: missingEmail.length === 0,
    cronConfigured: missingCron.length === 0,
    missing: [...missingEmail, ...missingCron],
  };
}
