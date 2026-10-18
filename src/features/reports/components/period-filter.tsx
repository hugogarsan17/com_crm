"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adjacentMonths, formatMonth, PERIOD_PRESETS, type PeriodPreset } from "../period";

const ALL = "__all__";

function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function navigate(patch: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const q = sp.toString();
    startTransition(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false }));
  }

  return { navigate, pending };
}

export function PeriodFilter({
  preset,
  from,
  to,
  month,
  currentMonth,
  products,
  product,
}: {
  preset: PeriodPreset;
  from: string;
  to: string;
  /** Mes natural seleccionado ("YYYY-MM"), si el periodo es un mes completo. */
  month: string | null;
  /** Mes en curso en la zona horaria del usuario ("YYYY-MM"). */
  currentMonth: string;
  /** Si se pasa, muestra el filtro de producto (códigos del catálogo). */
  products?: { value: string; label: string }[];
  product?: string;
}) {
  const { navigate, pending } = useNavigate();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [pickedMonth, setPickedMonth] = useState(month ?? currentMonth);
  const [mode, setMode] = useState<PeriodPreset>(preset);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="period" className="text-xs text-muted-foreground">Periodo</Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            const next = v as PeriodPreset;
            setMode(next);
            if (next === "custom" || next === "month") return;
            navigate({ period: v, from: undefined, to: undefined, month: undefined });
          }}
        >
          <SelectTrigger id="period" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_PRESETS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mode === "month" ? (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor="p-month" className="text-xs text-muted-foreground">Mes</Label>
            <Input
              id="p-month"
              type="month"
              value={pickedMonth}
              max={currentMonth}
              onChange={(e) => setPickedMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="secondary"
            disabled={!pickedMonth || pickedMonth > currentMonth}
            onClick={() => navigate({ period: "month", month: pickedMonth, from: undefined, to: undefined })}
          >
            Aplicar
          </Button>
        </>
      ) : null}
      {mode === "custom" ? (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor="p-from" className="text-xs text-muted-foreground">Desde</Label>
            <Input id="p-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="p-to" className="text-xs text-muted-foreground">Hasta</Label>
            <Input id="p-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
          </div>
          <Button
            variant="secondary"
            disabled={!customFrom || !customTo}
            onClick={() => navigate({ period: "custom", from: customFrom, to: customTo, month: undefined })}
          >
            Aplicar
          </Button>
        </>
      ) : null}
      {products ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="r-product" className="text-xs text-muted-foreground">Producto</Label>
          <Select value={product ?? ALL} onValueChange={(v) => navigate({ product: v === ALL ? undefined : v })}>
            <SelectTrigger id="r-product" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los productos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {pending ? <Loader2Icon className="mb-2 size-4 animate-spin text-muted-foreground" aria-label="Cargando" /> : null}
    </div>
  );
}

/** Flechas mes anterior / siguiente para periodos de un mes natural. */
export function MonthNavigator({ month, currentMonth }: { month: string; currentMonth: string }) {
  const { navigate, pending } = useNavigate();
  const { prev, next } = adjacentMonths(month, currentMonth);
  const go = (m: string) =>
    navigate(m === currentMonth ? { period: undefined, month: undefined, from: undefined, to: undefined } : { period: "month", month: m, from: undefined, to: undefined });

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Cambiar de mes">
      <Button variant="outline" size="icon-lg" disabled={pending} onClick={() => go(prev)} aria-label={`Ver ${formatMonth(prev)}`}>
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium capitalize" aria-live="polite">
        {formatMonth(month)}
      </span>
      <Button
        variant="outline"
        size="icon-lg"
        disabled={pending || !next}
        onClick={() => next && go(next)}
        aria-label={next ? `Ver ${formatMonth(next)}` : "No hay meses posteriores"}
      >
        <ChevronRightIcon />
      </Button>
      {month !== currentMonth ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => go(currentMonth)}>
          Mes actual
        </Button>
      ) : null}
    </div>
  );
}
