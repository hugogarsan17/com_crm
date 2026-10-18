"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { localDateTimeToIso } from "@/lib/dates";
import { leadSchema, setLeadStatusSchema, type LeadFormInput, type SetLeadStatusInput } from "@/lib/validation/lead";
import { funeralInsuranceToDb } from "./constants";

const leadIdSchema = z.uuid();

function toLeadRow(data: z.output<typeof leadSchema>, tz: string) {
  return {
    full_name: data.full_name,
    phone: data.phone,
    email: data.email,
    postal_code: data.postal_code,
    locality: data.locality,
    customer_reference: data.customer_reference,
    has_funeral_insurance: funeralInsuranceToDb(data.has_funeral_insurance),
    product_code: data.product_code,
    status: data.status,
    priority: data.priority,
    notes: data.notes,
    closed_reason: data.closed_reason,
    ...(data.received_at ? { received_at: localDateTimeToIso(data.received_at, tz) } : {}),
  };
}

export async function createLead(input: LeadFormInput): Promise<ActionResult<{ id: string }>> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { user, supabase } = ctx;

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({ ...toLeadRow(parsed.data, user.timezone), user_id: user.id })
    .select("id")
    .single();
  if (error || !lead) return fail(databaseErrorMessage(error));

  if (parsed.data.follow_up_due_at) {
    const { error: taskError } = await supabase.from("tasks").insert({
      user_id: user.id,
      lead_id: lead.id,
      title: "Primer contacto",
      due_at: localDateTimeToIso(parsed.data.follow_up_due_at, user.timezone),
    });
    if (taskError) {
      refresh();
      return ok({ id: lead.id }, "Ficha creada, pero no se pudo programar el seguimiento. Añádelo desde la ficha.");
    }
  }

  refresh();
  return ok({ id: lead.id }, "Ficha creada");
}

export async function updateLead(id: string, input: LeadFormInput): Promise<ActionResult<{ id: string }>> {
  if (!leadIdSchema.safeParse(id).success) return fail("Ficha no válida.");
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("leads")
    .update(toLeadRow(parsed.data, ctx.user.timezone))
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseErrorMessage(error));
  if (!data) return fail("No se ha encontrado la ficha.");

  refresh();
  return ok({ id }, "Cambios guardados");
}

export async function setLeadStatus(input: SetLeadStatusInput): Promise<ActionResult> {
  const parsed = setLeadStatusSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("leads")
    .update({ status: parsed.data.status, closed_reason: parsed.data.closed_reason })
    .eq("id", parsed.data.lead_id)
    .eq("user_id", ctx.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseErrorMessage(error));
  if (!data) return fail("No se ha encontrado la ficha.");

  refresh();
  return ok(undefined, "Estado actualizado");
}

export async function setLeadArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!leadIdSchema.safeParse(id).success) return fail("Ficha no válida.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("leads")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseErrorMessage(error));
  if (!data) return fail("No se ha encontrado la ficha.");

  refresh();
  return ok(undefined, archived ? "Ficha archivada" : "Ficha restaurada");
}

/** Borrado definitivo (con actividades, tareas y pólizas). La UI pide confirmación. */
export async function deleteLead(id: string): Promise<ActionResult> {
  if (!leadIdSchema.safeParse(id).success) return fail("Ficha no válida.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id");
  if (error) return fail(databaseErrorMessage(error));
  if (!data?.length) return fail("No se ha encontrado la ficha.");

  refresh();
  return ok(undefined, "Ficha eliminada definitivamente");
}
