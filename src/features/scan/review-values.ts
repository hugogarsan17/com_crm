import type { ScanReviewInput } from "@/lib/validation/scan";
import { hasFuneralCoverage, type ConsultaAbreviada } from "./consulta-abreviada";

/** Ruta del JSON de la hoja → campo del formulario de revisión. */
const FIELD_MAP: Record<string, string> = {
  "poliza.producto": "policy.product_reference",
  "poliza.numero_poliza": "lead.customer_reference",
  "poliza.fecha_efecto": "policy.effect_date",
  "poliza.tipo": "policy.policy_type",
  "poliza.forma_pago": "policy.payment_frequency",
  "poliza.situacion": "policy.status_code",
  "poliza.fecha_baja": "policy.cancel_date",
  "poliza.cubierto_hasta": "policy.covered_until",
  "poliza.prima_anual": "policy.annual_premium",
  "poliza.primer_recibo": "policy.first_receipt_amount",
  "poliza.siguientes_recibos": "policy.next_receipt_amount",
  "poliza.fecha_consulta": "policy.consulted_at",
  "tomador.nombre": "lead.full_name",
  "tomador.telefono": "lead.phone",
  "tomador.domicilio": "lead.address",
  "tomador.municipio": "lead.locality",
  "tomador.codigo_postal": "lead.postal_code",
  "garantias": "coverages",
  "asegurados": "insured",
};

export function reviewFieldFor(path: string) {
  if (FIELD_MAP[path]) return FIELD_MAP[path];
  const m = /^(garantias|asegurados)\.(\d+)\.(\w+)$/.exec(path);
  if (m) return `${FIELD_MAP[m[1]]}.${m[2]}.${m[3]}`;
  return null;
}

const amount = (v: number | null) => (v == null ? "" : v.toFixed(2).replace(".", ","));

function titleCase(value: string | null) {
  if (!value) return "";
  const particles = new Set(["de", "del", "la", "las", "los", "y", "e", "i"]);
  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) => (i > 0 && particles.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

/**
 * Valores iniciales de la revisión a partir de la hoja leída. Lo dudoso llega vacío
 * (con su lectura como pista); el DNI no forma parte del formulario.
 */
export function scanToReviewValues(sheet: ConsultaAbreviada, defaultTaskDueLocal: string) {
  const values: ScanReviewInput = {
    lead: {
      full_name: sheet.tomador.nombre ?? "",
      phone: sheet.tomador.telefono ?? "",
      secondary_phone: "",
      address: titleCase(sheet.tomador.domicilio),
      postal_code: sheet.tomador.codigo_postal ?? "",
      locality: titleCase(sheet.tomador.municipio),
      customer_reference: sheet.poliza.numero_poliza ?? "",
      // SER.DECESOS → sí; si no aparece no se deduce «no».
      has_funeral_insurance: hasFuneralCoverage(sheet.garantias) ? "yes" : "unknown",
      product_code: "",
      priority: "normal",
      notes: "",
    },
    policy: {
      product_reference: sheet.poliza.producto ?? "",
      effect_date: sheet.poliza.fecha_efecto ?? "",
      policy_type: sheet.poliza.tipo ?? "",
      payment_frequency: sheet.poliza.forma_pago ?? "",
      status_code: sheet.poliza.situacion ?? "",
      cancel_date: sheet.poliza.fecha_baja ?? "",
      covered_until: sheet.poliza.cubierto_hasta ?? "",
      annual_premium: amount(sheet.poliza.prima_anual),
      first_receipt_amount: amount(sheet.poliza.primer_recibo),
      next_receipt_amount: amount(sheet.poliza.siguientes_recibos),
      consulted_at: sheet.poliza.fecha_consulta?.slice(0, 16) ?? "",
    },
    coverages: sheet.garantias.map((g) => ({ nombre: g.nombre ?? "", estado: g.estado ?? "" })),
    insured: sheet.asegurados.map((a) => ({
      orden: a.orden == null ? "" : String(a.orden),
      nombre: a.nombre ?? "",
      edad_real: a.edad_real == null ? "" : String(a.edad_real),
      edad_derecho: a.edad_derecho == null ? "" : String(a.edad_derecho),
      baja: a.baja ?? "",
      motivo: a.motivo ?? "",
    })),
    task: { enabled: false, title: "Primer contacto", due_at: defaultTaskDueLocal },
  };

  const doubtful: Record<string, string | null> = {};
  for (const path of sheet.dudosos) {
    const field = reviewFieldFor(path);
    if (field) doubtful[field] = sheet.lecturas[path] ?? null;
  }
  return { values, doubtful, dni: sheet.tomador.dni, dniReading: sheet.lecturas["tomador.dni"] ?? null };
}
