Arquitectura prevista
Stack
- Next.js App Router + React + TypeScript estricto.
- Tailwind CSS y shadcn/ui.
- Supabase: PostgreSQL, Auth y RLS.
- @supabase/ssr para sesiones mediante cookies en servidor y navegador.
- Zod + React Hook Form para validación y formularios.
- TanStack Table para tablas complejas cuando aporte valor.
- Recharts para gráficos del dashboard.
- Vitest para pruebas unitarias y Playwright para flujos e2e.
- Vercel como destino previsto de despliegue.
El stack es una decisión inicial, no una orden para reemplazar una base de código ya existente. Inspecciona package.json, convenciones, rutas y configuración antes de tocar dependencias.
Organización orientativa
Respeta primero la estructura existente. Si no existe una convención, agrupa por dominio, por ejemplo:
- app/: rutas y layouts.
- components/: componentes compartidos y de interfaz.
- features/leads/, features/tasks/, features/policies/: lógica de dominio y componentes específicos.
- lib/supabase/: clientes SSR/browser y helpers de sesión.
- lib/validation/: esquemas Zod.
- types/: tipos generados de Supabase.
- supabase/migrations/: SQL versionado.
Reglas de ejecución
- Server Components primero; componentes cliente únicamente para estado/interacción del navegador.
- Las lecturas y mutaciones deben usar la sesión del usuario y respetar RLS.
- Validar autorización en servidor; no depender de ocultar botones o rutas.
- No usar service_role en código cliente. Mantener secretos fuera del repositorio.
- Generar tipos TypeScript desde el esquema de Supabase cuando sea posible y mantenerlos sincronizados.
- Usar migraciones reproducibles; evitar cambios manuales no registrados en SQL.
- Errores comprensibles para el usuario y logs sin información personal innecesaria.
Variables de entorno
Documentar en .env.example y nunca añadir credenciales reales:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY (o la publishable key equivalente de la configuración usada)
La clave service_role, si alguna tarea administrativa futura la requiere, debe ser exclusivamente de servidor y fuera de la sesión normal de usuario.
Desde octubre 2026 la usa SOLO la tarea programada de avisos (src/lib/supabase/admin.ts, "server-only", variable SUPABASE_SERVICE_ROLE_KEY sin prefijo NEXT_PUBLIC_), invocada por /api/cron/notifications con CRON_SECRET. Ninguna petición de usuario usa ese cliente.
Otras variables de servidor: RESEND_API_KEY, NOTIFICATIONS_FROM_EMAIL, CRON_SECRET y, opcional, POSTAL_CODE_LOOKUP_URL (ver .env.example y README).
Decisiones de implementación (octubre 2026)
- Next.js 16.4 con Cache Components y Partial Prefetching (valores por defecto del scaffold). Todo dato privado se lee tras `connection()` en `lib/supabase/server.ts`, así nunca entra en el shell estático. Los hooks de URL (`usePathname`) van dentro de `<Suspense>`.
- `src/proxy.ts` (antes middleware) refresca la sesión con `getClaims()` y hace redirecciones optimistas. La autorización real está en `lib/auth.ts` (DAL), en cada Server Action y en RLS.
- Estructura por dominio en `src/features/<dominio>/{actions,queries,constants,components}`. Esquemas Zod en `src/lib/validation`, compartidos por cliente y servidor (las acciones reciben los valores "en bruto" del formulario y vuelven a validar).
- Fechas: el servidor convierte los `datetime-local` usando la zona horaria del perfil (`profiles.timezone`).
- La lista de fichas no usa TanStack Table: filtra, ordena y pagina en servidor mediante parámetros de URL.
- Operaciones multi-tabla atómicas mediante RPC `security invoker` (`log_activity`, `import_leads`).
- Pruebas de base de datos con PGlite y un stub de `auth` (`tests/db`); RLS verificada además contra Supabase real (`tests/integration`).
- Catálogo de productos en la tabla `products` (fuente única); `src/features/products/catalog.ts` solo contiene utilidades.
- Comisión calculada en la base de datos (trigger, numeric); `src/features/commissions/calc.ts` replica el cálculo en céntimos (BigInt) para la vista previa.
- Códigos postales: `/api/postal-codes/[cp]` (con sesión) consulta Zippopotam.us (datos GeoNames) con 4 s de timeout. Dependencia externa sin SLA: si falla, la localidad se escribe a mano.
- Calendario (`/calendar`) sobre la tabla `tasks` existente; sin tabla paralela.
- Avisos por email con la API REST de Resend (fetch, sin SDK) desde una Route Handler programada (Vercel Cron, vercel.json). Idempotencia con `notification_log`.
Interfaz y sistema de diseño (noviembre 2026)
- Tema oscuro único (clase `dark` en `<html>`): grafito con degradados ambientales, superficies translúcidas, bordes finos y acento verde lima. Tokens en `src/app/globals.css` (`--background`, `--surface*`, `--brand`, `--radius-card`, `--radius-control`…); los nombres de shadcn (`--primary`, `--card`…) apuntan a ellos. Fuente Manrope (`next/font`).
- Utilidades `.surface` / `.surface-inset` para tarjetas y paneles; controles en forma de píldora (`components/shared/segmented.tsx`), métricas de cabecera (`metric.tsx`) y avatar con iniciales (`initials-avatar.tsx`).
- Estructura: cabecera con marca, navegación principal en cápsula centrada (`NAV_ITEMS`) y perfil; barra lateral estrecha de iconos con accesos secundarios (`ACTION_ITEMS`: nueva ficha, importar, exportar; ajustes). En móvil (< lg): barra inferior flotante y los accesos secundarios en el menú de perfil.
- Fichas: vista de tarjetas (por defecto) o tabla mediante el parámetro de URL `layout=grid|table`; en móvil siempre tarjetas. Métricas de cabecera reales (`getLeadsOverview`).
- Se respeta `prefers-reduced-motion`; transiciones de 150–220 ms.
Escaneo de fichas (noviembre 2026)
- «Escanear documento» en Nueva ficha: OCR en el navegador con tesseract.js (idioma `spa`). La imagen no se envía a ningún servidor; la primera vez el navegador descarga el motor y el modelo de idioma desde jsDelivr/tessdata (CDN públicos, sin datos del usuario).
- `src/features/scan/extract.ts` (función pura con pruebas) deduce nombre, teléfono, email, código postal, localidad, número de póliza, seguro de decesos y producto. Solo devuelve valores que pasan las validaciones del formulario y no inventa lo que no reconoce (p. ej. el nombre solo se toma si está etiquetado).
- Los datos rellenan el formulario para revisarlos; la ficha se crea con «Crear ficha» (misma validación Zod en cliente y servidor, mismos avisos). Solo imágenes; los PDF se capturan como imagen.
