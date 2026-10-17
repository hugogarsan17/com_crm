-- =============================================================================
-- Cartera CRM · Row Level Security
-- Cada usuario autenticado solo puede ver y modificar sus propias filas.
-- En tablas hijas se exige además que el lead asociado sea del mismo usuario
-- (también garantizado por la FK compuesta (lead_id, user_id)).
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.policies enable row level security;

-- -----------------------------------------------------------------------------
-- Permisos de tabla: nada para anon; lo justo para authenticated.
-- -----------------------------------------------------------------------------
revoke all on table public.profiles, public.leads, public.activities, public.tasks, public.policies from anon;
revoke all on table public.profiles, public.leads, public.activities, public.tasks, public.policies from authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, timezone) on table public.profiles to authenticated;

grant select, insert, update, delete on table public.leads to authenticated;
grant select, insert, update, delete on table public.activities to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.policies to authenticated;

revoke execute on function public.normalize_phone(text) from anon;
revoke execute on function public.is_closed_lead_status(public.lead_status) from anon;

-- -----------------------------------------------------------------------------
-- profiles: leer y actualizar solo el propio perfil (lo crea el trigger).
-- -----------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create policy "leads_select_own" on public.leads
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "leads_insert_own" on public.leads
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "leads_update_own" on public.leads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "leads_delete_own" on public.leads
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Función auxiliar: el lead pertenece al usuario actual.
-- security invoker: se evalúa con la RLS de leads del propio usuario.
-- -----------------------------------------------------------------------------
create or replace function public.owns_lead(p_lead_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.leads l
     where l.id = p_lead_id
       and l.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_lead(uuid) from public, anon;
grant execute on function public.owns_lead(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- activities
-- -----------------------------------------------------------------------------
create policy "activities_select_own" on public.activities
  for select to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "activities_insert_own" on public.activities
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "activities_update_own" on public.activities
  for update to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id))
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "activities_delete_own" on public.activities
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id))
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "tasks_delete_own" on public.tasks
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

-- -----------------------------------------------------------------------------
-- policies
-- -----------------------------------------------------------------------------
create policy "policies_select_own" on public.policies
  for select to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "policies_insert_own" on public.policies
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "policies_update_own" on public.policies
  for update to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id))
  with check (user_id = (select auth.uid()) and public.owns_lead(lead_id));

create policy "policies_delete_own" on public.policies
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.owns_lead(lead_id));
