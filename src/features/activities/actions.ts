"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { localDateTimeToIso } from "@/lib/dates";
import { logActivitySchema, type LogActivityInput } from "@/lib/validation/activity";

/** Registra un contacto: actividad + cambio de estado + seguimiento, en una transacción (RPC). */
export async function logActivity(input: LogActivityInput): Promise<ActionResult<{ activityId: string }>> {
  const parsed = logActivitySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const v = parsed.data;
  const tz = ctx.user.timezone;

  const { data, error } = await ctx.supabase.rpc("log_activity", {
    p_lead_id: v.lead_id,
    p_channel: v.channel,
    p_outcome: v.outcome,
    p_occurred_at: localDateTimeToIso(v.occurred_at, tz),
    p_summary: v.summary,
    p_new_status: v.new_status,
    p_closed_reason: v.closed_reason,
    p_follow_up_title: v.schedule_follow_up ? v.follow_up_title : null,
    p_follow_up_due_at: v.schedule_follow_up && v.follow_up_due_at ? localDateTimeToIso(v.follow_up_due_at, tz) : null,
  });
  if (error) return fail(databaseErrorMessage(error));

  const activityId = (data as { activity_id?: string } | null)?.activity_id ?? "";
  refresh();
  return ok({ activityId }, "Contacto registrado");
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Actividad no válida.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id");
  if (error) return fail(databaseErrorMessage(error));
  if (!data?.length) return fail("No se ha encontrado la actividad.");
  refresh();
  return ok(undefined, "Actividad eliminada");
}
