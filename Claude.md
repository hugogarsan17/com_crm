Contexto del proyecto
CRM SaaS para que un comercial de seguros gestione clientes asignados, llamadas, seguimientos, pólizas vendidas y comisiones.
Antes de trabajar
- Lee docs/product.md para entender usuario, objetivo y alcance.
- Lee docs/architecture.md antes de cambiar estructura o tecnología.
- Lee docs/database.md antes de tocar Supabase, SQL, RLS o tipos.
- Lee docs/workflows.md antes de modificar flujos funcionales.
- Inspecciona el repositorio y respeta sus convenciones. No asumas que estos archivos describen código ya implementado.
Stack previsto
Next.js App Router, React, TypeScript estricto, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth + RLS), Zod y React Hook Form. Despliegue previsto en Vercel. Adapta al repositorio existente antes de instalar o sustituir tecnologías.
Reglas de desarrollo
- Implementa funcionalidades completas conectadas a la base de datos; no entregues solo pantallas simuladas.
- Usa Server Components por defecto. Usa componentes de cliente solo para interacción que lo requiera.
- Protege datos tanto en servidor como con RLS. Nunca expongas service_role al navegador.
- Valida entradas con Zod en cliente y servidor. Maneja errores, carga y estados vacíos.
- Mantén los datos de cada usuario aislados. No uses datos personales reales en demostraciones.
- No inventes reglas de comisión ni envíes mensajes automáticos a clientes.
- Ejecuta las comprobaciones relevantes (lint, typecheck, pruebas, build) y corrige fallos atribuibles al cambio.
- Actualiza la documentación si cambias decisiones de arquitectura, esquema o comportamiento.
Producto en una frase
Cada lead abierto debe tener una próxima acción y fecha, o estar explícitamente marcado como que no requiere seguimiento.