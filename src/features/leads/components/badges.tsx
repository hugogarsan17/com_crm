import { FlameIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_STYLES, type LeadPriority, type LeadStatus } from "../constants";

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
