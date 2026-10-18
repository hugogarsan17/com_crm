import { ACTIVITY_OUTCOME_LABELS } from "@/features/activities/constants";
import {
  FUNERAL_INSURANCE_LABELS,
  funeralInsuranceFromDb,
  LEAD_PRIORITY_LABELS,
  LEAD_STATUS_LABELS,
  RETIRED_LEAD_STATUS_LABELS,
} from "@/features/leads/constants";
import { productLabel } from "@/features/products/catalog";
import { getCurrentUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayInTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

const PAGE = 1000;

/** Seguro de decesos en el CSV: "Sí", "No" o vacío (sin indicar), reimportable tal cual. */
function funeralCell(value: boolean | null) {
  const v = funeralInsuranceFromDb(value);
  return v === "unknown" ? "" : FUNERAL_INSURANCE_LABELS[v];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  const supabase = await createClient();

  const { data: products, error: productsError } = await supabase.from("products").select("code, label, active");
  if (productsError) return new Response("No se pudieron exportar las fichas", { status: 500 });

  const all: Tables<"leads">[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .order("received_at", { ascending: true })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return new Response("No se pudieron exportar las fichas", { status: 500 });
    all.push(...data);
    if (data.length < PAGE) break;
  }

  const body = toCsv(
    [
      "Nombre", "Teléfono", "Email", "Código postal", "Localidad", "Número de póliza", "Seguro de decesos", "Producto",
      "Estado", "Estado anterior", "Prioridad", "Último resultado", "Último contacto", "Próxima acción", "Próximo seguimiento",
      "Recibida", "Cerrada", "Motivo de cierre", "Archivada", "Notas",
    ],
    all.map((l) => [
      l.full_name, l.phone, l.email, l.postal_code, l.locality, l.customer_reference, funeralCell(l.has_funeral_insurance),
      l.product_code ? productLabel(products, l.product_code) : "",
      LEAD_STATUS_LABELS[l.status], l.legacy_status ? (RETIRED_LEAD_STATUS_LABELS[l.legacy_status] ?? l.legacy_status) : "",
      LEAD_PRIORITY_LABELS[l.priority],
      l.last_outcome ? ACTIVITY_OUTCOME_LABELS[l.last_outcome] : "", l.last_contact_at, l.next_action, l.next_follow_up_at,
      l.received_at, l.closed_at, l.closed_reason, l.archived_at, l.notes,
    ]),
  );
  return csvResponse(`fichas-${todayInTimeZone(user.timezone)}.csv`, body);
}
