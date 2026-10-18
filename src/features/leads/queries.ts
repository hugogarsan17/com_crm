import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { localDateTimeToIso } from "@/lib/dates";
import { sanitizeSearchTerm } from "@/lib/normalize";
import type { Tables } from "@/types/database.types";
import { CLOSED_LEAD_STATUSES, LEADS_PAGE_SIZE } from "./constants";
import type { LeadFilters } from "./search-params";

export const LEAD_LIST_COLUMNS =
  "id, full_name, phone, email, customer_reference, postal_code, locality, has_funeral_insurance, product_code, legacy_status, status, priority, next_action, next_follow_up_at, last_outcome, last_contact_at, received_at, archived_at" as const;

export type LeadListItem = Pick<
  Tables<"leads">,
  | "id"
  | "full_name"
  | "phone"
  | "email"
  | "customer_reference"
  | "postal_code"
  | "locality"
  | "has_funeral_insurance"
  | "product_code"
  | "legacy_status"
  | "status"
  | "priority"
  | "next_action"
  | "next_follow_up_at"
  | "last_outcome"
  | "last_contact_at"
  | "received_at"
  | "archived_at"
>;

export async function listLeads(filters: LeadFilters) {
  const { user, supabase } = await requireUser();

  let query = supabase.from("leads").select(LEAD_LIST_COLUMNS, { count: "exact" }).eq("user_id", user.id);

  query = filters.view === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  if (filters.q) {
    const term = sanitizeSearchTerm(filters.q);
    if (term) {
      const conditions = [
        `full_name.ilike.*${term}*`,
        `email.ilike.*${term}*`,
        `customer_reference.ilike.*${term}*`,
        `phone.ilike.*${term}*`,
      ];
      const digits = term.replace(/\D/g, "");
      if (digits.length >= 3) conditions.push(`phone_normalized.ilike.*${digits}*`);
      query = query.or(conditions.join(","));
    }
  }

  if (filters.status === "open") {
    query = query.not("status", "in", `(${CLOSED_LEAD_STATUSES.join(",")})`);
  } else if (filters.status === "closed") {
    query = query.in("status", [...CLOSED_LEAD_STATUSES]);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.product) query = query.eq("product_code", filters.product);
  if (filters.funeral === "unknown") query = query.is("has_funeral_insurance", null);
  else if (filters.funeral) query = query.eq("has_funeral_insurance", filters.funeral === "yes");
  if (filters.from) query = query.gte("received_at", localDateTimeToIso(`${filters.from}T00:00`, user.timezone));
  if (filters.to) query = query.lte("received_at", localDateTimeToIso(`${filters.to}T23:59`, user.timezone));

  switch (filters.sort) {
    case "received_asc":
      query = query.order("received_at", { ascending: true });
      break;
    case "follow_up_asc":
      query = query.order("next_follow_up_at", { ascending: true, nullsFirst: false }).order("received_at", { ascending: false });
      break;
    case "updated_desc":
      query = query.order("updated_at", { ascending: false });
      break;
    default:
      query = query.order("received_at", { ascending: false });
  }
  query = query.order("id");

  const fromIndex = (filters.page - 1) * LEADS_PAGE_SIZE;
  const { data, count, error } = await query.range(fromIndex, fromIndex + LEADS_PAGE_SIZE - 1);
  if (error) throw new Error("No se pudieron cargar las fichas.");

  return {
    leads: (data ?? []) as LeadListItem[],
    total: count ?? 0,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / LEADS_PAGE_SIZE)),
    timezone: user.timezone,
    fetchedAt: Date.now(),
  };
}

export async function getLeadDetail(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, supabase } = await requireUser();

  const [lead, activities, tasks, policies] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("activities").select("*").eq("lead_id", id).order("occurred_at", { ascending: false }).limit(200),
    supabase.from("tasks").select("*").eq("lead_id", id).order("due_at", { ascending: true }).limit(200),
    supabase.from("policies").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);

  if (lead.error || activities.error || tasks.error || policies.error) {
    throw new Error("No se pudo cargar la ficha.");
  }
  if (!lead.data) notFound();

  return {
    user,
    lead: lead.data,
    activities: activities.data,
    tasks: tasks.data,
    policies: policies.data,
  };
}

export async function getLeadForEdit(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("No se pudo cargar la ficha.");
  if (!data) notFound();
  return { user, lead: data };
}
