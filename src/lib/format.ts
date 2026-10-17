import { DEFAULT_TIMEZONE } from "@/lib/dates";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const integer = new Intl.NumberFormat("es-ES");
const percent = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });

export function formatCurrency(value: number | null | undefined) {
  return value == null ? "—" : currency.format(value);
}

export function formatNumber(value: number) {
  return integer.format(value);
}

export function formatPercent(ratio: number | null) {
  return ratio == null ? "—" : percent.format(ratio);
}

export function formatDateTime(iso: string | null | undefined, tz: string = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined, tz: string = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  // Las fechas sin hora ("YYYY-MM-DD") se muestran tal cual, sin conversión de zona.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: isDateOnly ? "UTC" : tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isDateOnly ? `${iso}T00:00:00Z` : iso));
}

export function formatTime(iso: string, tz: string = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Enlace tel: a partir de un teléfono libre. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Enlace para abrir WhatsApp manualmente (no envía nada automáticamente). */
export function whatsappHref(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `34${digits}`;
  return `https://wa.me/${digits}`;
}
