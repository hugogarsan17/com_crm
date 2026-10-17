import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CoinsIcon,
  InboxIcon,
  PartyPopperIcon,
  PhoneIcon,
  ScaleIcon,
  SparklesIcon,
  ThumbsDownIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import { ResultsChart } from "@/features/dashboard/components/results-chart";
import { LeadStatusBadge, PriorityBadge } from "@/features/leads/components/badges";
import { PeriodFilter } from "@/features/reports/components/period-filter";
import { resolvePeriod } from "@/features/reports/period";
import { getDashboardSummary, getResultsSeries } from "@/features/reports/queries";
import { TaskRow } from "@/features/tasks/components/task-row";
import { getTodayQueue } from "@/features/tasks/queries";
import { requireUser } from "@/lib/auth";
import { formatCurrency, formatDate, formatNumber, telHref } from "@/lib/format";

export const metadata: Metadata = { title: "Para hoy" };

type SearchParams = PageProps<"/dashboard">["searchParams"];

// Memoizadas por petición: todas las secciones reciben la misma promesa de searchParams,
// así que comparten una única lectura de la sesión y una única consulta a Supabase.
const loadPeriod = cache(async (searchParams: SearchParams) => {
  const sp = await searchParams;
  const { user } = await requireUser();
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return resolvePeriod({ period: str(sp.period), from: str(sp.from), to: str(sp.to) }, user.timezone);
});

const loadSummary = cache(async (searchParams: SearchParams) => getDashboardSummary(await loadPeriod(searchParams)));

const loadQueue = cache(getTodayQueue);

function TilesSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[90px] rounded-xl" />
      ))}
    </>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

async function Greeting() {
  const { user } = await requireUser();
  const firstName = user.fullName.split(" ")[0];
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Hola{firstName ? `, ${firstName}` : ""}</h1>
      <p className="text-sm text-muted-foreground">
        {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: user.timezone }).format(new Date())}
      </p>
    </>
  );
}

