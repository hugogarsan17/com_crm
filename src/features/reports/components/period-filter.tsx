"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_PRESETS, type PeriodPreset } from "../period";

const ALL = "__all__";

export function PeriodFilter({
  preset,
  from,
  to,
  products,
  product,
}: {
  preset: PeriodPreset;
  from: string;
  to: string;
  /** Si se pasa, muestra el filtro de producto. */
  products?: string[];
  product?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [showCustom, setShowCustom] = useState(preset === "custom");

  function navigate(patch: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const q = sp.toString();
    startTransition(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="period" className="text-xs text-muted-foreground">Periodo</Label>
        <Select
          value={showCustom ? "custom" : preset}
          onValueChange={(v) => {
            if (v === "custom") {
              setShowCustom(true);
              return;
            }
            setShowCustom(false);
            navigate({ period: v, from: undefined, to: undefined });
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
      {showCustom ? (
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
            onClick={() => navigate({ period: "custom", from: customFrom, to: customTo })}
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
                <SelectItem key={p} value={p}>
                  {p}
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
