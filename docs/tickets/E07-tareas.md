# E07 · Tareas

> Spec: `docs/specs/07-tareas.md` · Rango: HOG-350 – HOG-399 · Fase: 2
> Recordatorios: E07 implementa `TaskRemindersProvider` para el `ReminderScheduler` de HOG-601 (spec 12 §3.4). Expone `TasksService.findAll`/`create` (E14).

---

### HOG-350 · Implementar las utilidades de recurrencia, vencimiento y rotación en shared

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/07-tareas.md#fechas-de-vencimiento` (RN-07-03 a RN-07-10, RN-07-15)

**Descripción**
Funciones puras que fijan cómo se repiten, vencen, se agrupan y rotan las tareas. Son la base de la API y de la web y deben cumplir al pie de la letra la tabla de ejemplos de la spec.

**Criterios de aceptación**
- [ ] `buildRrule(spec)` produce la forma canónica de RN-07-03 y `parseRrule(rrule)` devuelve el `RecurrenceSpec` o `null` si la RRULE está fuera del subconjunto; son inversas exactas.
- [ ] `describeRecurrence(spec | null)` devuelve los textos de RN-07-04 ("Una vez" para `null`).
- [ ] `firstOccurrence(spec | null, startDate, dueTime, tz)` cumple RN-07-06 y devuelve `{ nextDueAt: Date | null, allDay: boolean }`.
- [ ] `nextOccurrence(rrule, closedDueAt, dueTime, now, tz)` cumple RN-07-07 (candidata con `dtstart = D` + regla de no acumulación) y **todas las filas de RN-07-08**.
- [ ] `isOverdue(task, now, tz)` (RN-07-09), `bucketTasks(tasks, now, tz)` (RN-07-10, con el orden interno) y `taskDueLabel(task, now, tz)` ("Hoy", "Hoy · 21:00", "Mañana", "jue 12", "Vencida hace 2 días", "Vencía hoy a las 9:00").
- [ ] `nextAssignee(rotationUserIds, closedAssigneeId)` cumple RN-07-15 (asignado fuera de la lista → el primero).
- [ ] Los cálculos se hacen en hora local de pared de `tz` y se convierten a UTC con `@date-fns/tz`; funcionan igual en Node y en el navegador.

**Notas técnicas**
- Archivos: `packages/shared/src/tasks/{recurrence.ts, occurrence.ts, overdue.ts, buckets.ts, rotation.ts}`.
- Dependencia `rrule` en `packages/shared`. Truco de zona: construir `dtstart` como fecha "flotante" en UTC con los componentes locales (`datetime(y, m, d, hh, mm)`), calcular con `RRule.after(...)` y reinterpretar el resultado como hora local de `tz` con `TZDate`.
- Siempre `WKST=MO` en semanales para que `INTERVAL` cuente semanas ISO.

**Tests**
- Unit: `recurrence.spec.ts` (ida y vuelta de todos los `RecurrenceSpec`, rechazo de `FREQ=YEARLY`, `COUNT`, `UNTIL`, `BYMONTHDAY=31`), `occurrence.spec.ts` (las 10 filas de RN-07-08 con `vi.setSystemTime(2026-11-11)`; cambio de hora de marzo y octubre; `firstOccurrence` del ejemplo de creación), `overdue.spec.ts`, `buckets.spec.ts` (lunes, miércoles y domingo), `rotation.spec.ts`.
- Integración: —
- E2E: —

---

### HOG-351 · Definir los esquemas zod y los eventos de tareas en shared

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-350
- **Spec:** `docs/specs/07-tareas.md#5-api` · `#6-eventos-en-tiempo-real`

