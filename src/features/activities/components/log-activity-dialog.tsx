"use client";

import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import {
  applyActionErrors,
  callAction,
  CheckboxField,
  FormRootError,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
} from "@/components/form/fields";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, isClosedStatus, type LeadStatus } from "@/features/leads/constants";
import { logActivitySchema, type LogActivityInput } from "@/lib/validation/activity";
import { logActivity } from "../actions";
import {
  ACTIVITY_CHANNELS,
  ACTIVITY_CHANNEL_LABELS,
  ACTIVITY_OUTCOMES,
  ACTIVITY_OUTCOME_LABELS,
  OUTCOMES_SUGGESTING_FOLLOW_UP,
  SUGGESTED_STATUS_BY_OUTCOME,
  type ActivityOutcome,
} from "../constants";

const channelOptions = ACTIVITY_CHANNELS.map((c) => ({ value: c, label: ACTIVITY_CHANNEL_LABELS[c] }));
const outcomeOptions = ACTIVITY_OUTCOMES.map((o) => ({ value: o, label: ACTIVITY_OUTCOME_LABELS[o] }));
const statusOptions = LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }));

export function LogActivityDialog({
  open,
  onOpenChange,
  leadId,
  currentStatus,
  nowLocal,
  defaultFollowUpLocal,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentStatus: LeadStatus;
  nowLocal: string;
  defaultFollowUpLocal: string;
  onLogged?: (newStatus: LeadStatus | null) => void;
}) {
  const defaults: LogActivityInput = {
    lead_id: leadId,
    channel: "call",
    outcome: "" as ActivityOutcome,
    occurred_at: nowLocal,
    summary: "",
    new_status: "",
    closed_reason: "",
    schedule_follow_up: false,
    follow_up_title: "Volver a contactar",
    follow_up_due_at: defaultFollowUpLocal,
  };
  const form = useForm({ resolver: zodResolver(logActivitySchema), defaultValues: defaults });
  const [touchedStatus, setTouchedStatus] = useState(false);
  const scheduleFollowUp = useWatch({ control: form.control, name: "schedule_follow_up" });
  const newStatus = useWatch({ control: form.control, name: "new_status" });

  function onOutcomeChange(value: string) {
    const outcome = value as ActivityOutcome;
    if (!touchedStatus) {
      const suggested = SUGGESTED_STATUS_BY_OUTCOME[outcome];
      form.setValue("new_status", suggested && suggested !== currentStatus ? suggested : "");
    }
    form.setValue("schedule_follow_up", OUTCOMES_SUGGESTING_FOLLOW_UP.includes(outcome));
  }

  const onSubmit = form.handleSubmit(async () => {
    const raw = form.getValues();
    const result = await callAction(() => logActivity(raw));
    if (!result.ok) {
      applyActionErrors(form, result);
      return;
    }
    toast.success(result.message ?? "Contacto registrado");
    onOpenChange(false);
    form.reset(defaults);
    setTouchedStatus(false);
    onLogged?.(raw.new_status ? (raw.new_status as LeadStatus) : null);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contacto</DialogTitle>
          <DialogDescription>Anota qué ha pasado y programa el siguiente paso.</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormRootError />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField name="channel" label="Canal" options={channelOptions} required />
                <TextField name="occurred_at" label="Fecha y hora" type="datetime-local" required />
              </div>
              <SelectField name="outcome" label="Resultado" options={outcomeOptions} required onValueChange={onOutcomeChange} />
              <TextareaField name="summary" label="Resumen" rows={3} placeholder="Qué le has ofrecido, qué ha respondido…" />
              <SelectField
                name="new_status"
                label="Nuevo estado de la ficha"
                options={statusOptions}
                emptyLabel={`Mantener (${LEAD_STATUS_LABELS[currentStatus]})`}
                onValueChange={() => setTouchedStatus(true)}
              />
              {newStatus && isClosedStatus(newStatus as LeadStatus) ? (
                <TextField name="closed_reason" label="Motivo (opcional)" />
              ) : null}
              <CheckboxField
                name="schedule_follow_up"
                label="Programar seguimiento"
                description="Crea una tarea para volver a contactar."
              />
              {scheduleFollowUp ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField name="follow_up_title" label="Qué hacer" />
                  <TextField name="follow_up_due_at" label="Cuándo" type="datetime-local" required />
                </div>
              ) : null}
              <SubmitButton>Guardar contacto</SubmitButton>
            </FieldGroup>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
