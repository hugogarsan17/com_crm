-- =============================================================================
-- Cartera CRM · Esquema inicial
-- Tablas, tipos, restricciones, índices y triggers de integridad.
-- Las políticas RLS están en la migración siguiente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos controlados
-- -----------------------------------------------------------------------------
create type public.lead_status as enum (
  'pending_contact',
  'no_answer',
  'follow_up',
  'interested',
  'proposal_in_progress',
  'policy_contracted',
  'rejected',
  'keeps_current_conditions',
  'do_not_contact'
);

create type public.lead_priority as enum ('low', 'normal', 'high');

create type public.task_status as enum ('pending', 'completed', 'cancelled');

create type public.commission_status as enum ('pending', 'confirmed', 'paid');

create type public.activity_channel as enum (
  'call',
  'whatsapp',
  'sms',
  'email',
  'visit',
  'other'
);

-- Resultado de un intento de contacto (distinto del estado general del lead).
create type public.activity_outcome as enum (
  'no_answer',
  'spoke',
  'interested',
  'info_requested',
  'call_back',
  'proposal_sent',
  'contracted',
  'rejected',
  'keeps_conditions',
  'wrong_contact',
  'do_not_contact',
  'other'
);

-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normaliza un teléfono para detectar duplicados: solo dígitos y sin prefijo +34.
-- Debe mantenerse en sincronía con normalizePhone() en src/lib/normalize.ts.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    case
      when d like '0034%' and length(d) = 13 then substr(d, 5)
      when d like '34%' and length(d) = 11 then substr(d, 3)
      else d
    end,
    ''
  )
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) as s;
$$;

-- Estados que cierran la gestión de un lead.
create or replace function public.is_closed_lead_status(p_status public.lead_status)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_status in (
    'policy_contracted'::public.lead_status,
    'rejected'::public.lead_status,
    'keeps_current_conditions'::public.lead_status,
    'do_not_contact'::public.lead_status
  );
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 120),
  timezone text not null default 'Europe/Madrid'
    constraint profiles_timezone_length check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil del comercial, 1:1 con auth.users. Se crea por trigger al registrarse.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil al registrar un usuario en auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Usuario'
      ),
      120
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null
    constraint leads_full_name_length check (char_length(btrim(full_name)) between 1 and 200),
  phone text
    constraint leads_phone_length check (phone is null or char_length(phone) <= 30),
  email text
    constraint leads_email_format check (
      email is null
      or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    ),
  locality text
    constraint leads_locality_length check (locality is null or char_length(locality) <= 120),
  customer_reference text
    constraint leads_customer_reference_length check (customer_reference is null or char_length(customer_reference) <= 80),
  current_policies text[] not null default '{}'
    constraint leads_current_policies_size check (cardinality(current_policies) <= 30),
  product_to_offer text
    constraint leads_product_length check (product_to_offer is null or char_length(product_to_offer) <= 120),
  source text
    constraint leads_source_length check (source is null or char_length(source) <= 120),
  status public.lead_status not null default 'pending_contact',
  priority public.lead_priority not null default 'normal',
  notes text
    constraint leads_notes_length check (notes is null or char_length(notes) <= 5000),
  received_at timestamptz not null default now(),
  -- Próxima acción: se sincroniza con la tarea pendiente más próxima (trigger en tasks).
  next_action text,
  next_follow_up_at timestamptz,
  -- Último contacto: se sincroniza con activities (trigger en activities).
  last_contact_at timestamptz,
  last_outcome public.activity_outcome,
  closed_at timestamptz,
  closed_reason text
    constraint leads_closed_reason_length check (closed_reason is null or char_length(closed_reason) <= 500),
  phone_normalized text generated always as (public.normalize_phone(phone)) stored,
  email_normalized text generated always as (nullif(lower(btrim(email)), '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  -- Permite que las tablas hijas referencien (lead_id, user_id) y así garantizar
  -- a nivel de restricción que el lead pertenece al mismo usuario.
  constraint leads_id_user_id_key unique (id, user_id)
);

comment on table public.leads is 'Fichas de clientes asignadas al comercial.';
comment on column public.leads.next_follow_up_at is 'Derivado: vencimiento de la tarea pendiente más próxima.';
comment on column public.leads.last_outcome is 'Derivado: resultado de la actividad más reciente.';

create index leads_user_status_idx on public.leads (user_id, status);
create index leads_user_next_follow_up_idx on public.leads (user_id, next_follow_up_at);
create index leads_user_received_idx on public.leads (user_id, received_at);
create index leads_user_closed_idx on public.leads (user_id, closed_at);
create index leads_user_phone_norm_idx on public.leads (user_id, phone_normalized);
create index leads_user_email_norm_idx on public.leads (user_id, email_normalized);
create index leads_user_reference_idx on public.leads (user_id, lower(btrim(customer_reference)));

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Mantiene closed_at coherente con el estado.
create or replace function public.leads_handle_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_closed_lead_status(new.status) then
    if tg_op = 'INSERT' then
      new.closed_at := coalesce(new.closed_at, now());
    elsif old.status is distinct from new.status
      and new.closed_at is not distinct from old.closed_at then
      new.closed_at := now();
    elsif new.closed_at is null then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
    new.closed_reason := null;
  end if;
  return new;
end;
$$;

create trigger leads_handle_status
  before insert or update of status, closed_at, closed_reason on public.leads
  for each row execute function public.leads_handle_status();

-- -----------------------------------------------------------------------------
-- activities
-- -----------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null,
  channel public.activity_channel not null,
  outcome public.activity_outcome not null,
  summary text
    constraint activities_summary_length check (summary is null or char_length(summary) <= 2000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint activities_lead_fkey foreign key (lead_id, user_id)
    references public.leads (id, user_id) on delete cascade
);

comment on table public.activities is 'Historial cronológico de contactos con cada lead.';

create index activities_lead_occurred_idx on public.activities (lead_id, occurred_at desc);
create index activities_user_occurred_idx on public.activities (user_id, occurred_at);

-- Mantiene leads.last_contact_at / last_outcome.
create or replace function public.sync_lead_last_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lead_id uuid := coalesce(new.lead_id, old.lead_id);
begin
  update public.leads l
     set (last_contact_at, last_outcome) = (
       select a.occurred_at, a.outcome
         from public.activities a
        where a.lead_id = v_lead_id
        order by a.occurred_at desc, a.created_at desc
        limit 1
     )
   where l.id = v_lead_id;
  return null;
end;
$$;

create trigger activities_sync_lead_last_contact
  after insert or update of occurred_at, outcome or delete on public.activities
  for each row execute function public.sync_lead_last_contact();

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null,
  title text not null
    constraint tasks_title_length check (char_length(btrim(title)) between 1 and 200),
  description text
    constraint tasks_description_length check (description is null or char_length(description) <= 2000),
  due_at timestamptz not null,
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_completed_at_consistency check ((status = 'completed') = (completed_at is not null)),
  constraint tasks_lead_fkey foreign key (lead_id, user_id)
    references public.leads (id, user_id) on delete cascade
);

