import type { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors; code?: string };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  fieldErrors?: FieldErrors,
  code?: string,
): { ok: false; error: string; fieldErrors?: FieldErrors; code?: string } {
  return { ok: false, error, fieldErrors, code };
}

export function validationFailure(error: z.ZodError) {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail("Revisa los campos marcados.", fieldErrors);
}

/** Traduce errores de PostgREST/Postgres a mensajes comprensibles sin filtrar detalles internos. */
export function databaseErrorMessage(error: { code?: string; message?: string; hint?: string } | null | undefined) {
  if (!error) return "Ha ocurrido un error inesperado.";
  switch (error.code) {
    case "42501":
      return "No tienes permiso para realizar esta acción. Vuelve a iniciar sesión.";
    case "23514":
      return "Algún dato no cumple las reglas de validación.";
    case "23503":
      return "La ficha asociada no existe o no te pertenece.";
    case "P0002":
    case "PGRST116":
      return "No se ha encontrado el registro.";
    case "22023":
      return "Los parámetros enviados no son válidos.";
  }
  if (error.message?.toLowerCase().includes("fetch")) {
    return "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.";
  }
  return "No se pudo guardar. Inténtalo de nuevo.";
}
