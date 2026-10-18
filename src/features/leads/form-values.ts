import { isoToLocalDateTime } from "@/lib/dates";
import type { LeadFormInput } from "@/lib/validation/lead";
import type { Tables } from "@/types/database.types";
import { funeralInsuranceFromDb } from "./constants";

export function emptyLeadFormValues(): LeadFormInput {
  return {
    full_name: "",
    phone: "",
    email: "",
    postal_code: "",
    locality: "",
    customer_reference: "",
    has_funeral_insurance: "unknown",
    product_code: "",
    status: "pending_contact",
    priority: "normal",
    notes: "",
    received_at: "",
    closed_reason: "",
    follow_up_due_at: "",
  };
}

export function leadToFormValues(lead: Tables<"leads">, tz: string): LeadFormInput {
  return {
    full_name: lead.full_name,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    postal_code: lead.postal_code ?? "",
    locality: lead.locality ?? "",
    customer_reference: lead.customer_reference ?? "",
    has_funeral_insurance: funeralInsuranceFromDb(lead.has_funeral_insurance),
    product_code: lead.product_code ?? "",
    status: lead.status,
    priority: lead.priority,
    notes: lead.notes ?? "",
    received_at: isoToLocalDateTime(lead.received_at, tz),
    closed_reason: lead.closed_reason ?? "",
    follow_up_due_at: "",
  };
}
