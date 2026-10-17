import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { AlertTriangleIcon, ArchiveIcon, ChevronLeftIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { ACTIVITY_OUTCOME_LABELS } from "@/features/activities/constants";
import { LeadStatusBadge, PriorityBadge } from "@/features/leads/components/badges";
import { LeadDetailActions } from "@/features/leads/components/lead-detail-actions";
import { OPEN_NEEDS_FOLLOW_UP } from "@/features/leads/constants";
import { getLeadDetail } from "@/features/leads/queries";
import { PoliciesSection } from "@/features/policies/components/policies-section";
import { TaskRow } from "@/features/tasks/components/task-row";
import { isoToLocalDateTime, localDateTimeFromNow, todayInTimeZone } from "@/lib/dates";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Ficha" };

type Params = PageProps<"/leads/[id]">["params"];

const loadDetail = cache(async (params: Params) => getLeadDetail((await params).id));

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function LinesSkeleton({ lines }: { lines: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full max-w-64" />
      ))}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando ficha">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
    </div>
  );
}

async function LeadHeader({ params }: { params: Params }) {
  const { user, lead } = await loadDetail(params);
  const tz = user.timezone;
  const needsNextAction = OPEN_NEEDS_FOLLOW_UP.includes(lead.status) && !lead.next_follow_up_at;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{lead.full_name}</h1>
        <LeadStatusBadge status={lead.status} className="text-sm" />
        <PriorityBadge priority={lead.priority} />
      </div>
      {lead.archived_at ? (
        <Alert>
          <ArchiveIcon />
          <AlertDescription>Ficha archivada el {formatDateTime(lead.archived_at, tz)}. No aparece en tus listas ni bandejas.</AlertDescription>
        </Alert>
      ) : null}
      {lead.status === "do_not_contact" ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertDescription>Este cliente ha pedido que no se le contacte.</AlertDescription>
        </Alert>
      ) : null}
      {needsNextAction ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertDescription>Esta ficha está abierta pero no tiene próxima acción. Programa un seguimiento o ciérrala.</AlertDescription>
        </Alert>
      ) : null}
      <LeadDetailActions
        lead={lead}
        nowLocal={isoToLocalDateTime(new Date().toISOString(), tz)}
        tomorrowLocal={localDateTimeFromNow(tz, 1)}
        today={todayInTimeZone(tz)}
      />
    </div>
  );
}

async function NextFollowUp({ params }: { params: Params }) {
  const { user, lead } = await loadDetail(params);
  if (!lead.next_follow_up_at) return <p className="text-sm text-muted-foreground">Sin seguimiento programado.</p>;
  return (
    <p className={new Date(lead.next_follow_up_at) < new Date() ? "text-destructive" : undefined}>
      <span className="font-medium">{lead.next_action}</span>
      <br />
      <span className="text-sm">{formatDateTime(lead.next_follow_up_at, user.timezone)}</span>
    </p>
  );
}

async function ClientData({ params }: { params: Params }) {
  const { user, lead } = await loadDetail(params);
  const tz = user.timezone;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3">
        <Info label="Teléfono">{lead.phone}</Info>
        <Info label="Email">{lead.email}</Info>
        <Info label="Localidad">{lead.locality}</Info>
        <Info label="Referencia">{lead.customer_reference}</Info>
        <Info label="Pólizas actuales">{lead.current_policies.join(", ")}</Info>
        <Info label="Producto a ofrecer">{lead.product_to_offer}</Info>
        <Info label="Origen">{lead.source}</Info>
        <Info label="Recibida">{formatDateTime(lead.received_at, tz)}</Info>
        <Info label="Último resultado">
          {lead.last_outcome ? `${ACTIVITY_OUTCOME_LABELS[lead.last_outcome]} · ${formatDateTime(lead.last_contact_at, tz)}` : null}
        </Info>
        {lead.closed_at ? <Info label="Cerrada">{formatDateTime(lead.closed_at, tz)}</Info> : null}
        {lead.closed_reason ? <Info label="Motivo de cierre">{lead.closed_reason}</Info> : null}
      </dl>
      {lead.notes ? (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs text-muted-foreground">Notas</p>
          <p className="text-sm whitespace-pre-line">{lead.notes}</p>
        </div>
      ) : null}
    </>
  );
}

async function CommissionTotals({ params }: { params: Params }) {
  const { policies } = await loadDetail(params);
  if (!policies.length) return null;
  const totals = policies.reduce(
    (acc, p) => ({
      estimated: acc.estimated + (p.estimated_commission ?? 0),
      confirmed: acc.confirmed + (p.commission_status !== "pending" ? (p.confirmed_commission ?? 0) : 0),
    }),
    { estimated: 0, confirmed: 0 },
  );
  return (
    <p className="text-sm text-muted-foreground">
      Estimada {formatCurrency(totals.estimated)} · Confirmada {formatCurrency(totals.confirmed)}
    </p>
  );
}

async function Policies({ params }: { params: Params }) {
  const { user, lead, policies } = await loadDetail(params);
  return <PoliciesSection policies={policies} leadId={lead.id} today={todayInTimeZone(user.timezone)} />;
}

async function Tasks({ params }: { params: Params }) {
  const { user, tasks } = await loadDetail(params);
  const tz = user.timezone;
  const now = new Date();
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const otherTasks = tasks.filter((t) => t.status !== "pending").reverse();
  return (
    <>
      {pendingTasks.length === 0 && otherTasks.length === 0 ? <p className="text-sm text-muted-foreground">Sin seguimientos.</p> : null}
      {pendingTasks.length ? (
        <ul className="flex flex-col gap-2">
          {pendingTasks.map((t) => (
            <TaskRow key={t.id} task={t} timezone={tz} now={now} />
          ))}
        </ul>
      ) : null}
      {otherTasks.length ? (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground">Completados y cancelados ({otherTasks.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {otherTasks.map((t) => (
              <TaskRow key={t.id} task={t} timezone={tz} now={now} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

async function History({ params }: { params: Params }) {
  const { user, activities } = await loadDetail(params);
  return <ActivityTimeline activities={activities} timezone={user.timezone} />;
}

export default function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/leads" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" aria-hidden /> Fichas
      </Link>

      <Suspense fallback={<HeaderSkeleton />}>
        <LeadHeader params={params} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Próximo seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LinesSkeleton lines={2} />}>
                <NextFollowUp params={params} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos del cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LinesSkeleton lines={8} />}>
                <ClientData params={params} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pólizas y comisiones</CardTitle>
              <Suspense fallback={null}>
                <CommissionTotals params={params} />
              </Suspense>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LinesSkeleton lines={2} />}>
                <Policies params={params} />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Seguimientos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Suspense fallback={<Skeleton className="h-20 rounded-xl" />}>
                <Tasks params={params} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de contactos</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<LinesSkeleton lines={3} />}>
                <History params={params} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
