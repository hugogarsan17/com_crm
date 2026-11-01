import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { CalendarX2Icon, PhoneCallIcon, PlusIcon, SearchXIcon, UploadIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { HeaderMetric } from "@/components/shared/metric";
import { PageHeader } from "@/components/shared/page-header";
import { LeadsFilters } from "@/features/leads/components/leads-filters";
import { LeadsList, Pagination } from "@/features/leads/components/leads-list";
import { getLeadsOverview, listLeads } from "@/features/leads/queries";
import { getProducts } from "@/features/products/queries";
import { parseLeadFilters } from "@/features/leads/search-params";
import { formatNumber, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Fichas" };

type SearchParams = PageProps<"/leads">["searchParams"];

const loadFilters = cache(async (searchParams: SearchParams) => parseLeadFilters(await searchParams));

function PrimaryActions() {
  return (
    <>
      <Button asChild size="lg">
        <Link href="/leads/new">
          <PlusIcon aria-hidden /> Nueva ficha
        </Link>
      </Button>
      <Button asChild variant="ghost" size="lg">
        <Link href="/leads/import">
          <UploadIcon aria-hidden /> Importar CSV
        </Link>
      </Button>
    </>
  );
}

async function FiltersSection({ searchParams }: { searchParams: SearchParams }) {
  const [filters, products] = await Promise.all([loadFilters(searchParams), getProducts()]);
  return <LeadsFilters filters={filters} products={products} actions={<PrimaryActions />} />;
}

async function LeadsResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = await loadFilters(searchParams);
  const [result, products] = await Promise.all([listLeads(filters), getProducts()]);
  const hasFilters = Boolean(
    filters.q || filters.status || filters.priority || filters.product || filters.funeral || filters.from || filters.to,
  );

  if (result.leads.length === 0) {
    return hasFilters || filters.view === "archived" ? (
      <EmptyState
        icon={SearchXIcon}
        title={filters.view === "archived" && !hasFilters ? "No hay fichas archivadas" : "Ninguna ficha coincide con los filtros"}
        description="Prueba con otros criterios de búsqueda."
      />
    ) : (
      <EmptyState
        icon={UsersIcon}
        title="Todavía no tienes fichas"
        description="Crea tu primera ficha o importa un listado en CSV."
        action={
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/leads/new">Nueva ficha</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/leads/import">Importar CSV</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      <LeadsList leads={result.leads} products={products} timezone={result.timezone} now={result.fetchedAt} layout={filters.layout} />
      <Pagination filters={filters} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  );
}

async function Overview() {
  const o = await getLeadsOverview();
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:flex lg:gap-8">
      <HeaderMetric
        icon={UsersIcon}
        value={formatNumber(o.total)}
        chip={o.receivedThisWeek ? `+${formatNumber(o.receivedThisWeek)} esta semana` : undefined}
        label="Fichas activas en tu cartera"
      />
      <HeaderMetric
        icon={PhoneCallIcon}
        value={formatNumber(o.contactedThisWeek)}
        chip={o.total ? formatPercent(o.contactedThisWeek / o.total) : undefined}
        label="Contactadas en los últimos 7 días"
      />
      <HeaderMetric icon={CalendarX2Icon} value={formatNumber(o.withoutNextAction)} label="Abiertas sin próxima acción programada" />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:flex lg:gap-8" aria-busy="true" aria-label="Cargando métricas">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="hidden size-11 rounded-full sm:block" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando filtros">
      <div className="flex flex-col gap-3 md:flex-row">
        <Skeleton className="h-11 w-full rounded-full md:w-80 xl:w-[24rem]" />
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:justify-between">
        {/* Las acciones principales siguen disponibles mientras cargan los filtros. */}
        <div className="flex flex-wrap gap-2">
          <PrimaryActions />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] sm:gap-4" aria-busy="true" aria-label="Cargando fichas">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-60 rounded-card" />
      ))}
    </div>
  );
}

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fichas de clientes">
        <Suspense fallback={<OverviewSkeleton />}>
          <Overview />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersSection searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <LeadsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
