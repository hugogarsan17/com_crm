/**
 * Normalización para detectar duplicados. Debe coincidir con
 * public.normalize_phone() y la columna email_normalized de la migración inicial.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0034") && d.length === 13) d = d.slice(4);
  else if (d.startsWith("34") && d.length === 11) d = d.slice(2);
  return d === "" ? null : d;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e === "" ? null : e;
}

export function normalizeReference(ref: string | null | undefined): string | null {
  const r = (ref ?? "").trim().toLowerCase();
  return r === "" ? null : r;
}

/** Limpia un término de búsqueda para usarlo de forma segura en filtros `or` de PostgREST. */
export function sanitizeSearchTerm(term: string) {
  return term
    .replace(/[%_,()"'\\*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
