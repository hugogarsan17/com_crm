import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/features/leads/components/lead-form";
import { LeadFormSkeleton } from "@/features/leads/components/lead-form-skeleton";
import { leadToFormValues } from "@/features/leads/form-values";
import { getLeadForEdit } from "@/features/leads/queries";
import { getProducts } from "@/features/products/queries";

export const metadata: Metadata = { title: "Editar ficha" };

type Params = PageProps<"/leads/[id]/edit">["params"];

const loadLead = cache(async (params: Params) => getLeadForEdit((await params).id));

async function EditLeadHeader({ params }: { params: Params }) {
  const { lead } = await loadLead(params);
  return <PageHeader title={`Editar · ${lead.full_name}`} />;
}

async function EditLeadForm({ params }: { params: Params }) {
  const [{ user, lead }, products] = await Promise.all([loadLead(params), getProducts()]);
  return <LeadForm mode="edit" leadId={lead.id} defaultValues={leadToFormValues(lead, user.timezone)} products={products} />;
}

export default function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageHeader title="Editar ficha" />}>
        <EditLeadHeader params={params} />
      </Suspense>
      <Suspense fallback={<LeadFormSkeleton sections={2} />}>
        <EditLeadForm params={params} />
      </Suspense>
    </div>
  );
}
