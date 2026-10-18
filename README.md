# Cartera CRM

CRM SaaS para comerciales de seguros. Permite gestionar las fichas de clientes recibidas, registrar llamadas y mensajes, programar seguimientos en un calendario y controlar pólizas contratadas y comisiones (calculadas con el porcentaje que configura cada comercial).

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
| Para hoy (`/dashboard`) | «Pendientes ahora» (vencidos de cualquier mes, hoy, primer contacto, propuestas, sin próxima acción) y «Resultados del mes» (mes en curso por defecto, flechas para meses anteriores y otros periodos): pólizas, rechazos, fichas recibidas, valor de pólizas, comisión calculada, confirmada y pagada, y gráfico |
| Calendario (`/calendar`) | Seguimientos por día, semana o mes; crear (vinculado a una ficha), editar, completar, cancelar, reprogramar y eliminar; abrir la ficha desde la tarea |
| Fichas (`/leads`) | Búsqueda por nombre, teléfono, email o número de póliza; filtros por estado, prioridad, producto, seguro de decesos y fechas; ordenación; paginación en servidor; archivar y restaurar; eliminación definitiva con confirmación; exportación CSV |
| Ficha (`/leads/[id]`) | Código postal con localidad automática, número de póliza, seguro de decesos (sí/no/sin indicar), producto del catálogo, estado, próximo seguimiento, historial, tareas, pólizas y comisiones; botones de llamar, WhatsApp y email (los abre el usuario, nunca se envía nada automáticamente); cierre como contratada o rechazada |
| Registrar contacto | Canal, resultado, resumen, nuevo estado (sugerido según el resultado) y seguimiento opcional, todo en una única transacción (`log_activity`) |
| Seguimientos (`/tasks`) | Pestañas Hoy, Vencidas, Próximas, Completadas y Canceladas; completar, posponer (rápido o a una fecha), cancelar, reabrir y abrir la ficha |
| Pólizas | Producto (desplegable del catálogo), fecha, prima, valor de póliza y comisión calculada automáticamente; comisión confirmada manual; estado pendiente, confirmada o pagada |
| Informes (`/reports`) | Por periodo (incluido un mes concreto) y producto: recibidas, contactadas, con respuesta, pólizas, rechazos, conversión, primas, valor de pólizas y comisiones; desglose por producto; exportación CSV |
| Importación CSV (`/leads/import`) | Carga en el navegador, codificación, asignación de columnas (incluye código postal, número de póliza, seguro de decesos y producto del catálogo), validación por fila, duplicados (teléfono, email o número de póliza), resumen, lotes atómicos y reintento solo de los lotes fallidos |
| Ajustes | Nombre, zona horaria, cambio de contraseña, porcentajes de comisión, avisos por email, exportación de todos los datos (JSON) y eliminación de la cuenta |

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
| `RESEND_API_KEY` | Solo para avisos | Resend → API Keys. Solo servidor |
| `NOTIFICATIONS_FROM_EMAIL` | Solo para avisos | Remitente con dominio verificado en Resend, p. ej. `Cartera CRM <avisos@tu-dominio.com>` |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo para avisos | Supabase → Project Settings → API Keys (service_role o secret key). Solo servidor |
| `CRON_SECRET` | Solo para avisos | Cadena aleatoria (`openssl rand -hex 32`). Vercel Cron la envía como `Authorization: Bearer …` |
| `POSTAL_CODE_LOOKUP_URL` | No | Servicio alternativo de códigos postales (por defecto `https://api.zippopotam.us/es`) |

- En desarrollo van en `.env.local` (o `.env`). Están ignorados por git; solo se versiona `.env.example`.
- En Vercel van en Project → Settings → Environment Variables, para Production y Preview.
- La clave `service_role` solo la usa la tarea programada de avisos (`/api/cron/notifications`, código `server-only`). Nunca debe llevar el prefijo `NEXT_PUBLIC_`.

## Base de datos (migraciones)

Las migraciones están en `supabase/migrations/` y se aplican en orden:

1. `20261017000100_initial_schema.sql`: enums, tablas, restricciones, índices y triggers (`updated_at`, creación de perfil, `closed_at`, próxima acción y último contacto derivados, bloqueo de seguimientos para "No contactar").
2. `20261017000200_rls_policies.sql`: RLS en todas las tablas, permisos mínimos y políticas por usuario. En las tablas hijas también se comprueba que el lead sea del mismo usuario.
3. `20261017000300_rpc_functions.sql`: `log_activity`, `get_dashboard_summary`, `get_report`, `get_results_series`, `get_product_options`, `find_lead_duplicates`, `import_leads` y `delete_my_account`.
4. `20261017000400_hardening.sql`: retira `EXECUTE` de las funciones de trigger e índices para las FK compuestas.
5. `20261018000100_lead_fields_and_statuses.sql`: código postal, seguro de decesos, número de póliza (etiqueta), retirada de los estados «Interesado», «Mantiene condiciones» y «No contactar» con correspondencia explícita (ver `docs/database.md`).
6. `20261018000200_products_and_commissions.sql`: catálogo `products`, `leads.product_code`, `policies.product_code`, valor de póliza, reglas de comisión y trigger de cálculo.
7. `20261018000300_notifications.sql`: preferencias y registro de avisos por email.
8. `20261018000400_rpc_v2.sql`: panel (pendientes + métricas del periodo), informe por producto del catálogo, serie, importación y `log_activity` con los nuevos tipos.

