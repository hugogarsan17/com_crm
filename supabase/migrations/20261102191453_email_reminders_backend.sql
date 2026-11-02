create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notify_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_cron_secret', 'Secreto para invocar send-reminders desde pg_cron');
  end if;
end $$;

-- Comprueba el secreto que envía pg_cron (solo service_role)
create or replace function public.notify_check_secret(p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(p_secret, '') <> '' and exists (
    select 1 from vault.decrypted_secrets
    where name = 'notify_cron_secret' and decrypted_secret = p_secret
  );
$$;

-- Reserva los avisos pendientes de enviar (idempotente por tarea, tipo y vencimiento)
create or replace function public.notify_claim_due()
returns table (
  log_id uuid, kind text, task_title text, task_description text, due_at timestamptz,
  lead_name text, lead_phone text, user_email text, user_name text, user_timezone text
)
language sql volatile security definer set search_path = ''
as $$
  with cand as (
    select t.id as task_id, t.user_id, t.due_at, k.kind
    from public.tasks t
    join public.notification_preferences p on p.user_id = t.user_id and p.email_enabled
    cross join lateral (values
      (case when p.notify_upcoming and t.due_at > now()
                 and t.due_at <= now() + make_interval(hours => p.upcoming_hours) then 'upcoming' end),
      (case when p.notify_overdue and t.due_at <= now()
                 and t.due_at > now() - interval '3 days' then 'overdue' end)
    ) as k(kind)
    where t.status = 'pending' and k.kind is not null
  ),
  ins as (
    insert into public.notification_log (user_id, task_id, kind, due_at, status, attempts)
    select c.user_id, c.task_id, c.kind, c.due_at, 'sending', 1 from cand c
    on conflict (task_id, kind, due_at) do nothing
    returning id, task_id, kind
  ),
  retry as (
    update public.notification_log l
       set status = 'sending', attempts = l.attempts + 1, error = null, updated_at = now()
      from cand c
     where l.task_id = c.task_id and l.kind = c.kind and l.due_at = c.due_at and l.attempts < 3
       and (l.status = 'failed' or (l.status = 'sending' and l.updated_at < now() - interval '15 minutes'))
    returning l.id, l.task_id, l.kind
  ),
  claimed as (select * from ins union all select * from retry)
  select cl.id, cl.kind, t.title, t.description, t.due_at,
         ld.full_name, ld.phone, u.email::text, pr.full_name, coalesce(pr.timezone, 'Europe/Madrid')
  from claimed cl
  join public.tasks t on t.id = cl.task_id
  join public.leads ld on ld.id = t.lead_id
  join auth.users u on u.id = t.user_id
  left join public.profiles pr on pr.id = t.user_id
  where u.email is not null;
$$;

-- Marca el resultado de un envío
create or replace function public.notify_mark(p_log_id uuid, p_ok boolean, p_provider_id text, p_error text)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.notification_log
     set status = case when p_ok then 'sent' else 'failed' end,
         provider_message_id = p_provider_id,
         error = left(p_error, 500),
         updated_at = now()
   where id = p_log_id;
$$;

revoke execute on function public.notify_check_secret(text) from public, anon, authenticated;
revoke execute on function public.notify_claim_due() from public, anon, authenticated;
revoke execute on function public.notify_mark(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.notify_check_secret(text) to service_role;
grant execute on function public.notify_claim_due() to service_role;
grant execute on function public.notify_mark(uuid, boolean, text, text) to service_role;
