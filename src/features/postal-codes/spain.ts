/**
 * Códigos postales españoles: 5 dígitos; los dos primeros son el código INE de la
 * provincia (01–52). Se usa para validar el formato y decidir si se consulta la
 * localidad. Los códigos de otros países se aceptan sin consulta.
 */
export const SPANISH_POSTAL_CODE_RE = /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/;

/** Formato genérico aceptado (también códigos extranjeros): 3–10 letras, dígitos, espacios o guiones. */
export const POSTAL_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;

export const POSTAL_CODE_ERROR = "Código postal no válido (ejemplo: 28001)";

/** Provincias por código INE. */
export const SPANISH_PROVINCES: Record<string, string> = {
  "01": "Araba/Álava", "02": "Albacete", "03": "Alicante/Alacant", "04": "Almería", "05": "Ávila",
  "06": "Badajoz", "07": "Illes Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
  "11": "Cádiz", "12": "Castellón/Castelló", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña",
  "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
  "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
  "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia",
  "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo",
  "46": "Valencia/València", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza",
  "51": "Ceuta", "52": "Melilla",
};

/** Normaliza para guardar: sin espacios sobrantes y en mayúsculas. */
export function normalizePostalCode(raw: string) {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isValidPostalCode(raw: string) {
  return POSTAL_CODE_RE.test(normalizePostalCode(raw));
}

export function isSpanishPostalCode(raw: string) {
  return SPANISH_POSTAL_CODE_RE.test(raw.trim());
}

/** Cinco dígitos que no corresponden a ninguna provincia: probablemente un error de tecleo. */
export function looksLikeInvalidSpanishPostalCode(raw: string) {
  const v = raw.trim();
  return /^\d{5}$/.test(v) && !SPANISH_POSTAL_CODE_RE.test(v);
}

export function provinceForPostalCode(raw: string) {
  const v = raw.trim();
  return isSpanishPostalCode(v) ? (SPANISH_PROVINCES[v.slice(0, 2)] ?? null) : null;
}

export type PostalCodeLookup =
  | { status: "found"; postalCode: string; province: string | null; localities: string[] }
  | { status: "not_found"; postalCode: string; province: string | null }
  | { status: "unsupported"; postalCode: string }
  | { status: "error"; postalCode: string; province: string | null };

/** Extrae los nombres de localidad (sin duplicados, en el orden del servicio). */
export function parseZippopotamPlaces(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("places" in body) || !Array.isArray(body.places)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const place of body.places as unknown[]) {
    const name = place && typeof place === "object" && "place name" in place ? (place as Record<string, unknown>)["place name"] : null;
    if (typeof name !== "string") continue;
    const v = name.trim();
    if (v && v.length <= 120 && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}
