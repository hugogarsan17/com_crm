"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDownIcon, DownloadIcon, LayoutGridIcon, Loader2Icon, SearchIcon, SlidersHorizontalIcon, TableIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { chipClass, segmentedClass, segmentedItemClass } from "@/components/shared/segmented";
import { productOptions, type Product } from "@/features/products/catalog";
import { cn } from "@/lib/utils";
import {
  FUNERAL_INSURANCE_LABELS,
  FUNERAL_INSURANCE_OPTIONS,
  LEAD_PRIORITIES,
  LEAD_PRIORITY_LABELS,
  LEAD_SORTS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from "../constants";
import { leadFiltersToSearch, type LeadFilters } from "../search-params";

const ALL = "__all__";

/** Atajos de estado visibles como chips; el resto de estados se elige en el panel de filtros. */
const STATUS_CHIPS: { value: LeadFilters["status"]; label: string }[] = [
  { value: undefined, label: "Todas" },
  { value: "open", label: "Abiertas" },
  { value: "pending_contact", label: "Pendientes" },
  { value: "follow_up", label: "En seguimiento" },
  { value: "closed", label: "Cerradas" },
];

const pillTrigger = "h-10 rounded-full border-border bg-white/[0.03] pl-3.5 hover:bg-surface-hover";

export function LeadsFilters({ filters, products, actions }: { filters: LeadFilters; products: Product[]; actions?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

  function apply(patch: Partial<LeadFilters>, resetPage = true) {
    const next = { ...filters, ...patch, ...(resetPage ? { page: 1 } : {}) };
    startTransition(() => router.replace(`${pathname}${leadFiltersToSearch(next)}`, { scroll: false }));
  }

  // Búsqueda con retardo para no lanzar una consulta por cada tecla.
  useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const t = setTimeout(() => apply({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = Boolean(
    filters.q || filters.status || filters.priority || filters.product || filters.funeral || filters.from || filters.to,
  );
  // Filtros que solo se ven dentro del panel (para indicarlo en el botón).
  const panelCount =
    [filters.priority, filters.product, filters.funeral, filters.from, filters.to].filter(Boolean).length +
    (filters.view === "archived" ? 1 : 0) +
    (filters.status && !STATUS_CHIPS.some((c) => c.value === filters.status) ? 1 : 0);

  function clearAll() {
    setQ("");
    startTransition(() =>
      router.replace(`${pathname}${leadFiltersToSearch({ view: filters.view, sort: filters.sort, layout: filters.layout })}`),
    );
  }

  return (
    <div className="flex flex-col gap-3" role="search">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:w-80 xl:w-[24rem]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, teléfono, email o nº de póliza…"
            aria-label="Buscar fichas"
            className="h-11 rounded-full border-border bg-white/[0.04] pr-10 pl-10 backdrop-blur-md"
          />
          {pending ? (
            <Loader2Icon className="absolute top-1/2 right-4 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Cargando" />
          ) : null}
        </div>

        {/* Desplazamiento horizontal propio en móvil; la página nunca desborda. */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          <div role="group" aria-label="Filtrar por estado" className="flex w-max gap-1.5">
            {STATUS_CHIPS.map((chip) => {
              const active = filters.status === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => apply({ status: chip.value })}
                  className={chipClass(active)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <FiltersPanel filters={filters} products={products} apply={apply} count={panelCount} onClear={clearAll} hasFilters={hasFilters} />

          <Select value={filters.sort} onValueChange={(v) => apply({ sort: v as LeadFilters["sort"] })}>
            <SelectTrigger aria-label="Ordenar por" className={cn(pillTrigger, "min-w-0")}>
              <ArrowUpDownIcon className="text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {Object.entries(LEAD_SORTS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div role="group" aria-label="Vista de la lista" className={cn(segmentedClass, "hidden md:inline-flex")}>
            {(
              [
                ["grid", "Tarjetas", LayoutGridIcon],
                ["table", "Tabla", TableIcon],
              ] as const
            ).map(([layout, label, Icon]) => (
              <button
                key={layout}
                type="button"
                aria-pressed={filters.layout === layout}
                onClick={() => apply({ layout }, false)}
                className={segmentedItemClass(filters.layout === layout)}
              >
                <Icon aria-hidden /> {label}
              </button>
            ))}
          </div>

          <Button asChild variant="outline" size="lg">
            <a href="/api/export/leads">
              <DownloadIcon aria-hidden /> Exportar
            </a>
          </Button>
        </div>
      </div>

      {hasFilters ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtros aplicados.</span>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            <XIcon aria-hidden /> Limpiar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FiltersPanel({
  filters,
  products,
  apply,
  count,
  onClear,
  hasFilters,
}: {
  filters: LeadFilters;
  products: Product[];
  apply: (patch: Partial<LeadFilters>) => void;
  count: number;
  onClear: () => void;
  hasFilters: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" aria-label={count ? `Filtros (${count} aplicados)` : "Filtros"}>
          <SlidersHorizontalIcon aria-hidden /> Filtros
          {count ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground" aria-hidden>
              {count}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100vw,24rem)] gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Los cambios se aplican al instante.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Fichas</Label>
            <div role="group" aria-label="Fichas activas o archivadas" className={cn(segmentedClass, "w-full")}>
              {(["active", "archived"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={filters.view === view}
                  onClick={() => apply({ view })}
                  className={cn(segmentedItemClass(filters.view === view), "flex-1")}
                >
                  {view === "active" ? "Activas" : "Archivadas"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-status" className="text-xs text-muted-foreground">Estado</Label>
            <Select value={filters.status ?? ALL} onValueChange={(v) => apply({ status: v === ALL ? undefined : (v as LeadFilters["status"]) })}>
              <SelectTrigger id="f-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="open">Abiertos</SelectItem>
                <SelectItem value="closed">Cerrados</SelectItem>
                <SelectSeparator />
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-priority" className="text-xs text-muted-foreground">Prioridad</Label>
            <Select value={filters.priority ?? ALL} onValueChange={(v) => apply({ priority: v === ALL ? undefined : (v as LeadFilters["priority"]) })}>
              <SelectTrigger id="f-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {LEAD_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {LEAD_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-product" className="text-xs text-muted-foreground">Producto</Label>
            <Select value={filters.product ?? ALL} onValueChange={(v) => apply({ product: v === ALL ? undefined : v })}>
              <SelectTrigger id="f-product" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {productOptions(products, filters.product).map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-funeral" className="text-xs text-muted-foreground">Seguro de decesos</Label>
            <Select
              value={filters.funeral ?? ALL}
              onValueChange={(v) => apply({ funeral: v === ALL ? undefined : (v as LeadFilters["funeral"]) })}
            >
              <SelectTrigger id="f-funeral" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {FUNERAL_INSURANCE_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {FUNERAL_INSURANCE_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-from" className="text-xs text-muted-foreground">Recibido desde</Label>
              <Input id="f-from" type="date" value={filters.from ?? ""} onChange={(e) => apply({ from: e.target.value || undefined })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="f-to" className="text-xs text-muted-foreground">Recibido hasta</Label>
              <Input id="f-to" type="date" value={filters.to ?? ""} onChange={(e) => apply({ to: e.target.value || undefined })} />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row justify-between border-t px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClear} disabled={!hasFilters}>
            <XIcon aria-hidden /> Limpiar
          </Button>
          <Button type="button" onClick={() => setOpen(false)}>
            Ver resultados
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
