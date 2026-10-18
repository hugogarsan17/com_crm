import { TZDate } from "@date-fns/tz";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { isValidLocalDate } from "@/lib/dates";

export const PERIOD_PRESETS = {
  this_week: "Esta semana",
  this_month: "Este mes",
  last_month: "Mes anterior",
  month: "Elegir mes…",
  last_30: "Últimos 30 días",
  last_90: "Últimos 90 días",
  this_year: "Este año",
  custom: "Personalizado",
} as const;

export type PeriodPreset = keyof typeof PERIOD_PRESETS;
export type Bucket = "day" | "week" | "month";

export type ResolvedPeriod = {
  preset: PeriodPreset;
  from: string;
  to: string;
  bucket: Bucket;
  /** "YYYY-MM" cuando el periodo es exactamente un mes natural (este mes, mes anterior o un mes elegido). */
  month: string | null;
};

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: string | undefined): value is string {
  if (!value || !MONTH_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2200;
}

/** "2026-10" → "octubre de 2026". */
export function formatMonth(month: string) {
  const d = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Mes anterior y siguiente ("YYYY-MM"); el siguiente es null si sería futuro respecto a `currentMonth`. */
export function adjacentMonths(month: string, currentMonth: string) {
  const base = parseISO(`${month}-01`);
  const prev = format(subMonths(base, 1), "yyyy-MM");
  const next = format(addMonths(base, 1), "yyyy-MM");
  return { prev, next: next <= currentMonth ? next : null };
}

const MAX_DAYS = 1095;

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function bucketFor(from: string, to: string): Bucket {
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  if (days <= 31) return "day";
  if (days <= 186) return "week";
  return "month";
}

/** Resuelve el periodo (fechas locales inclusive) a partir de los parámetros de la URL. */
export function resolvePeriod(
  params: { period?: string; from?: string; to?: string; month?: string },
  tz: string,
  now: Date = new Date(),
  fallback: PeriodPreset = "this_month",
): ResolvedPeriod {
  const today = new TZDate(now, tz);
  const preset: PeriodPreset =
    params.period && params.period in PERIOD_PRESETS ? (params.period as PeriodPreset) : fallback;

  let from: string;
  let to: string = ymd(today);
  const currentMonth = format(today, "yyyy-MM");
  let month: string | null = null;

  switch (preset) {
    case "this_week":
      from = ymd(startOfWeek(today, { weekStartsOn: 1 }));
      break;
    case "last_month": {
      const prev = subMonths(today, 1);
      from = ymd(startOfMonth(prev));
      to = ymd(endOfMonth(prev));
      month = format(prev, "yyyy-MM");
      break;
    }
    case "month": {
      if (!isValidMonth(params.month) || params.month > currentMonth) {
        return resolvePeriod({ period: fallback }, tz, now, fallback);
      }
      const start = parseISO(`${params.month}-01`);
      from = ymd(start);
      // El mes en curso llega hasta hoy; los anteriores, completos.
      to = params.month === currentMonth ? ymd(today) : ymd(endOfMonth(start));
      month = params.month;
      break;
    }
    case "last_30":
      from = ymd(subDays(today, 29));
      break;
    case "last_90":
      from = ymd(subDays(today, 89));
      break;
    case "this_year":
      from = ymd(startOfYear(today));
      break;
    case "custom": {
      const validFrom = params.from && isValidLocalDate(params.from) ? params.from : null;
      const validTo = params.to && isValidLocalDate(params.to) ? params.to : null;
      if (!validFrom || !validTo) return resolvePeriod({ period: fallback }, tz, now, fallback);
      from = validFrom <= validTo ? validFrom : validTo;
      to = validFrom <= validTo ? validTo : validFrom;
      if (differenceInCalendarDays(parseISO(to), parseISO(from)) > MAX_DAYS) {
        from = ymd(subDays(parseISO(to), MAX_DAYS));
      }
      break;
    }
    default:
      from = ymd(startOfMonth(today));
      if (preset === "this_month") month = currentMonth;
  }

  return { preset, from, to, bucket: bucketFor(from, to), month };
}

/** Conversión segura: leads con póliza / leads contactados. */
export function conversionRate(won: number, contacted: number) {
  return contacted > 0 ? won / contacted : null;
}
