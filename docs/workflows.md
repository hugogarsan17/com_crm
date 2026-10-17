Flujos y criterios de aceptación
Registrar una llamada o mensaje
1. Abrir la ficha del lead.
2. Registrar canal, fecha/hora, resultado y resumen breve.
3. Actualizar estado si corresponde.
4. Crear siguiente tarea con fecha cuando haya que volver a contactar.
5. Guardar actividad y tarea vinculadas al mismo lead y usuario.
Los resultados típicos incluyen: no contesta, hablar con el cliente, interesado, solicita información, volver a llamar, rechaza. Diferenciar resultado de actividad y estado general del lead.
Cerrar gestión
- Contratada: registrar una o varias pólizas y comisión manual (estimada/confirmada/pagada).
- Rechazada: guardar motivo opcional y fecha de cierre.
- Mantiene condiciones: estado separado, guardar notas y cerrar o programar revisión según decida el comercial.
- No contactar: impedir que aparezca como tarea de contacto activa y destacar claramente el estado.
Bandeja diaria
La vista principal debe mostrar para hoy y vencidos, además de pendientes de primer contacto. Cada fila: nombre, teléfono, producto, estado, último resultado, próxima acción y fecha. Permitir acceso directo a la ficha y acciones rápidas en móvil.
Importar CSV
- Vista previa y mapeo de columnas.
- Validar campos y normalizar email/teléfono para cotejo.
- Avisar de duplicados por teléfono, email o referencia; dejar al usuario decidir qué hacer.
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