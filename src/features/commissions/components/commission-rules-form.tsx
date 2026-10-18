"use client";

import { useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalculatorIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextField } from "@/components/form/fields";
import type { Product } from "@/features/products/catalog";
import { commissionRulesSchema } from "@/lib/validation/commission";
import { recalculateMissingCommissions, saveCommissionRules } from "../actions";
import type { CommissionRule } from "../calc";

function percent(v: number | undefined) {
  return v == null ? "" : String(v).replace(".", ",");
}

/**
 * Porcentaje de comisión sobre el valor de póliza: uno general y, opcionalmente, uno por producto
 * (el del producto tiene prioridad). Vacío = sin regla. La aplicación no trae porcentajes por defecto.
 */
export function CommissionRulesForm({ products, rules }: { products: Product[]; rules: CommissionRule[] }) {
  const [recalculating, startRecalc] = useTransition();
  const rows = [
    { product_code: "", label: "General (todos los productos)" },
    ...products
      .filter((p) => p.active || rules.some((r) => r.product_code === p.code))
      .map((p) => ({ product_code: p.code, label: p.label })),
  ];
  const defaultValues = {
    rules: rows.map((row) => ({
      product_code: row.product_code,
      rate_percent: percent(rules.find((r) => (r.product_code ?? "") === row.product_code)?.rate_percent),
    })),
  };
  const form = useForm({ resolver: zodResolver(commissionRulesSchema), defaultValues });

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => saveCommissionRules(form.getValues()));
    if (!result.ok) return applyActionErrors(form, result);
    toast.success(result.message ?? "Guardado");
  });

  return (
    <div className="flex flex-col gap-4">
      {rules.length === 0 ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            Aún no hay ninguna regla: las pólizas se guardan con su valor, pero sin comisión calculada. Indica el porcentaje que te
            corresponde según tu contrato con la aseguradora (la aplicación no propone ninguno).
          </AlertDescription>
        </Alert>
      ) : null}
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormRootError />
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((row, i) => (
                <TextField
                  key={row.product_code || "general"}
                  name={`rules.${i}.rate_percent`}
                  label={`${row.label} (%)`}
                  inputMode="decimal"
                  placeholder="Sin regla"
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Comisión = valor de póliza × porcentaje / 100, redondeada a céntimos. Si un producto tiene porcentaje propio, se usa ese; si
              no, el general. Cambiar un porcentaje no modifica las comisiones ya calculadas; se aplica a las pólizas nuevas y a las que
              cambien de valor o producto.
            </p>
            <div className="flex flex-wrap gap-2">
              <SubmitButton className="self-start">Guardar porcentajes</SubmitButton>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={recalculating}
                onClick={() =>
                  startRecalc(async () => {
                    const r = await callAction(() => recalculateMissingCommissions());
                    if (r.ok) toast.success(r.message ?? "Hecho");
                    else toast.error(r.error);
                  })
                }
              >
                <CalculatorIcon aria-hidden /> Calcular pólizas sin comisión
              </Button>
            </div>
          </FieldGroup>
        </form>
      </FormProvider>
    </div>
  );
}
