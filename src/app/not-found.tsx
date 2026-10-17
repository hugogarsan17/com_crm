import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl font-semibold">404</p>
      <p className="text-muted-foreground">No hemos encontrado lo que buscas.</p>
      <Button asChild>
        <Link href="/dashboard">Volver al panel</Link>
      </Button>
    </div>
  );
}
