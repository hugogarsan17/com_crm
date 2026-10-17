"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { databaseErrorMessage, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { getActionContext, UNAUTHENTICATED_MESSAGE } from "@/lib/auth";
import { duplicateCheckSchema, importBatchSchema, type ImportRow } from "@/lib/validation/import";
import type { ExistingLeadKey } from "./csv";

const existingSchema = z.array(
  z.object({
    full_name: z.string(),
    phone_normalized: z.string().nullable(),
    email_normalized: z.string().nullable(),
    customer_reference: z.string().nullable(),
  }),
);

export async function checkDuplicates(keys: { phones: string[]; emails: string[]; references: string[] }): Promise<ActionResult<ExistingLeadKey[]>> {
  const parsed = duplicateCheckSchema.safeParse(keys);
  if (!parsed.success) return validationFailure(parsed.error);
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase.rpc("find_lead_duplicates", {
    p_phones: parsed.data.phones,
    p_emails: parsed.data.emails,
    p_references: parsed.data.references,
  });
  if (error) return fail(databaseErrorMessage(error));
  return ok(existingSchema.catch([]).parse(data));
}

/** Inserta un lote de forma atómica: o entran todas sus filas o ninguna. */
export async function importLeadsBatch(rows: ImportRow[]): Promise<ActionResult<{ inserted: number }>> {
  const parsed = importBatchSchema.safeParse(rows);
  if (!parsed.success) return fail("El lote contiene filas no válidas. Vuelve a validar el archivo.");
  const ctx = await getActionContext();
  if (!ctx) return fail(UNAUTHENTICATED_MESSAGE);

  const { data, error } = await ctx.supabase.rpc("import_leads", { p_rows: parsed.data });
  if (error) return fail(databaseErrorMessage(error));
  refresh();
  return ok({ inserted: typeof data === "number" ? data : parsed.data.length });
}