**Descripción**
Esquemas de entrada y salida de la API de tareas y tipos de `task.*`.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/tasks.ts` con `taskDto`, `taskCompletionDto`, `taskWithCompletionDto`, `recurrenceSpec`, `rruleString`, `taskScheduleInput`, `createTaskInput`, `updateTaskInput`, `closeOccurrenceInput`, `tasksQuery` y `historyQuery`.
- [ ] Los *refines* de `createTaskInput` cubren RN-07-02 (recurrente sin `startDate`; `dueTime` sin fecha), RN-07-15 (`NONE` con `rotationUserIds` no vacío; `ROUND_ROBIN` con < 2 o con `currentAssigneeId` fuera de la lista) y RN-07-16 (puntual con turnos), con los mensajes en español de la spec.
- [ ] `RealtimeEventDataMap` incluye `task.created/updated/deleted/completed/skipped`.

**Notas técnicas**
- `updateTaskInput` no lleva *refines* cruzados: el servicio valida el estado resultante con una función compartida `validateTaskState(state)` exportada desde el mismo archivo.

**Tests**
- Unit: `schemas/tasks.spec.ts` (cada *refine* con su mensaje).
- Integración: —
- E2E: —

---

### HOG-352 · Implementar la API de tareas (listar, crear, ver, editar y borrar)

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-351, HOG-004, HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/07-tareas.md#datos-básicos` · RN-07-01, RN-07-02, RN-07-06, RN-07-15 a RN-07-17, RN-07-19, RN-07-20

**Descripción**
CRUD de `Task` con el cálculo de la primera ocurrencia, la validación de asignación y rotación y `TasksService.findAll`/`create` reutilizables por el asistente.

**Criterios de aceptación**
- [ ] `GET /tasks?assigneeId&includeDone` devuelve las activas (y las archivadas de los últimos 30 días con `includeDone`) con `lastCompletion` en ≤ 2 consultas.
- [ ] `POST` calcula `nextDueAt`/`allDay` con `firstOccurrence` en la zona del grupo, valida miembros (`422`) y el máximo de 200 activas (`422`); `201 taskDto`.
- [ ] `GET /tasks/:id` → `taskDto`; otro grupo → `404`.
- [ ] `PATCH` aplica RN-07-19 (recalcula `nextDueAt` solo si llega `schedule`) y valida el estado resultante con `validateTaskState`.
- [ ] `DELETE` → `204` (cascada de completaciones) y `task.deleted { id }`.
- [ ] Eventos `task.created/updated` y actividad de §9 con `ActivityService.record(tx, …)`.
- [ ] `TasksService.findAll(groupId, query)` y `create(ctx, input)` exportados desde `TasksModule`.
- [ ] `dueTime` del DTO se deriva de `nextDueAt` en la zona del grupo.

**Notas técnicas**
- Archivos: `apps/api/src/modules/tasks/{tasks.module.ts, tasks.controller.ts, tasks.service.ts, task.mapper.ts}`.
- Las llamadas al scheduler se añaden en HOG-355; deja un método privado `afterCommit(task)` vacío como punto de enganche.

**Tests**
- Integración: `apps/api/test/tasks/crud.int.spec.ts` (crear puntual sin fecha, puntual con hora, recurrente semanal → `nextDueAt` del ejemplo de RN-07-08; 422 de cada *refine*; asignado no miembro → 422; 201.ª activa → 422; editar sin `schedule` no cambia `nextDueAt`; 404 de otro grupo; 401; eventos y actividad).
- E2E: —

---

### HOG-353 · Completar y saltar tareas con rotación automática

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-352
- **Spec:** `docs/specs/07-tareas.md#completar-saltar-y-deshacer` (RN-07-11 a RN-07-13, RN-07-15)

**Descripción**
`POST /tasks/:id/complete` y `POST /tasks/:id/skip` con protección de concurrencia por `expectedDueAt`, cálculo de la próxima ocurrencia y avance del turno.

**Criterios de aceptación**
- [ ] Bloqueo `SELECT … FOR UPDATE` de la tarea; `expectedDueAt` distinto del `nextDueAt` actual o tarea archivada → `409 CONFLICT` con `current: taskDto`.
- [ ] Completar crea `TaskCompletion` (`dueAt`, `assigneeId`, `completedById`, `skipped = false`); recurrente → `nextDueAt = nextOccurrence(...)` y turno con `nextAssignee`; puntual → `archivedAt = now`.
- [ ] Saltar: solo recurrentes (`422` en puntuales); crea la completación con `skipped = true` y avanza igual que completar.
- [ ] Responde `taskWithCompletionDto` y emite `task.completed` o `task.skipped` con la misma forma.
- [ ] Actividad de §9, incluida la variante "(le tocaba a Óscar)" cuando `completedById ≠ assigneeId` y había asignado.

