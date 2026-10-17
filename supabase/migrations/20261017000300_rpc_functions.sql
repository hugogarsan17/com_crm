-- =============================================================================
-- Cartera CRM · Funciones RPC
-- Todas (salvo delete_my_account) son SECURITY INVOKER: se ejecutan con los
-- permisos y la RLS del usuario que llama. Además filtran por auth.uid()
-- explícitamente para que los planes usen los índices por usuario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registrar un contacto de forma atómica: actividad + estado + seguimiento.
-- -----------------------------------------------------------------------------
create or replace function public.log_activity(
  p_lead_id uuid,
  p_channel public.activity_channel,
  p_outcome public.activity_outcome,
  p_occurred_at timestamptz,
  p_summary text default null,
  p_new_status public.lead_status default null,
  p_closed_reason text default null,
  p_follow_up_title text default null,
  p_follow_up_due_at timestamptz default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_activity_id uuid;
  v_task_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not exists (select 1 from public.leads where id = p_lead_id and user_id = v_uid) then
    raise exception 'Ficha no encontrada' using errcode = 'P0002';
  end if;

  insert into public.activities (user_id, lead_id, channel, outcome, summary, occurred_at)
  values (v_uid, p_lead_id, p_channel, p_outcome, nullif(btrim(p_summary), ''), coalesce(p_occurred_at, now()))
  returning id into v_activity_id;

  if p_new_status is not null then
    update public.leads
       set status = p_new_status,
           closed_reason = case
             when public.is_closed_lead_status(p_new_status) then nullif(btrim(p_closed_reason), '')
             else null
           end
     where id = p_lead_id and user_id = v_uid;
  end if;

  if p_follow_up_due_at is not null then
    insert into public.tasks (user_id, lead_id, title, due_at)
    values (
      v_uid,
      p_lead_id,
      coalesce(nullif(btrim(p_follow_up_title), ''), 'Volver a contactar'),
      p_follow_up_due_at
    )
    returning id into v_task_id;
  end if;

  return jsonb_build_object('activity_id', v_activity_id, 'task_id', v_task_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Panel de control
-- p_from / p_to: fechas locales (inclusive) en la zona horaria p_tz.
-- -----------------------------------------------------------------------------
create or replace function public.get_dashboard_summary(
  p_from date,
  p_to date,
  p_tz text default 'Europe/Madrid'
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone p_tz)::date;
  v_today_start timestamptz := (v_today::timestamp at time zone p_tz);
  v_tomorrow_start timestamptz := ((v_today + 1)::timestamp at time zone p_tz);
  v_from timestamptz := (p_from::timestamp at time zone p_tz);
  v_to timestamptz := ((p_to + 1)::timestamp at time zone p_tz);
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'pending_contact', (
      select count(*) from public.leads
       where user_id = v_uid and archived_at is null and status = 'pending_contact'
    ),
    'interested', (
      select count(*) from public.leads
       where user_id = v_uid and archived_at is null
         and status in ('interested', 'proposal_in_progress')
    ),
    'open_without_next_action', (
      select count(*) from public.leads
       where user_id = v_uid and archived_at is null
         and status in ('no_answer', 'follow_up', 'interested', 'proposal_in_progress')
         and next_follow_up_at is null
    ),
    'follow_ups_today', (
      select count(*) from public.tasks t
        join public.leads l on l.id = t.lead_id
       where t.user_id = v_uid and t.status = 'pending' and l.archived_at is null
         and t.due_at >= v_today_start and t.due_at < v_tomorrow_start
    ),
    'follow_ups_overdue', (
      select count(*) from public.tasks t
        join public.leads l on l.id = t.lead_id
       where t.user_id = v_uid and t.status = 'pending' and l.archived_at is null
         and t.due_at < v_today_start
    ),
    'leads_received', (
      select count(*) from public.leads
       where user_id = v_uid and received_at >= v_from and received_at < v_to
    ),
    'policies_contracted', (
      select count(*) from public.policies
       where user_id = v_uid
         and coalesce(contracted_at, (created_at at time zone p_tz)::date) between p_from and p_to
    ),
    'rejected', (
      select count(*) from public.leads
       where user_id = v_uid and status = 'rejected'
         and closed_at >= v_from and closed_at < v_to
    ),
    'keeps_conditions', (
      select count(*) from public.leads
       where user_id = v_uid and status = 'keeps_current_conditions'
         and closed_at >= v_from and closed_at < v_to
    ),
    'estimated_commission', (
      select coalesce(sum(estimated_commission), 0) from public.policies
       where user_id = v_uid
         and coalesce(contracted_at, (created_at at time zone p_tz)::date) between p_from and p_to
    ),
    'confirmed_commission', (
      select coalesce(sum(confirmed_commission), 0) from public.policies
       where user_id = v_uid and commission_status in ('confirmed', 'paid')
         and coalesce(contracted_at, (created_at at time zone p_tz)::date) between p_from and p_to
    ),
    'paid_commission', (
      select coalesce(sum(confirmed_commission), 0) from public.policies
       where user_id = v_uid and commission_status = 'paid'
         and coalesce(contracted_at, (created_at at time zone p_tz)::date) between p_from and p_to
    )
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Informe por periodo y producto (opcional, comparación sin mayúsculas).
-- -----------------------------------------------------------------------------
create or replace function public.get_report(
  p_from date,
  p_to date,
  p_tz text default 'Europe/Madrid',
  p_product text default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_from timestamptz := (p_from::timestamp at time zone p_tz);
  v_to timestamptz := ((p_to + 1)::timestamp at time zone p_tz);
  v_product text := nullif(lower(btrim(p_product)), '');
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_to < p_from then
    raise exception 'Periodo no válido' using errcode = '22023';
  end if;

  with
  period_policies as (
    select p.*
      from public.policies p
     where p.user_id = v_uid
       and coalesce(p.contracted_at, (p.created_at at time zone p_tz)::date) between p_from and p_to
       and (v_product is null or lower(btrim(p.product_name)) = v_product)
  ),
  period_activities as (
    select a.*
      from public.activities a
      join public.leads l on l.id = a.lead_id
     where a.user_id = v_uid
       and a.occurred_at >= v_from and a.occurred_at < v_to
       and (v_product is null or lower(btrim(l.product_to_offer)) = v_product)
  ),
  closed_leads as (
    select l.status
      from public.leads l
     where l.user_id = v_uid
       and l.closed_at >= v_from and l.closed_at < v_to
       and (v_product is null or lower(btrim(l.product_to_offer)) = v_product)
  )
  select jsonb_build_object(
    'leads_received', (
      select count(*) from public.leads l
       where l.user_id = v_uid and l.received_at >= v_from and l.received_at < v_to
         and (v_product is null or lower(btrim(l.product_to_offer)) = v_product)
    ),
    'contact_attempts', (select count(*) from period_activities),
    'leads_contacted', (select count(distinct lead_id) from period_activities),
    'leads_reached', (
      select count(distinct lead_id) from period_activities
       where outcome not in ('no_answer', 'wrong_contact')
    ),
    'policies_contracted', (select count(*) from period_policies),
    'leads_with_policy', (select count(distinct lead_id) from period_policies),
    'rejected', (select count(*) from closed_leads where status = 'rejected'),
    'keeps_conditions', (select count(*) from closed_leads where status = 'keeps_current_conditions'),
    'premium_total', (select coalesce(sum(premium_amount), 0) from period_policies),
    'estimated_commission', (select coalesce(sum(estimated_commission), 0) from period_policies),
    'confirmed_commission', (
      select coalesce(sum(confirmed_commission), 0) from period_policies
       where commission_status in ('confirmed', 'paid')
    ),
    'paid_commission', (
      select coalesce(sum(confirmed_commission), 0) from period_policies
       where commission_status = 'paid'
    ),
    'by_product', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.policies desc, x.product), '[]'::jsonb)
        from (
          select min(btrim(product_name)) as product,
                 count(*) as policies,
                 coalesce(sum(premium_amount), 0) as premium_total,
                 coalesce(sum(estimated_commission), 0) as estimated_commission,
                 coalesce(sum(confirmed_commission) filter (where commission_status in ('confirmed', 'paid')), 0) as confirmed_commission,
                 coalesce(sum(confirmed_commission) filter (where commission_status = 'paid'), 0) as paid_commission
            from period_policies
           group by lower(btrim(product_name))
        ) as x
    )
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Serie temporal de resultados para el gráfico del panel.
-- -----------------------------------------------------------------------------
create or replace function public.get_results_series(
  p_from date,
  p_to date,
  p_tz text default 'Europe/Madrid',
  p_bucket text default 'day'
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_from timestamptz := (p_from::timestamp at time zone p_tz);
  v_to timestamptz := ((p_to + 1)::timestamp at time zone p_tz);
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'Agrupación no válida' using errcode = '22023';
  end if;
  if p_to < p_from or p_to - p_from > 1100 then
    raise exception 'Periodo no válido' using errcode = '22023';
  end if;

  with
  buckets as (
    select gs::date as bucket
      from generate_series(
        date_trunc(p_bucket, p_from::timestamp),
        date_trunc(p_bucket, p_to::timestamp),
        ('1 ' || p_bucket)::interval
      ) as gs
  ),
  contacted as (
    select date_trunc(p_bucket, a.occurred_at at time zone p_tz)::date as bucket,
           count(distinct a.lead_id) as n
      from public.activities a
     where a.user_id = v_uid and a.occurred_at >= v_from and a.occurred_at < v_to
     group by 1
  ),
  contracted as (
    select date_trunc(p_bucket, coalesce(p.contracted_at::timestamp, p.created_at at time zone p_tz))::date as bucket,
           count(*) as n
      from public.policies p
     where p.user_id = v_uid
       and coalesce(p.contracted_at, (p.created_at at time zone p_tz)::date) between p_from and p_to
     group by 1
  ),
  closed as (
    select date_trunc(p_bucket, l.closed_at at time zone p_tz)::date as bucket,
           count(*) filter (where l.status = 'rejected') as rejected,
           count(*) filter (where l.status = 'keeps_current_conditions') as keeps
      from public.leads l
     where l.user_id = v_uid and l.closed_at >= v_from and l.closed_at < v_to
     group by 1
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'bucket', to_char(b.bucket, 'YYYY-MM-DD'),
             'contacted', coalesce(c.n, 0),
             'contracted', coalesce(p.n, 0),
             'rejected', coalesce(x.rejected, 0),
             'keeps_conditions', coalesce(x.keeps, 0)
           ) order by b.bucket
         ), '[]'::jsonb)
    into v_result
    from buckets b
    left join contacted c on c.bucket = b.bucket
    left join contracted p on p.bucket = b.bucket
    left join closed x on x.bucket = b.bucket;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Productos usados (para filtros).
