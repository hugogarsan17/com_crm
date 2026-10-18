import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { isValidLocalDate, todayInTimeZone } from "@/lib/dates";

export const CALENDAR_VIEWS = { day: "Día", week: "Semana", month: "Mes" } as const;
export type CalendarView = keyof typeof CALENDAR_VIEWS;

export type CalendarRange = {
  view: CalendarView;
  /** Día de referencia ("YYYY-MM-DD"). */
  date: string;
  today: string;
  /** Días visibles, de lunes a domingo en semana y mes (el mes incluye días de relleno). */
  days: string[];
  /** Primer día visible y día siguiente al último (exclusivo), en fecha local. */
  startDate: string;
  endDate: string;
  /** Instantes UTC equivalentes en la zona del usuario, para la consulta. */
  startIso: string;
  endIso: string;
  prevDate: string;
  nextDate: string;
};

const WEEK = { weekStartsOn: 1 } as const;

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** Medianoche local de `date` en la zona `tz`, como instante ISO. */
export function localMidnightIso(date: string, tz: string) {
  const d = parseISO(date);
  return new Date(new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, tz).getTime()).toISOString();
}

export function parseCalendarParams(params: { view?: string; date?: string }, tz: string, now: Date = new Date()) {
  const view: CalendarView = params.view && params.view in CALENDAR_VIEWS ? (params.view as CalendarView) : "week";
  const today = todayInTimeZone(tz, now);
  const date = params.date && isValidLocalDate(params.date) ? params.date : today;
  return { view, date, today };
}

/** Calcula los días visibles y el rango de consulta de una vista del calendario. */
export function resolveCalendarRange(view: CalendarView, date: string, tz: string, now: Date = new Date()): CalendarRange {
  const ref = parseISO(date);
  let first: Date;
  let last: Date;
  let prev: Date;
  let next: Date;

  switch (view) {
    case "day":
      first = ref;
      last = ref;
      prev = addDays(ref, -1);
      next = addDays(ref, 1);
      break;
    case "week":
      first = startOfWeek(ref, WEEK);
      last = endOfWeek(ref, WEEK);
      prev = addWeeks(ref, -1);
      next = addWeeks(ref, 1);
      break;
    case "month":
      first = startOfWeek(startOfMonth(ref), WEEK);
      last = endOfWeek(endOfMonth(ref), WEEK);
      prev = addMonths(ref, -1);
      next = addMonths(ref, 1);
      break;
  }

  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(ymd(d));
  const startDate = days[0];
  const endDate = ymd(addDays(last, 1));

  return {
    view,
    date,
    today: todayInTimeZone(tz, now),
    days,
    startDate,
    endDate,
    startIso: localMidnightIso(startDate, tz),
    endIso: localMidnightIso(endDate, tz),
    prevDate: ymd(prev),
    nextDate: ymd(next),
  };
}

/** Agrupa tareas por día local (zona `tz`), ordenadas por hora. */
export function groupTasksByDay<T extends { due_at: string }>(tasks: readonly T[], tz: string) {
  const map = new Map<string, T[]>();
  const sorted = [...tasks].sort((a, b) => a.due_at.localeCompare(b.due_at));
  for (const t of sorted) {
    const day = todayInTimeZone(tz, new Date(t.due_at));
    const list = map.get(day);
    if (list) list.push(t);
    else map.set(day, [t]);
  }
  return map;
}

export function calendarTitle(range: Pick<CalendarRange, "view" | "date" | "days">) {
  const ref = new Date(`${range.date}T00:00:00Z`);
  const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat("es-ES", { ...opts, timeZone: "UTC" }).format(d);
  if (range.view === "month") return fmt({ month: "long", year: "numeric" }, ref);
  if (range.view === "day") return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, ref);
  const a = new Date(`${range.days[0]}T00:00:00Z`);
  const b = new Date(`${range.days[range.days.length - 1]}T00:00:00Z`);
  return `${fmt({ day: "numeric", month: "short" }, a)} – ${fmt({ day: "numeric", month: "short", year: "numeric" }, b)}`;
}

export function calendarHref(view: CalendarView, date: string) {
  return `/calendar?view=${view}&date=${date}`;
}
