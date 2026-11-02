-- Mueve pg_net del esquema public a extensions (aviso «extension_in_public» del linter de Supabase).
--
-- pg_net no admite ALTER EXTENSION ... SET SCHEMA, así que se recrea. Sus funciones
-- viven siempre en el esquema `net` (net.http_post), de modo que el job de pg_cron
-- «send-reminders», que las llama por nombre, sigue funcionando sin cambios.
-- Al recrearla se descartan las peticiones en cola y el histórico de net._http_response.
drop extension if exists pg_net;
create extension pg_net schema extensions;
