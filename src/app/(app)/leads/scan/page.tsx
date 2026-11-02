import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { getProducts } from "@/features/products/queries";
import { ScanSheetFlow } from "@/features/scan/components/scan-sheet-flow";
import { requireUser } from "@/lib/auth";
import { localDateTimeFromNow } from "@/lib/dates";

export const metadata: Metadata = { title: "Escanear hoja de póliza" };

async function Flow() {
  const [{ user }, products] = await Promise.all([requireUser(), getProducts()]);
  // La primera tarea, si se crea, se propone para mañana a las 10:00 (hora del perfil).
  return <ScanSheetFlow products={products} defaultTaskDueLocal={localDateTimeFromNow(user.timezone, 1)} />;
}

export default function ScanSheetPage() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/leads/new" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" aria-hidden /> Nueva ficha
      </Link>
      <PageHeader
        title="Escanear hoja de póliza"
        description="Lee la hoja «Consulta abreviada» y crea la ficha con su póliza tras revisar los datos."
      />
      <Suspense fallback={<Skeleton className="h-56 rounded-card" />}>
        <Flow />
      </Suspense>
    </div>
  );
}
