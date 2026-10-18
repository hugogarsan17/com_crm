"use server";

import { refresh } from "next/cache";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { addDaysKeepingLocalTime, localDateTimeToIso } from "@/lib/dates";
import { sanitizeSearchTerm } from "@/lib/normalize";
import {
  leadSearchSchema,
  postponeTaskSchema,
  taskIdSchema,
  taskSchema,
  updateTaskSchema,
  type PostponeTaskInput,
  type TaskInput,
  type UpdateTaskInput,
} from "@/lib/validation/task";
import type { TaskStatus } from "./constants";

export async function createTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.user.id,
      lead_id: parsed.data.lead_id,
      title: parsed.data.title,
      description: parsed.data.description,
      due_at: localDateTimeToIso(parsed.data.due_at, ctx.user.timezone),
    })
    .select("id")
    .single();
  if (error || !data) return fail(databaseErrorMessage(error));
  refresh();
  return ok({ id: data.id }, "Seguimiento programado");
}

/** Edita título, detalles, fecha y ficha de una tarea. */
export async function updateTask(input: UpdateTaskInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({
      lead_id: parsed.data.lead_id,
      title: parsed.data.title,
      description: parsed.data.description,
      due_at: localDateTimeToIso(parsed.data.due_at, ctx.user.timezone),
    })
    .eq("id", parsed.data.task_id)
    .eq("user_id", ctx.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseErrorMessage(error));
  if (!data) return fail("No se ha encontrado el seguimiento.");
  refresh();
  return ok({ id: data.id }, "Seguimiento actualizado");
}

export type LeadOption = { id: string; full_name: string; phone: string | null; locality: string | null };

/** Fichas activas del usuario para vincular una tarea (búsqueda por nombre, teléfono o número de póliza). */
export async function searchLeadOptions(query: string): Promise<ActionResult<LeadOption[]>> {
  const parsed = leadSearchSchema.safeParse(query);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  let q = ctx.supabase
    .from("leads")
    .select("id, full_name, phone, locality")
    .eq("user_id", ctx.user.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  const term = sanitizeSearchTerm(parsed.data);
  if (term) q = q.or(`full_name.ilike.*${term}*,phone.ilike.*${term}*,customer_reference.ilike.*${term}*`);
  const { data, error } = await q;
  if (error) return fail(databaseErrorMessage(error));
  return ok(data);
}

async function setTaskStatus(taskId: string, status: TaskStatus, message: string): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse({ task_id: taskId });
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({ status })
    .eq("id", parsed.data.task_id)
    .eq("user_id", ctx.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseErrorMessage(error));
  if (!data) return fail("No se ha encontrado el seguimiento.");
  refresh();
  return ok(undefined, message);
}

export async function completeTask(taskId: string) {
  return setTaskStatus(taskId, "completed", "Seguimiento completado");
}

export async function cancelTask(taskId: string) {
  return setTaskStatus(taskId, "cancelled", "Seguimiento cancelado");
}

export async function reopenTask(taskId: string) {
  return setTaskStatus(taskId, "pending", "Seguimiento reabierto");
}

/** Pospone N días (manteniendo la hora) o a una fecha concreta. */
export async function postponeTask(input: PostponeTaskInput): Promise<ActionResult> {
  const parsed = postponeTaskSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const tz = ctx.user.timezone;

  let dueAt: string;
  if ("days" in parsed.data) {
    const { data: task, error } = await ctx.supabase
      .from("tasks")
      .select("due_at")
      .eq("id", parsed.data.task_id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return fail(databaseErrorMessage(error));
    if (!task) return fail("No se ha encontrado el seguimiento.");
    // Si ya estaba vencida, se pospone desde hoy (misma hora) para no dejarla en el pasado.
    const base = new Date(task.due_at) < new Date() ? new Date().toISOString() : task.due_at;
    dueAt = addDaysKeepingLocalTime(base, parsed.data.days, tz);
  } else {
    dueAt = localDateTimeToIso(parsed.data.due_at, tz);
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({ due_at: dueAt, status: "pending" })
    .eq("id", parsed.data.task_id)
    .eq("user_id", ctx.user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseErrorMessage(error));
  if (!data) return fail("No se ha encontrado el seguimiento.");
  refresh();
  return ok(undefined, "Seguimiento reprogramado");
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse({ task_id: taskId });
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { data, error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("id", parsed.data.task_id)
    .eq("user_id", ctx.user.id)
    .select("id");
  if (error) return fail(databaseErrorMessage(error));
  if (!data?.length) return fail("No se ha encontrado el seguimiento.");
  refresh();
  return ok(undefined, "Seguimiento eliminado");
}
