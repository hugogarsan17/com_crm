"use client";

import { useTransition } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, CheckboxField, FormRootError, SelectField, SubmitButton } from "@/components/form/fields";
import { formatDateTime } from "@/lib/format";
import { notificationPreferencesSchema, UPCOMING_HOURS_OPTIONS } from "@/lib/validation/notifications";
import { saveNotificationPreferences, sendTestEmail } from "../actions";

const hoursOptions = UPCOMING_HOURS_OPTIONS.map((h) => ({
  value: String(h),
  label: h < 24 ? `${h} horas antes` : h === 24 ? "1 día antes" : h === 168 ? "1 semana antes" : `${h / 24} días antes`,
}));

const STATUS_LABELS: Record<string, string> = { sent: "Enviado", failed: "Fallido", sending: "En curso" };

type Props = {
  email: string;
  timezone: string;
  preferences: { email_enabled: boolean; notify_upcoming: boolean; upcoming_hours: number; notify_overdue: boolean };
  recent: { id: string; kind: string; due_at: string; status: string; created_at: string; error: string | null }[];
  config: { emailConfigured: boolean; cronConfigured: boolean; missing: string[] };
};

export function NotificationSettings({ email, timezone, preferences, recent, config }: Props) {
  const [testing, startTest] = useTransition();
  const form = useForm({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: { ...preferences, upcoming_hours: String(preferences.upcoming_hours) },
  });
  const enabled = useWatch({ control: form.control, name: "email_enabled" });
  const upcoming = useWatch({ control: form.control, name: "notify_upcoming" });

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => saveNotificationPreferences(form.getValues()));
    if (!result.ok) return applyActionErrors(form, result);
    toast.success(result.message ?? "Guardado");
  });

  const ready = config.emailConfigured && config.cronConfigured;

  return (
    <div className="flex flex-col gap-4">
      {!ready ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>El envío de emails no está configurado</AlertTitle>
          <AlertDescription>
            <p>
              Puedes guardar tus preferencias, pero no se enviará ningún aviso hasta que el administrador defina en el servidor (Vercel →
              Settings → Environment Variables): <strong>{config.missing.join(", ")}</strong>. Instrucciones en el README, sección
              «Avisos por email».
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormRootError />
            <CheckboxField
              name="email_enabled"
              label="Recibir avisos de seguimientos por email"
              description={`Se envían a ${email}, una vez al día como máximo por cada seguimiento y vencimiento. Nunca se escribe a tus clientes.`}
            />
            {enabled ? (
              <>
                <CheckboxField name="notify_overdue" label="Avisar de seguimientos vencidos" />
                <CheckboxField name="notify_upcoming" label="Avisar de seguimientos próximos" />
                {upcoming ? <SelectField name="upcoming_hours" label="Con cuánta antelación" options={hoursOptions} /> : null}
              </>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <SubmitButton className="self-start">Guardar avisos</SubmitButton>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={testing}
                onClick={() =>
                  startTest(async () => {
                    const r = await callAction(() => sendTestEmail());
                    if (r.ok) toast.success(r.message ?? "Enviado");
                    else toast.error(r.error);
                  })
                }
              >
                <MailIcon aria-hidden /> Enviar email de prueba
              </Button>
            </div>
          </FieldGroup>
        </form>
      </FormProvider>

      <div>
        <p className="text-sm font-medium">Últimos avisos</p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se ha enviado ningún aviso.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2">
                <span className="tabular-nums">{formatDateTime(r.created_at, timezone)}</span>
                <span className="text-muted-foreground">{r.kind === "overdue" ? "Vencido" : "Próximo"}</span>
                <span className={r.status === "failed" ? "text-destructive" : undefined}>{STATUS_LABELS[r.status] ?? r.status}</span>
                {r.error ? <span className="text-xs text-muted-foreground">({r.error})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
