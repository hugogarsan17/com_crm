-- Escaneo de hojas «Consulta abreviada» (noviembre 2026).
--
-- 1) Ficha: domicilio y teléfono adicional.
-- 2) customer_policies: póliza que el cliente YA tiene (leída de la hoja escaneada).
--    Es distinta de public.policies (pólizas vendidas por el comercial, que alimentan
--    comisiones e informes): estas no cuentan como ventas.
-- 3) create_lead_from_scan: crea ficha + póliza del cliente + primera tarea opcional
--    en una sola transacción (security invoker: respeta RLS).
--
-- No se guardan DNI, IBAN, domicilio de cobro ni la imagen escaneada.

-- -----------------------------------------------------------------------------
-- 1) Ficha
-- -----------------------------------------------------------------------------
alter table public.leads
  add column address text
    constraint leads_address_length check (address is null or char_length(address) <= 200),
  add column secondary_phone text
    constraint leads_secondary_phone_length check (secondary_phone is null or char_length(secondary_phone) <= 30);

comment on column public.leads.address is 'Domicilio del cliente (calle, número, piso).';
comment on column public.leads.secondary_phone is 'Teléfono adicional del cliente.';

-- -----------------------------------------------------------------------------
-- 2) Pólizas existentes del cliente
-- -----------------------------------------------------------------------------
create table public.customer_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null,
  policy_number text
    constraint customer_policies_number_length check (policy_number is null or char_length(policy_number) between 1 and 40),
  product_reference text
    constraint customer_policies_product_length check (product_reference is null or char_length(product_reference) <= 20),
  effect_date date,
  policy_type text
    constraint customer_policies_type_length check (policy_type is null or char_length(policy_type) <= 60),
  payment_frequency text
    constraint customer_policies_frequency_length check (payment_frequency is null or char_length(payment_frequency) <= 10),
  status_code text
    constraint customer_policies_status_length check (status_code is null or char_length(status_code) <= 10),
  cancel_date date,
  -- «GAR./ASEG. A FECHA». Se guarda, pero aún no genera avisos (significado pendiente de confirmar).
  covered_until date,
  annual_premium numeric(12, 2)
    constraint customer_policies_annual_non_negative check (annual_premium is null or annual_premium >= 0),
  first_receipt_amount numeric(12, 2)
    constraint customer_policies_first_non_negative check (first_receipt_amount is null or first_receipt_amount >= 0),
  next_receipt_amount numeric(12, 2)
    constraint customer_policies_next_non_negative check (next_receipt_amount is null or next_receipt_amount >= 0),
  consulted_at timestamptz,
  -- [{ "nombre": text, "estado": text }]
  coverages jsonb not null default '[]'
    constraint customer_policies_coverages_array check (jsonb_typeof(coverages) = 'array' and jsonb_array_length(coverages) <= 100),
  -- [{ "orden", "nombre", "edad_real", "edad_derecho", "baja", "motivo" }]
  insured jsonb not null default '[]'
    constraint customer_policies_insured_array check (jsonb_typeof(insured) = 'array' and jsonb_array_length(insured) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_policies_lead_fkey foreign key (lead_id, user_id)
    references public.leads (id, user_id) on delete cascade
);

comment on table public.customer_policies is 'Pólizas que el cliente ya tiene (escaneo de «Consulta abreviada»). No son ventas: no cuentan en comisiones ni informes.';

create index customer_policies_lead_idx on public.customer_policies (lead_id);
create index customer_policies_user_number_idx on public.customer_policies (user_id, lower(policy_number));

create trigger customer_policies_set_updated_at
  before update on public.customer_policies
  for each row execute function public.set_updated_at();

alter table public.customer_policies enable row level security;

revoke all on table public.customer_policies from anon;
revoke all on table public.customer_policies from authenticated;
grant select, insert, update, delete on table public.customer_policies to authenticated;

create policy "customer_policies_select_own" on public.customer_policies
  for select to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "customer_policies_insert_own" on public.customer_policies
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "customer_policies_update_own" on public.customer_policies
  for update to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id))
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "customer_policies_delete_own" on public.customer_policies
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

-- -----------------------------------------------------------------------------
-- 3) Alta atómica desde el escaneo
-- -----------------------------------------------------------------------------
create or replace function public.create_lead_from_scan(p_lead jsonb, p_policy jsonb, p_task jsonb default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lead_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lead) <> 'object' or jsonb_typeof(p_policy) <> 'object'
     or (p_task is not null and jsonb_typeof(p_task) not in ('object', 'null')) then
    raise exception 'Formato no válido' using errcode = '22023';
  end if;

  insert into public.leads (
    user_id, full_name, phone, secondary_phone, address, postal_code, locality,
    customer_reference, has_funeral_insurance, product_code, priority, notes
  )
  values (
    v_uid,
    btrim(p_lead ->> 'full_name'),
    nullif(btrim(p_lead ->> 'phone'), ''),
    nullif(btrim(p_lead ->> 'secondary_phone'), ''),
    nullif(btrim(p_lead ->> 'address'), ''),
    nullif(upper(btrim(p_lead ->> 'postal_code')), ''),
    nullif(btrim(p_lead ->> 'locality'), ''),
    nullif(btrim(p_lead ->> 'customer_reference'), ''),
    (p_lead ->> 'has_funeral_insurance')::boolean,
    nullif(btrim(p_lead ->> 'product_code'), ''),
    coalesce((p_lead ->> 'priority')::public.lead_priority, 'normal'),
    nullif(btrim(p_lead ->> 'notes'), '')
  )
  returning id into v_lead_id;

  insert into public.customer_policies (
    user_id, lead_id, policy_number, product_reference, effect_date, policy_type,
    payment_frequency, status_code, cancel_date, covered_until, annual_premium,
    first_receipt_amount, next_receipt_amount, consulted_at, coverages, insured
  )
  values (
    v_uid,
    v_lead_id,
    nullif(btrim(p_policy ->> 'policy_number'), ''),
    nullif(btrim(p_policy ->> 'product_reference'), ''),
    (p_policy ->> 'effect_date')::date,
    nullif(btrim(p_policy ->> 'policy_type'), ''),
    nullif(btrim(p_policy ->> 'payment_frequency'), ''),
    nullif(btrim(p_policy ->> 'status_code'), ''),
    (p_policy ->> 'cancel_date')::date,
    (p_policy ->> 'covered_until')::date,
    (p_policy ->> 'annual_premium')::numeric,
    (p_policy ->> 'first_receipt_amount')::numeric,
    (p_policy ->> 'next_receipt_amount')::numeric,
    (p_policy ->> 'consulted_at')::timestamptz,
    coalesce(p_policy -> 'coverages', '[]'::jsonb),
    coalesce(p_policy -> 'insured', '[]'::jsonb)
  );

  if p_task is not null and jsonb_typeof(p_task) = 'object' then
    insert into public.tasks (user_id, lead_id, title, due_at)
    values (v_uid, v_lead_id, btrim(p_task ->> 'title'), (p_task ->> 'due_at')::timestamptz);
  end if;

  return v_lead_id;
end;
$$;

revoke execute on function public.create_lead_from_scan(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_lead_from_scan(jsonb, jsonb, jsonb) to authenticated;
