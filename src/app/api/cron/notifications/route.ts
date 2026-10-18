import type { NextRequest } from "next/server";
import { notificationsConfigStatus } from "@/features/notifications/config";
import { sendEmail } from "@/features/notifications/email";
import { runNotifications } from "@/features/notifications/run";
import { supabaseNotificationStore } from "@/features/notifications/store";
import { APP_NAME } from "@/lib/app";
import { cleanEnvValue } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tarea programada de avisos por email (Vercel Cron: ver vercel.json y README).
 * Protegida con CRON_SECRET (cabecera Authorization: Bearer <CRON_SECRET>).
 * Si falta configuración responde 503 indicando qué variables faltan (sin valores)
 * y no marca ningún aviso como enviado.
 */
export async function GET(request: NextRequest) {
  const secret = cleanEnvValue(process.env.CRON_SECRET);
  if (!secret) {
    return Response.json({ error: "Avisos no configurados: falta CRON_SECRET." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const config = notificationsConfigStatus();
  if (!config.emailConfigured || !config.cronConfigured) {
    console.warn(`[avisos] Configuración incompleta. Faltan: ${config.missing.join(", ")}`);
    return Response.json(
      { status: "not_configured", missing: config.missing, message: "Configura las variables indicadas (ver README → Avisos por email)." },
      { status: 503 },
    );
  }

  const appUrl = (cleanEnvValue(process.env.NEXT_PUBLIC_SITE_URL) ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`).replace(/\/$/, "");
  const summary = await runNotifications({
    store: supabaseNotificationStore(createAdminClient()),
    send: sendEmail,
    emailConfigured: true,
    appUrl,
    appName: APP_NAME,
  });
  if (summary.errors.length) console.warn(`[avisos] ${summary.errors.length} incidencias en la ejecución.`);
  return Response.json(summary, { status: summary.emailsFailed > 0 ? 207 : 200 });
}
