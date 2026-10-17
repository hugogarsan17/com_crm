"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { policySchema, type PolicyInput } from "@/lib/validation/policy";
import type { Tables } from "@/types/database.types";
import { savePolicy } from "../actions";
import { COMMISSION_STATUSES, COMMISSION_STATUS_LABELS } from "../constants";

const commissionOptions = COMMISSION_STATUSES.map((s) => ({ value: s, label: COMMISSION_STATUS_LABELS[s] }));

function money(v: number | null) {
  return v == null ? "" : String(v).replace(".", ",");
}

export function policyDefaults(leadId: string, today: string, product: string | null, policy?: Tables<"policies">): PolicyInput {
  return {
    lead_id: leadId,
    product_name: policy?.product_name ?? product ?? "",
    contracted_at: policy ? (policy.contracted_at ?? "") : today,
    premium_amount: money(policy?.premium_amount ?? null),
    estimated_commission: money(policy?.estimated_commission ?? null),
    confirmed_commission: money(policy?.confirmed_commission ?? null),
    commission_status: policy?.commission_status ?? "pending",
    notes: policy?.notes ?? "",
    mark_lead_contracted: !policy,
  };
}

export function PolicyDialog({
  open,
  onOpenChange,
  policyId,
  defaultValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string | null;
  defaultValues: PolicyInput;
}) {
  // El padre remonta el diálogo (key) al cambiar de póliza, así que defaultValues basta.
  const form = useForm({ resolver: zodResolver(policySchema), defaultValues });

  const onSubmit = form.handleSubmit(async () => {
    const raw = form.getValues();
    const result = await callAction(() => savePolicy(policyId, raw));
    if (!result.ok) return applyActionErrors(form, result);
    toast.success(result.message ?? "Póliza guardada");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{policyId ? "Editar póliza" : "Registrar póliza contratada"}</DialogTitle>
          <DialogDescription>
            Introduce los importes manualmente. La aplicación no calcula comisiones.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormRootError />
              <TextField name="product_name" label="Producto" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="contracted_at" label="Fecha de contratación" type="date" />
                <TextField name="premium_amount" label="Prima (€)" inputMode="decimal" placeholder="0,00" />
                <TextField name="estimated_commission" label="Comisión estimada (€)" inputMode="decimal" placeholder="0,00" />
                <TextField name="confirmed_commission" label="Comisión confirmada (€)" inputMode="decimal" placeholder="0,00" />
              </div>
              <SelectField
                name="commission_status"
                label="Estado de la comisión"
                options={commissionOptions}
                required
                description="Para marcarla como confirmada o pagada indica la comisión confirmada."
              />
              <TextareaField name="notes" label="Notas" rows={2} />
              {!policyId ? (
                <CheckboxField name="mark_lead_contracted" label='Marcar la ficha como "Póliza contratada"' />
              ) : null}
              <SubmitButton>{policyId ? "Guardar cambios" : "Registrar póliza"}</SubmitButton>
            </FieldGroup>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
