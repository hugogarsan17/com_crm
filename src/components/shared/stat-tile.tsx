import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "alert" | "warning";
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "alert" && "text-destructive",
          tone === "warning" && "text-amber-700",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = "rounded-xl border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-muted/50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