**Notas técnicas**
- Métodos `complete` y `skip` en `tasks.service.ts` que comparten `closeOccurrence(task, { skipped })`.
- La comparación de `expectedDueAt` se hace en milisegundos (`getTime()`), con `null` igual a `null`.

**Tests**
- Integración: `apps/api/test/tasks/complete-skip.int.spec.ts` (rotación [A, B, C] completada por B en el turno de A → siguiente B; saltar avanza; puntual archivada; saltar puntual → 422; `expectedDueAt` antiguo → 409 con `current`; dos `complete` concurrentes con `Promise.all` → un 200 y un 409; eventos y actividad).
- E2E: cubierto en E2E-07 (HOG-362).

---

### HOG-354 · Exponer el historial de una tarea y deshacer la última completación

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-353
- **Spec:** `docs/specs/07-tareas.md#completar-saltar-y-deshacer` (RN-07-14) · `docs/04-api-y-tiempo-real.md`

**Descripción**
`GET /tasks/:id/history` paginado y el nuevo `DELETE /tasks/:id/completions/:completionId` que usa el "Deshacer" del toast.

**Criterios de aceptación**
- [ ] `GET /tasks/:id/history?cursor&limit` devuelve `{ items: taskCompletionDto[], nextCursor }`, de la más reciente a la más antigua.
- [ ] `DELETE …/completions/:completionId` solo acepta la última completación (si no, `409 CONFLICT` "No se puede deshacer: la tarea ha cambiado"); restaura `nextDueAt`, `currentAssigneeId` y `archivedAt = null`, borra la completación, responde `taskDto`, emite `task.updated` y registra "volvió a dejar pendiente …".
- [ ] El endpoint y el `409 CONFLICT` con `current` de `complete`/`skip` coinciden con `docs/04-api-y-tiempo-real.md`.

**Notas técnicas**
- Bloquear la tarea con `FOR UPDATE` también al deshacer.

**Tests**
- Integración: `apps/api/test/tasks/history-undo.int.spec.ts` (paginación; deshacer restaura una puntual archivada y una rotación; deshacer la penúltima → 409; completación de otra tarea → 404).
- E2E: —

---

### HOG-355 · Integrar los recordatorios de tareas con el ReminderScheduler

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-353, HOG-601
- **Spec:** `docs/specs/07-tareas.md#recordatorios-integración-con-reminderscheduler-hog-601--spec-12` (RN-07-21 a RN-07-23) · `docs/specs/12-notificaciones.md` §3.4

**Descripción**
Implementar `TaskRemindersProvider` (fila `TASK` de la spec 12) y llamar a `upsertForSource`/`cancelForSource` tras cada mutación de tareas.

**Criterios de aceptación**
- [ ] `apps/api/src/modules/tasks/task-reminders.provider.ts` implementa `computeForSource`, `computeForHorizon` (≤ 3 consultas) y `computeForGroup`, y se registra con `scheduler.registerProvider` en `onModuleInit`.
- [ ] `fireAt`, destinatarios, `title`, `body`, `url` (`/g/<groupId>/tareas?destacar=<taskId>`) y `occurrenceAt` exactamente como RN-07-22.
- [ ] Tareas archivadas, sin fecha o con `reminderMinutesBefore = null` → `[]`.
- [ ] Tras el commit: `upsertForSource('TASK', id)` en crear, editar, completar (recurrente), saltar y deshacer; `cancelForSource('TASK', id)` en borrar y al archivar una puntual (RN-07-23). Un error del scheduler no rompe la respuesta.

**Notas técnicas**
- Textos con `formatDayShort` de `shared/dates` ("jue 12 nov").
- Las preferencias y las horas de silencio son de HOG-602; no consultarlas aquí.

