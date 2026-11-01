import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Métrica compacta de cabecera: icono en círculo, cifra destacada, chip opcional y etiqueta. */
export function HeaderMetric({ icon: Icon, value, chip, label }: { icon: LucideIcon; value: string; chip?: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="hidden size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white/[0.04] text-muted-foreground sm:flex">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</span>
          {chip ? (
            <span className="rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-primary">
              {chip}
            </span>
          ) : null}
        </p>
        <p className="text-xs leading-snug text-muted-foreground sm:max-w-48">{label}</p>
      </div>
    </div>
  );
}
