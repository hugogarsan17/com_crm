import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { PRODUCT_CODE_RE, productLabel, productOptions } from "@/features/products/catalog";
import { getProducts } from "@/features/products/queries";
import { PeriodFilter } from "@/features/reports/components/period-filter";
import { conversionRate, resolvePeriod } from "@/features/reports/period";
import { getReport } from "@/features/reports/queries";
import { requireUser } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/dates";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Informes" };

type SearchParams = PageProps<"/reports">["searchParams"];

// Memoizadas por petición: todas las secciones comparten la misma promesa de searchParams.
const loadFilters = cache(async (searchParams: SearchParams) => {
  const sp = await searchParams;
  const { user } = await requireUser();
  const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const period = resolvePeriod({ period: str(sp.period), from: str(sp.from), to: str(sp.to), month: str(sp.month) }, user.timezone);
  const product = str(sp.product);
  return { period, product: product && PRODUCT_CODE_RE.test(product) ? product : undefined, currentMonth: todayInTimeZone(user.timezone).slice(0, 7) };
});

const loadReport = cache(async (searchParams: SearchParams) => {
  const { period, product } = await loadFilters(searchParams);
  return getReport(period, product);
});

function TilesSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[90px] rounded-xl" />
      ))}
    </>
  );
}

async function ReportDescription({ searchParams }: { searchParams: SearchParams }) {
  const [{ period, product }, products] = await Promise.all([loadFilters(searchParams), getProducts()]);
  return `${formatDate(period.from)} – ${formatDate(period.to)}${product ? ` · ${productLabel(products, product)}` : ""}`;
}

function ExportButton({ href }: { href?: string }) {
  return (
    <Button asChild={Boolean(href)} variant="outline" size="lg" disabled={!href}>
      {href ? (
        <a href={href}>
          <DownloadIcon aria-hidden /> Exportar CSV
        </a>
      ) : (
        <span>
          <DownloadIcon aria-hidden /> Exportar CSV
        </span>
      )}
    </Button>
  );
}

async function ReportExport({ searchParams }: { searchParams: SearchParams }) {
  const { period, product } = await loadFilters(searchParams);
  const query = new URLSearchParams({
    period: period.preset,
    from: period.from,
    to: period.to,
    ...(period.month ? { month: period.month } : {}),
    ...(product ? { product } : {}),
  });
  return <ExportButton href={`/api/export/report?${query.toString()}`} />;
}

async function ReportFilters({ searchParams }: { searchParams: SearchParams }) {
  const [{ period, product, currentMonth }, products] = await Promise.all([loadFilters(searchParams), getProducts()]);
  return (
    <PeriodFilter
      key={`${period.preset}-${period.month ?? period.from}`}
      preset={period.preset}
      from={period.from}
      to={period.to}
      month={period.month}
      currentMonth={currentMonth}
      products={productOptions(products, product)}
      product={product}
    />
  );
}

async function ActivityTiles({ searchParams }: { searchParams: SearchParams }) {
  const report = await loadReport(searchParams);
  const conversion = conversionRate(report.leads_with_policy, report.leads_contacted);
  return (
    <>
      <StatTile label="Fichas recibidas" value={formatNumber(report.leads_received)} />
      <StatTile
        label="Fichas contactadas"
        value={formatNumber(report.leads_contacted)}
        hint={`${formatNumber(report.contact_attempts)} intentos · ${formatNumber(report.leads_reached)} con respuesta`}
      />
      <StatTile label="Pólizas contratadas" value={formatNumber(report.policies_contracted)} hint={`${formatNumber(report.leads_with_policy)} clientes`} />
      <StatTile label="Conversión" value={formatPercent(conversion)} hint="Clientes con póliza / contactados" />
      <StatTile label="Rechazos" value={formatNumber(report.rejected)} />
      <StatTile label="Primas" value={formatCurrency(report.premium_total)} />
    </>
  );
}

async function CommissionTiles({ searchParams }: { searchParams: SearchParams }) {
  const report = await loadReport(searchParams);
  return (
    <>
      <StatTile label="Valor de pólizas" value={formatCurrency(report.policy_value_total)} />
      <StatTile
        label="Comisión calculada"
        value={formatCurrency(report.calculated_commission)}
        hint={report.policies_without_commission ? `${formatNumber(report.policies_without_commission)} pólizas sin calcular` : "Según tus reglas de comisión"}
        tone={report.policies_without_commission ? "warning" : "default"}
      />
      <StatTile label="Comisión confirmada" value={formatCurrency(report.confirmed_commission)} hint="Confirmadas y pagadas" />
      <StatTile label="Comisión pagada" value={formatCurrency(report.paid_commission)} />
    </>
  );
}

async function ProductBreakdown({ searchParams }: { searchParams: SearchParams }) {
  const report = await loadReport(searchParams);
  if (report.by_product.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay pólizas en este periodo.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Pólizas</TableHead>
            <TableHead className="text-right">Primas</TableHead>
            <TableHead className="text-right">Valor de póliza</TableHead>
            <TableHead className="text-right">Calculada</TableHead>
            <TableHead className="text-right">Confirmada</TableHead>
            <TableHead className="text-right">Pagada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.by_product.map((p) => (
            <TableRow key={p.product_code ?? p.product}>
              <TableCell className="font-medium">
                {p.product}
                {p.product_code ? null : <span className="ml-1 text-xs font-normal text-muted-foreground">(fuera de catálogo)</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(p.policies)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.premium_total)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.policy_value_total)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.calculated_commission)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.confirmed_commission)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(p.paid_commission)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Informes"
        description={
          <Suspense fallback={<span className="inline-block h-4 w-56 animate-pulse rounded-md bg-muted align-middle" />}>
            <ReportDescription searchParams={searchParams} />
          </Suspense>
        }
        actions={
          <Suspense fallback={<ExportButton />}>
            <ReportExport searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-wrap gap-2" aria-busy="true">
            <Skeleton className="h-[52px] w-44" />
            <Skeleton className="h-[52px] w-48" />
          </div>
        }
      >
        <ReportFilters searchParams={searchParams} />
      </Suspense>

      <section aria-label="Actividad" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<TilesSkeleton count={7} />}>
          <ActivityTiles searchParams={searchParams} />
        </Suspense>
      </section>

      <section aria-label="Comisiones" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<TilesSkeleton count={4} />}>
          <CommissionTiles searchParams={searchParams} />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Por producto</CardTitle>
          <CardDescription>
            Pólizas con fecha de contratación en el periodo. La comisión calculada usa el valor de póliza y tus reglas de comisión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <ProductBreakdown searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Contactadas: fichas con al menos un contacto registrado en el periodo. Rechazos: fichas cerradas como rechazadas en el
        periodo. Con un producto seleccionado, las métricas de fichas usan el producto de la ficha y las de pólizas el de la
        póliza. Comisión calculada: valor de póliza × porcentaje configurado en Ajustes; la confirmada y la pagada se
        introducen a mano.
      </p>
    </div>
  );
}