> Aplica las migraciones **antes** de desplegar este código: la app nueva consulta columnas y tablas que no existen en el esquema anterior.

**Opción A: Supabase CLI** (recomendada)

```bash
npx supabase login
npx supabase link --project-ref <id-del-proyecto>
npx supabase db push
```

**Opción B: SQL Editor del dashboard**: ejecuta los archivos en orden.

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

## Comisiones

La app **no trae ningún porcentaje**. Cada comercial lo configura en **Ajustes → Comisiones**: uno general y, si hace falta, uno por producto (tiene prioridad). Comisión calculada = valor de póliza × porcentaje / 100, redondeada a céntimos en la base de datos. Sin porcentaje o sin valor, la póliza queda «sin calcular» y se indica en la ficha, el panel y los informes. Tras configurar el primer porcentaje, «Calcular pólizas sin comisión» completa las existentes. Cambiar un porcentaje no modifica comisiones ya calculadas.

## Catálogo de productos

Tabla `products` (Decesos, Hogar, Auto, Vida). Para añadir uno, crea una migración nueva:

```sql
insert into public.products (code, label, sort_order) values ('salud', 'Salud', 50);
```

Para retirarlo sin perder histórico: `update public.products set active = false where code = '…';`.

## Código postal → localidad

Al escribir un código postal español en la ficha, el servidor consulta [Zippopotam.us](https://zippopotam.us) (datos de GeoNames, gratuito y sin clave) y rellena la localidad si está vacía o conserva el último valor automático. Limitaciones: es un servicio externo sin garantía de disponibilidad, algunos códigos rurales devuelven varias localidades (se ofrece la lista) y los nombres pueden no coincidir con el nombre oficial del INE. Si falla, la localidad se escribe a mano. Los códigos extranjeros se aceptan sin consulta.

## Avisos por email

1. Crea una cuenta en Resend, verifica tu dominio y crea una API key.
2. En Vercel → Settings → Environment Variables (Production): `RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` y `NEXT_PUBLIC_SITE_URL`.
3. `vercel.json` programa `/api/cron/notifications` cada día a las 06:00 UTC (compatible con el plan Hobby). Con el plan Pro puedes aumentar la frecuencia (p. ej. `0 * * * *`). Alternativa: `pg_cron` + `pg_net` en Supabase llamando al endpoint con la cabecera `Authorization: Bearer <CRON_SECRET>`.
4. Cada comercial activa los avisos en **Ajustes → Avisos por email** y puede enviarse un email de prueba.

Funcionamiento: un email resumen por usuario con los seguimientos vencidos y/o próximos. Cada aviso (tarea + tipo + vencimiento) se registra en `notification_log` con una restricción única, así que no se repite; si se reprograma la tarea, puede volver a avisarse. Los fallos quedan registrados y se reintentan hasta 3 veces. Si falta configuración, el endpoint responde 503 con los nombres de las variables que faltan y no marca nada como enviado; la app sigue funcionando y Ajustes muestra las instrucciones. Prueba manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-app.vercel.app/api/cron/notifications`.

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
- **Comisiones**: se calculan solo con el porcentaje configurado por el comercial; "Confirmada" y "Pagada" exigen un importe confirmado introducido a mano.
- **Estados retirados**: «Interesado» pasó a «En seguimiento»; «Mantiene condiciones» y «No contactar» pasaron a «Rechazado» (se guarda el estado original en `legacy_status` y la ficha avisa si el cliente pidió no ser contactado).
- **TanStack Table** no se usa: la lista de fichas filtra, ordena y pagina en servidor (URL compartible, sin el límite de 1.000 filas de la API), lo que encaja mejor que una tabla en cliente.
- **Registro E2E**: el alta real de usuarios no se prueba automáticamente porque enviaría emails (el SMTP integrado de Supabase solo envía al equipo). Se prueban la validación del formulario y el login, el logout y la protección de rutas.
- **Tema oscuro**: la interfaz es solo clara.
- **Recordatorios**: emails opcionales al propio comercial (ver «Avisos por email»); no hay notificaciones push.
# com_crm
