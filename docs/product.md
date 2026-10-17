Producto y alcance
Usuario y problema
Un comercial recibe fichas de clientes actuales y los contacta por llamada o mensaje para ofrecer pólizas adicionales. Necesita controlar a quién ha contactado, qué respondió cada cliente, a quién debe volver a llamar, qué operaciones cerró y qué comisión le corresponde.
Objetivo del MVP
Que el comercial pueda gestionar su trabajo diario sin perder seguimientos y revisar sus resultados. Es un CRM enfocado en este flujo, no un CRM generalista.
Flujo principal
1. Recibe o importa una ficha.
2. Revisa los datos y el producto que ofrecerá.
3. Llama, escribe o visita al cliente.
4. Registra canal, resultado y resumen.
5. Actualiza el estado y agenda la próxima acción cuando proceda.
6. Cierra como póliza contratada, rechazo, mantenimiento de condiciones u otro estado definido.
7. Si se contrata, registra manualmente póliza y comisión.
Funciones MVP
- Cuenta personal, registro, login, logout, recuperación/restablecimiento de contraseña y verificación de email según configuración de Supabase.
- Panel con fichas por estado, tareas de hoy/vencidas, pólizas y comisiones del periodo.
- CRUD y archivo de leads, búsqueda y filtros.
- Registro cronológico de llamadas, WhatsApp, SMS, email, visita u otro contacto.
- Tareas de seguimiento pendientes, completadas o canceladas.
- Registro manual de pólizas y comisiones.
- Importación CSV con previsualización, validación y aviso de duplicados.
- Informes básicos por fechas y producto, exportables a CSV.
Estados de lead
pending_contact, no_answer, follow_up, interested, proposal_in_progress, policy_contracted, rejected, keeps_current_conditions, do_not_contact.
“Rechazado” y “mantiene las condiciones actuales” son resultados distintos. Las fichas abiertas deben tener próxima acción/fecha o indicación explícita de que no requieren seguimiento.
Fuera del MVP
- Envío automático de WhatsApp, SMS o email.
- Integración con sistemas internos de aseguradoras.
- Cálculo automático de comisiones sin una regla proporcionada.
- Grabación o transcripción de llamadas.
- Gestión avanzada de equipos, supervisores y reparto automático.
Privacidad
Guardar solo los datos necesarios para gestionar el contacto. Evitar documentos de identidad, datos bancarios y otros datos sensibles innecesarios. Incluir opciones para exportar y eliminar datos y no afirmar afiliación con Ocaso ni otra compañía.