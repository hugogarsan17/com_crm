"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { applyActionErrors, callAction, FormRootError, SubmitButton, TextareaField, TextField } from "@/components/form/fields";
import { taskSchema } from "@/lib/validation/task";
import { createTask, updateTask } from "../actions";
import { LeadPickerField } from "./lead-picker";

export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  dueLocal: string;
  lead: { id: string; full_name: string };
};

/**
 * Crear o editar un seguimiento.
 * - Con `leadId`: la ficha es fija (desde la ficha del cliente).
 * - Sin `leadId`: se elige la ficha con un buscador (desde el calendario).
 * - Con `task`: edición; permite cambiar la ficha, el texto y la fecha.
 */
export function TaskDialog({
  open,
  onOpenChange,
  leadId,
  defaultDueLocal,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  defaultDueLocal: string;
  task?: EditableTask;
}) {
  const defaults = task
    ? { lead_id: task.lead.id, title: task.title, description: task.description ?? "", due_at: task.dueLocal }
    : { lead_id: leadId ?? "", title: "Volver a contactar", description: "", due_at: defaultDueLocal };
  const form = useForm({ resolver: zodResolver(taskSchema), defaultValues: defaults });

  const onSubmit = form.handleSubmit(async () => {
    const values = form.getValues();
    const result = await callAction(() => (task ? updateTask({ ...values, task_id: task.id }) : createTask(values)));
    if (!result.ok) return applyActionErrors(form, result);
    toast.success(result.message ?? "Seguimiento guardado");
    form.reset(defaults);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Editar seguimiento" : "Nuevo seguimiento"}</DialogTitle>
          <DialogDescription>Programa la próxima acción con este cliente.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormRootError />
              {leadId && !task ? null : <LeadPickerField name="lead_id" initialLead={task?.lead ?? null} />}
              <TextField name="title" label="Qué hacer" required />
              <TextField name="due_at" label="Cuándo" type="datetime-local" required />
              <TextareaField name="description" label="Detalles" rows={2} />
              <SubmitButton>{task ? "Guardar cambios" : "Programar"}</SubmitButton>
            </FieldGroup>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
