Flujos y criterios de aceptación
Registrar una llamada o mensaje
1. Abrir la ficha del lead.
2. Registrar canal, fecha/hora, resultado y resumen breve.
3. Actualizar estado si corresponde.
4. Crear siguiente tarea con fecha cuando haya que volver a contactar.
5. Guardar actividad y tarea vinculadas al mismo lead y usuario.
Los resultados típicos incluyen: no contesta, hablar con el cliente, interesado, solicita información, volver a llamar, rechaza. Diferenciar resultado de actividad y estado general del lead.
Cerrar gestión
- Contratada: registrar una o varias pólizas (producto del catálogo y valor de póliza). La comisión se calcula con la regla configurada en Ajustes → Comisiones; si falta la regla o el valor, se indica y no se inventa. La comisión confirmada/pagada se introduce a mano.
- Rechazada: guardar motivo opcional y fecha de cierre (incluye los antiguos "Mantiene condiciones" y "No contactar"; las fichas que eran "No contactar" muestran un aviso destacado).
Bandeja diaria
La vista principal debe mostrar para hoy y vencidos (de cualquier mes), además de pendientes de primer contacto. Las métricas de resultados son del mes en curso por defecto, con navegación a meses anteriores; nunca se borran datos al cambiar de mes.
Calendario
- Vista por día, semana y mes en la zona horaria del perfil. Crear, editar (incluida la ficha vinculada), completar, cancelar, reprogramar y eliminar tareas; cada tarea pertenece a una ficha y desde ella se abre la ficha. Las tareas son las mismas que las de "Seguimientos" y "Para hoy".
Ficha: código postal
- Al escribir un código postal español se consulta la localidad y se rellena si el campo está vacío o conserva el último valor automático; si el servicio falla o no la encuentra, se escribe a mano. Los códigos extranjeros se aceptan sin consulta.
Avisos por email
- Cada comercial los activa en Ajustes (vencidos y/o próximos con N horas de antelación). Una tarea programada diaria envía un resumen al propio comercial; cada aviso (tarea, tipo, vencimiento) se envía una sola vez. Cada fila: nombre, teléfono, producto, estado, último resultado, próxima acción y fecha. Permitir acceso directo a la ficha y acciones rápidas en móvil.
Importar CSV
- Vista previa y mapeo de columnas.
- Validar campos y normalizar email/teléfono para cotejo.
- Avisar de duplicados por teléfono, email o número de póliza; dejar al usuario decidir qué hacer.
- Columnas reconocidas: nombre, teléfono, email, código postal, localidad, número de póliza (también "Referencia"), seguro de decesos (sí/no/vacío = sin indicar), producto (debe coincidir con el catálogo), prioridad, notas y fecha de recepción.
- Mostrar filas válidas y rechazadas con causa antes de confirmar.
- Importar con la sesión normal y RLS; informar éxitos y fallos de forma explícita.
Pruebas de aceptación
1. Registro, confirmación de email cuando aplique, login, logout y recuperación de contraseña.
2. Rutas privadas redirigen a usuarios sin sesión.
3. Dos usuarios no pueden consultar, editar ni borrar datos del otro (verificar RLS, no solo UI).
4. Crear/editar/buscar/archivar lead.
5. Registrar actividad y verla en orden cronológico.
6. Crear, posponer, completar y cancelar seguimiento.
7. Cerrar lead como contratado, rechazado o mantiene condiciones.
8. Registrar y resumir comisiones sin cálculo inventado.
9. Panel e informes reflejan datos reales y solo del usuario.
10. Importación informa duplicados y errores.
Al terminar un cambio
Ejecutar comprobaciones disponibles y pertinentes: lint, typecheck, pruebas y build. Documentar migraciones/env necesarias y no declarar implementado lo que no se haya probado.