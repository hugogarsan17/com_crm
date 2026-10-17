import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/shared/auth-card";

export const metadata: Metadata = { title: "Enlace no válido" };

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <AuthCard
          title="El enlace no es válido"
          description="Puede que haya caducado, que ya se haya usado o que se haya abierto en otro navegador."
        >
          <div className="flex flex-col gap-2">
            <Button asChild size="lg">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/forgot-password">Solicitar un nuevo enlace</Link>
            </Button>
          </div>
        </AuthCard>
      </div>
    </div>
  );
}