**Tests**
- Unit: `task-reminders.provider.spec.ts` (todo el día → 09:00 local − minutos; con hora; sin asignado → todos los miembros; textos con y sin asignado).
- Integración: `apps/api/test/tasks/reminders.int.spec.ts` con `FakeReminderScheduler`: cada mutación hace la llamada esperada; con el scheduler real de HOG-601 y temporizadores falsos, completar una tarea reprograma el aviso a la nueva fecha.
- E2E: —

---

### HOG-356 · Reajustar asignaciones y turnos cuando un miembro sale del hogar

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-352, HOG-106
- **Spec:** `docs/specs/07-tareas.md#asignación-y-rotación` (RN-07-18) · `docs/specs/02-grupos-invitaciones.md` (RN-02-22)

**Descripción**
Manejador de `MemberRemovedHooks` (mecanismo de E02) que quita al usuario de las rotaciones y reasigna o desasigna sus tareas dentro de la transacción de salida.

**Criterios de aceptación**
- [ ] `apps/api/src/modules/tasks/tasks.member-removed.ts` registra `onMemberRemoved(tx, { groupId, userId })` y usa solo el `tx` recibido.
- [ ] Cumple los cuatro puntos de RN-07-18 (siguiente en el orden original; < 2 → `NONE` con el que queda; asignado fijo → `null`).
- [ ] No emite eventos ni actividad; `features/tasks/realtime.ts` invalida `['group', g, 'tasks']` en `group.member.left`. Los recordatorios los reconcilia el manejador de E12 (HOG-601) con `cancelForUserInGroup` + `rebuildGroup` (no se llama al scheduler aquí).

**Notas técnicas**
- La lógica de reasignación es una función pura (`reassignOnMemberRemoved(task, userId)`) en `packages/shared/src/tasks/rotation.ts` para probarla sin BBDD.

**Tests**
- Unit: `reassignOnMemberRemoved` (rotación de 3 con el actual saliendo; de 2 a 1; asignado fijo; no afectado).
- Integración: `apps/api/test/tasks/member-removed.int.spec.ts` (salir del grupo con tareas por turnos y fijas).
- E2E: —

---

### HOG-357 · Crear los hooks de datos y el tiempo real de tareas en la web

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-351, HOG-006, HOG-152
- **Spec:** `docs/specs/07-tareas.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks de TanStack Query de tareas con actualizaciones optimistas (completar con un toque) y manejadores de `task.*`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/tasks/api.ts` con `useTasks(query)`, `useTask(id)`, `useTaskHistory(id)` (infinita), `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useCompleteTask`, `useSkipTask` y `useUndoCompletion`.
- [ ] `useCompleteTask`/`useSkipTask` envían `expectedDueAt` = `nextDueAt` de la caché y aplican de forma optimista el resultado calculado con `nextOccurrence`/`nextAssignee` de shared; ante `409` revierten y aplican `current`.
- [ ] `realtime.ts` aplica §6 (incluida la invalidación en `group.member.left`) y marca la onda en `task:<id>`.

**Notas técnicas**
- Claves: `['group', g, 'tasks', query]`, `['group', g, 'task', id]`, `['group', g, 'task', id, 'history']`.

**Tests**
- Unit: manejadores de `realtime.ts`; `useCompleteTask` con MSW (éxito, 409 con `current`, *rollback*).
- E2E: —

---

### HOG-358 · Construir la lista de tareas con "Mis tareas" y "Todas", agrupada y con completar de un toque

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-357, HOG-750, HOG-009
- **Spec:** `docs/specs/07-tareas.md#71-lista--gtareas`

**Descripción**
`/g/:groupId/tareas?vista=mias|todas` con los grupos Vencidas, Hoy, Esta semana, Más adelante y Sin fecha, filas con completar de un toque y toast de deshacer.

