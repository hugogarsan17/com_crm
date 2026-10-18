"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productOptions, type Product } from "@/features/products/catalog";
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

export function LeadsFilters({ filters, products }: { filters: LeadFilters; products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

  function apply(patch: Partial<LeadFilters>) {
    const next = { ...filters, ...patch, page: 1 };
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3" role="search">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email o número de póliza"
          aria-label="Buscar fichas"
          className="h-10 pl-8"
        />
        {pending ? (
          <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Cargando" />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-col gap-1">
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
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-sort" className="text-xs text-muted-foreground">Ordenar por</Label>
          <Select value={filters.sort} onValueChange={(v) => apply({ sort: v as LeadFilters["sort"] })}>
            <SelectTrigger id="f-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAD_SORTS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-from" className="text-xs text-muted-foreground">Recibido desde</Label>
          <Input id="f-from" type="date" value={filters.from ?? ""} onChange={(e) => apply({ from: e.target.value || undefined })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-to" className="text-xs text-muted-foreground">Recibido hasta</Label>
          <Input id="f-to" type="date" value={filters.to ?? ""} onChange={(e) => apply({ to: e.target.value || undefined })} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Fichas activas o archivadas">
          {(["active", "archived"] as const).map((view) => (
            <Button
              key={view}
              type="button"
              size="sm"
              variant={filters.view === view ? "secondary" : "ghost"}
              aria-pressed={filters.view === view}
              onClick={() => apply({ view })}
            >
              {view === "active" ? "Activas" : "Archivadas"}
            </Button>
          ))}
        </div>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              startTransition(() => router.replace(`${pathname}${leadFiltersToSearch({ view: filters.view, sort: filters.sort })}`));
            }}
          >
            <XIcon aria-hidden /> Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
}
