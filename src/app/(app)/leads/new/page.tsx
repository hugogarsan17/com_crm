import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/features/leads/components/lead-form";
import { LeadFormSkeleton } from "@/features/leads/components/lead-form-skeleton";
import { emptyLeadFormValues } from "@/features/leads/form-values";
import { getProducts } from "@/features/products/queries";

export const metadata: Metadata = { title: "Nueva ficha" };

async function NewLeadForm() {
  const products = await getProducts();
  return <LeadForm mode="create" defaultValues={emptyLeadFormValues()} products={products} />;
}

export default function NewLeadPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Nueva ficha" description="Los campos marcados con * son obligatorios." />
      <Suspense fallback={<LeadFormSkeleton />}>
        <NewLeadForm />
      </Suspense>
    </div>
  );
}
