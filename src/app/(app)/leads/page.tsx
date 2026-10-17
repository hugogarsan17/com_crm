import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { DownloadIcon, PlusIcon, SearchXIcon, UploadIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { LeadsFilters } from "@/features/leads/components/leads-filters";
import { LeadsList, Pagination } from "@/features/leads/components/leads-list";
import { getProductOptions, listLeads } from "@/features/leads/queries";
import { parseLeadFilters } from "@/features/leads/search-params";

export const metadata: Metadata = { title: "Fichas" };

type SearchParams = PageProps<"/leads">["searchParams"];

const loadFilters = cache(async (searchParams: SearchParams) => parseLeadFilters(await searchParams));

async function FiltersSection({ searchParams }: { searchParams: SearchParams }) {
  const [filters, productOptions] = await Promise.all([loadFilters(searchParams), getProductOptions()]);
  return <LeadsFilters filters={filters} productOptions={productOptions} />;
}

async function LeadsResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = await loadFilters(searchParams);
  const result = await listLeads(filters);
  const hasFilters = Boolean(filters.q || filters.status || filters.priority || filters.product || filters.from || filters.to);

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
      <LeadsList leads={result.leads} timezone={result.timezone} now={result.fetchedAt} />
      <Pagination filters={filters} page={result.page} pageCount={result.pageCount} total={result.total} />
    </>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3" aria-busy="true" aria-label="Cargando filtros">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-8 w-44" />
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando fichas">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  );
}

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fichas de clientes"
        description="Busca, filtra y gestiona tus fichas."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <a href="/api/export/leads">
                <DownloadIcon aria-hidden /> Exportar CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/leads/import">
                <UploadIcon aria-hidden /> Importar
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/leads/new">
                <PlusIcon aria-hidden /> Nueva ficha
              </Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersSection searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <LeadsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
