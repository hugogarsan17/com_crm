"use client";

import { createContext, useContext, useRef, useState, type ChangeEvent, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useFieldArray, useForm, useFormContext, useFormState, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CameraIcon,
  IdCardIcon,
  ImageUpIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  applyActionErrors,
  callAction,
  CheckboxField,
  FormRootError,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form/fields";
import { FUNERAL_INSURANCE_LABELS, FUNERAL_INSURANCE_OPTIONS, LEAD_PRIORITIES, LEAD_PRIORITY_LABELS } from "@/features/leads/constants";
import { productOptions, type Product } from "@/features/products/catalog";
import { cn } from "@/lib/utils";
import { scanReviewSchema, type ScanReviewInput } from "@/lib/validation/scan";
import { createLeadFromScan, findScanDuplicates, type ScanDuplicate } from "../actions";
import { FORMAS_PAGO, groupWordsIntoLines, isConsultaAbreviada, parseConsultaAbreviada } from "../consulta-abreviada";
import { recognizeImage } from "../ocr";
import { scanToReviewValues } from "../review-values";

type Review = {
  values: ScanReviewInput;
  doubtful: Record<string, string | null>;
  dni: string | null;
  dniReading: string | null;
  duplicates: ScanDuplicate[];
};

type State =
  | { step: "pick" }
  | { step: "reading"; status: string; progress: number }
  | { step: "error"; message: string }
  | { step: "review"; review: Review };

const funeralOptions = FUNERAL_INSURANCE_OPTIONS.map((v) => ({ value: v, label: FUNERAL_INSURANCE_LABELS[v] }));
const priorityOptions = LEAD_PRIORITIES.map((p) => ({ value: p, label: LEAD_PRIORITY_LABELS[p] }));
const frequencyHint = Object.entries(FORMAS_PAGO)
  .map(([code, label]) => `${code} = ${label.toLowerCase()}`)
  .join(", ");

/**
 * Escaneo de la hoja «Consulta abreviada»: foto → OCR en el navegador → revisión de
 * todos los campos (los dudosos resaltados) → alta atómica. La imagen no se guarda.
 */
export function ScanSheetFlow({ products, defaultTaskDueLocal }: { products: Product[]; defaultTaskDueLocal: string }) {
  const [state, setState] = useState<State>({ step: "pick" });
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const run = useRef(0);

  async function read(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ step: "error", message: "Selecciona una imagen (foto, JPG o PNG). Si tienes un PDF, haz una captura de la página." });
      return;
    }
    const id = ++run.current;
    try {
      const { words } = await recognizeImage(file, ({ status, progress }) => {
        if (id === run.current) setState({ step: "reading", status, progress });
      });
      if (id !== run.current) return;
      const lines = groupWordsIntoLines(words);
      if (!isConsultaAbreviada(lines)) {
        setState({
          step: "error",
          message:
            "No parece una hoja «Consulta abreviada». Repite la foto de frente y con buena luz, o usa «Otro documento» en Nueva ficha.",
        });
        return;
      }
      const sheet = parseConsultaAbreviada(lines);
      const { values, doubtful, dni, dniReading } = scanToReviewValues(sheet, defaultTaskDueLocal);
      const dup = await callAction(() =>
        findScanDuplicates({ customer_reference: values.lead.customer_reference, phone: values.lead.phone }),
      );
      if (id !== run.current) return;
      setState({ step: "review", review: { values, doubtful, dni, dniReading, duplicates: dup.ok ? dup.data : [] } });
    } catch {
      if (id === run.current) {
        setState({ step: "error", message: "No se pudo leer la hoja. Comprueba la conexión (la primera vez se descarga el lector) y vuelve a intentarlo." });
      }
    }
  }

  function restart() {
    run.current++;
    setState({ step: "pick" });
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    void read(e.target.files?.[0]);
    e.target.value = "";
  };

  const inputs = (
    <>
      {/* Entradas ocultas: cámara trasera en móvil y selector de archivos. La imagen solo vive en memoria. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
    </>
  );

  if (state.step === "review") {
    return <ReviewForm review={state.review} products={products} onRestart={restart} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Foto de la hoja</CardTitle>
        <CardDescription>
          Hoja impresa «Consulta abreviada». Se lee en tu dispositivo: la imagen no se sube ni se guarda. El IBAN y el domicilio de cobro se descartan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {inputs}
        {state.step === "error" ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.step === "reading" ? (
          <div className="flex flex-col gap-3 py-2" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> {state.status}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(state.progress * 100)}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" size="lg" onClick={() => cameraInput.current?.click()}>
                <CameraIcon aria-hidden /> Hacer foto
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => fileInput.current?.click()}>
                <ImageUpIcon aria-hidden /> Elegir imagen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Consejo: la hoja entera, de frente, plana y con buena luz. Después podrás revisar y corregir todos los datos antes de guardar.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Revisión
// -----------------------------------------------------------------------------
const DoubtContext = createContext<Record<string, string | null>>({});

/** Aviso de campo dudoso: se muestra hasta que el usuario lo edita. */
function useDoubt(name: string) {
  const doubtful = useContext(DoubtContext);
  const { setValue, control } = useFormContext();
  const { dirtyFields } = useFormState({ control, name });
  const isDirty = name.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), dirtyFields);
  if (!(name in doubtful) || isDirty) return null;
  const reading = doubtful[name];
  return {
    className: "[&_input]:border-warning [&_input]:ring-3 [&_input]:ring-warning/20",
    description: (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-warning">
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold">
          <AlertTriangleIcon className="size-3" aria-hidden /> Dudoso
        </span>
        {reading ? (
          <>
            <span>
              Leído: «<span className="font-mono">{reading}</span>»
            </span>
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              onClick={() => setValue(name, reading, { shouldDirty: true, shouldValidate: true })}
            >
              Usar esta lectura
            </button>
          </>
        ) : (
          <span>No se ha leído con seguridad: compruébalo en la hoja.</span>
        )}
      </span>
    ),
  };
}

