"use client";

import { useEffect, useId, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { callAction } from "@/components/form/fields";
import { cn } from "@/lib/utils";
import { searchLeadOptions, type LeadOption } from "../actions";

/** Selector de ficha para vincular una tarea: busca entre las fichas activas del usuario. */
export function LeadPickerField({ name, initialLead }: { name: string; initialLead?: { id: string; full_name: string } | null }) {
  const { control, getFieldState, formState } = useFormContext();
  const error = getFieldState(name, formState).error;
  const listId = useId();
  const [selected, setSelected] = useState(initialLead ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (selected) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await callAction(() => searchLeadOptions(query));
      if (cancelled) return;
      setLoading(false);
      if (r.ok) {
        setResults(r.data);
        setSearchError(null);
      } else {
        setResults(null);
        setSearchError(r.error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor={`${listId}-search`}>
            Ficha del cliente
            <span aria-hidden className="text-destructive">
              *
            </span>
          </FieldLabel>
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="truncate font-medium">{selected.full_name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(null);
                  field.onChange("");
                }}
              >
                <XIcon aria-hidden /> Cambiar
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id={`${listId}-search`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o nº de póliza"
                  className="pl-8"
                  aria-controls={listId}
                  aria-invalid={!!error}
                  autoComplete="off"
                />
                {loading ? (
                  <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando" />
                ) : null}
              </div>
              <ul id={listId} role="listbox" aria-label="Fichas" className="max-h-48 overflow-y-auto rounded-lg border">
                {searchError ? <li className="px-3 py-2 text-sm text-destructive">{searchError}</li> : null}
                {results && results.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Ninguna ficha activa coincide.</li>
                ) : null}
                {results?.map((lead) => (
                  <li key={lead.id} role="option" aria-selected={field.value === lead.id}>
                    <button
                      type="button"
                      className={cn("flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted")}
                      onClick={() => {
                        setSelected({ id: lead.id, full_name: lead.full_name });
                        field.onChange(lead.id);
                      }}
                    >
                      <span className="font-medium">{lead.full_name}</span>
                      <span className="text-xs text-muted-foreground">{[lead.phone, lead.locality].filter(Boolean).join(" · ") || "Sin teléfono"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <FieldDescription>Toda tarea debe estar vinculada a una ficha.</FieldDescription>
          <FieldError errors={[error ? { message: "Selecciona la ficha del cliente" } : undefined]} />
        </Field>
      )}
    />
  );
}
