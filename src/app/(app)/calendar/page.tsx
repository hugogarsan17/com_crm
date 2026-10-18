import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarTask, NewCalendarTaskButton, type CalendarTaskData } from "@/features/calendar/components/calendar-task";
import {
  CALENDAR_VIEWS,
  calendarHref,
  calendarTitle,
  groupTasksByDay,
  parseCalendarParams,
  resolveCalendarRange,
  type CalendarRange,
  type CalendarView,
} from "@/features/calendar/range";
import { listTasksInRange } from "@/features/tasks/queries";
import { requireUser } from "@/lib/auth";
import { isoToLocalDateTime, localDateTimeFromNow } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendario" };

type SearchParams = PageProps<"/calendar">["searchParams"];

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_CELL_LIMIT = 3;

// Memoizadas por petición (todas las secciones comparten la misma promesa de searchParams).
const loadRange = cache(async (searchParams: SearchParams) => {
  const sp = await searchParams;
  const { user } = await requireUser();
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const { view, date } = parseCalendarParams({ view: str(sp.view), date: str(sp.date) }, user.timezone);
  return { range: resolveCalendarRange(view, date, user.timezone), timezone: user.timezone };
});

const loadTasks = cache(async (searchParams: SearchParams) => {
  const { range } = await loadRange(searchParams);
  const result = await listTasksInRange(range.startIso, range.endIso);
  const now = Date.now();
  const tasks: CalendarTaskData[] = result.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_at: t.due_at,
    dueLocal: isoToLocalDateTime(t.due_at, result.timezone),
    status: t.status,
    overdue: t.status === "pending" && new Date(t.due_at).getTime() < now,
    lead: t.lead,
  }));
  return { ...result, tasks, byDay: groupTasksByDay(tasks, result.timezone) };
});