function ReviewTextField({ className, description, ...props }: ComponentProps<typeof TextField>) {
  const doubt = useDoubt(props.name);
  return <TextField {...props} className={cn(className, doubt?.className)} description={doubt?.description ?? description} />;
}

function ReviewForm({ review, products, onRestart }: { review: Review; products: Product[]; onRestart: () => void }) {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(scanReviewSchema), defaultValues: review.values, mode: "onBlur" });
  const coverages = useFieldArray({ control: form.control, name: "coverages" });
  const insured = useFieldArray({ control: form.control, name: "insured" });
  const taskEnabled = useWatch({ control: form.control, name: "task.enabled" });
  const doubtCount = Object.keys(review.doubtful).length;

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => createLeadFromScan(form.getValues()));
    if (!result.ok) {
      applyActionErrors(form, result);
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Ficha creada");
    router.push(`/leads/${result.data.id}`);
  });

  return (
    <DoubtContext.Provider value={review.doubtful}>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <FormRootError />

          {doubtCount ? (
            <Alert>
              <AlertTriangleIcon className="text-warning" />
              <AlertDescription>
                {doubtCount === 1 ? "Hay 1 campo dudoso" : `Hay ${doubtCount} campos dudosos`} marcado
                {doubtCount === 1 ? "" : "s"} con «Dudoso»: compruébalos con la hoja. El resto también es editable.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircleIcon />
              <AlertDescription>Se han leído todos los campos. Revísalos antes de crear la ficha.</AlertDescription>
            </Alert>
          )}

          {review.duplicates.length ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>
                Posible duplicado: ya tienes{" "}
                {review.duplicates.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/leads/${d.id}`} target="_blank" className="font-medium underline underline-offset-4">
                      {d.full_name}
                    </Link>{" "}
                    (mismo {d.reasons.join(" y ")})
                  </span>
                ))}
                . Puedes crear la ficha igualmente.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Ficha del cliente</CardTitle>
              <CardDescription>Datos del tomador.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ReviewTextField name="lead.full_name" label="Nombre y apellidos" required autoComplete="off" className="sm:col-span-2" />
                <ReviewTextField name="lead.phone" label="Teléfono" type="tel" inputMode="tel" autoComplete="off" />
                <ReviewTextField name="lead.secondary_phone" label="Teléfono adicional" type="tel" inputMode="tel" autoComplete="off" />
                <ReviewTextField name="lead.address" label="Domicilio" autoComplete="off" className="sm:col-span-2" />
                <ReviewTextField name="lead.postal_code" label="Código postal" inputMode="numeric" autoComplete="off" />
                <ReviewTextField name="lead.locality" label="Localidad" autoComplete="off" />
                <ReviewTextField name="lead.customer_reference" label="Número de póliza" autoComplete="off" />
                <SelectField
                  name="lead.has_funeral_insurance"
                  label="¿Tiene seguro de decesos?"
                  options={funeralOptions}
                  description="«Sí» si la hoja incluye la garantía SER.DECESOS."
                />
                <SelectField name="lead.product_code" label="Producto a ofrecer" options={productOptions(products, "")} emptyLabel="Sin producto" />
                <SelectField name="lead.priority" label="Prioridad" options={priorityOptions} required />
                <TextareaField name="lead.notes" label="Notas" rows={3} className="sm:col-span-2" />
              </FieldGroup>
              <div className="surface-inset flex items-start gap-3 rounded-2xl px-4 py-3 text-sm" role="note">
                <IdCardIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <p>
                  {review.dni ? (
                    <>
                      DNI leído: <span className="font-mono font-medium">{review.dni}</span>.{" "}
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-warning">DNI dudoso</span>
                      {review.dniReading ? (
                        <>
                          {" "}
                          (leído «<span className="font-mono">{review.dniReading}</span>»)
                        </>
                      ) : null}
                      .{" "}
                    </>
                  )}
                  <span className="text-muted-foreground">Solo para que lo compruebes con la hoja: no se guarda.</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Póliza del cliente</CardTitle>
              <CardDescription>La póliza que ya tiene. No cuenta como venta ni en comisiones.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReviewTextField name="policy.product_reference" label="Producto (código)" inputMode="numeric" />
                <ReviewTextField name="policy.effect_date" label="Fecha de efecto" type="date" />
                <ReviewTextField name="policy.policy_type" label="Tipo" />
                <ReviewTextField name="policy.payment_frequency" label="Forma de pago" description={frequencyHint} />
                <ReviewTextField name="policy.status_code" label="Situación" description="VI = vigente" />
                <ReviewTextField name="policy.cancel_date" label="Fecha de baja" type="date" />
                <ReviewTextField
                  name="policy.covered_until"
                  label="Cubierto hasta"
                  type="date"
                  description="Se guarda, pero todavía no genera avisos."
                />
                <ReviewTextField name="policy.annual_premium" label="Prima anual (€)" inputMode="decimal" />
                <ReviewTextField name="policy.first_receipt_amount" label="Primer recibo (€)" inputMode="decimal" />
                <ReviewTextField name="policy.next_receipt_amount" label="Siguientes recibos (€)" inputMode="decimal" />
                <ReviewTextField name="policy.consulted_at" label="Fecha de la consulta" type="datetime-local" />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Garantías ({coverages.fields.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {coverages.fields.length === 0 ? <p className="text-sm text-muted-foreground">No se ha leído ninguna garantía.</p> : null}
              {coverages.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-start gap-2">
                  <ReviewTextField name={`coverages.${i}.nombre`} label="Garantía" />
                  <ReviewTextField name={`coverages.${i}.estado`} label="Estado" />
                  <Button type="button" variant="ghost" size="icon-lg" className="mt-6" aria-label={`Quitar garantía ${i + 1}`} onClick={() => coverages.remove(i)}>
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="self-start" onClick={() => coverages.append({ nombre: "", estado: "" })}>
                <PlusIcon aria-hidden /> Añadir garantía
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asegurados ({insured.fields.length})</CardTitle>
              <CardDescription>El nombre puede venir recortado por la pantalla: se guarda tal cual.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {insured.fields.length === 0 ? <p className="text-sm text-muted-foreground">No se ha leído ningún asegurado.</p> : null}
              {insured.fields.map((f, i) => (
                <div key={f.id} className="surface-inset flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Asegurado {i + 1}</p>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Quitar asegurado ${i + 1}`} onClick={() => insured.remove(i)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                  <FieldGroup className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                    <ReviewTextField name={`insured.${i}.orden`} label="Orden" inputMode="numeric" />
                    <ReviewTextField name={`insured.${i}.nombre`} label="Nombre" className="col-span-2 sm:col-span-5" />
                    <ReviewTextField name={`insured.${i}.edad_real`} label="Edad real" inputMode="numeric" />
                    <ReviewTextField name={`insured.${i}.edad_derecho`} label="Edad derecho" inputMode="numeric" />
                    <ReviewTextField name={`insured.${i}.baja`} label="Baja" type="date" className="sm:col-span-2" />
                    <ReviewTextField name={`insured.${i}.motivo`} label="Motivo" className="sm:col-span-2" />
                  </FieldGroup>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => insured.append({ orden: String(insured.fields.length + 1), nombre: "", edad_real: "", edad_derecho: "", baja: "", motivo: "" })}
              >
                <PlusIcon aria-hidden /> Añadir asegurado
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Primera tarea de seguimiento</CardTitle>
              <CardDescription>Opcional. Se crea junto con la ficha.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <CheckboxField name="task.enabled" label="Crear la primera tarea" className="sm:col-span-2" />
                {taskEnabled ? (
                  <>
                    <TextField name="task.title" label="Título" required />
                    <TextField name="task.due_at" label="Día y hora" type="datetime-local" required />
                  </>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={onRestart}>
              <RotateCcwIcon aria-hidden /> Descartar y escanear otra
            </Button>
            <SubmitButton>Crear ficha</SubmitButton>
          </div>
        </form>
      </FormProvider>
    </DoubtContext.Provider>
  );
}
