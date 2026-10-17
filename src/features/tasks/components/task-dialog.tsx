"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextareaField, TextField } from "@/components/form/fields";
import { taskSchema } from "@/lib/validation/task";
import { createTask } from "../actions";

export function TaskDialog({
  open,
  onOpenChange,
  leadId,
  defaultDueLocal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  defaultDueLocal: string;
}) {
  const defaults = { lead_id: leadId, title: "Volver a contactar", description: "", due_at: defaultDueLocal };
  const form = useForm({ resolver: zodResolver(taskSchema), defaultValues: defaults });

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => createTask(form.getValues()));
    if (!result.ok) return applyActionErrors(form, result);
    toast.success(result.message ?? "Seguimiento programado");
    form.reset(defaults);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo seguimiento</DialogTitle>
          <DialogDescription>Programa la próxima acción con este cliente.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormRootError />
              <TextField name="title" label="Qué hacer" required />
              <TextField name="due_at" label="Cuándo" type="datetime-local" required />
              <TextareaField name="description" label="Detalles" rows={2} />
              <SubmitButton>Programar</SubmitButton>
            </FieldGroup>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
