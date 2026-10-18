import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTIVITY_OUTCOME_LABELS } from "@/features/activities/constants";
import { productLabel, type Product } from "@/features/products/catalog";
import { formatDate, formatDateTime, telHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeadListItem } from "../queries";
import { leadFiltersToSearch, type LeadFilters } from "../search-params";
import { FuneralInsuranceBadge, LeadStatusBadge, LegacyStatusBadge, PriorityBadge } from "./badges";


function NextAction({ lead, tz, now }: { lead: LeadListItem; tz: string; now: number }) {
  if (!lead.next_follow_up_at) {
    return <span className="text-muted-foreground">{lead.status === "pending_contact" ? "Primer contacto" : "Sin programar"}</span>;
  }
  const overdue = new Date(lead.next_follow_up_at).getTime() < now;
  return (
    <span className={cn("flex flex-col", overdue && "text-destructive")}>
      <span className="font-medium">{lead.next_action}</span>
      <span className="text-xs">
        {overdue ? "Vencido · " : ""}
        {formatDateTime(lead.next_follow_up_at, tz)}
      </span>
    </span>
  );
}

export function LeadsList({
  leads,
  products,
  timezone,
  now,
}: {
  leads: LeadListItem[];
  products: Product[];
  timezone: string;
  now: number;
}) {
  return (
    <>
      {/* Móvil: tarjetas */}
      <ul className="flex flex-col gap-2 md:hidden">
        {leads.map((lead) => (
          <li key={lead.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/leads/${lead.id}`} className="min-w-0 font-medium underline-offset-4 hover:underline">
                <span className="block truncate">{lead.full_name}</span>
              </Link>
              <LeadStatusBadge status={lead.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {lead.customer_reference ? <span>Nº póliza {lead.customer_reference}</span> : null}
              {lead.product_code ? <span>{productLabel(products, lead.product_code)}</span> : null}
              {lead.last_outcome ? <span>Último: {ACTIVITY_OUTCOME_LABELS[lead.last_outcome]}</span> : null}
              <FuneralInsuranceBadge value={lead.has_funeral_insurance} />
              <PriorityBadge priority={lead.priority} />
              <LegacyStatusBadge legacyStatus={lead.legacy_status} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2 text-sm">
              <NextAction lead={lead} tz={timezone} now={now} />
              {lead.phone && lead.legacy_status !== "do_not_contact" ? (
                <Button asChild size="icon-lg" variant="outline" aria-label={`Llamar a ${lead.full_name}`}>
                  <a href={telHref(lead.phone)}>
                    <PhoneIcon />
                  </a>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Decesos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último resultado</TableHead>
              <TableHead>Próxima acción</TableHead>
              <TableHead>Recibido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="max-w-56">
                  <Link href={`/leads/${lead.id}`} className="block truncate font-medium underline-offset-4 hover:underline">
                    {lead.full_name}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    {lead.customer_reference ? (
                      <span className="truncate text-xs text-muted-foreground">Nº póliza {lead.customer_reference}</span>
                    ) : null}
                    <PriorityBadge priority={lead.priority} />
                    <LegacyStatusBadge legacyStatus={lead.legacy_status} />
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {lead.phone ? (
                    <a href={telHref(lead.phone)} className="underline-offset-4 hover:underline">
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {lead.product_code ? productLabel(products, lead.product_code) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <FuneralInsuranceBadge value={lead.has_funeral_insurance} />
                </TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {lead.last_outcome ? ACTIVITY_OUTCOME_LABELS[lead.last_outcome] : <span className="text-muted-foreground">Sin contacto</span>}
                </TableCell>
                <TableCell className="text-sm">
                  <NextAction lead={lead} tz={timezone} now={now} />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(lead.received_at, timezone)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function Pagination({ filters, page, pageCount, total }: { filters: LeadFilters; page: number; pageCount: number; total: number }) {
  if (pageCount <= 1) return <p className="text-sm text-muted-foreground">{total} fichas</p>;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {total} fichas · página {page} de {pageCount}
      </p>
      <div className="flex gap-2">
        <Button asChild={page > 1} variant="outline" size="lg" disabled={page <= 1}>
          {page > 1 ? (
            <Link href={`/leads${leadFiltersToSearch({ ...filters, page: page - 1 })}`}>
              <ChevronLeftIcon aria-hidden /> Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeftIcon aria-hidden /> Anterior
            </span>
          )}
        </Button>
        <Button asChild={page < pageCount} variant="outline" size="lg" disabled={page >= pageCount}>
          {page < pageCount ? (
            <Link href={`/leads${leadFiltersToSearch({ ...filters, page: page + 1 })}`}>
              Siguiente <ChevronRightIcon aria-hidden />
            </Link>
          ) : (
            <span>
              Siguiente <ChevronRightIcon aria-hidden />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}
