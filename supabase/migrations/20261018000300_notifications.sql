-- =============================================================================
-- Cartera CRM · Avisos por email de seguimientos
--
-- * notification_preferences: preferencias de cada comercial (desactivadas por
--   defecto: nadie recibe emails sin activarlos).
-- * notification_log: registro de avisos. La restricción única
--   (task_id, kind, due_at) garantiza que un mismo seguimiento no se avisa dos
--   veces para el mismo vencimiento; si se reprograma (due_at cambia) puede
--   volver a avisarse.
-- Los avisos los envía el endpoint /api/cron/notifications (servidor) con la
-- clave service_role, que nunca llega al navegador. Los usuarios solo pueden
-- leer su propio registro; no pueden escribirlo.
-- Los avisos van al email del propio comercial, nunca a los clientes.
-- =============================================================================

create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email_enabled boolean not null default false,
  notify_upcoming boolean not null default true,
  upcoming_hours integer not null default 24
    constraint notification_preferences_upcoming_hours check (upcoming_hours between 1 and 168),
  notify_overdue boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is 'Preferencias de avisos por email del comercial.';

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notification_preferences_update_own" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null
    constraint notification_log_kind check (kind in ('upcoming', 'overdue')),
  -- Vencimiento de la tarea en el momento del aviso (clave de idempotencia).
  due_at timestamptz not null,
  status text not null default 'sending'
    constraint notification_log_status check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 1,
  provider_message_id text,
  error text
    constraint notification_log_error_length check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_log_once unique (task_id, kind, due_at)
);

comment on table public.notification_log is 'Avisos por email enviados o intentados (idempotencia por tarea, tipo y vencimiento).';

create index notification_log_user_created_idx on public.notification_log (user_id, created_at desc);

create trigger notification_log_set_updated_at
  before update on public.notification_log
  for each row execute function public.set_updated_at();

alter table public.notification_log enable row level security;
revoke all on table public.notification_log from anon, authenticated;
grant select on table public.notification_log to authenticated;

create policy "notification_log_select_own" on public.notification_log
  for select to authenticated using (user_id = (select auth.uid()));
