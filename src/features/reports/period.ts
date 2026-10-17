import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek, startOfYear, subDays, subMonths } from "date-fns";
import { isValidLocalDate } from "@/lib/dates";

export const PERIOD_PRESETS = {
  this_week: "Esta semana",
  this_month: "Este mes",
  last_month: "Mes anterior",
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
};

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
  params: { period?: string; from?: string; to?: string },
  tz: string,
  now: Date = new Date(),
  fallback: PeriodPreset = "this_month",
): ResolvedPeriod {
  const today = new TZDate(now, tz);
  const preset: PeriodPreset =
    params.period && params.period in PERIOD_PRESETS ? (params.period as PeriodPreset) : fallback;

  let from: string;
  let to: string = ymd(today);

  switch (preset) {
    case "this_week":
      from = ymd(startOfWeek(today, { weekStartsOn: 1 }));
      break;
    case "last_month": {
      const prev = subMonths(today, 1);
      from = ymd(startOfMonth(prev));
      to = ymd(endOfMonth(prev));
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
  }

  return { preset, from, to, bucket: bucketFor(from, to) };
}

/** Conversión segura: leads con póliza / leads contactados. */
export function conversionRate(won: number, contacted: number) {
  return contacted > 0 ? won / contacted : null;
}
