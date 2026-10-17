"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { callAction } from "@/components/form/fields";
import { deleteAccount } from "../actions";

export function DeleteAccount() {
  const [text, setText] = useState("");
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive" size="lg">Eliminar mi cuenta</Button>}
      title="¿Eliminar tu cuenta y todos tus datos?"
      description="Se borrarán definitivamente tu perfil, fichas, historial, seguimientos y pólizas. Descarga antes una copia si la necesitas."
      confirmLabel="Eliminar definitivamente"
      destructive
      confirmDisabled={text.trim().toUpperCase() !== "ELIMINAR"}
      onConfirm={async () => {
        const r = await callAction(() => deleteAccount(text));
        if (!r.ok) toast.error(r.error);
        return r.ok;
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-account-confirm">Escribe ELIMINAR para confirmar</Label>
        <Input id="delete-account-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </div>
    </ConfirmDialog>
  );
}