function dayLabel(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-ES", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Fecha y hora por defecto para una tarea nueva: el día seleccionado a las 10:00 (o mañana si ya pasó). */
function defaultDueLocal(range: CalendarRange, tz: string) {
  return range.date >= range.today ? `${range.date}T10:00` : localDateTimeFromNow(tz, 1);
}

async function Toolbar({ searchParams }: { searchParams: SearchParams }) {
  const { range, timezone } = await loadRange(searchParams);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon-lg">
          <Link href={calendarHref(range.view, range.prevDate)} aria-label="Anterior">
            <ChevronLeftIcon />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={calendarHref(range.view, range.today)}>Hoy</Link>
        </Button>
        <Button asChild variant="outline" size="icon-lg">
          <Link href={calendarHref(range.view, range.nextDate)} aria-label="Siguiente">
            <ChevronRightIcon />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {calendarTitle(range)}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Vista del calendario" className="inline-flex rounded-lg bg-muted p-1">
          {(Object.entries(CALENDAR_VIEWS) as [CalendarView, string][]).map(([view, label]) => (
            <Link
              key={view}
              href={calendarHref(view, range.date)}
              aria-current={view === range.view ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                view === range.view ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <NewCalendarTaskButton defaultDueLocal={defaultDueLocal(range, timezone)} />
      </div>
    </div>
  );
}

function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap justify-between gap-2" aria-busy="true">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-9 w-64" />
    </div>
  );
}

function DayHeading({ date, today, link }: { date: string; today: string; link?: boolean }) {
  const isToday = date === today;
  const text = (
    <>
      <span className="capitalize">{dayLabel(date, { weekday: "long" })}</span>{" "}
      <span className={cn("tabular-nums", isToday && "rounded-full bg-primary px-1.5 text-primary-foreground")}>
        {dayLabel(date, { day: "numeric", month: "short" })}
      </span>
      {isToday ? <span className="sr-only"> (hoy)</span> : null}
    </>
  );
  return link ? (
    <Link href={calendarHref("day", date)} className="text-sm font-medium underline-offset-4 hover:underline">
      {text}
    </Link>
  ) : (
    <p className="text-sm font-medium">{text}</p>
  );
}

async function CalendarBody({ searchParams }: { searchParams: SearchParams }) {
  const [{ range, timezone }, { tasks, byDay, truncated }] = await Promise.all([loadRange(searchParams), loadTasks(searchParams)]);
  const newTask = <NewCalendarTaskButton defaultDueLocal={defaultDueLocal(range, timezone)} />;

  const notice = truncated ? (
    <Alert>
      <AlertTriangleIcon />
      <AlertDescription>Hay demasiadas tareas en este periodo; se muestran las primeras 1.000. Usa la vista de semana o día.</AlertDescription>
    </Alert>
  ) : null;

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarDaysIcon}
        title={range.view === "day" ? "No hay tareas este día" : range.view === "week" ? "No hay tareas esta semana" : "No hay tareas este mes"}
        description="Crea una tarea vinculada a una ficha o cambia de periodo."
        action={newTask}
      />
    );
  }

  if (range.view === "day") {
    const list = byDay.get(range.date) ?? [];
    return (
      <ul className="flex flex-col gap-2">
        {list.map((t) => (
          <li key={t.id}>
            <CalendarTask task={t} timezone={timezone} />
          </li>
        ))}
      </ul>
    );
  }

  if (range.view === "week") {
    return (
      <>
        {notice}
        <div className="grid gap-2 md:grid-cols-7">
          {range.days.map((day) => {
            const list = byDay.get(day) ?? [];
            return (
              <section
                key={day}
                aria-label={dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}
                className={cn("flex min-h-24 flex-col gap-2 rounded-xl border bg-card p-2", day === range.today && "border-primary")}
              >
                <DayHeading date={day} today={range.today} link />
                {list.length ? (
                  <ul className="flex flex-col gap-1">
                    {list.map((t) => (
                      <li key={t.id}>
                        <CalendarTask task={t} timezone={timezone} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin tareas</p>
                )}
              </section>
            );
          })}
        </div>
      </>
    );
  }

  // Mes: rejilla en escritorio y agenda (solo días con tareas) en móvil.
  const month = range.date.slice(0, 7);
  const daysWithTasks = range.days.filter((d) => d.startsWith(month) && byDay.has(d));
  return (
    <>
      {notice}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="grid grid-cols-7 border-b bg-muted text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {range.days.map((day) => {
            const list = byDay.get(day) ?? [];
            const outside = !day.startsWith(month);
            return (
              <div key={day} className={cn("flex min-h-28 flex-col gap-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", outside && "bg-muted/40")}>
                <Link
                  href={calendarHref("day", day)}
                  className={cn(
                    "self-start rounded-full px-1.5 text-xs tabular-nums hover:underline",
                    day === range.today ? "bg-primary text-primary-foreground" : outside ? "text-muted-foreground" : "font-medium",
                  )}
                  aria-label={dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}
                >
                  {Number(day.slice(8))}
                </Link>
                {list.slice(0, MONTH_CELL_LIMIT).map((t) => (
                  <CalendarTask key={t.id} task={t} timezone={timezone} compact />
                ))}
                {list.length > MONTH_CELL_LIMIT ? (
                  <Link href={calendarHref("day", day)} className="text-xs text-muted-foreground hover:underline">
                    +{list.length - MONTH_CELL_LIMIT} más
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {daysWithTasks.length === 0 ? <p className="text-sm text-muted-foreground">No hay tareas en los días de este mes.</p> : null}
        {daysWithTasks.map((day) => (
          <section key={day} className="flex flex-col gap-1.5">
            <DayHeading date={day} today={range.today} link />
            <ul className="flex flex-col gap-1">
              {(byDay.get(day) ?? []).map((t) => (
                <li key={t.id}>
                  <CalendarTask task={t} timezone={timezone} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function BodySkeleton() {
  return (
    <div className="grid gap-2 md:grid-cols-7" aria-busy="true" aria-label="Cargando calendario">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Calendario"
        description="Tus seguimientos por día, semana o mes. Pulsa una tarea para gestionarla o abrir la ficha."
      />
      <Suspense fallback={<ToolbarSkeleton />}>
        <Toolbar searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<BodySkeleton />}>
        <CalendarBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
