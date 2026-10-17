"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangleIcon className="size-8 text-destructive" aria-hidden />
      <p className="font-medium">Algo ha fallado al cargar esta página.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Error inesperado."} Comprueba tu conexión y vuelve a intentarlo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
