-- Vencimiento de pólizas y seguimiento automático una semana antes.
--
-- policies.expires_on: fecha en la que vence (o se renueva) la póliza.
-- tasks.policy_id: vincula el seguimiento creado automáticamente con su póliza.
-- Al guardar una póliza con vencimiento se crea (o se ajusta) una tarea pendiente
-- 7 días antes a las 10:00 en la zona horaria del perfil. Es una tarea normal del
-- comercial: aparece en el calendario, en «Para hoy», en Seguimientos y en los avisos
-- por email del propio comercial. No se envía nada al cliente.

alter table public.policies
  add column expires_on date;

alter table public.policies
  add constraint policies_expires_after_contract
  check (expires_on is null or contracted_at is null or expires_on >= contracted_at);

comment on column public.policies.expires_on is 'Fecha de vencimiento de la póliza. Genera un seguimiento automático una semana antes.';

create index policies_user_expires_idx on public.policies (user_id, expires_on) where expires_on is not null;

-- La tarea solo puede apuntar a una póliza de su misma ficha (y, por la FK de la ficha, del mismo usuario).
alter table public.policies
  add constraint policies_id_lead_key unique (id, lead_id);

alter table public.tasks
  add column policy_id uuid;

alter table public.tasks
  add constraint tasks_policy_fkey foreign key (policy_id, lead_id)
  references public.policies (id, lead_id) on delete cascade;

comment on column public.tasks.policy_id is 'Póliza cuyo vencimiento originó la tarea (seguimiento automático).';

-- Como máximo un seguimiento de vencimiento pendiente por póliza.
create unique index tasks_policy_pending_key on public.tasks (policy_id)
  where policy_id is not null and status = 'pending';

create or replace function public.policies_sync_expiry_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_due timestamptz;
  v_task_id uuid;
  v_title text;
  v_description text;
begin
  select t.id into v_task_id
    from public.tasks t
   where t.policy_id = new.id
     and t.status = 'pending';

  v_title := left('Vencimiento de póliza: ' || new.product_name, 200);

  -- Ediciones que no cambian la fecha: solo se actualiza el título del aviso pendiente.
  -- Así no se recrea un aviso ya completado ni se pisa una fecha reprogramada a mano.
  if tg_op = 'UPDATE' and new.expires_on is not distinct from old.expires_on then
    if v_task_id is not null and new.product_name is distinct from old.product_name then
      update public.tasks set title = v_title where id = v_task_id;
    end if;
    return null;
  end if;

  select coalesce(p.timezone, 'Europe/Madrid') into v_tz
    from public.profiles p
   where p.id = new.user_id;
  v_tz := coalesce(v_tz, 'Europe/Madrid');
  v_today := (now() at time zone v_tz)::date;

  -- Sin vencimiento o ya vencida: se cancela el aviso pendiente (si lo había).
  if new.expires_on is null or new.expires_on < v_today then
    if v_task_id is not null then
      update public.tasks set status = 'cancelled' where id = v_task_id;
    end if;
    return null;
  end if;

  -- Una semana antes a las 10:00 (hora local). Si esa fecha ya pasó, el aviso queda para dentro de una hora.
  v_due := ((new.expires_on - 7)::timestamp + time '10:00') at time zone v_tz;
  if v_due < now() then
    v_due := now() + interval '1 hour';
  end if;

  v_description := 'La póliza vence el ' || to_char(new.expires_on, 'DD/MM/YYYY')
    || '. Seguimiento creado automáticamente una semana antes.';

  if v_task_id is null then
    insert into public.tasks (user_id, lead_id, policy_id, title, description, due_at)
    values (new.user_id, new.lead_id, new.id, v_title, v_description, v_due);
  else
    update public.tasks
       set title = v_title, description = v_description, due_at = v_due
     where id = v_task_id;
  end if;
  return null;
end;
$$;

create trigger policies_sync_expiry_task
  after insert or update of expires_on, product_name on public.policies
  for each row execute function public.policies_sync_expiry_task();

revoke execute on function public.policies_sync_expiry_task() from public, anon, authenticated;
