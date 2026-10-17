"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextField } from "@/components/form/fields";
import { PASSWORD_MIN, resetPasswordSchema } from "@/lib/validation/auth";
import { updatePassword } from "../actions";

export function ResetPasswordForm() {
  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await callAction(() => updatePassword(values));
    if (!result.ok) applyActionErrors(form, result);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormRootError />
          <TextField
            name="password"
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            description={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}
            required
          />
          <TextField name="confirm_password" label="Repite la contraseña" type="password" autoComplete="new-password" required />
          <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
        </FieldGroup>
      </form>
    </FormProvider>
  );
}
