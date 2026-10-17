# Cartera CRM

CRM SaaS para comerciales de seguros. Permite gestionar las fichas de clientes recibidas, registrar llamadas y mensajes, programar seguimientos y controlar pólizas contratadas y comisiones (introducidas manualmente).

> Herramienta independiente. No está afiliada a ninguna compañía aseguradora.

## Stack

- **Next.js 16** (App Router, Cache Components, `proxy.ts`), **React 19**, **TypeScript estricto**
- **Tailwind CSS 4** + **shadcn/ui** (Radix)
- **Supabase**: PostgreSQL, Auth y Row Level Security, con `@supabase/ssr` (sesión en cookies)
- **React Hook Form** + **Zod 4** (los mismos esquemas validan en cliente y en servidor)
- **Recharts** (gráfico del panel), **PapaParse** (importación CSV)
- **Vitest** (unitarias y base de datos con PGlite) y **Playwright** (E2E)
- Despliegue en **Vercel**

## Funcionalidades

| Área | Qué incluye |
|---|---|
| Autenticación | Registro (nombre, email, contraseña), login, logout, recuperación y restablecimiento de contraseña, confirmación de email, reenvío de confirmación y mensajes de error en español |
| Para hoy (`/dashboard`) | Seguimientos vencidos y de hoy, fichas pendientes de primer contacto, interesados, fichas abiertas sin próxima acción, resultados del periodo (pólizas, rechazos, mantienen condiciones, comisiones estimada, confirmada y pagada) y gráfico de evolución |
| Fichas (`/leads`) | Búsqueda por nombre, teléfono, email o referencia; filtros por estado, prioridad, producto y fechas; ordenación; paginación en servidor; archivar y restaurar; eliminación definitiva con confirmación; exportación CSV |
| Ficha (`/leads/[id]`) | Datos, estado, próximo seguimiento, historial cronológico, tareas, pólizas y comisiones; botones de llamar, WhatsApp y email (los abre el usuario, nunca se envía nada automáticamente); cierre como contratada, rechazada, mantiene condiciones o no contactar |
| Registrar contacto | Canal, resultado, resumen, nuevo estado (sugerido según el resultado) y seguimiento opcional, todo en una única transacción (`log_activity`) |
| Seguimientos (`/tasks`) | Pestañas Hoy, Vencidas, Próximas, Completadas y Canceladas; completar, posponer (rápido o a una fecha), cancelar, reabrir y abrir la ficha |
| Pólizas | Producto, fecha, prima y comisiones estimada y confirmada; estado pendiente, confirmada o pagada. Sin cálculo automático |
| Informes (`/reports`) | Por periodo y producto: recibidas, contactadas, con respuesta, pólizas, rechazos, mantienen condiciones, conversión, primas y comisiones; desglose por producto; exportación CSV |
| Importación CSV (`/leads/import`) | Carga en el navegador, codificación, asignación de columnas, validación por fila, duplicados (teléfono, email o referencia, contra tus fichas y dentro del archivo), resumen, lotes atómicos y reintento solo de los lotes fallidos |
| Ajustes | Nombre, zona horaria, exportación de todos los datos (JSON) y eliminación de la cuenta |

## Estructura

```
src/
  app/                    Rutas (App Router)
    (auth)/               login, register, forgot-password, reset-password
    (app)/                Rutas privadas con navegación: dashboard, leads, tasks, reports, settings
    auth/confirm          Destino de los enlaces de email (token_hash o code PKCE)
    api/export/*          Exportaciones CSV/JSON (exigen sesión)
  proxy.ts                Refresco de sesión y redirecciones (antes "middleware")
  features/<dominio>/     Lógica por dominio: actions.ts (Server Actions), queries.ts (lecturas
                          server-only), constants.ts y components/ (UI)
  lib/
    supabase/             Clientes de servidor, navegador y proxy (@supabase/ssr)
    validation/           Esquemas Zod compartidos cliente/servidor
    auth.ts               Data Access Layer: sesión validada en servidor
  types/database.types.ts Tipos de la base de datos (formato supabase gen types)
supabase/
  migrations/             SQL versionado (esquema, RLS, RPC, hardening)
  templates/              Plantillas de email recomendadas
tests/
  db/                     Migraciones + RLS + triggers sobre PGlite (Postgres en WASM)
  integration/            RLS contra un proyecto Supabase real
  e2e/                    Playwright
docs/                     Producto, arquitectura, modelo de datos y flujos
```

## Puesta en marcha local

Requisitos: Node.js 20.9 o superior (probado con Node 24) y un proyecto de Supabase.

```bash
npm install
cp .env.example .env.local      # y rellena las variables (ver más abajo)
npm run dev                     # http://localhost:3000
```

### Variables de entorno

