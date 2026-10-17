import { Skeleton } from "@/components/ui/skeleton";

export function LeadFormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando formulario">
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border p-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
