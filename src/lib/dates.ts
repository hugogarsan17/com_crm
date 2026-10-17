import { TZDate } from "@date-fns/tz";
import { addDays, format, isValid, parseISO } from "date-fns";

export const DEFAULT_TIMEZONE = "Europe/Madrid";

const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** ¿Es "YYYY-MM-DD" una fecha real? */
export function isValidLocalDate(value: string) {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && y >= 1900 && y <= 2200;
}

/** ¿Es "YYYY-MM-DDTHH:mm" (formato de <input type="datetime-local">) una fecha real? */
export function isValidLocalDateTime(value: string) {
  const m = LOCAL_DATETIME_RE.exec(value);
  if (!m) return false;
  return isValidLocalDate(`${m[1]}-${m[2]}-${m[3]}`) && Number(m[4]) < 24 && Number(m[5]) < 60;
}

/** Convierte "YYYY-MM-DDTHH:mm" interpretado en la zona `tz` a ISO UTC. */
export function localDateTimeToIso(value: string, tz: string) {
  const m = LOCAL_DATETIME_RE.exec(value);
  if (!m || !isValidLocalDateTime(value)) throw new Error(`Fecha no válida: ${value}`);
  const date = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, tz);
  return new Date(date.getTime()).toISOString();
}

/** Convierte un instante ISO al formato de <input type="datetime-local"> en la zona `tz`. */
export function isoToLocalDateTime(iso: string | null | undefined, tz: string) {
  if (!iso) return "";
  const date = parseISO(iso);
  if (!isValid(date)) return "";
  return format(new TZDate(date, tz), "yyyy-MM-dd'T'HH:mm");
}

/** Fecha local de hoy ("YYYY-MM-DD") en la zona `tz`. */
export function todayInTimeZone(tz: string, now: Date = new Date()) {
  return format(new TZDate(now, tz), "yyyy-MM-dd");
}

/** Instantes de inicio y fin (exclusivo) del día local que contiene `now`. */
export function dayBoundsInTimeZone(tz: string, now: Date = new Date()) {
  const local = new TZDate(now, tz);
  const start = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, tz);
  const end = addDays(start, 1);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

/** "YYYY-MM-DDTHH:mm" desplazado `days` días desde ahora (en la zona `tz`), a las `hour`:00. */
export function localDateTimeFromNow(tz: string, days: number, hour = 10, now: Date = new Date()) {
  const local = new TZDate(now, tz);
  const target = new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + days, hour, 0, 0, tz);
  return format(target, "yyyy-MM-dd'T'HH:mm");
}

/** Suma días a un instante ISO conservando la hora local en la zona `tz`. */
export function addDaysKeepingLocalTime(iso: string, days: number, tz: string) {
  const local = new TZDate(parseISO(iso), tz);
  const moved = new TZDate(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + days,
    local.getHours(),
    local.getMinutes(),
    0,
    tz,
  );
  return new Date(moved.getTime()).toISOString();
}
