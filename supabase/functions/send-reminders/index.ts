import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Autenticación propia: solo responde a pg_cron con el secreto guardado en Vault.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("NOTIFY_FROM") ?? "CRM <avisos@crm.hugogarsan.es>";
const REPLY_TO = Deno.env.get("NOTIFY_REPLY_TO");
const APP_URL = Deno.env.get("APP_URL");

type Row = {
  log_id: string;
  kind: "upcoming" | "overdue";
  task_title: string;
  task_description: string | null;
  due_at: string;
  lead_name: string;
  lead_phone: string | null;
  user_email: string;
  user_name: string | null;
  user_timezone: string;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function fmtDate(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(iso));
  }
}

function buildEmail(r: Row) {
  const when = fmtDate(r.due_at, r.user_timezone);
  const overdue = r.kind === "overdue";
  const subject = overdue
    ? `Seguimiento vencido: ${r.task_title} (${r.lead_name})`
    : `Recordatorio: ${r.task_title} (${r.lead_name})`;
  const hello = r.user_name ? `Hola ${esc(r.user_name)},` : "Hola,";
  const intro = overdue ? "Tienes un seguimiento <strong>vencido</strong>:" : "Tienes un seguimiento próximo:";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5;max-width:560px">
<p>${hello}</p>
<p>${intro}</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Tarea</td><td style="padding:4px 0"><strong>${esc(r.task_title)}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Cliente</td><td style="padding:4px 0">${esc(r.lead_name)}</td></tr>
${r.lead_phone ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Teléfono</td><td style="padding:4px 0">${esc(r.lead_phone)}</td></tr>` : ""}
<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Vence</td><td style="padding:4px 0">${esc(when)}</td></tr>
</table>
${r.task_description ? `<p style="color:#374151">${esc(r.task_description)}</p>` : ""}
${APP_URL ? `<p><a href="${esc(APP_URL)}" style="color:#2563eb">Abrir el CRM</a></p>` : ""}
<p style="font-size:12px;color:#9ca3af;margin-top:24px">Recibes este aviso porque tienes activados los recordatorios por email. Puedes desactivarlos en los ajustes del CRM.</p>
</div>`;
  const text = `${overdue ? "Seguimiento vencido" : "Seguimiento próximo"}\nTarea: ${r.task_title}\nCliente: ${r.lead_name}${r.lead_phone ? `\nTeléfono: ${r.lead_phone}` : ""}\nVence: ${when}${r.task_description ? `\n\n${r.task_description}` : ""}`;
  return { subject, html, text };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: ok, error: secretErr } = await supabase.rpc("notify_check_secret", {
    p_secret: req.headers.get("x-cron-secret") ?? "",
  });
  if (secretErr || ok !== true) return json({ error: "unauthorized" }, 401);
  if (!RESEND_API_KEY) return json({ error: "missing RESEND_API_KEY" }, 500);

  const { data, error } = await supabase.rpc("notify_claim_due");
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as Row[];

  let sent = 0, failed = 0;
  for (const r of rows) {
    const { subject, html, text } = buildEmail(r);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${r.log_id}`,
        },
        body: JSON.stringify({
          from: FROM,
          to: [r.user_email],
          subject,
          html,
          text,
          ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await supabase.rpc("notify_mark", { p_log_id: r.log_id, p_ok: true, p_provider_id: body.id ?? null, p_error: null });
        sent++;
      } else {
        await supabase.rpc("notify_mark", { p_log_id: r.log_id, p_ok: false, p_provider_id: null, p_error: `${res.status}: ${body.message ?? JSON.stringify(body)}` });
        failed++;
      }
    } catch (e) {
      await supabase.rpc("notify_mark", { p_log_id: r.log_id, p_ok: false, p_provider_id: null, p_error: String(e) });
      failed++;
    }
  }
  return json({ claimed: rows.length, sent, failed });
});
