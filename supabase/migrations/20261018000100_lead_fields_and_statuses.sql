-- =============================================================================
-- Cartera CRM · Campos de ficha y estados (octubre 2026)
--
-- 1. Código postal (postal_code) y seguro de decesos (has_funeral_insurance).
-- 2. customer_reference pasa a significar "Número de póliza" (solo cambia la
--    etiqueta; la columna y sus datos se conservan).
-- 3. Se retiran los estados "interested", "keeps_current_conditions" y
--    "do_not_contact". Correspondencia explícita:
--        interested                -> follow_up   (sigue abierta)
--        keeps_current_conditions  -> rejected    (sigue cerrada, conserva closed_at)
--        do_not_contact            -> rejected    (sigue cerrada, conserva closed_at)
--    El estado original queda guardado en leads.legacy_status para auditoría y
--    para que la interfaz siga avisando de que el cliente pidió no ser contactado.
-- 4. Las columnas en desuso (current_policies, product_to_offer, source) NO se
--    borran: dejan de usarse en la aplicación y sus datos se conservan (también
--    aparecen en la exportación JSON completa).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Nuevas columnas
-- -----------------------------------------------------------------------------
alter table public.leads
  add column postal_code text
    constraint leads_postal_code_format check (
      postal_code is null or postal_code ~ '^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$'
    ),
  add column has_funeral_insurance boolean,
  add column legacy_status text
    constraint leads_legacy_status_values check (
      legacy_status is null or legacy_status in ('interested', 'keeps_current_conditions', 'do_not_contact')
    );

comment on column public.leads.postal_code is 'Código postal (español de 5 dígitos o extranjero).';
comment on column public.leads.has_funeral_insurance is '¿Tiene seguro de decesos? true = sí, false = no, null = sin indicar.';
comment on column public.leads.customer_reference is 'Número de póliza del cliente (antes "Referencia de cliente").';
comment on column public.leads.legacy_status is 'Estado retirado que tenía la ficha antes de la migración 20261018000100.';
comment on column public.leads.current_policies is 'En desuso desde 20261018000100 (sustituido por has_funeral_insurance). Se conserva el dato.';
comment on column public.leads.product_to_offer is 'En desuso desde 20261018000100 (sustituido por product_code, migración 20261018000200). Se conserva el dato.';
comment on column public.leads.source is 'En desuso desde 20261018000100. Se conserva el dato.';

-- Seguro de decesos a partir de las antiguas "pólizas actuales", solo cuando el
-- dato es explícito. Cualquier otro caso queda "sin indicar" (null).
update public.leads
   set has_funeral_insurance = true
 where exists (select 1 from unnest(current_policies) as p where p ~* 'deceso');

update public.leads
   set has_funeral_insurance = false
 where has_funeral_insurance is null
   and cardinality(current_policies) = 1
   and lower(btrim(current_policies[1])) in ('ninguna', 'ninguno', 'sin pólizas', 'sin polizas');

-- -----------------------------------------------------------------------------
-- 2. Estados retirados
-- -----------------------------------------------------------------------------
-- Guardar el estado original antes de transformarlo.
update public.leads
   set legacy_status = status::text
 where status::text in ('interested', 'keeps_current_conditions', 'do_not_contact');

-- Objetos que dependen del tipo o de la columna status.
drop trigger leads_handle_status on public.leads;
drop trigger leads_after_status_change on public.leads;
drop function public.leads_after_status_change();

alter type public.lead_status rename to lead_status_retired;

create type public.lead_status as enum (
  'pending_contact',
  'no_answer',
  'follow_up',
  'proposal_in_progress',
  'policy_contracted',
  'rejected'
);

-- ALTER COLUMN TYPE no dispara triggers: closed_at y closed_reason se conservan.
alter table public.leads alter column status drop default;
alter table public.leads alter column status type public.lead_status using (
  case status::text
    when 'interested' then 'follow_up'
    when 'keeps_current_conditions' then 'rejected'
    when 'do_not_contact' then 'rejected'
    else status::text
  end
)::public.lead_status;
alter table public.leads alter column status set default 'pending_contact';

drop function public.log_activity(
  uuid, public.activity_channel, public.activity_outcome, timestamptz, text,
  public.lead_status_retired, text, text, timestamptz
);
drop function public.is_closed_lead_status(public.lead_status_retired);
drop type public.lead_status_retired;

create or replace function public.is_closed_lead_status(p_status public.lead_status)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_status in ('policy_contracted'::public.lead_status, 'rejected'::public.lead_status);
$$;

revoke execute on function public.is_closed_lead_status(public.lead_status) from public, anon;
grant execute on function public.is_closed_lead_status(public.lead_status) to authenticated;

-- closed_at: solo se reinicia al pasar de abierto a cerrado (antes también al
-- cambiar entre dos estados cerrados, lo que movía la fecha de cierre).
create or replace function public.leads_handle_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_closed_lead_status(new.status) then
    if tg_op = 'INSERT' then
      new.closed_at := coalesce(new.closed_at, now());
    elsif not public.is_closed_lead_status(old.status)
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

-- Sin el estado "No contactar" ya no hay bloqueo de seguimientos.
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
  return new;
end;
$$;

revoke execute on function public.leads_handle_status() from public, anon, authenticated;
revoke execute on function public.tasks_before_write() from public, anon, authenticated;
