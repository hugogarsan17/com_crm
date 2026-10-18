Modelo de datos Supabase
Este es el modelo objetivo del MVP. Comprueba el esquema existente antes de crear tablas; usa migraciones SQL versionadas y evita duplicar entidades.
Tablas
profiles
- id uuid primary key references auth.users(id) on delete cascade
- full_name text not null
- created_at, updated_at (timestamptz, por defecto now())
Crear perfil de forma confiable al registrar usuario mediante trigger/función SQL o flujo de servidor robusto. No permitir que un usuario cree perfiles de otros usuarios.
leads
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- full_name text not null, phone text, email text, locality text, customer_reference text
- current_policies text[] not null default '{}'
- product_to_offer text, source text
- status lead_status not null default 'pending_contact'
- priority lead_priority not null default 'normal'
- notes text, received_at timestamptz not null default now()
- next_action text, next_follow_up_at timestamptz
- closed_at timestamptz, closed_reason text, archived_at timestamptz
- created_at, updated_at (timestamptz, por defecto now())
activities
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- lead_id uuid not null references leads(id) on delete cascade
- channel text not null, outcome text not null, summary text
- occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
tasks
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- lead_id uuid not null references leads(id) on delete cascade
- title text not null, description text, due_at timestamptz not null
- status task_status not null default 'pending', completed_at timestamptz
- created_at, updated_at (timestamptz, por defecto now())
policies
- id uuid primary key default gen_random_uuid()
- user_id uuid not null references auth.users(id) on delete cascade
- lead_id uuid not null references leads(id) on delete cascade
- product_name text not null, contracted_at date
- premium_amount numeric(12,2), estimated_commission numeric(12,2), confirmed_commission numeric(12,2)
- commission_status commission_status not null default 'pending'
- notes text, created_at, updated_at
Tipos controlados
- lead_status: pending_contact, no_answer, follow_up, proposal_in_progress, policy_contracted, rejected (desde la migración 20261018000100; ver "Cambios de octubre 2026").
- lead_priority: low, normal, high.
- task_status: pending, completed, cancelled.
- commission_status: pending, confirmed, paid.
- Los canales y resultados de actividad deben validarse con una lista controlada o restricciones documentadas.
RLS obligatorio
Activar RLS en todas las tablas privadas.
- Perfil: usuario puede leer/actualizar solo id = auth.uid().
- Leads: select/insert/update/delete solo cuando user_id = auth.uid().
- Actividades, tareas y pólizas: acceso solo si user_id = auth.uid() y el lead_id pertenece a ese mismo usuario. Comprobar esta relación también mediante políticas/constraints apropiadas.
- En inserts, comprobar que user_id = auth.uid().
- No confiar únicamente en filtros desde Next.js.
Índices recomendados
- leads(user_id, status)
- leads(user_id, next_follow_up_at)
- leads(user_id, received_at)
- activities(lead_id, occurred_at desc)
- tasks(user_id, status, due_at)
- policies(user_id, contracted_at)
Añadir trigger para mantener updated_at. Aplicar importaciones con validación y reportar filas fallidas; nunca ocultar resultados parciales.
Implementación (ver supabase/migrations)
- Las tablas hijas usan una FK compuesta `(lead_id, user_id) → leads(id, user_id)`: la base de datos impide vincular filas al lead de otro usuario incluso sin RLS. Las políticas, además, comprueban `owns_lead(lead_id)`.
- Canales y resultados de actividad son enums: `activity_channel` (call, whatsapp, sms, email, visit, other) y `activity_outcome` (no_answer, spoke, interested, info_requested, call_back, proposal_sent, contracted, rejected, keeps_conditions, wrong_contact, do_not_contact, other).
- Columnas derivadas en leads: `next_action` / `next_follow_up_at` (tarea pendiente más próxima), `last_contact_at` / `last_outcome` (actividad más reciente), `phone_normalized` / `email_normalized` (generadas, para duplicados) y `closed_at` (según el estado).
- `profiles.timezone` (por defecto Europe/Madrid) para los cálculos de "hoy" e informes.
- "No contactar": cancela las tareas pendientes y bloquea nuevas (trigger).
- `delete_my_account()` es la única función SECURITY DEFINER expuesta y solo borra la fila `auth.users` del propio usuario (cascada).

