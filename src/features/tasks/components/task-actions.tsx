"use client";

import { useState, useTransition } from "react";
import { CalendarClockIcon, CheckIcon, MoreHorizontalIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAction } from "@/components/form/fields";
import type { ActionResult } from "@/lib/action-result";
import { cancelTask, completeTask, deleteTask, postponeTask, reopenTask } from "../actions";
import { POSTPONE_OPTIONS, type TaskStatus } from "../constants";

export function TaskActions({
  taskId,
  status,
  dueLocal,
  compact = false,
}: {
  taskId: string;
  status: TaskStatus;
  /** Vencimiento actual en formato datetime-local (para posponer a fecha concreta). */
  dueLocal: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [customDue, setCustomDue] = useState(dueLocal);
  const [customError, setCustomError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      const result = await callAction(fn);
      if (result.ok) {
        toast.success(result.message ?? "Hecho");
        after?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {status === "pending" ? (
        <Button
          size={compact ? "icon-lg" : "lg"}
          variant="outline"
          disabled={pending}
          onClick={() => run(() => completeTask(taskId))}
          aria-label="Marcar como completada"
          title="Completar"
        >
          <CheckIcon />
          {compact ? null : "Completar"}
        </Button>
      ) : (
        <Button size={compact ? "icon-lg" : "lg"} variant="ghost" disabled={pending} onClick={() => run(() => reopenTask(taskId))} aria-label="Reabrir" title="Reabrir">
          <RotateCcwIcon />
          {compact ? null : "Reabrir"}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-lg" variant="ghost" disabled={pending} aria-label="Más acciones del seguimiento">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "pending" ? (
            <>
              <DropdownMenuLabel>Posponer</DropdownMenuLabel>
              {POSTPONE_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.days} onSelect={() => run(() => postponeTask({ task_id: taskId, days: o.days }))}>
                  <CalendarClockIcon /> {o.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => setCustomOpen(true)}>
                <CalendarClockIcon /> Reprogramar (elegir fecha)…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirm("cancel")}>
                <XIcon /> Cancelar seguimiento
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
            <Trash2Icon /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reprogramar seguimiento</DialogTitle>
            <DialogDescription>Elige la nueva fecha y hora.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`due-${taskId}`}>Nueva fecha</Label>
            <Input
              id={`due-${taskId}`}
              type="datetime-local"
              value={customDue}
              onChange={(e) => setCustomDue(e.target.value)}
              aria-invalid={!!customError}
            />
            {customError ? <p className="text-sm text-destructive" role="alert">{customError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              size="lg"
              disabled={pending}
              onClick={() => {
                if (!customDue) {
                  setCustomError("Indica una fecha");
                  return;
                }
                setCustomError(null);
                run(() => postponeTask({ task_id: taskId, due_at: customDue }), () => setCustomOpen(false));
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? "¿Eliminar este seguimiento?" : "¿Cancelar este seguimiento?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "Se borrará definitivamente. Si solo no vas a hacerlo, mejor cancélalo."
                : "Dejará de aparecer en tus pendientes. Podrás reabrirlo desde la pestaña Canceladas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "delete" ? "destructive" : "default"}
              onClick={() => run(() => (confirm === "delete" ? deleteTask(taskId) : cancelTask(taskId)))}
            >
              {confirm === "delete" ? "Eliminar" : "Cancelar seguimiento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
