import { cn } from "@/lib/utils";

/** Grupo de opciones en cápsula (vistas, pestañas, conmutadores). Sirve para enlaces y botones. */
export const segmentedClass = "inline-flex items-center gap-0.5 rounded-full border border-border bg-black/25 p-1 backdrop-blur-md";

export function segmentedItemClass(active: boolean) {
  return cn(
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
    active ? "bg-surface-hover text-foreground shadow-sm" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
  );
}

/** Píldora de filtro (chip) con estado seleccionado. */
export function chipClass(active: boolean) {
  return cn(
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
    active
      ? "border-white/20 bg-surface-hover text-foreground"
      : "border-border bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground",
  );
}