**Criterios de aceptación**
- [ ] Control segmentado "Mis tareas" | "Todas" | "Por calles" sincronizado con `?vista=` (la vista por calles es HOG-359).
- [ ] `DepthFigure` "N para hoy" en la cabecera.
- [ ] Grupos con `bucketTasks`; "Vencidas" con `LaneRope variant="limit"` (corchera roja/blanca); grupos vacíos ocultos.
- [ ] Fila de §7.1 con `taskDueLabel`, `describeRecurrence`, `MemberDot` + "Le toca a …"/"Sin asignar" e icono de turnos.
- [ ] Un toque en el círculo completa: toast "Hecha · Deshacer" o "Hecha. Ahora le toca a Óscar · Deshacer" (5 s) que llama a `useUndoCompletion`; `409` → toast "Alguien ya ha marcado esta tarea".
- [ ] Menú de fila con "Saltar esta vez" (solo recurrentes, toast "Saltada. Ahora le toca a …"), "Editar" y "Borrar" (confirmación).
- [ ] "Nueva tarea" (abre HOG-360) y "Ver hechas" (`includeDone`).
- [ ] Estados de §7.1 (cargando, vacíos de cada vista, error, sin conexión) y onda.
- [ ] 375 px y modo oscuro.

**Notas técnicas**
- `apps/web/src/features/tasks/pages/TasksPage.tsx`, `components/{TaskRow.tsx, TaskBucket.tsx, TaskViewSwitch.tsx}`.
- "Hoy" se recalcula al pasar la medianoche local (temporizador hasta las 00:00 de `tz`) para no dejar la lista desfasada.
- Sustituye el `ComingSoonPage` de la pestaña Tareas de HOG-750.

**Tests**
- Unit: `TasksPage.spec.tsx` con MSW y reloj fijo (agrupación, mis vs todas, toast con turno, deshacer, saltar, vacíos).
- E2E: cubierto en HOG-362.

---

### HOG-359 · Construir la vista de tareas por calles

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-358
- **Spec:** `docs/specs/07-tareas.md#72-por-calles--vistacalles`

**Descripción**
`?vista=calles`: un `Lane` por miembro y uno "Sin asignar" con las tareas vencidas, de hoy y del resto de la semana.

**Criterios de aceptación**
- [ ] Un `Lane` por miembro actual (orden de `GET /groups/:g/members`) con `MemberDot`, nombre y `DepthFigure` del número de tareas, y un `Lane` final "Sin asignar".
- [ ] Fichas compactas con emoji, título y día ("hoy", "jue"); las vencidas con la corchera roja/blanca; se pueden completar con el mismo toast.
- [ ] Pie "Solo se muestran las tareas hasta el domingo"; calle vacía "Nada esta semana".
- [ ] Onda en la ficha y en el `Lane` (`highlight="ripple"`) cuando otro la cambia.

**Notas técnicas**
- `apps/web/src/features/tasks/components/{TaskLanes.tsx, TaskChip.tsx}`; los miembros vienen del hook de miembros de E02.

**Tests**
- Unit: `TaskLanes.spec.tsx` (reparto por miembro, sin asignar, tareas de la semana siguiente excluidas).
- E2E: —

---

### HOG-360 · Crear el formulario de tarea con selector de repetición y turnos

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-357, HOG-008, HOG-600
- **Spec:** `docs/specs/07-tareas.md#74-formulario-taskformdialog-crear-y-editar-a-pantalla-completa`

**Descripción**
`TaskFormDialog` para crear y editar: título, emoji, descripción, repetición amigable, fecha y hora, asignación fija o por turnos y recordatorio.

**Criterios de aceptación**
- [ ] Selector "¿Se repite?" con las opciones de §7.4 que construye un `RecurrenceSpec` y envía `rrule = buildRrule(spec)`; la descripción en vivo usa `describeRecurrence`.
- [ ] "Empieza el" / "Fecha" (con "Sin fecha" en puntuales) y "Hora" ("Todo el día" por defecto).
- [ ] "¿Quién la hace?": "Una persona" (miembro o "Sin asignar") | "Por turnos" (solo si se repite; mínimo 2; reordenable; "Empieza:").
- [ ] "Recordatorio" con las opciones de RN-07-21 según tenga hora o no; ayuda de notificaciones si el usuario no tiene suscripción push (hook de HOG-600).
- [ ] Al editar, el formulario se rellena con `parseRrule(task.rrule)` y el día local de `nextDueAt`; solo envía `schedule` si cambia algo de la programación.
- [ ] Validación en línea con los mensajes de HOG-351; 375 px y modo oscuro.

