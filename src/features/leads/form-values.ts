import { isoToLocalDateTime } from "@/lib/dates";
import type { LeadFormInput } from "@/lib/validation/lead";
import type { Tables } from "@/types/database.types";

export function emptyLeadFormValues(): LeadFormInput {
  return {
    full_name: "",
    phone: "",
    email: "",
    locality: "",
    customer_reference: "",
    current_policies: "",
    product_to_offer: "",
    source: "",
    status: "pending_contact",
    priority: "normal",
    notes: "",
    received_at: "",
    closed_reason: "",
    follow_up_title: "",
    follow_up_due_at: "",
  };
}

export function leadToFormValues(lead: Tables<"leads">, tz: string): LeadFormInput {
  return {
    full_name: lead.full_name,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    locality: lead.locality ?? "",
    customer_reference: lead.customer_reference ?? "",
    current_policies: lead.current_policies.join(", "),
    product_to_offer: lead.product_to_offer ?? "",
    source: lead.source ?? "",
    status: lead.status,
    priority: lead.priority,
    notes: lead.notes ?? "",
    received_at: isoToLocalDateTime(lead.received_at, tz),
    closed_reason: lead.closed_reason ?? "",
    follow_up_title: "",
    follow_up_due_at: "",
  };
}
