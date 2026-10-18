/**
 * Lógica pura de la importación CSV: mapeo de columnas, validación por fila
 * y detección de duplicados. Se ejecuta en el navegador y se prueba con Vitest.
 */
import { isValidLocalDate, isValidLocalDateTime, localDateTimeToIso } from "@/lib/dates";
import { normalizeEmail, normalizePhone, normalizeReference } from "@/lib/normalize";
import { EMAIL_ERROR, isValidEmail, isValidPhone, PHONE_ERROR } from "@/lib/validation/common";
import type { ImportRow } from "@/lib/validation/import";
import type { LeadPriority } from "@/features/leads/constants";
import { isValidPostalCode, normalizePostalCode, POSTAL_CODE_ERROR } from "@/features/postal-codes/spain";
import { matchProduct, type Product } from "@/features/products/catalog";

export const IMPORT_FIELDS = [
  { key: "full_name", label: "Nombre", required: true, synonyms: ["nombre", "nombre completo", "cliente", "nombre y apellidos", "name", "full name", "titular"] },
  { key: "phone", label: "Teléfono", required: false, synonyms: ["telefono", "teléfono", "tel", "movil", "móvil", "phone", "celular"] },
  { key: "email", label: "Email", required: false, synonyms: ["email", "e-mail", "correo", "correo electronico", "correo electrónico", "mail"] },
  { key: "postal_code", label: "Código postal", required: false, synonyms: ["codigo postal", "código postal", "cp", "c p", "c.p.", "postal", "zip", "postal code"] },
  { key: "locality", label: "Localidad", required: false, synonyms: ["localidad", "poblacion", "población", "ciudad", "municipio", "city"] },
  {
    key: "customer_reference",
    label: "Número de póliza",
    required: false,
    // "referencia" se mantiene por compatibilidad con los CSV anteriores.
    synonyms: ["numero de poliza", "número de póliza", "nº poliza", "nº póliza", "n poliza", "num poliza", "poliza", "póliza", "policy number", "referencia", "ref"],
  },
  {
    key: "has_funeral_insurance",
    label: "Seguro de decesos",
    required: false,
    synonyms: ["seguro de decesos", "decesos", "tiene decesos", "tiene seguro de decesos", "¿tiene seguro de decesos?"],
  },
  { key: "product", label: "Producto", required: false, synonyms: ["producto", "producto a ofrecer", "product"] },
  { key: "priority", label: "Prioridad", required: false, synonyms: ["prioridad", "priority"] },
  { key: "notes", label: "Notas", required: false, synonyms: ["notas", "observaciones", "comentarios", "notes"] },
  { key: "received_at", label: "Fecha de recepción", required: false, synonyms: ["fecha", "fecha recepcion", "fecha de recepción", "fecha de recepcion", "recibido", "received"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Record<ImportFieldKey, string>;
export type CsvRecord = Record<string, string | undefined>;

export const MAX_IMPORT_ROWS = 5000;

function canon(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Propone una asignación de columnas a partir de las cabeceras del CSV. */
export function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<string>();
  const mapping = {} as ColumnMapping;
  for (const field of IMPORT_FIELDS) {
    const synonyms = field.synonyms.map(canon);
    const match = headers.find((h) => !used.has(h) && synonyms.includes(canon(h)));
    mapping[field.key] = match ?? "";
    if (match) used.add(match);
  }
  return mapping;
}

/** Fecha de un CSV → ISO. Acepta dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd y hora opcional HH:mm. */
export function parseImportDate(raw: string, tz: string): string | null | "invalid" {
  const v = raw.trim();
  if (!v) return null;
  let y: string, m: string, d: string;
  let time = "09:00";
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v);
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v);
  if (dmy) {
    [d, m, y] = [dmy[1], dmy[2], dmy[3]];
    if (dmy[4]) time = `${dmy[4].padStart(2, "0")}:${dmy[5]}`;
  } else if (ymd) {
    [y, m, d] = [ymd[1], ymd[2], ymd[3]];
    if (ymd[4]) time = `${ymd[4].padStart(2, "0")}:${ymd[5]}`;
  } else {
    return "invalid";
  }
  const date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const local = `${date}T${time}`;
  if (!isValidLocalDate(date) || !isValidLocalDateTime(local)) return "invalid";
  return localDateTimeToIso(local, tz);
}

/** Sí / No / vacío (sin indicar). Nunca convierte un vacío en "no". */
export function parseFuneralInsurance(raw: string): boolean | null | "invalid" {
  const v = canon(raw).replace(/[¿?]/g, "").trim();
  if (!v || ["sin indicar", "desconocido", "no consta", "ns", "nc", "ns/nc", "-"].includes(v)) return null;
  if (["si", "s", "yes", "y", "1", "true", "x", "tiene"].includes(v)) return true;
  if (["no", "n", "0", "false", "no tiene"].includes(v)) return false;
  return "invalid";
}

export function parsePriority(raw: string): LeadPriority | "invalid" {
  const v = canon(raw);
  if (!v || v === "normal" || v === "media" || v === "medium" || v === "2") return "normal";
  if (["alta", "high", "urgente", "3"].includes(v)) return "high";
  if (["baja", "low", "1"].includes(v)) return "low";
  return "invalid";
}

export type DuplicateInfo = { source: "file" | "existing"; field: "teléfono" | "email" | "número de póliza"; matchName: string };

export type ParsedRow = {
  /** Número de línea en el CSV (cabecera = 1). */
  line: number;
  record: CsvRecord;
  value: ImportRow | null;
  errors: string[];
  duplicate: DuplicateInfo | null;
};

function cell(record: CsvRecord, mapping: ColumnMapping, key: ImportFieldKey) {
  const col = mapping[key];
  return col ? (record[col] ?? "").trim() : "";
}

function optional(value: string, max: number, label: string, errors: string[]) {
  if (!value) return null;
  if (value.length > max) errors.push(`${label}: máximo ${max} caracteres`);
  return value;
}

export function validateRecord(
  record: CsvRecord,
  mapping: ColumnMapping,
  tz: string,
  line: number,
  products: readonly Product[],
): ParsedRow {
  const errors: string[] = [];

  const fullName = cell(record, mapping, "full_name");
  if (!fullName) errors.push("Falta el nombre");
  else if (fullName.length > 200) errors.push("Nombre: máximo 200 caracteres");

  const phone = cell(record, mapping, "phone");
  if (phone && !isValidPhone(phone)) errors.push(PHONE_ERROR);

  const email = cell(record, mapping, "email");
  if (email && !isValidEmail(email)) errors.push(EMAIL_ERROR);

  const rawPostalCode = cell(record, mapping, "postal_code");
  if (rawPostalCode && !isValidPostalCode(rawPostalCode)) errors.push(POSTAL_CODE_ERROR);

  const funeral = parseFuneralInsurance(cell(record, mapping, "has_funeral_insurance"));
  if (funeral === "invalid") errors.push("Seguro de decesos no reconocido (usa sí, no o déjalo vacío)");

  const rawProduct = cell(record, mapping, "product");
  const product = rawProduct ? matchProduct(products, rawProduct) : null;
  if (rawProduct && !product) {
    errors.push(`Producto «${rawProduct.slice(0, 40)}» fuera del catálogo (${products.filter((p) => p.active).map((p) => p.label).join(", ")})`);
  }

  const priority = parsePriority(cell(record, mapping, "priority"));
  if (priority === "invalid") errors.push("Prioridad no reconocida (usa alta, normal o baja)");

  const receivedAt = parseImportDate(cell(record, mapping, "received_at"), tz);
  if (receivedAt === "invalid") errors.push("Fecha de recepción no válida (usa dd/mm/aaaa)");

  const value: ImportRow = {
    full_name: fullName,
    phone: phone || null,
    email: email ? email.toLowerCase() : null,
    postal_code: rawPostalCode && isValidPostalCode(rawPostalCode) ? normalizePostalCode(rawPostalCode) : null,
    locality: optional(cell(record, mapping, "locality"), 120, "Localidad", errors),
    customer_reference: optional(cell(record, mapping, "customer_reference"), 80, "Número de póliza", errors),
    has_funeral_insurance: funeral === "invalid" ? null : funeral,
    product_code: product?.code ?? null,
    priority: priority === "invalid" ? "normal" : priority,
    notes: optional(cell(record, mapping, "notes"), 5000, "Notas", errors),
    received_at: receivedAt === "invalid" ? null : receivedAt,
  };

  return { line, record, value: errors.length ? null : value, errors, duplicate: null };
}

export function validateRecords(records: CsvRecord[], mapping: ColumnMapping, tz: string, products: readonly Product[]): ParsedRow[] {
  return records.map((r, i) => validateRecord(r, mapping, tz, i + 2, products));
}

export type ExistingLeadKey = {
  full_name: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  customer_reference: string | null;
};

/** Claves normalizadas de las filas válidas, para consultar duplicados en la base de datos. */
export function collectKeys(rows: ParsedRow[]) {
  const phones = new Set<string>();
  const emails = new Set<string>();
  const references = new Set<string>();
  for (const r of rows) {
    if (!r.value) continue;
    const p = normalizePhone(r.value.phone);
    const e = normalizeEmail(r.value.email);
    const ref = normalizeReference(r.value.customer_reference);
    if (p) phones.add(p);
    if (e) emails.add(e);
    if (ref) references.add(ref);
  }
  return { phones: [...phones], emails: [...emails], references: [...references] };
}

/** Marca duplicados contra la base de datos y dentro del propio archivo (se conserva la primera aparición). */
export function markDuplicates(rows: ParsedRow[], existing: ExistingLeadKey[]): ParsedRow[] {
  const byPhone = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byRef = new Map<string, string>();
  for (const e of existing) {
    if (e.phone_normalized) byPhone.set(e.phone_normalized, e.full_name);
    if (e.email_normalized) byEmail.set(e.email_normalized, e.full_name);
    if (e.customer_reference) byRef.set(e.customer_reference, e.full_name);
  }

  const seenPhone = new Map<string, string>();
  const seenEmail = new Map<string, string>();
  const seenRef = new Map<string, string>();

  return rows.map((row) => {
    if (!row.value) return { ...row, duplicate: null };
    const p = normalizePhone(row.value.phone);
    const e = normalizeEmail(row.value.email);
    const ref = normalizeReference(row.value.customer_reference);

    let duplicate: DuplicateInfo | null = null;
    if (p && byPhone.has(p)) duplicate = { source: "existing", field: "teléfono", matchName: byPhone.get(p)! };
    else if (e && byEmail.has(e)) duplicate = { source: "existing", field: "email", matchName: byEmail.get(e)! };
    else if (ref && byRef.has(ref)) duplicate = { source: "existing", field: "número de póliza", matchName: byRef.get(ref)! };
    else if (p && seenPhone.has(p)) duplicate = { source: "file", field: "teléfono", matchName: seenPhone.get(p)! };
    else if (e && seenEmail.has(e)) duplicate = { source: "file", field: "email", matchName: seenEmail.get(e)! };
    else if (ref && seenRef.has(ref)) duplicate = { source: "file", field: "número de póliza", matchName: seenRef.get(ref)! };

    const label = `${row.value.full_name} (línea ${row.line})`;
    if (p && !seenPhone.has(p)) seenPhone.set(p, label);
    if (e && !seenEmail.has(e)) seenEmail.set(e, label);
    if (ref && !seenRef.has(ref)) seenRef.set(ref, label);

    return { ...row, duplicate };
  });
}

export function summarize(rows: ParsedRow[]) {
  const invalid = rows.filter((r) => !r.value).length;
  const duplicates = rows.filter((r) => r.value && r.duplicate).length;
  const clean = rows.filter((r) => r.value && !r.duplicate).length;
  return { total: rows.length, invalid, duplicates, clean };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
