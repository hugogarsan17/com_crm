import "server-only";
import { cleanEnvValue } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey?: string };
export type SendResult = { ok: true; id: string | null } | { ok: false; error: string; notConfigured?: boolean };
export type EmailSender = (message: EmailMessage) => Promise<SendResult>;

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Envía un email con la API REST de Resend. Sin RESEND_API_KEY o remitente devuelve
 * { ok: false, notConfigured: true }: nunca simula un envío. Las claves no se registran.
 */
export const sendEmail: EmailSender = async (message) => {
  const apiKey = cleanEnvValue(process.env.RESEND_API_KEY);
  const from = cleanEnvValue(process.env.NOTIFICATIONS_FROM_EMAIL);
  if (!apiKey || !from) {
    return { ok: false, error: "El envío de emails no está configurado (faltan RESEND_API_KEY o NOTIFICATIONS_FROM_EMAIL).", notConfigured: true };
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
    if (!res.ok) return { ok: false, error: `Resend respondió ${res.status}: ${(body?.message ?? body?.name ?? "error").slice(0, 200)}` };
    return { ok: true, id: body?.id ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "Tiempo de espera agotado al contactar con Resend." : "No se pudo contactar con Resend." };
  }
};
