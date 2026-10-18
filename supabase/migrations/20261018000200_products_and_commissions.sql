-- =============================================================================
-- Cartera CRM · Catálogo de productos y cálculo de comisión
--
-- * products: catálogo único (fichas, pólizas, filtros, informes e importación).
--   leads.product_code sustituye al texto libre product_to_offer (que se conserva).
--   Se inicializa con los productos que ya usaba el proyecto (Decesos, Hogar,
--   Auto, Vida). Para añadir uno: nueva migración con un INSERT; para retirarlo:
--   active = false (nunca borrar, las pólizas antiguas lo referencian).
-- * commission_rules: porcentaje de comisión configurado por cada comercial,
--   por producto o general (product_code null). La aplicación NO trae ningún
--   porcentaje por defecto: sin regla no hay comisión calculada.
-- * policies: "Valor de póliza" (policy_value) sustituye a "Comisión estimada"
--   en la interfaz. La comisión se calcula en base de datos (trigger), con
--   aritmética numeric y redondeo a 2 decimales. estimated_commission se
--   conserva como dato histórico (no se borra ni se sobrescribe).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo de productos
-- -----------------------------------------------------------------------------
create table public.products (
  code text primary key
    constraint products_code_format check (code ~ '^[a-z0-9_]{1,40}$'),
  label text not null unique
    constraint products_label_length check (char_length(btrim(label)) between 1 and 80),
  sort_order integer not null default 0,
  active boolean not null default true
);

comment on table public.products is 'Catálogo de productos. Común a todos los usuarios y de solo lectura desde la aplicación.';

insert into public.products (code, label, sort_order) values
  ('decesos', 'Decesos', 10),
  ('hogar', 'Hogar', 20),
  ('auto', 'Auto', 30),
  ('vida', 'Vida', 40);

alter table public.products enable row level security;
revoke all on table public.products from anon, authenticated;
grant select on table public.products to authenticated;

create policy "products_select_authenticated" on public.products
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Fichas: "Producto" del catálogo (sustituye al texto libre product_to_offer)
-- -----------------------------------------------------------------------------
alter table public.leads add column product_code text references public.products (code);

comment on column public.leads.product_code is 'Producto del catálogo que se ofrece al cliente.';

create index leads_user_product_idx on public.leads (user_id, product_code);
create index leads_product_code_idx on public.leads (product_code);

-- Conserva el producto de las fichas existentes cuando el texto coincide con el catálogo.
update public.leads l
   set product_code = pr.code
  from public.products pr
 where l.product_code is null
   and l.product_to_offer is not null
   and lower(regexp_replace(btrim(l.product_to_offer), '^seguros? (de |del )?', '', 'i')) in (pr.code, lower(pr.label));

-- -----------------------------------------------------------------------------
-- Reglas de comisión (por usuario)
-- -----------------------------------------------------------------------------
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null = regla general (se aplica si no hay regla específica del producto).
  product_code text references public.products (code),
  rate_percent numeric(5, 2) not null
    constraint commission_rules_rate_range check (rate_percent >= 0 and rate_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_rules_user_product_key unique nulls not distinct (user_id, product_code)
);

comment on table public.commission_rules is 'Porcentaje de comisión sobre el valor de póliza, configurado por el comercial.';

create trigger commission_rules_set_updated_at
  before update on public.commission_rules
  for each row execute function public.set_updated_at();

alter table public.commission_rules enable row level security;
revoke all on table public.commission_rules from anon, authenticated;
grant select, insert, update, delete on table public.commission_rules to authenticated;

create policy "commission_rules_select_own" on public.commission_rules
  for select to authenticated using (user_id = (select auth.uid()));
create policy "commission_rules_insert_own" on public.commission_rules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "commission_rules_update_own" on public.commission_rules
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "commission_rules_delete_own" on public.commission_rules
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Pólizas: producto del catálogo, valor de póliza y comisión calculada
-- -----------------------------------------------------------------------------
alter table public.policies
  add column product_code text references public.products (code),
  add column policy_value numeric(12, 2)
    constraint policies_value_non_negative check (policy_value is null or policy_value >= 0),
  add column commission_rate numeric(5, 2),
  add column calculated_commission numeric(12, 2);

