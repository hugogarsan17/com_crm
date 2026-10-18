"use client";

import Link from "next/link";
import { FormProvider, useForm, useWatch } from "react-hook-form";
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
import { previewCommission, type CommissionRule } from "@/features/commissions/calc";
import { productOptions, type Product } from "@/features/products/catalog";
import { parseMoney } from "@/lib/validation/common";
import { policySchema, type PolicyInput } from "@/lib/validation/policy";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/types/database.types";
import { savePolicy } from "../actions";
import { COMMISSION_STATUSES, COMMISSION_STATUS_LABELS } from "../constants";

const commissionOptions = COMMISSION_STATUSES.map((s) => ({ value: s, label: COMMISSION_STATUS_LABELS[s] }));

function money(v: number | null) {
  return v == null ? "" : String(v).replace(".", ",");
}

export function policyDefaults(leadId: string, today: string, policy?: Tables<"policies">, leadProductCode?: string | null): PolicyInput {
  return {
    lead_id: leadId,
    product_code: policy ? (policy.product_code ?? "") : (leadProductCode ?? ""),
    contracted_at: policy ? (policy.contracted_at ?? "") : today,
    premium_amount: money(policy?.premium_amount ?? null),
    policy_value: money(policy?.policy_value ?? null),
    confirmed_commission: money(policy?.confirmed_commission ?? null),
    commission_status: policy?.commission_status ?? "pending",
    notes: policy?.notes ?? "",
    mark_lead_contracted: !policy,
  };
}

/** Vista previa de la comisión mientras se escribe (la definitiva la calcula la base de datos). */
function CommissionPreview({ products, rules }: { products: Product[]; rules: CommissionRule[] }) {
  const [productCode, rawValue] = useWatch({ name: ["product_code", "policy_value"] }) as [string, string];
  const value = rawValue?.trim() ? parseMoney(rawValue) : null;
  const preview = previewCommission(rules, productCode || null, value);
  const product = products.find((p) => p.code === productCode);

  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
      <p className="text-xs text-muted-foreground">Comisión calculada</p>
      {preview.status === "ok" ? (
        <p>
          <span className="text-base font-semibold tabular-nums">{formatCurrency(preview.commission)}</span>{" "}
          <span className="text-muted-foreground">
            ({preview.rate.toLocaleString("es-ES")} % de {formatCurrency(value)})
          </span>
        </p>
      ) : preview.status === "missing_value" ? (
        <p className="text-muted-foreground">Indica el valor de póliza para calcularla.</p>
      ) : (
        <p className="text-amber-800 dark:text-amber-300">
          No se puede calcular: no hay porcentaje de comisión configurado{product ? ` para «${product.label}»` : ""}.{" "}
          <Link href="/settings#comisiones" className="font-medium underline underline-offset-4">
            Configurarlo en Ajustes
          </Link>
        </p>
      )}
    </div>
  );
}

export function PolicyDialog({
  open,
  onOpenChange,
  policyId,
  defaultValues,
  products,
  rules,
  legacyProductName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string | null;
  defaultValues: PolicyInput;
  products: Product[];
  rules: CommissionRule[];
  /** Nombre de producto de una póliza antigua fuera de catálogo. */
  legacyProductName?: string | null;
}) {
  // El padre remonta el diálogo (key) al cambiar de póliza, así que defaultValues basta.
  const form = useForm({ resolver: zodResolver(policySchema), defaultValues });

  const onSubmit = form.handleSubmit(async () => {
    const raw = form.getValues();
    const result = await callAction(() => savePolicy(policyId, raw));
    if (!result.ok) return applyActionErrors(form, result);
    const message = result.message ?? "Póliza guardada";
    if (result.data.calculatedCommission == null && raw.policy_value.trim()) toast.warning(message);
    else toast.success(message);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{policyId ? "Editar póliza" : "Registrar póliza contratada"}</DialogTitle>
          <DialogDescription>
            La comisión se calcula con el valor de póliza y el porcentaje que hayas configurado en Ajustes.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormRootError />
              <SelectField
                name="product_code"
                label="Producto"
                options={productOptions(products, defaultValues.product_code)}
                placeholder="Selecciona un producto"
                required
                description={
                  legacyProductName && !defaultValues.product_code
                    ? `Producto antiguo fuera de catálogo: «${legacyProductName}». Elige uno del catálogo para guardar.`
                    : undefined
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="contracted_at" label="Fecha de contratación" type="date" />
                <TextField name="premium_amount" label="Prima (€)" inputMode="decimal" placeholder="0,00" />
                <TextField name="policy_value" label="Valor de póliza (€)" inputMode="decimal" placeholder="0,00" />
                <TextField name="confirmed_commission" label="Comisión confirmada (€)" inputMode="decimal" placeholder="0,00" />
              </div>
              <CommissionPreview products={products} rules={rules} />
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
