"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextField } from "@/components/form/fields";
import { changePasswordSchema, PASSWORD_MIN } from "@/lib/validation/auth";
import { changePassword } from "../actions";

const EMPTY = { current_password: "", password: "", confirm_password: "" };

export function ChangePasswordForm() {
  const form = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => changePassword(form.getValues()));
    if (!result.ok) {
      applyActionErrors(form, result);
      toast.error(result.error);
      return;
    }
    form.reset(EMPTY);
    toast.success(result.message ?? "Contraseña cambiada");
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormRootError />
          <TextField name="current_password" label="Contraseña actual" type="password" autoComplete="current-password" required />
          <TextField
            name="password"
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            description={`Al menos ${PASSWORD_MIN} caracteres, con letras y números.`}
          />
          <TextField name="confirm_password" label="Repite la nueva contraseña" type="password" autoComplete="new-password" required />
          <SubmitButton className="self-start" pendingText="Cambiando…">
            Cambiar contraseña
          </SubmitButton>
        </FieldGroup>
      </form>
    </FormProvider>
  );
}
