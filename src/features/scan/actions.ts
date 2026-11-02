"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { localDateTimeToIso } from "@/lib/dates";
import { normalizePhone } from "@/lib/normalize";
import { scanReviewSchema, type ScanReviewInput } from "@/lib/validation/scan";
import { funeralInsuranceToDb } from "@/features/leads/constants";

/**
 * Crea la ficha, la póliza que el cliente ya tiene y, opcionalmente, la primera tarea,
 * todo en una transacción (RPC create_lead_from_scan, con la sesión y la RLS del usuario).
 */
export async function createLeadFromScan(input: ScanReviewInput): Promise<ActionResult<{ id: string }>> {
  const parsed = scanReviewSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);
  const { user, supabase } = ctx;
  const { lead, policy, coverages, insured, task } = parsed.data;

  const { data, error } = await supabase.rpc("create_lead_from_scan", {
    p_lead: {
      ...lead,
      has_funeral_insurance: funeralInsuranceToDb(lead.has_funeral_insurance),
    },
    p_policy: {
      ...policy,
      policy_number: lead.customer_reference,
      consulted_at: policy.consulted_at ? localDateTimeToIso(policy.consulted_at, user.timezone) : null,
      coverages,
      insured,
    },
    p_task: task.enabled && task.title && task.due_at ? { title: task.title, due_at: localDateTimeToIso(task.due_at, user.timezone) } : null,
  });
  if (error || !data) return fail(databaseErrorMessage(error));

  refresh();
  return ok({ id: data }, task.enabled ? "Ficha creada con su póliza y la primera tarea." : "Ficha creada con su póliza.");
}

const duplicatesSchema = z.object({
  customer_reference: z.string().trim().max(80),
  phone: z.string().trim().max(30),
});

export type ScanDuplicate = { id: string; full_name: string; reasons: ("póliza" | "teléfono")[] };

/** Fichas existentes del usuario con el mismo número de póliza o teléfono. */
export async function findScanDuplicates(input: z.input<typeof duplicatesSchema>): Promise<ActionResult<ScanDuplicate[]>> {
  const parsed = duplicatesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const phone = normalizePhone(parsed.data.phone);
  const reference = parsed.data.customer_reference.toLowerCase();
  if (!phone && !reference) return ok([]);

  const { data, error } = await ctx.supabase.rpc("find_lead_duplicates", {
    p_phones: phone ? [phone] : [],
    p_emails: [],
    p_references: reference ? [reference] : [],
  });
  if (error) return fail(databaseErrorMessage(error));

  const rows = (data ?? []) as { id: string; full_name: string; phone_normalized: string | null; customer_reference: string | null }[];
  return ok(
    rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      reasons: [
        ...(reference && r.customer_reference === reference ? (["póliza"] as const) : []),
        ...(phone && r.phone_normalized === phone ? (["teléfono"] as const) : []),
      ],
    })),
  );
}
