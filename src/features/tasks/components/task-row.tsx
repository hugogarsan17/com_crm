import Link from "next/link";
import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTIVITY_OUTCOME_LABELS, type ActivityOutcome } from "@/features/activities/constants";
import { LeadStatusBadge } from "@/features/leads/components/badges";
import type { LeadStatus } from "@/features/leads/constants";
import { isoToLocalDateTime } from "@/lib/dates";
import { formatDateTime, telHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import { classifyTask } from "../buckets";
import type { TaskStatus } from "../constants";
import { TaskActions } from "./task-actions";

export type TaskRowData = {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: TaskStatus;
  completed_at: string | null;
  lead?: {
    id: string;
    full_name: string;
    phone: string | null;
    status: LeadStatus;
    legacy_status: string | null;
    last_outcome: ActivityOutcome | null;
  } | null;
};

const BUCKET_STYLES = {
  overdue: "text-destructive font-medium",
  today: "text-amber-700 dark:text-amber-400 font-medium",
  upcoming: "text-muted-foreground",
  completed: "text-muted-foreground",
  cancelled: "text-muted-foreground line-through",
} as const;

export function TaskRow({ task, timezone, now }: { task: TaskRowData; timezone: string; now: Date }) {
  const bucket = classifyTask(task.due_at, task.status, timezone, now);
  const lead = task.lead;
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {lead ? (
            <Link href={`/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">
              {lead.full_name}
            </Link>
          ) : null}
          {lead ? <LeadStatusBadge status={lead.status} /> : null}
        </div>
        <p className={cn("text-sm", lead ? "" : "font-medium")}>{task.title}</p>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className={BUCKET_STYLES[bucket]}>
            {bucket === "overdue" ? "Vencida · " : ""}
            {task.status === "completed" && task.completed_at
              ? `Completada ${formatDateTime(task.completed_at, timezone)}`
              : formatDateTime(task.due_at, timezone)}
          </span>
          {lead?.last_outcome ? <span>Último: {ACTIVITY_OUTCOME_LABELS[lead.last_outcome]}</span> : null}
        </p>
        {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
      </div>
      <div className="flex items-center gap-1 self-end sm:self-auto">
        {lead?.phone && task.status === "pending" && lead.legacy_status !== "do_not_contact" ? (
          <Button asChild variant="outline" size="icon-lg" aria-label={`Llamar a ${lead.full_name}`}>
            <a href={telHref(lead.phone)}>
              <PhoneIcon />
            </a>
          </Button>
        ) : null}
        <TaskActions taskId={task.id} status={task.status} dueLocal={isoToLocalDateTime(task.due_at, timezone)} compact />
      </div>
    </li>
  );
}
