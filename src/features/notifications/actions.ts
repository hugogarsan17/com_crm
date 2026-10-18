"use server";

import { refresh } from "next/cache";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { APP_NAME } from "@/lib/app";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { notificationPreferencesSchema, type NotificationPreferencesInput } from "@/lib/validation/notifications";
import { notificationsConfigStatus } from "./config";
import { sendEmail } from "./email";

export async function saveNotificationPreferences(input: NotificationPreferencesInput): Promise<ActionResult> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { error } = await ctx.supabase
    .from("notification_preferences")
    .upsert({ user_id: ctx.user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) return fail(databaseErrorMessage(error));
  refresh();

  const config = notificationsConfigStatus();
  if (parsed.data.email_enabled && (!config.emailConfigured || !config.cronConfigured)) {
    return ok(undefined, "Preferencias guardadas. Ojo: el envío de emails aún no está configurado en el servidor, así que no recibirás avisos.");
  }
  return ok(undefined, "Preferencias guardadas");
}

/** Envía un email de prueba al propio usuario. Si el proveedor no está configurado, lo dice: no simula el envío. */
export async function sendTestEmail(): Promise<ActionResult> {
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  if (!ctx.user.email) return fail("Tu cuenta no tiene email.");

  const result = await sendEmail({
    to: ctx.user.email,
    subject: `${APP_NAME}: email de prueba`,
    text: `Este es un email de prueba de ${APP_NAME}. Si lo recibes, los avisos de seguimientos funcionan.`,
    html: `<p>Este es un email de prueba de <strong>${APP_NAME}</strong>. Si lo recibes, los avisos de seguimientos funcionan.</p>`,
  });
  if (!result.ok) return fail(result.error);
  return ok(undefined, `Email de prueba enviado a ${ctx.user.email}. Revisa tu bandeja (y la carpeta de spam).`);
}
