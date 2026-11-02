import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { Tables } from "@/types/database.types";
import { aseguradoSchema, FORMAS_PAGO, garantiaSchema } from "../consulta-abreviada";

const coveragesSchema = z.array(garantiaSchema).catch([]);
const insuredSchema = z.array(aseguradoSchema).catch([]);

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

/** Póliza(s) que el cliente ya tiene, leídas de la hoja «Consulta abreviada». Solo lectura. */
export function CustomerPolicies({ policies, timezone }: { policies: Tables<"customer_policies">[]; timezone: string }) {
  if (policies.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{policies.length === 1 ? "Póliza actual del cliente" : "Pólizas actuales del cliente"}</CardTitle>
        <CardDescription>Leída de la hoja escaneada. No cuenta como venta ni en comisiones.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {policies.map((p) => {
          const coverages = coveragesSchema.parse(p.coverages);
          const insured = insuredSchema.parse(p.insured);
          return (
            <div key={p.id} className="flex flex-col gap-4 [&+&]:border-t [&+&]:pt-5">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Info label="Nº de póliza">{p.policy_number}</Info>
                <Info label="Producto (código)">{p.product_reference}</Info>
                <Info label="Tipo">{p.policy_type}</Info>
                <Info label="Fecha de efecto">{p.effect_date ? formatDate(p.effect_date) : null}</Info>
                <Info label="Situación">{p.status_code === "VI" ? "VI · vigente" : p.status_code}</Info>
                <Info label="Fecha de baja">{p.cancel_date ? formatDate(p.cancel_date) : null}</Info>
                <Info label="Forma de pago">
                  {p.payment_frequency ? `${p.payment_frequency}${FORMAS_PAGO[p.payment_frequency] ? ` · ${FORMAS_PAGO[p.payment_frequency].toLowerCase()}` : ""}` : null}
                </Info>
                <Info label="Cubierto hasta">{p.covered_until ? formatDate(p.covered_until) : null}</Info>
                <Info label="Prima anual">{p.annual_premium != null ? formatCurrency(p.annual_premium) : null}</Info>
                <Info label="Primer recibo">{p.first_receipt_amount != null ? formatCurrency(p.first_receipt_amount) : null}</Info>
                <Info label="Siguientes recibos">{p.next_receipt_amount != null ? formatCurrency(p.next_receipt_amount) : null}</Info>
                <Info label="Consulta">{p.consulted_at ? formatDateTime(p.consulted_at, timezone) : null}</Info>
              </dl>

              {coverages.length ? (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Garantías</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {coverages.map((c, i) => (
                      <li key={i} className="rounded-full border border-border bg-white/[0.04] px-2.5 py-1 text-xs">
                        <span className="font-medium">{c.nombre}</span>
                        {c.estado ? <span className="text-muted-foreground"> · {c.estado}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {insured.length ? (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Asegurados</p>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Nº</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="text-right">Real</TableHead>
                          <TableHead className="text-right">Der.</TableHead>
                          <TableHead>Baja</TableHead>
                          <TableHead>Mot.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insured.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell className="tabular-nums">{a.orden ?? "—"}</TableCell>
                            <TableCell>{a.nombre ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{a.edad_real ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{a.edad_derecho ?? "—"}</TableCell>
                            <TableCell>{a.baja ? formatDate(a.baja) : "—"}</TableCell>
                            <TableCell>{a.motivo ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
