"use client";

import { useState } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextField } from "@/components/form/fields";
import { PASSWORD_MIN, registerSchema } from "@/lib/validation/auth";
import { signUp } from "../actions";

export function RegisterForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await callAction(() => signUp(values));
    if (!result.ok) return applyActionErrors(form, result);
    if (result.data.needsConfirmation) setSentTo(values.email);
  });

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheckIcon className="size-10 text-emerald-600" aria-hidden />
        <p className="font-medium">Revisa tu email</p>
        <p className="text-sm text-muted-foreground">
          Si <strong>{sentTo}</strong> no estaba registrado, te hemos enviado un enlace para confirmar tu cuenta.
          Después podrás iniciar sesión.
        </p>
        <Link href="/login" className="text-sm font-medium underline-offset-4 hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormRootError />
          <TextField name="full_name" label="Nombre y apellidos" autoComplete="name" required />
          <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required />
          <TextField
            name="password"
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            description={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}
            required
          />
          <TextField name="confirm_password" label="Repite la contraseña" type="password" autoComplete="new-password" required />
          <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </FieldGroup>
      </form>
    </FormProvider>
  );
}
