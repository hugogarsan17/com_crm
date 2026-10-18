import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ImportWizard } from "@/features/import/components/import-wizard";
import { getProducts } from "@/features/products/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Importar CSV" };

async function ImportWizardSection() {
  const [{ user }, products] = await Promise.all([requireUser(), getProducts()]);
  return <ImportWizard timezone={user.timezone} products={products} />;
}

function ImportWizardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando importación">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Importar fichas desde CSV"
        description="Carga el archivo, asigna columnas, revisa errores y duplicados, y confirma."
      />
      <Suspense fallback={<ImportWizardSkeleton />}>
        <ImportWizardSection />
      </Suspense>
    </div>
  );
}
