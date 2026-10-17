"use client";

import type { ComponentProps, ReactNode } from "react";
import { Controller, useFormContext, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

const EMPTY_OPTION = "__empty__";

function useFieldError(name: string) {
  const { getFieldState, formState } = useFormContext();
  return getFieldState(name, formState).error;
}

function fieldId(name: string) {
  return `field-${name.replace(/\W/g, "-")}`;
}

type BaseProps = {
  name: string;
  label: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
};

function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <>
      {label}
      {required ? (
        <span aria-hidden className="text-destructive">
          *
        </span>
      ) : null}
    </>
  );
}

export function TextField({
  name,
  label,
  description,
  required,
  className,
  ...inputProps
}: BaseProps & Omit<ComponentProps<typeof Input>, "name">) {
  const { register } = useFormContext();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>
        <LabelText label={label} required={required} />
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={description ? `${id}-desc` : undefined}
        aria-required={required}
        {...inputProps}
        {...register(name)}
      />
      {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

export function TextareaField({
  name,
  label,
  description,
  required,
  className,
  ...props
}: BaseProps & Omit<ComponentProps<typeof Textarea>, "name">) {
  const { register } = useFormContext();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>
        <LabelText label={label} required={required} />
      </FieldLabel>
      <Textarea id={id} aria-invalid={!!error} {...props} {...register(name)} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  name,
  label,
  description,
  required,
  className,
  options,
  placeholder = "Selecciona…",
  emptyLabel,
  onValueChange,
}: BaseProps & {
  options: readonly SelectOption[];
  placeholder?: string;
  /** Si se indica, añade una opción vacía (valor "") con este texto. */
  emptyLabel?: string;
  onValueChange?: (value: string) => void;
}) {
  const { control } = useFormContext();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!error} className={className}>
          <FieldLabel htmlFor={id}>
            <LabelText label={label} required={required} />
          </FieldLabel>
          <Select
            name={field.name}
            value={field.value === "" || field.value == null ? (emptyLabel ? EMPTY_OPTION : "") : String(field.value)}
            onValueChange={(v) => {
              const value = v === EMPTY_OPTION ? "" : v;
              field.onChange(value);
              onValueChange?.(value);
            }}
          >
            <SelectTrigger id={id} aria-invalid={!!error} className="w-full" onBlur={field.onBlur} ref={field.ref}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {emptyLabel ? <SelectItem value={EMPTY_OPTION}>{emptyLabel}</SelectItem> : null}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[error]} />
        </Field>
      )}
    />
  );
}

export function CheckboxField({ name, label, description, className }: BaseProps) {
  const { control } = useFormContext();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" data-invalid={!!error} className={className}>
          <Checkbox
            id={id}
            checked={!!field.value}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            onBlur={field.onBlur}
            ref={field.ref}
            aria-invalid={!!error}
          />
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description ? <FieldDescription>{description}</FieldDescription> : null}
            <FieldError errors={[error]} />
          </FieldContent>
        </Field>
      )}
    />
  );
}

export function FormRootError() {
  const { formState } = useFormContext();
  const message = formState.errors.root?.message;
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function SubmitButton({ children, pendingText = "Guardando…", ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { formState } = useFormContext();
  const pending = formState.isSubmitting;
  return (
    <Button type="submit" size="lg" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}

/** Vuelca en el formulario los errores devueltos por una Server Action (conserva los valores). */
export function applyActionErrors<T extends FieldValues>(form: UseFormReturn<T, unknown, unknown>, result: ActionResult<unknown>) {
  if (result.ok) return;
  for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
    if (!messages?.length || key === "_form") continue;
    form.setError(key as Path<T>, { type: "server", message: messages[0] });
  }
  form.setError("root", { type: "server", message: result.error });
}

export const NETWORK_ERROR = "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.";

/** Ejecuta una Server Action capturando errores de red. */
export async function callAction<R>(fn: () => Promise<ActionResult<R>>): Promise<ActionResult<R>> {
  try {
    return await fn();
  } catch (error) {
    // Las redirecciones de Next.js se propagan para que el router las gestione.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw error;
    }
    return { ok: false, error: NETWORK_ERROR };
  }
}
