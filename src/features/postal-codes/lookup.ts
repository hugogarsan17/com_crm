import "server-only";
import { isSpanishPostalCode, parseZippopotamPlaces, provinceForPostalCode, type PostalCodeLookup } from "./spain";

/**
 * Consulta la localidad de un código postal español en Zippopotam.us (datos de
 * GeoNames, sin clave). Dependencia externa: si el servicio no responde en
 * TIMEOUT_MS o falla, se devuelve "error" y el usuario escribe la localidad a mano.
 * La URL puede cambiarse con POSTAL_CODE_LOOKUP_URL (debe aceptar /{cp} y
 * devolver el mismo formato JSON).
 */
const DEFAULT_BASE_URL = "https://api.zippopotam.us/es";
const TIMEOUT_MS = 4000;

export async function lookupPostalCode(rawPostalCode: string, fetchImpl: typeof fetch = fetch): Promise<PostalCodeLookup> {
  const postalCode = rawPostalCode.trim();
  if (!isSpanishPostalCode(postalCode)) return { status: "unsupported", postalCode };
  const province = provinceForPostalCode(postalCode);
  const base = (process.env.POSTAL_CODE_LOOKUP_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  try {
    const res = await fetchImpl(`${base}/${postalCode}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { status: "not_found", postalCode, province };
    if (!res.ok) return { status: "error", postalCode, province };
    const localities = parseZippopotamPlaces(await res.json());
    return localities.length ? { status: "found", postalCode, province, localities } : { status: "not_found", postalCode, province };
  } catch {
    return { status: "error", postalCode, province };
  }
}