async function PasswordNotice({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  if (sp.password !== "updated") return null;
  return (
    <Alert>
      <CheckCircle2Icon />
      <AlertDescription>Contraseña actualizada correctamente.</AlertDescription>
    </Alert>
  );
}

async function TodayTiles({ searchParams }: { searchParams: SearchParams }) {
  const summary = await loadSummary(searchParams);
  return (
    <>
      <StatTile
        label="Seguimientos vencidos"
        value={formatNumber(summary.follow_ups_overdue)}
        icon={AlertTriangleIcon}
        tone={summary.follow_ups_overdue ? "alert" : "default"}
        href="/tasks?view=overdue"
      />
      <StatTile label="Seguimientos de hoy" value={formatNumber(summary.follow_ups_today)} icon={CalendarClockIcon} href="/tasks" />
      <StatTile label="Pendientes de contactar" value={formatNumber(summary.pending_contact)} icon={InboxIcon} href="/leads?status=pending_contact" />
      <StatTile label="Interesados" value={formatNumber(summary.interested)} icon={SparklesIcon} href="/leads?status=interested" />
    </>
  );
}

async function MissingNextActionNotice({ searchParams }: { searchParams: SearchParams }) {
  const { open_without_next_action: count } = await loadSummary(searchParams);
  if (count === 0) return null;
  return (
    <Alert>
      <AlertTriangleIcon />
      <AlertDescription>
        Tienes {count} {count === 1 ? "ficha abierta" : "fichas abiertas"} sin próxima acción.{" "}
        <Link href="/leads?status=open&sort=follow_up_asc" className="font-medium underline underline-offset-4">
          Revisarlas
        </Link>
      </AlertDescription>
    </Alert>
  );
}

async function TodayTasks() {
  const queue = await loadQueue();
  if (queue.tasks.length === 0) {
    return <EmptyState icon={PartyPopperIcon} title="No tienes seguimientos pendientes para hoy" description="Aprovecha para contactar fichas nuevas." />;
  }
  const now = new Date();
  return (
    <ul className="flex flex-col gap-2">
      {queue.tasks.map((t) => (
        <TaskRow key={t.id} task={t} timezone={queue.timezone} now={now} />
      ))}
    </ul>
  );
}

async function FirstContactList({ searchParams }: { searchParams: SearchParams }) {
  const [queue, summary] = await Promise.all([loadQueue(), loadSummary(searchParams)]);
  if (queue.firstContact.length === 0) {
    return <EmptyState icon={InboxIcon} title="No hay fichas pendientes de primer contacto" />;
  }
  return (
    <>
      <ul className="flex flex-col divide-y">
        {queue.firstContact.map((lead) => (
          <li key={lead.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <Link href={`/leads/${lead.id}`} className="block truncate font-medium underline-offset-4 hover:underline">
                {lead.full_name}
              </Link>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {lead.product_to_offer ? <span>{lead.product_to_offer}</span> : null}
                <span>Recibida {formatDate(lead.received_at, queue.timezone)}</span>
                <PriorityBadge priority={lead.priority} />
              </p>
            </div>
            {lead.phone ? (
              <Button asChild variant="outline" size="icon-lg" aria-label={`Llamar a ${lead.full_name}`}>
                <a href={telHref(lead.phone)}>
                  <PhoneIcon />
                </a>
              </Button>
            ) : (
              <LeadStatusBadge status={lead.status} />
            )}
          </li>
        ))}
      </ul>
      {summary.pending_contact > queue.firstContact.length ? (
        <Button asChild variant="link" className="mt-2 px-0">
          <Link href="/leads?status=pending_contact&sort=received_asc">Ver las {summary.pending_contact} pendientes</Link>
        </Button>
      ) : null}
    </>
  );
}

async function PeriodControls({ searchParams }: { searchParams: SearchParams }) {
  const period = await loadPeriod(searchParams);
  return <PeriodFilter preset={period.preset} from={period.from} to={period.to} />;
}

async function PeriodTiles({ searchParams }: { searchParams: SearchParams }) {
  const summary = await loadSummary(searchParams);
  return (
    <>
      <StatTile label="Pólizas contratadas" value={formatNumber(summary.policies_contracted)} icon={BadgeCheckIcon} />
      <StatTile label="Rechazos" value={formatNumber(summary.rejected)} icon={ThumbsDownIcon} />
      <StatTile label="Mantienen condiciones" value={formatNumber(summary.keeps_conditions)} icon={ScaleIcon} />
      <StatTile label="Fichas recibidas" value={formatNumber(summary.leads_received)} icon={InboxIcon} />
      <StatTile label="Comisión estimada" value={formatCurrency(summary.estimated_commission)} icon={CoinsIcon} />
      <StatTile
        label="Comisión confirmada"
        value={formatCurrency(summary.confirmed_commission)}
        hint={`Pagada: ${formatCurrency(summary.paid_commission)}`}
        icon={CoinsIcon}
      />
    </>
  );
}

async function ChartDescription({ searchParams }: { searchParams: SearchParams }) {
  const period = await loadPeriod(searchParams);
  return (
    <>
      {formatDate(period.from)} – {formatDate(period.to)} · por {period.bucket === "day" ? "día" : period.bucket === "week" ? "semana" : "mes"}
    </>
  );
}

async function ResultsChartSection({ searchParams }: { searchParams: SearchParams }) {
  const period = await loadPeriod(searchParams);
  const series = await getResultsSeries(period);
  return <ResultsChart data={series} bucket={period.bucket} />;
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Suspense
          fallback={
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-48" />
            </div>
          }
        >
          <Greeting />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <PasswordNotice searchParams={searchParams} />
      </Suspense>

      <section aria-labelledby="today-title" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="today-title" className="sr-only">
          Resumen de hoy
        </h2>
        <Suspense fallback={<TilesSkeleton count={4} />}>
          <TodayTiles searchParams={searchParams} />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <MissingNextActionNotice searchParams={searchParams} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Para hoy</h2>
            </CardTitle>
            <CardDescription>Seguimientos vencidos y de hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ListSkeleton rows={2} />}>
              <TodayTasks />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Primer contacto</h2>
            </CardTitle>
            <CardDescription>Fichas nuevas sin contactar, por prioridad.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <FirstContactList searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="results-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="results-title" className="text-lg font-semibold">
            Resultados del periodo
          </h2>
          <Suspense fallback={<Skeleton className="h-[52px] w-44" />}>
            <PeriodControls searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Suspense fallback={<TilesSkeleton count={6} />}>
            <PeriodTiles searchParams={searchParams} />
          </Suspense>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Evolución de resultados</CardTitle>
            <CardDescription>
              <Suspense fallback={<span className="inline-block h-4 w-56 animate-pulse rounded-md bg-muted align-middle" />}>
                <ChartDescription searchParams={searchParams} />
              </Suspense>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <ResultsChartSection searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
