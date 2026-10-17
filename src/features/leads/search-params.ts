import { z } from "zod";
import { isValidLocalDate } from "@/lib/dates";
import { LEAD_PRIORITIES, LEAD_SORTS, LEAD_STATUSES, type LeadSort } from "./constants";

const optionalString = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined))
  .catch(undefined);

const optionalDate = z
  .string()
  .optional()
  .refine((v) => v === undefined || v === "" || isValidLocalDate(v))
  .transform((v) => (v ? v : undefined))
  .catch(undefined);

export const leadFiltersSchema = z.object({
  q: optionalString,
  status: z.union([z.enum(LEAD_STATUSES), z.literal("open"), z.literal("closed")]).optional().catch(undefined),
  priority: z.enum(LEAD_PRIORITIES).optional().catch(undefined),
  product: optionalString,
  from: optionalDate,
  to: optionalDate,
  sort: z
    .enum(Object.keys(LEAD_SORTS) as [LeadSort, ...LeadSort[]])
    .optional()
    .catch(undefined)
    .transform((v) => v ?? "received_desc"),
  view: z.enum(["active", "archived"]).optional().catch(undefined).transform((v) => v ?? "active"),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined).transform((v) => v ?? 1),
});

export type LeadFilters = z.output<typeof leadFiltersSchema>;

type RawParams = Record<string, string | string[] | undefined>;

export function parseLeadFilters(params: RawParams): LeadFilters {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = Array.isArray(v) ? v[0] : v;
  return leadFiltersSchema.parse(flat);
}

/** Construye la query string para enlaces de filtros/paginación, omitiendo valores por defecto. */
export function leadFiltersToSearch(filters: Partial<LeadFilters>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "sort" && v === "received_desc") continue;
    if (k === "view" && v === "active") continue;
    if (k === "page" && v === 1) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
