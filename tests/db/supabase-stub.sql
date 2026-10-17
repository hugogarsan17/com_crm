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
