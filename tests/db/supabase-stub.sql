-- Stub mínimo del entorno de Supabase para probar las migraciones en PGlite.
-- Reproduce: roles anon/authenticated, esquema auth, auth.users y auth.uid().
create role anon nologin noinherit;
create role authenticated nologin noinherit;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Piezas de la plataforma Supabase que usan las migraciones de avisos (nov. 2026).
-- PGlite no tiene pg_cron, pg_net ni Vault: se emula lo mínimo para que las
-- migraciones se apliquen y la lógica SQL de los avisos se pueda probar.
-- (El harness omite las sentencias create/drop extension de pg_net y pg_cron.)
-- -----------------------------------------------------------------------------
create role service_role nologin noinherit bypassrls;
grant usage on schema public to service_role;

-- Función de event trigger que Supabase crea en proyectos nuevos.
create function public.rls_auto_enable() returns void language sql as $$ select $$;

create schema extensions;
create function extensions.gen_random_bytes(n integer) returns bytea
language sql volatile
as $$ select substring(decode(repeat(md5(random()::text), n / 16 + 1), 'hex') from 1 for n) $$;

create schema vault;
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text not null,
  description text
);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
returns uuid language sql
as $$ insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id $$;

create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql
as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create function cron.unschedule(job_name text) returns boolean
language sql
as $$ with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d) $$;
