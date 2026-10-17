"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BadgeCheckIcon,
  BanIcon,
  CalendarPlusIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquarePlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  RotateCcwIcon,
  ScaleIcon,
  Trash2Icon,
  ThumbsDownIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { LogActivityDialog } from "@/features/activities/components/log-activity-dialog";
import { PolicyDialog, policyDefaults } from "@/features/policies/components/policy-dialog";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import type { ActionResult } from "@/lib/action-result";
import { telHref, whatsappHref } from "@/lib/format";
import { deleteLead, setLeadArchived, setLeadStatus } from "../actions";
import { LEAD_STATUS_LABELS, isClosedStatus, type LeadStatus } from "../constants";

type Lead = {
  id: string;
  full_name: string;
  status: LeadStatus;
  phone: string | null;
  email: string | null;
  product_to_offer: string | null;
  archived_at: string | null;
};

type CloseStatus = Extract<LeadStatus, "rejected" | "keeps_current_conditions" | "do_not_contact">;

const CLOSE_COPY: Record<CloseStatus, { title: string; description: string }> = {
  rejected: { title: "Marcar como rechazada", description: "El cliente ha rechazado la oferta. Puedes indicar el motivo." },
  keeps_current_conditions: {
    title: "El cliente mantiene sus condiciones",
    description: "Se cierra la gestión. Si quieres revisarlo más adelante, programa un seguimiento después.",
  },
  do_not_contact: {
    title: "Marcar como «No contactar»",
    description: "Se cancelarán sus seguimientos pendientes y no podrás programar nuevos mientras tenga este estado.",
  },
};

export function LeadDetailActions({
  lead,
  nowLocal,
  tomorrowLocal,
  today,
}: {
  lead: Lead;
  nowLocal: string;
  tomorrowLocal: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [closing, setClosing] = useState<CloseStatus | null>(null);
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const doNotContact = lead.status === "do_not_contact";

  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      const result = await callAction(fn);
      if (result.ok) {
        toast.success(result.message ?? "Hecho");
        after?.();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {!doNotContact && (lead.phone || lead.email) ? (
        <div className="flex flex-wrap gap-2">
          {lead.phone ? (
            <>
              <Button asChild size="lg" variant="outline">
                <a href={telHref(lead.phone)}>
                  <PhoneIcon aria-hidden /> Llamar
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={whatsappHref(lead.phone)} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon aria-hidden /> WhatsApp
                </a>
              </Button>
            </>
          ) : null}
          {lead.email ? (
            <Button asChild size="lg" variant="outline">
              <a href={`mailto:${lead.email}`}>
                <MailIcon aria-hidden /> Email
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={() => setLogOpen(true)}>
          <MessageSquarePlusIcon aria-hidden /> Registrar contacto
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setTaskOpen(true)} disabled={doNotContact} title={doNotContact ? "No disponible para «No contactar»" : undefined}>
          <CalendarPlusIcon aria-hidden /> Seguimiento
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setPolicyOpen(true)}>
          <BadgeCheckIcon aria-hidden /> Póliza
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href={`/leads/${lead.id}/edit`}>
            <PencilIcon aria-hidden /> Editar
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-lg" variant="ghost" aria-label="Más acciones de la ficha" disabled={pending}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Cerrar gestión</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setPolicyOpen(true)}>
              <BadgeCheckIcon /> Póliza contratada
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setClosing("rejected")} disabled={lead.status === "rejected"}>
              <ThumbsDownIcon /> Rechazada
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setClosing("keeps_current_conditions")} disabled={lead.status === "keeps_current_conditions"}>
              <ScaleIcon /> Mantiene condiciones
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setClosing("do_not_contact")} disabled={doNotContact}>
              <BanIcon /> No contactar
            </DropdownMenuItem>
            {isClosedStatus(lead.status) ? (
              <DropdownMenuItem onSelect={() => run(() => setLeadStatus({ lead_id: lead.id, status: "follow_up", closed_reason: "" }))}>
                <RotateCcwIcon /> Reabrir (en seguimiento)
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {lead.archived_at ? (
              <DropdownMenuItem onSelect={() => run(() => setLeadArchived(lead.id, false))}>
                <ArchiveRestoreIcon /> Restaurar ficha
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => run(() => setLeadArchived(lead.id, true))}>
                <ArchiveIcon /> Archivar ficha
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2Icon /> Eliminar definitivamente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <LogActivityDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        leadId={lead.id}
        currentStatus={lead.status}
        nowLocal={nowLocal}
        defaultFollowUpLocal={tomorrowLocal}
        onLogged={(status) => {
          if (status === "policy_contracted") setPolicyOpen(true);
        }}
      />
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} leadId={lead.id} defaultDueLocal={tomorrowLocal} />
      {policyOpen ? (
        <PolicyDialog
          open={policyOpen}
          onOpenChange={setPolicyOpen}
          policyId={null}
          defaultValues={policyDefaults(lead.id, today, lead.product_to_offer)}
        />
      ) : null}

      <AlertDialog
        open={closing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setClosing(null);
            setReason("");
          }
        }}
      >
        {closing ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{CLOSE_COPY[closing].title}</AlertDialogTitle>
              <AlertDialogDescription>{CLOSE_COPY[closing].description}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="close-reason">Motivo (opcional)</Label>
              <Input id="close-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
              <Button
                variant={closing === "do_not_contact" ? "destructive" : "default"}
                disabled={pending}
                onClick={() =>
                  run(
                    () => setLeadStatus({ lead_id: lead.id, status: closing, closed_reason: reason }),
                    () => {
                      setClosing(null);
                      setReason("");
                    },
                  )
                }
              >
                Marcar como «{LEAD_STATUS_LABELS[closing]}»
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la ficha definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán también su historial, seguimientos y pólizas. Esta acción no se puede deshacer. Si solo quieres
              quitarla de la lista, archívala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-delete">Escribe ELIMINAR para confirmar</Label>
            <Input id="confirm-delete" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending || deleteText.trim().toUpperCase() !== "ELIMINAR"}
              onClick={() => run(() => deleteLead(lead.id), () => router.push("/leads"))}
            >
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
