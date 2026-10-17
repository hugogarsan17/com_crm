"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SelectField, SubmitButton, TextField } from "@/components/form/fields";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import { updateProfile } from "../actions";

const TIMEZONES = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Paris",
  "America/Mexico_City",
  "America/Bogota",
  "America/Argentina/Buenos_Aires",
];

export function ProfileForm({ defaultValues }: { defaultValues: ProfileInput }) {
  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues });
  const options = Array.from(new Set([defaultValues.timezone, ...TIMEZONES])).map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }));

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => updateProfile(form.getValues()));
    if (!result.ok) return applyActionErrors(form, result);
    toast.success(result.message ?? "Guardado");
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormRootError />
          <TextField name="full_name" label="Nombre" autoComplete="name" required />
          <SelectField
            name="timezone"
            label="Zona horaria"
            options={options}
            description="Se usa para calcular «hoy», los vencimientos y los informes."
            required
          />
          <SubmitButton className="self-start">Guardar</SubmitButton>
        </FieldGroup>
      </form>
    </FormProvider>
  );
}
