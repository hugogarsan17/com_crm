import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

/** Mensajes en español para los errores de Supabase Auth. */
export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return "No se pudo conectar con el servidor de autenticación. Comprueba tu conexión e inténtalo de nuevo.";
  }
  if (!isAuthError(error)) return "Ha ocurrido un error inesperado. Inténtalo de nuevo.";

  switch (error.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Tienes que confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada (y la carpeta de spam).";
    case "weak_password":
      return "La contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con este email. Inicia sesión o recupera tu contraseña.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la actual.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos en poco tiempo. Espera unos minutos y vuelve a intentarlo.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "El registro con email está deshabilitado en este momento.";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "Tu sesión ha caducado. Solicita un nuevo enlace o vuelve a iniciar sesión.";
    case "otp_expired":
      return "El enlace ha caducado o ya se ha usado. Solicita uno nuevo.";
    case "email_address_invalid":
      return "Este email no es válido.";
  }
  if (error.status === 0 || error.status === undefined) {
    return "No se pudo conectar con el servidor. Comprueba tu conexión.";
  }
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