comment on table public.tasks is 'Seguimientos programados para cada lead.';

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_lead_status_due_idx on public.tasks (lead_id, status, due_at);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- completed_at coherente y bloqueo de seguimientos activos para "no contactar".
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  if new.status = 'pending' and exists (
    select 1 from public.leads l
     where l.id = new.lead_id and l.status = 'do_not_contact'
  ) then
    raise exception 'No se pueden programar seguimientos para un cliente marcado como "No contactar".'
      using errcode = 'P0001', hint = 'lead_do_not_contact';
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Mantiene leads.next_follow_up_at / next_action a partir de la tarea pendiente más próxima.
create or replace function public.sync_lead_next_follow_up()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  for v_lead_id in
    select distinct x
      from unnest(array[
        case when tg_op <> 'INSERT' then old.lead_id end,
        case when tg_op <> 'DELETE' then new.lead_id end
      ]) as x
     where x is not null
  loop
    update public.leads l
       set (next_follow_up_at, next_action) = (
         select t.due_at, t.title
           from public.tasks t
          where t.lead_id = v_lead_id
            and t.status = 'pending'
          order by t.due_at asc
          limit 1
       )
     where l.id = v_lead_id;
  end loop;
  return null;
end;
$$;

create trigger tasks_sync_lead_next_follow_up
  after insert or update of due_at, status, title, lead_id or delete on public.tasks
  for each row execute function public.sync_lead_next_follow_up();

-- Al marcar un lead como "No contactar" se cancelan sus seguimientos pendientes.
create or replace function public.leads_after_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'do_not_contact' then
    update public.tasks
       set status = 'cancelled'
     where lead_id = new.id
       and status = 'pending';
  end if;
  return null;
end;
$$;

create trigger leads_after_status_change
  after update of status on public.leads
  for each row
  when (old.status is distinct from new.status)
  execute function public.leads_after_status_change();

-- -----------------------------------------------------------------------------
-- policies
-- -----------------------------------------------------------------------------
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null,
  product_name text not null
    constraint policies_product_name_length check (char_length(btrim(product_name)) between 1 and 120),
  contracted_at date,
  premium_amount numeric(12, 2)
    constraint policies_premium_non_negative check (premium_amount is null or premium_amount >= 0),
  estimated_commission numeric(12, 2)
    constraint policies_estimated_non_negative check (estimated_commission is null or estimated_commission >= 0),
  confirmed_commission numeric(12, 2)
    constraint policies_confirmed_non_negative check (confirmed_commission is null or confirmed_commission >= 0),
  commission_status public.commission_status not null default 'pending',
  notes text
    constraint policies_notes_length check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una comisión confirmada o pagada debe tener importe confirmado.
  constraint policies_confirmed_amount_required check (
    commission_status = 'pending' or confirmed_commission is not null
  ),
  constraint policies_lead_fkey foreign key (lead_id, user_id)
    references public.leads (id, user_id) on delete cascade
);

comment on table public.policies is 'Pólizas contratadas y comisiones introducidas manualmente (sin cálculo automático).';

create index policies_user_contracted_idx on public.policies (user_id, contracted_at);
create index policies_lead_idx on public.policies (lead_id);

create trigger policies_set_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();
