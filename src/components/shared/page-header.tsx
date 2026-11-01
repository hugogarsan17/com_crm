import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Contenido junto al título en escritorio (p. ej. métricas). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:gap-10">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-balance sm:text-[2.15rem] sm:leading-[1.1]">{title}</h1>
          {description ? <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
