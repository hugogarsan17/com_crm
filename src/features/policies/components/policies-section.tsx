"use client";

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { callAction } from "@/components/form/fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommissionRule } from "@/features/commissions/calc";
import { productLabel, type Product } from "@/features/products/catalog";
import type { Tables } from "@/types/database.types";
import { deletePolicy } from "../actions";
import { COMMISSION_STATUS_LABELS, COMMISSION_STATUS_STYLES } from "../constants";
import { PolicyDialog, policyDefaults } from "./policy-dialog";

export function PoliciesSection({
  policies,
  leadId,
  today,
  products,
  rules,
}: {
  policies: Tables<"policies">[];
  leadId: string;
  today: string;
  products: Product[];
  rules: CommissionRule[];
}) {
  const [editing, setEditing] = useState<Tables<"policies"> | null>(null);

  if (policies.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pólizas registradas.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y">
        {policies.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{productLabel(products, p.product_code, p.product_name)}</p>
                {!p.product_code ? <span className="text-xs text-muted-foreground">(fuera de catálogo)</span> : null}
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", COMMISSION_STATUS_STYLES[p.commission_status])}>
                  Comisión {COMMISSION_STATUS_LABELS[p.commission_status].toLowerCase()}
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Contratada</dt>
                  <dd>{formatDate(p.contracted_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Prima</dt>
                  <dd>{formatCurrency(p.premium_amount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Valor de póliza</dt>
                  <dd>{formatCurrency(p.policy_value)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Comisión calculada</dt>
                  <dd>
                    {p.calculated_commission != null ? (
                      <>
                        {formatCurrency(p.calculated_commission)}
                        {p.commission_rate != null ? (
                          <span className="text-xs text-muted-foreground"> ({Number(p.commission_rate).toLocaleString("es-ES")} %)</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-amber-800 dark:text-amber-300">
                        {p.policy_value == null ? "Falta el valor de póliza" : "Sin regla de comisión"}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Confirmada</dt>
                  <dd>{formatCurrency(p.confirmed_commission)}</dd>
                </div>
              </dl>
              {p.estimated_commission != null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Comisión estimada anterior (dato histórico): {formatCurrency(p.estimated_commission)}
                </p>
              ) : null}
              {p.notes ? <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{p.notes}</p> : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-lg" aria-label={`Editar póliza ${productLabel(products, p.product_code, p.product_name)}`} onClick={() => setEditing(p)}>
                <PencilIcon />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-lg" aria-label={`Eliminar póliza ${productLabel(products, p.product_code, p.product_name)}`}>
                    <Trash2Icon />
                  </Button>
                }
                title="¿Eliminar esta póliza?"
                description="Se borrará la póliza y sus importes de comisión. No se puede deshacer."
                confirmLabel="Eliminar"
                destructive
                onConfirm={async () => {
                  const r = await callAction(() => deletePolicy(p.id));
                  if (r.ok) toast.success(r.message ?? "Eliminada");
                  else toast.error(r.error);
                  return r.ok;
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <PolicyDialog
          key={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          policyId={editing.id}
          defaultValues={policyDefaults(leadId, today, editing)}
          products={products}
          rules={rules}
          legacyProductName={editing.product_code ? null : editing.product_name}
        />
      ) : null}
    </>
  );
}