comment on column public.policies.product_name is 'Nombre del producto. Con product_code, copia de la etiqueta del catálogo; sin él, valor histórico fuera de catálogo.';
comment on column public.policies.policy_value is 'Valor de póliza (€) sobre el que se calcula la comisión.';
comment on column public.policies.commission_rate is 'Porcentaje aplicado en el último cálculo (derivado).';
comment on column public.policies.calculated_commission is 'Comisión calculada = round(policy_value * commission_rate / 100, 2) (derivado).';
comment on column public.policies.estimated_commission is 'En desuso desde 20261018000200 (sustituido por policy_value + cálculo). Se conserva el dato histórico.';

create index policies_user_product_idx on public.policies (user_id, product_code);
create index commission_rules_product_idx on public.commission_rules (product_code);

-- Asigna el producto del catálogo a las pólizas existentes cuando el nombre coincide
-- (sin distinguir mayúsculas y admitiendo el prefijo "Seguro de"). El resto quedan
-- como "fuera de catálogo" con su nombre original.
update public.policies p
   set product_code = pr.code
  from public.products pr
 where p.product_code is null
   and lower(regexp_replace(btrim(p.product_name), '^seguros? (de |del )?', '', 'i')) in (pr.code, lower(pr.label));

-- Regla aplicable: la específica del producto y, si no hay, la general.
create or replace function public.commission_rate_for(p_user_id uuid, p_product_code text)
returns numeric
language sql
stable
set search_path = ''
as $$
  select r.rate_percent
    from public.commission_rules r
   where r.user_id = p_user_id
     and (r.product_code = p_product_code or r.product_code is null)
   order by r.product_code nulls last
   limit 1;
$$;

-- Calcula la comisión al crear la póliza o al cambiar su valor o producto.
-- Los campos derivados no se pueden fijar a mano. Si una póliza no tenía comisión
-- (faltaba la regla o el valor), cualquier edición vuelve a intentar el cálculo.
-- Cambiar una regla NO recalcula pólizas ya calculadas (el histórico no cambia solo).
create or replace function public.policies_calculate_commission()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_rate numeric(5, 2);
begin
  if tg_op = 'UPDATE'
    and new.policy_value is not distinct from old.policy_value
    and new.product_code is not distinct from old.product_code
    and old.calculated_commission is not null then
    new.commission_rate := old.commission_rate;
    new.calculated_commission := old.calculated_commission;
    return new;
  end if;

  if new.policy_value is null then
    new.commission_rate := null;
    new.calculated_commission := null;
    return new;
  end if;

  v_rate := public.commission_rate_for(new.user_id, new.product_code);
  new.commission_rate := v_rate;
  new.calculated_commission := case when v_rate is null then null else round(new.policy_value * v_rate / 100, 2) end;
  return new;
end;
$$;

create trigger policies_calculate_commission
  before insert or update on public.policies
  for each row execute function public.policies_calculate_commission();

revoke execute on function public.policies_calculate_commission() from public, anon, authenticated;
revoke execute on function public.commission_rate_for(uuid, text) from public, anon;
grant execute on function public.commission_rate_for(uuid, text) to authenticated;

-- Recalcula las pólizas del usuario que tienen valor pero aún no comisión
-- (por ejemplo, tras configurar la regla por primera vez).
create or replace function public.recalculate_missing_commissions()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  with updated as (
    update public.policies
       set policy_value = policy_value
     where user_id = v_uid
       and policy_value is not null
       and calculated_commission is null
    returning calculated_commission
  )
  select count(*) filter (where calculated_commission is not null) into v_count from updated;
  return v_count;
end;
$$;

revoke execute on function public.recalculate_missing_commissions() from public, anon;
grant execute on function public.recalculate_missing_commissions() to authenticated;
