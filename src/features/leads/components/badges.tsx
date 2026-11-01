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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        priority === "high"
          ? "border border-[#ffb38a]/30 bg-[#ffb38a]/12 text-[#ffc6a6]"
          : "border border-border bg-white/[0.04] text-muted-foreground",
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        v === "yes"
          ? "border border-success/30 bg-success/10 text-success"
          : v === "no"
            ? "border border-border bg-white/[0.05] text-foreground/80"
            : "border border-dashed border-white/15 text-muted-foreground",
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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        doNotContact ? "border border-destructive/40 bg-destructive/15 text-destructive" : "border border-border bg-white/[0.04] text-muted-foreground",
      )}
      title="Estado anterior a la simplificación de estados"
    >
      {doNotContact ? <BanIcon className="size-3" aria-hidden /> : null}
      Antes: {RETIRED_LEAD_STATUS_LABELS[legacyStatus]}
    </span>
  );
}
