-- =============================================================================
-- Cartera CRM · Ajustes tras los advisors de Supabase
-- =============================================================================

-- Supabase concede EXECUTE a anon/authenticated por defecto en las funciones
-- nuevas del esquema public. Las funciones de trigger no deben exponerse por RPC.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.leads_handle_status() from anon, authenticated;
revoke execute on function public.leads_after_status_change() from anon, authenticated;
revoke execute on function public.sync_lead_last_contact() from anon, authenticated;
revoke execute on function public.sync_lead_next_follow_up() from anon, authenticated;
revoke execute on function public.tasks_before_write() from anon, authenticated;

-- Índices que cubren las FK compuestas (lead_id, user_id): aceleran los borrados
-- en cascada y las comprobaciones de integridad.
create index activities_lead_user_idx on public.activities (lead_id, user_id);
create index tasks_lead_user_idx on public.tasks (lead_id, user_id);
create index policies_lead_user_idx on public.policies (lead_id, user_id);
