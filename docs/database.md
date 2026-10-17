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
- lead_status: pending_contact, no_answer, follow_up, interested, proposal_in_progress, policy_contracted, rejected, keeps_current_conditions, do_not_contact.
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
