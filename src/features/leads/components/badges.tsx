import { BanIcon, FlameIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FUNERAL_INSURANCE_LABELS,
  funeralInsuranceFromDb,
  LEAD_PRIORITY_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_STYLES,
  RETIRED_LEAD_STATUS_LABELS,
  type LeadPriority,
  type LeadStatus,
} from "../constants";

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        LEAD_STATUS_STYLES[status],
        className,
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  if (priority === "normal") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        priority === "high"
          ? "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200"
          : "bg-muted text-muted-foreground",
      )}
    >
      {priority === "high" ? <FlameIcon className="size-3" aria-hidden /> : null}
      Prioridad {LEAD_PRIORITY_LABELS[priority].toLowerCase()}
    </span>
  );
}

/** Seguro de decesos: Sí / No / Sin indicar (null nunca se interpreta como "no"). */
export function FuneralInsuranceBadge({ value, className }: { value: boolean | null; className?: string }) {
  const v = funeralInsuranceFromDb(value);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        v === "yes"
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : v === "no"
            ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            : "border border-dashed text-muted-foreground",
        className,
      )}
    >
      Decesos: {FUNERAL_INSURANCE_LABELS[v].toLowerCase()}
    </span>
  );
}

/** Aviso para fichas que tenían un estado retirado (sobre todo «No contactar»). */
export function LegacyStatusBadge({ legacyStatus }: { legacyStatus: string | null }) {
  if (!legacyStatus || !(legacyStatus in RETIRED_LEAD_STATUS_LABELS)) return null;
  const doNotContact = legacyStatus === "do_not_contact";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        doNotContact ? "bg-red-600 text-white dark:bg-red-700" : "bg-muted text-muted-foreground",
      )}
      title="Estado anterior a la simplificación de estados"
    >
      {doNotContact ? <BanIcon className="size-3" aria-hidden /> : null}
      Antes: {RETIRED_LEAD_STATUS_LABELS[legacyStatus]}
    </span>
  );
}
