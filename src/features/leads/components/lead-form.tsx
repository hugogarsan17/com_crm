"use client";

import { useRouter } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  applyActionErrors,
  callAction,
  FormRootError,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form/fields";
import { leadSchema, type LeadFormInput } from "@/lib/validation/lead";
import { createLead, updateLead } from "../actions";
import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, isClosedStatus } from "../constants";

const statusOptions = LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }));
const priorityOptions = LEAD_PRIORITIES.map((p) => ({ value: p, label: LEAD_PRIORITY_LABELS[p] }));

export function LeadForm({
  mode,
  leadId,
  defaultValues,
  productOptions,
}: {
  mode: "create" | "edit";
  leadId?: string;
  defaultValues: LeadFormInput;
  productOptions: string[];
}) {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(leadSchema), defaultValues, mode: "onBlur" });
  const status = useWatch({ control: form.control, name: "status" });

  const onSubmit = form.handleSubmit(async () => {
    // Enviamos los valores en bruto: el servidor vuelve a validar con el mismo esquema.
    const raw = form.getValues();
    const result = await callAction(() => (mode === "create" ? createLead(raw) : updateLead(leadId!, raw)));
    if (!result.ok) {
      applyActionErrors(form, result);
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Guardado");
    router.push(`/leads/${result.data.id}`);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormRootError />
        <Card>
          <CardHeader>
            <CardTitle>Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <TextField name="full_name" label="Nombre y apellidos" autoComplete="off" required className="sm:col-span-2" />
              <TextField name="phone" label="Teléfono" type="tel" inputMode="tel" autoComplete="off" placeholder="600 123 456" />
              <TextField name="email" label="Email" type="email" inputMode="email" autoComplete="off" />
              <TextField name="locality" label="Localidad" autoComplete="off" />
              <TextField name="customer_reference" label="Referencia de cliente" autoComplete="off" />
              <TextField
                name="current_policies"
                label="Pólizas actuales"
                placeholder="Auto, Hogar"
                description="Separa varias con comas."
                className="sm:col-span-2"
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestión comercial</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <TextField name="product_to_offer" label="Producto a ofrecer" list="product-options" autoComplete="off" />
              <datalist id="product-options">
                {productOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <TextField name="source" label="Origen de la ficha" placeholder="Listado de octubre, recomendación…" />
              <SelectField name="status" label="Estado" options={statusOptions} required />
              <SelectField name="priority" label="Prioridad" options={priorityOptions} required />
              <TextField name="received_at" label="Fecha de recepción" type="datetime-local" description={mode === "create" ? "Si lo dejas vacío se usa la fecha actual." : undefined} />
              {isClosedStatus(status) ? (
                <TextField name="closed_reason" label="Motivo de cierre" placeholder="Opcional" />
              ) : null}
              <TextareaField name="notes" label="Notas" rows={4} className="sm:col-span-2" />
            </FieldGroup>
          </CardContent>
        </Card>

        {mode === "create" ? (
          <Card>
            <CardHeader>
              <CardTitle>Primer seguimiento</CardTitle>
              <CardDescription>Opcional. Programa cuándo vas a contactar por primera vez.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField name="follow_up_title" label="Qué hacer" placeholder="Primer contacto" />
                <TextField name="follow_up_due_at" label="Cuándo" type="datetime-local" />
              </FieldGroup>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
            Cancelar
          </Button>
          <SubmitButton>{mode === "create" ? "Crear ficha" : "Guardar cambios"}</SubmitButton>
        </div>
      </form>
    </FormProvider>
  );
}