Cambios de octubre 2026 (migraciones 20261018000100–0400)
Fichas (leads)
- postal_code text: código postal (5 dígitos españoles o formato extranjero de 3–10 caracteres; check leads_postal_code_format). La localidad se sigue guardando en locality y siempre es editable.
- customer_reference: misma columna, ahora significa "Número de póliza" (la interfaz, la búsqueda, el CSV y los duplicados usan ese nombre).
- has_funeral_insurance boolean: ¿tiene seguro de decesos? true / false / null = sin indicar. Se rellenó desde current_policies solo con datos explícitos: alguna póliza que contiene "deceso" → true; única póliza "Ninguna"/"Ninguno"/"Sin pólizas" → false; resto → null.
- product_code text → products(code): "Producto" de la ficha (desplegable). Se rellenó desde product_to_offer cuando el texto coincide con el catálogo (sin mayúsculas, admitiendo "Seguro de …").
- legacy_status text: estado retirado que tenía la ficha antes de la migración (auditoría y aviso en la ficha).
- Columnas en desuso que NO se borran (sus datos se conservan y siguen en la exportación JSON): current_policies, product_to_offer, source.
Estados retirados (correspondencia explícita aplicada con ALTER COLUMN TYPE, sin disparar triggers, por lo que closed_at y closed_reason se conservan):
- interested → follow_up
- keeps_current_conditions → rejected
- do_not_contact → rejected (la ficha muestra un aviso destacado porque legacy_status = 'do_not_contact')
Se eliminaron el trigger/función leads_after_status_change y el bloqueo de seguimientos de "No contactar" en tasks_before_write. leads_handle_status ya no mueve closed_at al cambiar entre dos estados cerrados.
Catálogo de productos (products)
- code (pk), label, sort_order, active. Inicial: decesos, hogar, auto, vida. Lectura para authenticated; sin escritura desde la app. Añadir producto = nueva migración con INSERT; retirarlo = active = false.
- policies.product_code → products(code). Las pólizas antiguas cuyo nombre no coincide (p. ej. "test") quedan con product_code null y se muestran como "fuera de catálogo"; al editarlas se pide elegir un producto del catálogo.
Comisión calculada
- commission_rules (user_id, product_code nullable = regla general, rate_percent numeric(5,2) 0–100, único por usuario y producto con NULLS NOT DISTINCT). RLS por usuario. No hay porcentajes por defecto.
- policies.policy_value numeric(12,2) ("Valor de póliza"), commission_rate y calculated_commission (derivados).
- Trigger policies_calculate_commission: al insertar o cambiar policy_value/product_code, calculated_commission = round(policy_value × rate / 100, 2) con la regla del producto o, si no hay, la general. Sin valor o sin regla → null (la interfaz lo indica). No se puede fijar a mano. Cambiar una regla no recalcula pólizas ya calculadas; recalculate_missing_commissions() completa las que tenían valor pero no comisión.
- estimated_commission se conserva como dato histórico (solo lectura en la interfaz).
Avisos por email
- notification_preferences (user_id pk, email_enabled false por defecto, notify_upcoming, upcoming_hours 1–168, notify_overdue). RLS: select/insert/update propios.
- notification_log (task_id, kind 'upcoming'|'overdue', due_at, status 'sending'|'sent'|'failed', attempts, provider_message_id, error). Única (task_id, kind, due_at) = idempotencia. Los usuarios solo pueden leer sus filas; escribe la tarea programada con service_role.
RPC
- get_dashboard_summary: pendientes actuales (pending_contact, proposals, open_without_next_action, follow_ups_today, follow_ups_overdue —de cualquier mes—) + métricas del periodo (leads_received, policies_contracted, rejected, policy_value_total, calculated_commission, policies_without_commission, confirmed_commission, paid_commission).
- get_report: p_product es un código del catálogo (fichas por leads.product_code, pólizas por policies.product_code).
- get_results_series sin keeps_conditions. import_leads con postal_code, has_funeral_insurance y product_code. get_product_options eliminada.
