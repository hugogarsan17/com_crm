revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
create index if not exists policies_product_code_idx on public.policies (product_code);
create index if not exists tasks_policy_lead_idx on public.tasks (policy_id, lead_id);
