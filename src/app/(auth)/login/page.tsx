import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/components/shared/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Iniciar sesión" };

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const notice = typeof params.notice === "string" ? params.notice : undefined;

  return (
    <div className="flex flex-col gap-4">
      {!isSupabaseConfigured() ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>
            La aplicación no está configurada: faltan las variables de entorno de Supabase (consulta el README).
          </AlertDescription>
        </Alert>
      ) : null}
      {notice === "deleted" ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertDescription>Tu cuenta y tus datos se han eliminado.</AlertDescription>
        </Alert>
      ) : null}
      {notice === "confirmed" ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertDescription>Email confirmado. Ya puedes iniciar sesión.</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next} />
    </div>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <AuthCard title="Iniciar sesión" description="Accede a tus fichas y seguimientos.">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}