-- -----------------------------------------------------------------------------
create or replace function public.get_product_options()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(product order by lower(product)), '[]'::jsonb)
    from (
      select min(product) as product
        from (
          select btrim(product_to_offer) as product
            from public.leads
           where user_id = (select auth.uid()) and nullif(btrim(product_to_offer), '') is not null
          union all
          select btrim(product_name)
            from public.policies
           where user_id = (select auth.uid())
        ) as all_products
       group by lower(product)
    ) as distinct_products;
$$;

-- -----------------------------------------------------------------------------
-- Duplicados para la importación CSV (valores ya normalizados en cliente).
-- Devuelve jsonb para no quedar limitado por el máximo de filas de la API.
-- -----------------------------------------------------------------------------
create or replace function public.find_lead_duplicates(
  p_phones text[] default '{}',
  p_emails text[] default '{}',
  p_references text[] default '{}'
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id,
           'full_name', l.full_name,
           'phone_normalized', l.phone_normalized,
           'email_normalized', l.email_normalized,
           'customer_reference', lower(btrim(l.customer_reference))
         )), '[]'::jsonb)
    from public.leads l
   where l.user_id = (select auth.uid())
     and (
       l.phone_normalized = any (coalesce(p_phones, '{}'))
       or l.email_normalized = any (coalesce(p_emails, '{}'))
       or lower(btrim(l.customer_reference)) = any (coalesce(p_references, '{}'))
     );
