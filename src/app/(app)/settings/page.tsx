import type { Metadata } from "next";
import { Suspense } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { DeleteAccount } from "@/features/profile/components/delete-account";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Ajustes" };

async function UserEmail() {
  const { user } = await requireUser();
  return user.email;
}

async function ProfileSection() {
  const { user } = await requireUser();
  return <ProfileForm defaultValues={{ full_name: user.fullName, timezone: user.timezone }} />;
}

function ProfileFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando perfil">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <PageHeader
        title="Ajustes"
        description={
          <Suspense fallback={<span className="inline-block h-4 w-48 animate-pulse rounded-md bg-muted align-middle" />}>
            <UserEmail />
          </Suspense>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ProfileFormSkeleton />}>
            <ProfileSection />
          </Suspense>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>Descarga una copia de toda la información que has guardado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg">
            <a href="/api/export/leads">
              <DownloadIcon aria-hidden /> Fichas (CSV)
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="/api/export/data">
              <DownloadIcon aria-hidden /> Todos mis datos (JSON)
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Eliminar cuenta</CardTitle>
          <CardDescription>Borra tu cuenta y todos sus datos de forma permanente.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
    </div>
  );
}
