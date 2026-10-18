"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLinkIcon, PencilIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadStatusBadge } from "@/features/leads/components/badges";
import type { LeadStatus } from "@/features/leads/constants";
import { TaskActions } from "@/features/tasks/components/task-actions";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/features/tasks/constants";
import { formatDateTime, formatTime, telHref } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CalendarTaskData = {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  dueLocal: string;
  status: TaskStatus;
  overdue: boolean;
  lead: { id: string; full_name: string; phone: string | null; status: LeadStatus; legacy_status: string | null };
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "border-l-primary bg-card hover:bg-muted",
  completed: "border-l-emerald-500 bg-muted/40 text-muted-foreground hover:bg-muted",
  cancelled: "border-l-zinc-400 bg-muted/40 text-muted-foreground line-through hover:bg-muted",
};

/** Tarea dentro del calendario. Al pulsarla se abre el detalle con sus acciones y el enlace a la ficha. */
export function CalendarTask({ task, timezone, compact = false }: { task: CalendarTaskData; timezone: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full min-w-0 flex-col rounded-md border border-l-4 px-2 py-1 text-left text-xs transition-colors",
          STATUS_STYLES[task.status],
          task.overdue && "border-l-destructive",
        )}
        aria-label={`${formatTime(task.due_at, timezone)} · ${task.lead.full_name} · ${task.title} (${task.overdue ? "vencida" : TASK_STATUS_LABELS[task.status].toLowerCase()})`}
      >
        <span className="flex items-center gap-1 font-medium">
          <span className={cn("tabular-nums", task.overdue && "text-destructive")}>{formatTime(task.due_at, timezone)}</span>
          <span className="truncate">{task.lead.full_name}</span>
        </span>
        {compact ? null : <span className="truncate">{task.title}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{task.title}</DialogTitle>
            <DialogDescription>
              {formatDateTime(task.due_at, timezone)} · {task.overdue ? "Vencida" : TASK_STATUS_LABELS[task.status]}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/leads/${task.lead.id}`} className="font-medium underline-offset-4 hover:underline">
                {task.lead.full_name}
              </Link>
              <LeadStatusBadge status={task.lead.status} />
            </div>
            {task.description ? <p className="text-sm whitespace-pre-line text-muted-foreground">{task.description}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href={`/leads/${task.lead.id}`}>
                  <ExternalLinkIcon aria-hidden /> Abrir ficha
                </Link>
              </Button>
              {task.lead.phone && task.status === "pending" && task.lead.legacy_status !== "do_not_contact" ? (
                <Button asChild size="lg" variant="outline">
                  <a href={telHref(task.lead.phone)}>
                    <PhoneIcon aria-hidden /> Llamar
                  </a>
                </Button>
              ) : null}
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditing(true);
                }}
              >
                <PencilIcon aria-hidden /> Editar
              </Button>
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-xs text-muted-foreground">Completar, reprogramar, cancelar o eliminar</p>
              <TaskActions taskId={task.id} status={task.status} dueLocal={task.dueLocal} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editing ? (
        <TaskDialog
          open={editing}
          onOpenChange={setEditing}
          defaultDueLocal={task.dueLocal}
          task={{ id: task.id, title: task.title, description: task.description, dueLocal: task.dueLocal, lead: task.lead }}
        />
      ) : null}
    </>
  );
}

/** Botón para crear una tarea desde el calendario (la ficha se elige en el diálogo). */
export function NewCalendarTaskButton({ defaultDueLocal, label = "Nueva tarea", size = "lg" }: { defaultDueLocal: string; label?: string; size?: "lg" | "icon-sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} aria-label={size === "icon-sm" ? label : undefined} variant={size === "icon-sm" ? "ghost" : "default"}>
        <PlusIcon aria-hidden />
        {size === "icon-sm" ? null : label}
      </Button>
      {open ? <TaskDialog open={open} onOpenChange={setOpen} defaultDueLocal={defaultDueLocal} /> : null}
    </>
  );
}