$$;

-- -----------------------------------------------------------------------------
-- Importación por lotes. Un lote se inserta completo o no se inserta nada.
-- -----------------------------------------------------------------------------
create or replace function public.import_leads(p_rows jsonb)
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
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Formato no válido' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'Máximo 1000 filas por lote' using errcode = '22023';
  end if;

  insert into public.leads (
    user_id, full_name, phone, email, locality, customer_reference,
    current_policies, product_to_offer, source, priority, notes, received_at
  )
  select
    v_uid,
    btrim(r.full_name),
    nullif(btrim(r.phone), ''),
    nullif(btrim(r.email), ''),
    nullif(btrim(r.locality), ''),
    nullif(btrim(r.customer_reference), ''),
    coalesce(r.current_policies, '{}'),
    nullif(btrim(r.product_to_offer), ''),
    nullif(btrim(r.source), ''),
    coalesce(r.priority, 'normal'),
    nullif(btrim(r.notes), ''),
    coalesce(r.received_at, now())
  from jsonb_to_recordset(p_rows) as r(
    full_name text,
    phone text,
    email text,
    locality text,
    customer_reference text,
    current_policies text[],
    product_to_offer text,
    source text,
    priority public.lead_priority,
    notes text,
    received_at timestamptz
  );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Eliminación de la cuenta y de todos sus datos (cascada desde auth.users).
-- SECURITY DEFINER limitado estrictamente a la fila del propio usuario.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke execute on function public.log_activity(uuid, public.activity_channel, public.activity_outcome, timestamptz, text, public.lead_status, text, text, timestamptz) from public, anon;
revoke execute on function public.get_dashboard_summary(date, date, text) from public, anon;
revoke execute on function public.get_report(date, date, text, text) from public, anon;
revoke execute on function public.get_results_series(date, date, text, text) from public, anon;
revoke execute on function public.get_product_options() from public, anon;
revoke execute on function public.find_lead_duplicates(text[], text[], text[]) from public, anon;
revoke execute on function public.import_leads(jsonb) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.log_activity(uuid, public.activity_channel, public.activity_outcome, timestamptz, text, public.lead_status, text, text, timestamptz) to authenticated;
grant execute on function public.get_dashboard_summary(date, date, text) to authenticated;
grant execute on function public.get_report(date, date, text, text) to authenticated;
grant execute on function public.get_results_series(date, date, text, text) to authenticated;
grant execute on function public.get_product_options() to authenticated;
grant execute on function public.find_lead_duplicates(text[], text[], text[]) to authenticated;
grant execute on function public.import_leads(jsonb) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
