import type { PostalCodeLookup } from "./spain";

/**
 * Decide qué localidad poner tras consultar un código postal.
 * Solo se rellena si el campo está vacío o conserva el último valor rellenado
 * automáticamente: nunca se sobrescribe lo que el usuario ha escrito a mano.
 * Devuelve null si no hay que tocar el campo.
 */
export function autofillLocality(current: string, lastAutofilled: string | null, lookup: PostalCodeLookup): string | null {
  if (lookup.status !== "found") return null;
  const value = current.trim();
  const editedByUser = value !== "" && value !== (lastAutofilled ?? "").trim();
  if (editedByUser) return null;
  const next = lookup.localities[0];
  return next && next !== value ? next : null;
}

/** Mensaje de ayuda bajo el campo según el resultado de la consulta. */
export function lookupMessage(lookup: PostalCodeLookup | null, filled: boolean): string | null {
  if (!lookup) return null;
  switch (lookup.status) {
    case "found":
      if (lookup.localities.length > 1) return `Este código postal tiene ${lookup.localities.length} localidades; revisa que la elegida sea la correcta.`;
      return filled ? "Localidad completada a partir del código postal. Puedes editarla." : null;
    case "not_found":
      return "No se ha encontrado la localidad de este código postal. Escríbela a mano.";
    case "error":
      return "No se pudo consultar la localidad ahora mismo. Escríbela a mano.";
    case "unsupported":
      return null;
  }
}
