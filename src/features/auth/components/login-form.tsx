"use client";

import { useState } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextField } from "@/components/form/fields";
import { loginSchema } from "@/lib/validation/auth";
import { resendConfirmation, signIn } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setUnconfirmedEmail(null);
    const result = await callAction(() => signIn(values, next));
    if (!result.ok) {
      applyActionErrors(form, result);
      if (result.code === "email_not_confirmed") setUnconfirmedEmail(values.email);
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormRootError />
          {unconfirmedEmail ? (
            <Button
              type="button"
              variant="outline"
              disabled={resending}
              onClick={async () => {
                setResending(true);
                const r = await callAction(() => resendConfirmation(unconfirmedEmail));
                setResending(false);
                if (r.ok) toast.success(r.message ?? "Email reenviado");
                else toast.error(r.error);
              }}
            >
              Reenviar email de confirmación
            </Button>
          ) : null}
          <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required />
          <TextField name="password" label="Contraseña" type="password" autoComplete="current-password" required />
          <SubmitButton pendingText="Entrando…">Iniciar sesión</SubmitButton>
          <div className="flex flex-col gap-2 text-center text-sm">
            <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
              He olvidado mi contraseña
            </Link>
            <p className="text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
                Regístrate
              </Link>
            </p>
          </div>
        </FieldGroup>
      </form>
    </FormProvider>
  );
}
