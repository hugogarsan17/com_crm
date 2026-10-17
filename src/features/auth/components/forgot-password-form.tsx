"use client";

import { useState } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextField } from "@/components/form/fields";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await callAction(() => requestPasswordReset(values));
    if (!result.ok) return applyActionErrors(form, result);
    setSent(true);
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheckIcon className="size-10 text-emerald-600" aria-hidden />
        <p className="font-medium">Revisa tu email</p>
        <p className="text-sm text-muted-foreground">
          Si existe una cuenta con ese email, recibirás un enlace para elegir una nueva contraseña.
        </p>
        <Link href="/login" className="text-sm font-medium underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormRootError />
          <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required />
          <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
          <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            Volver a iniciar sesión
          </Link>
        </FieldGroup>
      </form>
    </FormProvider>
  );
}
