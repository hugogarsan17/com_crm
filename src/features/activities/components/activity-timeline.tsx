import { formatDateTime } from "@/lib/format";
import type { Tables } from "@/types/database.types";
import { ACTIVITY_CHANNEL_LABELS, ACTIVITY_OUTCOME_LABELS } from "../constants";
import { DeleteActivityButton } from "./delete-activity-button";

export function ActivityTimeline({ activities, timezone }: { activities: Tables<"activities">[]; timezone: string }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay contactos registrados.</p>;
  }
  return (
    <ol className="relative flex flex-col gap-4 border-l pl-4">
      {activities.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {ACTIVITY_CHANNEL_LABELS[a.channel]} · {ACTIVITY_OUTCOME_LABELS[a.outcome]}
              </p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={a.occurred_at}>{formatDateTime(a.occurred_at, timezone)}</time>
              </p>
              {a.summary ? <p className="mt-1 text-sm whitespace-pre-line">{a.summary}</p> : null}
            </div>
            <DeleteActivityButton activityId={a.id} />
          </div>
        </li>
      ))}
    </ol>
  );
}