| Variable | Obligatoria | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí (una de las dos) | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SITE_URL` | No | URL pública de la app, para los enlaces de los emails. Si falta, se deduce de la petición |

- En desarrollo van en `.env.local` (o `.env`). Están ignorados por git; solo se versiona `.env.example`.
- En Vercel van en Project → Settings → Environment Variables, para Production y Preview.
- La clave `service_role` **no** se usa en ninguna parte y no debe añadirse.

## Base de datos (migraciones)

Las migraciones están en `supabase/migrations/` y se aplican en orden:

1. `20261017000100_initial_schema.sql`: enums, tablas, restricciones, índices y triggers (`updated_at`, creación de perfil, `closed_at`, próxima acción y último contacto derivados, bloqueo de seguimientos para "No contactar").
2. `20261017000200_rls_policies.sql`: RLS en todas las tablas, permisos mínimos y políticas por usuario. En las tablas hijas también se comprueba que el lead sea del mismo usuario.
3. `20261017000300_rpc_functions.sql`: `log_activity`, `get_dashboard_summary`, `get_report`, `get_results_series`, `get_product_options`, `find_lead_duplicates`, `import_leads` y `delete_my_account`.
4. `20261017000400_hardening.sql`: retira `EXECUTE` de las funciones de trigger e índices para las FK compuestas.

**Opción A: Supabase CLI** (recomendada)

```bash
npx supabase login
npx supabase link --project-ref <id-del-proyecto>
npx supabase db push
```

**Opción B: SQL Editor del dashboard**: ejecuta los cuatro archivos en orden.

Tras cambiar el esquema, regenera los tipos:

```bash
npx supabase gen types typescript --project-id <id> --schema public > src/types/database.types.ts
```

## Autenticación: configuración en Supabase

En **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` en desarrollo y tu dominio de producción (por ejemplo `https://tu-app.vercel.app`) en producción.
- **Redirect URLs**: añade `http://localhost:3000/auth/confirm`, `https://tu-app.vercel.app/auth/confirm` y, para los previews de Vercel, `https://*-<tu-equipo>.vercel.app/auth/confirm`.

En **Authentication → Emails → Templates** (recomendado, porque el enlace funciona aunque se abra en otro navegador o dispositivo):

- *Confirm signup*: usa `supabase/templates/confirmation.html`.
- *Reset password*: usa `supabase/templates/recovery.html`.

Con las plantillas por defecto, la app también funciona (flujo PKCE con `?code=`), pero el enlace debe abrirse en el mismo navegador donde se pidió.

Otros ajustes:

- **Confirm email**: la app funciona con la confirmación activada o desactivada.
- **SMTP propio**: el SMTP integrado de Supabase solo envía a direcciones del equipo del proyecto y con un límite muy bajo. Para usuarios reales configura un SMTP en Authentication → Emails → SMTP Settings.
- **Leaked password protection**: actívala en Authentication → Policies (los advisors de Supabase lo recomiendan).
- La longitud mínima de contraseña de la app es 8, con letras y números. Si exiges más en Supabase, la app mostrará el error de "contraseña débil".

## Despliegue en Vercel

1. Sube el repositorio a GitHub, GitLab o Bitbucket e impórtalo en Vercel (framework detectado: Next.js).
2. Añade las variables de entorno de la tabla anterior.
3. Despliega. Después actualiza en Supabase la **Site URL** y las **Redirect URLs** con el dominio de Vercel.
4. Comprueba registro, confirmación de email, login y recuperación de contraseña en producción.

## Pruebas y comprobaciones

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint (configuración de Next.js) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest: unitarias (validaciones, fechas y zonas horarias, CSV, informes) y base de datos sobre PGlite (migraciones, RLS entre dos usuarios, FK compuestas, triggers, RPC) |
| `npm run test:integration` | RLS contra el proyecto Supabase real con dos usuarios de prueba (necesita `.env` y `.env.test.local`) |
| `npm run test:e2e` | Playwright: construye la app y la arranca en el puerto 3100. Sin credenciales solo se ejecutan las pruebas públicas |
| `npm run check` | lint + typecheck + test + build |

Para las pruebas con sesión, crea `.env.test.local` (ignorado por git) con dos usuarios **de prueba** ya confirmados:

```
E2E_USER_A_EMAIL=...
E2E_USER_A_PASSWORD=...
E2E_USER_B_EMAIL=...
E2E_USER_B_PASSWORD=...
```

Las pruebas E2E crean y borran sus propias fichas. No las ejecutes contra un proyecto con datos reales de clientes.

## Decisiones y limitaciones conocidas

- **Zona horaria**: "hoy", los vencimientos y los informes se calculan en la zona horaria del perfil (por defecto `Europe/Madrid`, configurable en Ajustes). Los campos de fecha y hora se interpretan en esa zona.
- **Próxima acción**: `leads.next_follow_up_at` y `next_action` se derivan de la tarea pendiente más próxima (trigger). No se editan a mano; se gestionan con seguimientos.
- **Importación**: hasta 5.000 filas por archivo, en lotes de 500. Cada lote es atómico (todo o nada); si uno falla se informa y se pueden reintentar solo esas filas. Entre lotes no hay atomicidad global.
- **Comisiones**: nunca se calculan. "Confirmada" y "Pagada" exigen un importe confirmado.
- **TanStack Table** no se usa: la lista de fichas filtra, ordena y pagina en servidor (URL compartible, sin el límite de 1.000 filas de la API), lo que encaja mejor que una tabla en cliente.
- **Registro E2E**: el alta real de usuarios no se prueba automáticamente porque enviaría emails (el SMTP integrado de Supabase solo envía al equipo). Se prueban la validación del formulario y el login, el logout y la protección de rutas.
- **Tema oscuro**: la interfaz es solo clara.
- **Recordatorios**: no hay notificaciones push ni emails de recordatorio. La bandeja "Para hoy" es el punto de control diario.
# com_crm
