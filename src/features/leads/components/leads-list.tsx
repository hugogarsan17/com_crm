import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, MailIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ACTIVITY_OUTCOME_LABELS } from "@/features/activities/constants";
import { productLabel, type Product } from "@/features/products/catalog";
import { formatDate, formatDateTime, formatRelative, telHref } from "@/lib/format";
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

/** Botón de acción rápida (llamar / escribir) con nombre accesible y tooltip. */
function QuickAction({ href, label, icon: Icon }: { href: string; label: string; icon: typeof PhoneIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon" className="relative z-10">
          <a href={href} aria-label={label}>
            <Icon aria-hidden />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function LeadCard({ lead, products, tz, now }: { lead: LeadListItem; products: Product[]; tz: string; now: number }) {
  const canContact = lead.legacy_status !== "do_not_contact";
  const subtitle = [lead.product_code ? productLabel(products, lead.product_code) : null, lead.locality].filter(Boolean).join(" · ");
  const overdue = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() < now : false;

  return (
    <li className="surface group relative flex min-w-0 flex-col rounded-card p-4.5 transition-[border-color,background-color,transform] duration-200 ease-(--ease-soft) focus-within:border-white/25 hover:-translate-y-0.5 hover:border-white/20 motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-2">
        <InitialsAvatar name={lead.full_name} seed={lead.id} />
        <div className="flex flex-wrap justify-end gap-1">
          <PriorityBadge priority={lead.priority} />
        </div>
      </div>

      <h3 className="mt-3.5 min-w-0 text-[0.95rem] leading-snug font-semibold">
        {/* Enlace extendido: toda la tarjeta abre la ficha; las acciones quedan por encima. */}
        <Link
          href={`/leads/${lead.id}`}
          className="line-clamp-2 break-words outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {lead.full_name}
        </Link>
      </h3>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {subtitle || (lead.customer_reference ? `Nº póliza ${lead.customer_reference}` : "Sin producto asignado")}
      </p>

      <dl className="surface-inset mt-3.5 grid grid-cols-2 gap-3 rounded-2xl px-3.5 py-3">
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">Próxima acción</dt>
          <dd
            className={cn("mt-0.5 truncate text-sm font-semibold", overdue && "text-destructive")}
            title={lead.next_follow_up_at ? formatDateTime(lead.next_follow_up_at, tz) : undefined}
          >
            {lead.next_follow_up_at
              ? `${overdue ? "Vencida · " : ""}${formatRelative(lead.next_follow_up_at, now)}`
              : lead.status === "pending_contact"
                ? "Primer contacto"
                : "Sin programar"}
          </dd>
          {lead.next_action ? <dd className="truncate text-[11px] text-muted-foreground">{lead.next_action}</dd> : null}
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">Último contacto</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold" title={lead.last_contact_at ? formatDateTime(lead.last_contact_at, tz) : undefined}>
            {lead.last_contact_at ? formatRelative(lead.last_contact_at, now) : "Sin contacto"}
          </dd>
          {lead.last_outcome ? <dd className="truncate text-[11px] text-muted-foreground">{ACTIVITY_OUTCOME_LABELS[lead.last_outcome]}</dd> : null}
        </div>
      </dl>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3.5">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <LeadStatusBadge status={lead.status} />
          {lead.has_funeral_insurance !== null ? <FuneralInsuranceBadge value={lead.has_funeral_insurance} /> : null}
          <LegacyStatusBadge legacyStatus={lead.legacy_status} />
        </div>
        {canContact && (lead.email || lead.phone) ? (
          <div className="flex shrink-0 gap-1.5">
            {lead.email ? <QuickAction href={`mailto:${lead.email}`} label={`Escribir a ${lead.full_name}`} icon={MailIcon} /> : null}
            {lead.phone ? <QuickAction href={telHref(lead.phone)} label={`Llamar a ${lead.full_name}`} icon={PhoneIcon} /> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function LeadsList({
  leads,
  products,
  timezone,
  now,
  layout,
}: {
  leads: LeadListItem[];
  products: Product[];
  timezone: string;
  now: number;
  layout: LeadFilters["layout"];
}) {
  return (
    <>
      {/* Tarjetas: siempre en móvil y, en escritorio, en la vista "Tarjetas". */}
      <ul
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] sm:gap-4",
          layout === "table" && "md:hidden",
        )}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} products={products} tz={timezone} now={now} />
        ))}
      </ul>

      {layout === "table" ? (
        <div className="surface hidden overflow-x-auto rounded-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Cliente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Decesos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último resultado</TableHead>
                <TableHead>Próxima acción</TableHead>
                <TableHead className="pr-5">Recibido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-64 pl-5">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={lead.full_name} seed={lead.id} className="size-8 text-xs" />
                      <div className="min-w-0">
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
                      </div>
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
                  <TableCell className="pr-5 text-sm whitespace-nowrap">{formatDate(lead.received_at, timezone)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}

export function Pagination({ filters, page, pageCount, total }: { filters: LeadFilters; page: number; pageCount: number; total: number }) {
  if (pageCount <= 1) return <p className="text-sm text-muted-foreground">{total} fichas</p>;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-2">
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