**Notas técnicas**
- `apps/web/src/features/tasks/components/{TaskFormDialog.tsx, RecurrencePicker.tsx, AssigneePicker.tsx, ReminderPicker.tsx}` con React Hook Form.

**Tests**
- Unit: `RecurrencePicker.spec.tsx` (cada tipo produce la RRULE canónica), `TaskFormDialog.spec.tsx` (crear por turnos; turnos ocultos en puntuales; editar sin tocar la fecha no envía `schedule`).
- E2E: cubierto en HOG-362.

---

### HOG-361 · Crear la hoja de detalle de tarea con historial

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-358, HOG-354, HOG-756
- **Spec:** `docs/specs/07-tareas.md#73-detalle--hoja-tasktaskid-taskdetailsheet`

**Descripción**
`TaskDetailSheet` abierta con `?destacar=<taskId>` sobre `/g/:groupId/tareas` (también desde los recordatorios), con los datos, el orden de turnos, las acciones y el historial.

**Criterios de aceptación**
- [ ] `?destacar=<id>` abre la hoja y reproduce la onda en la fila (con `useDeepLinkHighlight` de HOG-756); cerrarla quita el parámetro; funciona al entrar directamente desde una notificación; id inexistente → se ignora.
- [ ] Muestra lo de §7.3: repetición, "Próxima: …" (o "Sin fecha"/"Hecha el …"), recordatorio, "Le toca a" y la fila de turnos con el actual resaltado y "Después: …".
- [ ] Botones "Hecha", "Saltar esta vez" (recurrentes), "Editar" (abre HOG-360) y "Borrar".
- [ ] Historial con scroll infinito y los textos de §7.3 ("Óscar la hizo en el turno de Ana", "Saltada · le tocaba a Lucía", "Usuario eliminado").
- [ ] Estados: 404 (también al recibir `task.deleted`), error y sin conexión.
- [ ] La ruta usa los parámetros documentados en `docs/08-convenciones.md` (`?destacar=` y `?vista=`).

**Notas técnicas**
- `apps/web/src/features/tasks/components/{TaskDetailSheet.tsx, TaskHistoryList.tsx, RotationOrder.tsx}`.

**Tests**
- Unit: `TaskDetailSheet.spec.tsx` (apertura por URL, textos del historial, 404).
- E2E: —

---

### HOG-362 · Escribir el e2e de tarea por turnos (E2E-07)

- **Épica:** E07 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-358, HOG-360, HOG-011
- **Spec:** `docs/specs/07-tareas.md#11-tests` · `docs/07-testing.md`

**Descripción**
Flujo crítico E2E-07 en Playwright (Pixel 7 e iPhone 14), con dos contextos de navegador.

**Criterios de aceptación**
- [ ] `apps/web/e2e/tasks-rotation.e2e.ts`: Ana crea "Sacar la basura", "Cada semana" con el día de la semana de hoy, empieza hoy, "Por turnos" [Ana, Óscar] → la fila muestra "Le toca a Ana" en "Hoy" → Ana pulsa el círculo → toast "Hecha. Ahora le toca a Óscar" → la fila muestra "Le toca a Óscar" y vence dentro de 7 días → en el contexto de Óscar, sin recargar, la tarea aparece en "Mis tareas".
- [ ] Pasa en local y en CI sin `waitForTimeout`.

**Notas técnicas**
- Helpers de doble contexto de HOG-011. No se fija el reloj: el día de la semana se calcula en el test con la fecha real en `Europe/Madrid` (la misma que usa la API), y la fecha esperada (+7 días) con `formatDayShort` de shared.

**Tests**
- E2E: E2E-07.
