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
        <p className="min-w-0 text-sm leading-snug text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-white/[0.04] text-muted-foreground",
              tone === "alert" && "border-destructive/30 bg-destructive/10 text-destructive",
              tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-xl leading-tight font-semibold tracking-tight break-words tabular-nums sm:text-[1.75rem] sm:leading-none",
          tone === "alert" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = "surface min-w-0 rounded-card p-4 sm:p-4.5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors duration-200 hover:border-white/20 hover:bg-surface-raised/80 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
