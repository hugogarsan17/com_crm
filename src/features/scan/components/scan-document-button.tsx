"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { AlertCircleIcon, CameraIcon, ImageUpIcon, Loader2Icon, ScanTextIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FUNERAL_INSURANCE_LABELS } from "@/features/leads/constants";
import { productLabel, type Product } from "@/features/products/catalog";
import { extractLeadFields, SCANNED_FIELD_LABELS, type ScannedLead } from "../extract";
import { recognizeImage } from "../ocr";

type Field = keyof ScannedLead;

type State =
  | { step: "pick" }
  | { step: "reading"; status: string; progress: number }
  | { step: "review"; fields: ScannedLead; text: string }
  | { step: "error"; message: string };

function displayValue(field: Field, value: string, products: Product[]) {
  if (field === "has_funeral_insurance") return FUNERAL_INSURANCE_LABELS[value as "yes" | "no"];
  if (field === "product_code") return productLabel(products, value);
  return value;
}

/**
 * Escanea una ficha en papel o una captura: reconoce el texto en el navegador (Tesseract.js,
 * la imagen no sale del dispositivo), deduce los campos y rellena el formulario para revisarlo.
 */
export function ScanDocumentButton({ products, label = "Escanear documento" }: { products: Product[]; label?: string }) {
  const { setValue, getValues, setFocus } = useFormContext();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ step: "pick" });
  const [selected, setSelected] = useState<Set<Field>>(new Set());
  const [addToNotes, setAddToNotes] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const run = useRef(0);

  // Al cerrar el diálogo se descarta el reconocimiento en curso.
  useEffect(() => {
    if (!open) run.current++;
  }, [open]);

  async function read(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ step: "error", message: "Selecciona una imagen (foto, JPG o PNG). Si tienes un PDF, haz una captura de la página." });
      return;
    }
    const id = ++run.current;
    setState({ step: "reading", status: "Preparando la imagen…", progress: 0 });
    try {
      const { text } = await recognizeImage(file, ({ status, progress }) => {
        if (id === run.current) setState({ step: "reading", status, progress });
      });
      if (id !== run.current) return;
      const fields = extractLeadFields(text, products);
      setSelected(new Set(Object.keys(fields) as Field[]));
      setAddToNotes(false);
      setState({ step: "review", fields, text: text.trim() });
    } catch {
      if (id === run.current) {
        setState({ step: "error", message: "No se pudo leer el documento. Comprueba la conexión (la primera vez se descarga el lector) y vuelve a intentarlo." });
      }
    }
  }

  function apply(fields: ScannedLead, text: string) {
    const chosen = (Object.keys(fields) as Field[]).filter((f) => selected.has(f));
    for (const field of chosen) {
      setValue(field, fields[field], { shouldDirty: true, shouldValidate: true });
    }
    if (addToNotes && text) {
      const current = String(getValues("notes") ?? "").trim();
      setValue("notes", `${current ? `${current}\n\n` : ""}Texto escaneado:\n${text}`.slice(0, 2000), { shouldDirty: true, shouldValidate: true });
    }
    setOpen(false);
    toast.success(
      chosen.length
        ? `${chosen.length} ${chosen.length === 1 ? "campo rellenado" : "campos rellenados"}. Revísalos antes de crear la ficha.`
        : "No se ha rellenado ningún campo.",
    );
    if (!getValues("full_name")) setTimeout(() => setFocus("full_name"), 50);
  }

  function toggle(field: Field, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => {
          setState({ step: "pick" });
          setOpen(true);
        }}
      >
        <ScanTextIcon aria-hidden /> {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Escanear documento</DialogTitle>
            <DialogDescription>
              Haz una foto de la ficha o elige una imagen. El texto se lee en tu dispositivo y rellena el formulario para que lo revises.
            </DialogDescription>
          </DialogHeader>

          {/* Entradas ocultas: cámara trasera en móvil y selector de archivos. */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {state.step === "pick" || state.step === "error" ? (
            <div className="flex flex-col gap-3">
              {state.step === "error" ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" size="lg" onClick={() => cameraInput.current?.click()}>
                  <CameraIcon aria-hidden /> Hacer foto
                </Button>
                <Button type="button" size="lg" variant="outline" onClick={() => fileInput.current?.click()}>
                  <ImageUpIcon aria-hidden /> Elegir imagen
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Consejo: foto de frente, con buena luz y el texto enfocado. Se reconocen nombre, teléfono, email, código postal,
                localidad, número de póliza, seguro de decesos y producto.
              </p>
            </div>
          ) : null}

          {state.step === "reading" ? (
            <div className="flex flex-col gap-3 py-2" role="status" aria-live="polite">
              <p className="flex items-center gap-2 text-sm">
                <Loader2Icon className="size-4 animate-spin" aria-hidden /> {state.status}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${Math.round(state.progress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {state.step === "review" ? (
            <div className="flex flex-col gap-4">
              {Object.keys(state.fields).length === 0 ? (
                <Alert>
                  <AlertCircleIcon />
                  <AlertDescription>
                    No se ha reconocido ningún dato con seguridad. Prueba con otra foto o guarda el texto leído en las notas.
                  </AlertDescription>
                </Alert>
              ) : (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Datos detectados</legend>
                  {(Object.entries(state.fields) as [Field, string][]).map(([field, value]) => (
                    <div key={field} className="surface-inset flex items-start gap-3 rounded-2xl px-3.5 py-2.5">
                      <Checkbox
                        id={`scan-${field}`}
                        checked={selected.has(field)}
                        onCheckedChange={(v) => toggle(field, v === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor={`scan-${field}`} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal">
                        <span className="text-xs text-muted-foreground">{SCANNED_FIELD_LABELS[field]}</span>
                        <span className="text-sm font-medium break-all">{displayValue(field, value, products)}</span>
                      </Label>
                    </div>
                  ))}
                </fieldset>
              )}

              {state.text ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Ver texto leído</summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-2xl border bg-black/25 p-3 font-sans text-xs whitespace-pre-wrap">
                    {state.text}
                  </pre>
                </details>
              ) : null}

              {state.text ? (
                <div className="flex items-center gap-2">
                  <Checkbox id="scan-notes" checked={addToNotes} onCheckedChange={(v) => setAddToNotes(v === true)} />
                  <Label htmlFor="scan-notes" className="font-normal">
                    Guardar el texto leído en Notas
                  </Label>
                </div>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setState({ step: "pick" })}>
                  Escanear otra
                </Button>
                <Button
                  type="button"
                  onClick={() => apply(state.fields, state.text)}
                  disabled={selected.size === 0 && !addToNotes}
                >
                  Rellenar formulario
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
