"use client";

import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { callAction } from "@/components/form/fields";
import { deleteActivity } from "../actions";

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Eliminar actividad">
          <Trash2Icon />
        </Button>
      }
      title="¿Eliminar este contacto del historial?"
      description="Úsalo solo para corregir un registro erróneo. No se puede deshacer."
      confirmLabel="Eliminar"
      destructive
      onConfirm={async () => {
        const r = await callAction(() => deleteActivity(activityId));
        if (r.ok) toast.success(r.message ?? "Eliminada");
        else toast.error(r.error);
        return r.ok;
      }}
    />
  );
}
