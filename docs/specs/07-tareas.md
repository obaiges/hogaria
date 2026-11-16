# 07 · Tareas del hogar

> Épica: E07 · Tickets: `docs/tickets/E07-tareas.md` (HOG-350 – HOG-399) · Modelo: `docs/02-modelo-datos.md` § TAREAS (`Task`, `TaskCompletion`, enum `RotationMode`) y § NOTIFICACIONES (`Reminder`) · API: `docs/04-api-y-tiempo-real.md` (fila "Tareas") · Fase 2

## 1. Objetivo

Repartir las tareas de la casa sin discutir: tareas puntuales o recurrentes, asignadas a una persona fija o **por turnos** (rotación automática), con recordatorio push opcional, historial de quién hizo qué y las vencidas bien a la vista. Marcar una tarea como hecha cuesta un toque y se puede deshacer. Sin puntos ni rankings.

## 2. Historias de usuario

- **US-07-01** Como miembro, quiero crear una tarea puntual, con fecha (y hora opcional) o sin fecha.
- **US-07-02** Como miembro, quiero crear una tarea recurrente eligiendo de forma sencilla: cada día, cada N días, ciertos días de la semana, cada N semanas o cada mes (un día concreto o el último).
- **US-07-03** Como miembro, quiero asignar una tarea a una persona fija o ponerla **por turnos** entre los miembros que elija, y que el turno avance solo al completarla o saltarla.
- **US-07-04** Como miembro, quiero marcarla como hecha con un toque y poder deshacerlo desde un aviso.
- **US-07-05** Como miembro, quiero **saltar esta vez** una tarea recurrente sin hacerla.
- **US-07-06** Como miembro, quiero ver "Mis tareas" y "Todas", agrupadas por Vencidas, Hoy, Esta semana, Más adelante y Sin fecha, con las vencidas destacadas.
- **US-07-07** Como miembro, quiero una vista **por calles** con una calle por miembro para ver de un vistazo a quién le toca qué esta semana.
- **US-07-08** Como miembro, quiero un recordatorio push antes de que venza una tarea que me toca.
- **US-07-09** Como miembro, quiero ver el historial de una tarea: quién la hizo, cuándo y a quién le tocaba.

## 3. Reglas de negocio

### Datos básicos
- **RN-07-01** `title`: `trim`, 1–80 caracteres. `description`: como mucho 500 caracteres o `null`. `emoji`: como mucho 8 caracteres o `null`. Un grupo tiene como mucho 200 tareas activas (`archivedAt = null`); al superarlo, `422` "Has llegado al máximo de 200 tareas".
- **RN-07-02** **Programación** (`schedule`, solo en la entrada; en el modelo se traduce a `rrule`, `nextDueAt` y `allDay`):
  - `rrule`: `null` = **puntual**; si no, una RRULE del subconjunto de RN-07-03.
  - `startDate` (`YYYY-MM-DD` en la zona del grupo): obligatoria si hay `rrule` (si falta: `422` "Elige cuándo empieza"); opcional en las puntuales (`null` = "Sin fecha").
  - `dueTime` (`"HH:mm"`) o `null`. `null` ⇒ `allDay = true` (vence "ese día"). Si `startDate` es `null`, `dueTime` debe ser `null`.
- **RN-07-03** **Subconjunto de RRULE admitido** (el servidor rechaza cualquier otra con `422` "Repetición no válida"). Sin `DTSTART`, `UNTIL`, `COUNT`, `BYSETPOS` ni ningún otro parámetro. Forma canónica (orden fijo de las partes, `INTERVAL` siempre presente):

  | Selector amigable (`RecurrenceSpec`) | RRULE canónica | Límites |
  |---|---|---|
  | `{ kind: 'DAILY', interval }` | `FREQ=DAILY;INTERVAL=n` | n 1–30 |
  | `{ kind: 'WEEKLY', interval, weekdays }` | `FREQ=WEEKLY;INTERVAL=n;BYDAY=MO,TH;WKST=MO` | n 1–12; 1–7 días, ordenados de lunes a domingo |
  | `{ kind: 'MONTHLY', interval, monthDay }` | `FREQ=MONTHLY;INTERVAL=n;BYMONTHDAY=d` | n 1–12; d 1–28 o −1 (último día) |

  `buildRrule(spec)` y `parseRrule(rrule)` (en `shared`) son inversas exactas. No se ofrecen los días 29–31 para evitar meses sin ocurrencia: para "fin de mes" se usa −1.
- **RN-07-04** `describeRecurrence(spec)` (texto de la interfaz): "Cada día" · "Cada 3 días" · "Cada semana: lunes y jueves" · "Cada 2 semanas: sábado" · "Cada semana: de lunes a viernes" (si son L–V) · "Cada mes, el día 5" · "Cada mes, el último día" · "Cada 3 meses, el día 1". Las puntuales: "Una vez".

### Fechas de vencimiento
- **RN-07-05** **Representación de `nextDueAt`:** las recurrencias se calculan en **hora local de pared** de la zona del grupo (`Group.timezone`) y después se convierten a UTC con `@date-fns/tz`. Si `allDay = true`, `nextDueAt` es las **00:00 locales** de ese día (ej.: jueves 12 nov 2026 en Madrid → `2026-11-11T23:00:00.000Z`). Si `allDay = false`, es esa hora local ese día. Así, una tarea de las 21:00 sigue a las 21:00 tras el cambio de hora.
- **RN-07-06** **Primera ocurrencia** (al crear, o al editar la programación): `firstOccurrence(spec, startDate, dueTime, tz)` = la primera fecha de la RRULE **mayor o igual que `startDate`**, calculada con `dtstart = startDate` (en hora local). Para una puntual: `nextDueAt = startDate` (+ `dueTime`) o `null` si no tiene fecha.
- **RN-07-07** **Próxima ocurrencia, anclada al calendario:** al cerrar una ocurrencia (completar o saltar) de una tarea recurrente cuyo `nextDueAt` era `D`:
  1. **Candidata** = la primera fecha de la RRULE **estrictamente posterior a `D`**, calculada con `dtstart = D` (así `INTERVAL` mantiene el ritmo desde la última ocurrencia, sea cual sea el día en que se completó).
  2. **Regla de no acumulación:** si el día local de la candidata es **anterior a hoy** (en la zona del grupo), la próxima es la primera fecha de la misma RRULE (mismo `dtstart = D`) **mayor o igual que hoy a las 00:00 locales**. Así, una tarea atrasada varias veces no deja una cola de ocurrencias vencidas.
  3. La hora (`dueTime`) se conserva.

  **Nunca** se calcula a partir de la fecha en que se completó ("N días después de hacerla"): la fecha en que se hace solo influye a través de la regla 2.
- **RN-07-08** **Ejemplos** (zona `Europe/Madrid`; el miércoles 11 nov 2026 es "hoy"):

  | # | Tarea | `nextDueAt` cerrado (D) | Se cierra el | Próxima | Por qué |
  |---|---|---|---|---|---|
  | 1 | Cada semana: lunes y jueves | lun 9 nov | lun 9 nov | **jue 12 nov** | Siguiente de la RRULE tras D |
  | 2 | Cada semana: lunes y jueves | jue 12 nov | mié 11 nov (antes de tiempo) | **lun 16 nov** | Se cierra la del jueves; la siguiente tras D |
  | 3 | Cada semana: lunes y jueves | lun 9 nov | mié 11 nov (tarde) | **jue 12 nov** | La candidata (jue 12) no es anterior a hoy |
  | 4 | Cada día | sáb 7 nov | mié 11 nov | **mié 11 nov** | Candidata dom 8 < hoy ⇒ primera ≥ hoy (regla 2) |
  | 5 | Cada día | mar 10 nov | mié 11 nov | **mié 11 nov** | Candidata = hoy, no es anterior a hoy |
  | 6 | Cada 2 semanas: sábado | sáb 14 nov | sáb 14 nov | **sáb 28 nov** | `INTERVAL=2` contado desde D |
  | 7 | Cada 2 semanas: sábado | sáb 31 oct | mié 11 nov | **sáb 14 nov** | Candidata sáb 14 ≥ hoy |
  | 8 | Cada mes, el último día | lun 30 nov | lun 30 nov | **jue 31 dic** | `BYMONTHDAY=-1`; después, 31 ene y 28 feb 2027 |
  | 9 | Cada mes, el día 15, a las 20:00 | lun 15 mar 2027 20:00 (`19:00Z`) | lun 15 mar 2027 | **jue 15 abr 2027 20:00 (`18:00Z`)** | Hora local conservada tras el cambio de hora |
  | 10 | Una vez, jue 12 nov | jue 12 nov | mié 11 nov | — | Puntual: se archiva (RN-07-12) |

  **Al crear** "Cada semana: lunes y jueves" con `startDate` = mié 11 nov → `nextDueAt` = jue 12 nov (RN-07-06).
- **RN-07-09** **Vencida** (`isOverdue(task, now, tz)`): si `allDay = false`, cuando `now > nextDueAt`; si `allDay = true`, cuando el día local de hoy es **posterior** al día de `nextDueAt` (una tarea "de hoy" no vence hasta que acaba el día). Las tareas sin fecha o archivadas nunca están vencidas.
- **RN-07-10** **Agrupación** (`bucketTasks(tasks, now, tz)`), en este orden: **Vencidas** (RN-07-09) · **Hoy** (vence hoy y no está vencida) · **Esta semana** (de mañana al domingo de la semana ISO actual; si hoy es domingo, vacío) · **Más adelante** · **Sin fecha**. Dentro de cada grupo: por `nextDueAt` ascendente; el mismo día, primero las de todo el día y después por hora; a igualdad, por `title`.

### Completar, saltar y deshacer
- **RN-07-11** `POST /tasks/:id/complete { expectedDueAt }` y `POST /tasks/:id/skip { expectedDueAt }` exigen que `expectedDueAt` coincida con el `nextDueAt` actual (los dos `null` también coinciden). Si no coincide, o la tarea está archivada: `409 CONFLICT` con la tarea actual en `current` ("Alguien ya ha marcado esta tarea"). Se bloquea la fila de la tarea (`SELECT … FOR UPDATE`) dentro de la transacción. Así, dos miembros que la marcan a la vez no cierran dos ocurrencias.
- **RN-07-12** **Completar** crea `TaskCompletion { dueAt = nextDueAt, assigneeId = currentAssigneeId, completedById = usuario, skipped = false, completedAt = now }` y después:
  - **recurrente:** `nextDueAt` = próxima (RN-07-07) y se aplica la rotación (RN-07-15);
  - **puntual:** `archivedAt = now` (`nextDueAt` no cambia, para el historial). Una tarea archivada es una tarea **hecha** y deja de aparecer en las listas activas.
- **RN-07-13** **Saltar esta vez** solo es posible en tareas recurrentes (si es puntual: `422` "Solo se pueden saltar las tareas que se repiten"). Crea `TaskCompletion` con `skipped = true` y avanza `nextDueAt` y la rotación exactamente igual que completar.
- **RN-07-14** **Deshacer** (`DELETE /tasks/:id/completions/:completionId`): solo se puede deshacer la **última** completación de la tarea (si no es la última: `409 CONFLICT` "No se puede deshacer: la tarea ha cambiado"). Borra la `TaskCompletion` y restaura `nextDueAt = completion.dueAt`, `currentAssigneeId = completion.assigneeId` y `archivedAt = null`. No tiene límite de tiempo.

### Asignación y rotación
- **RN-07-15** `rotationMode`:
  - **`NONE`:** `currentAssigneeId` = persona fija o `null` (sin asignar); `rotationUserIds = []`. Completar o saltar no cambia la asignación.
  - **`ROUND_ROBIN`** ("Por turnos"): `rotationUserIds` tiene entre 2 y 20 miembros distintos, en el orden del turno, y `currentAssigneeId` debe estar en esa lista (por defecto, el primero). Al completar o saltar: `next = rotationUserIds[(indexOf(assigneeId de la ocurrencia cerrada) + 1) % n]`; si ese `assigneeId` ya no está en la lista, `next = rotationUserIds[0]`.
  - El turno avanza **desde a quien le tocaba**, no desde quien la hizo: si Óscar hace la tarea en el turno de Ana con la rotación [Ana, Óscar, Lucía], la completación queda con `assigneeId = Ana`, `completedById = Óscar`, y el siguiente turno es de **Óscar**.
- **RN-07-16** La rotación solo se admite en tareas recurrentes (puntual con `ROUND_ROBIN`: `422` "Los turnos solo sirven para tareas que se repiten").
- **RN-07-17** Todos los `userId` (`currentAssigneeId`, `rotationUserIds`) deben ser miembros actuales: si no, `422` "Alguna persona no es miembro del hogar".
- **RN-07-18** **Un miembro sale o es expulsado:** esta épica registra un manejador en `MemberRemovedHooks` (spec 02, RN-02-22) — `onMemberRemoved(tx, { groupId, userId })`, en `apps/api/src/modules/tasks/tasks.member-removed.ts` — que se ejecuta **dentro** de la transacción de salida y, para cada tarea activa del grupo:
  - quita `userId` de `rotationUserIds`;
  - si era el `currentAssigneeId` de una tarea por turnos, pasa al que le seguía en el orden **original** (el siguiente que siga en la lista);
  - si quedan menos de 2 en la rotación, la tarea pasa a `NONE` con `currentAssigneeId` = el único que queda (o `null` si no queda nadie) y `rotationUserIds = []`;
  - si era el asignado fijo (`NONE`), `currentAssigneeId = null`.

  No emite eventos ni actividad: los clientes invalidan `['group', g, 'tasks']` al recibir `group.member.left`, y los recordatorios los reconcilia E02 tras el commit con `scheduler.cancelForUserInGroup` + `scheduler.rebuildGroup` (spec 12), que vuelve a pedir a `TaskRemindersProvider` los avisos de las tareas reasignadas.

### Edición y borrado
- **RN-07-19** `PATCH` es parcial y gana la última escritura. Si incluye `schedule`, se recalcula `nextDueAt` con RN-07-06 (la web lo rellena con el día local del `nextDueAt` actual, o con hoy si no tiene). Sin `schedule`, `nextDueAt` no cambia. Editar una tarea archivada no la reabre (para eso está "Deshacer").
- **RN-07-20** `DELETE` borra la tarea y su historial (cascada) y cancela sus recordatorios. La web pide confirmación.

### Recordatorios (integración con `ReminderScheduler`, HOG-601 · spec 12)
- **RN-07-21** `reminderMinutesBefore`: entero 0–10080 o `null` (sin recordatorio). Solo tiene sentido con fecha: si `nextDueAt` es `null`, se ignora. Opciones de la interfaz:
  - con hora: Sin recordatorio · A la hora (0) · 15 min antes · 30 min antes · 1 h antes (60) · 2 h antes (120) · 1 día antes (1440);
  - todo el día: Sin recordatorio · El mismo día a las 9:00 (0) · El día antes a las 9:00 (1440).
- **RN-07-22** **Proveedor:** esta épica implementa `TaskRemindersProvider` (`apps/api/src/modules/tasks/task-reminders.provider.ts`) con la interfaz `ReminderSourceProvider` de la spec 12 (`computeForSource`, `computeForHorizon` y `computeForGroup`) y lo registra con `scheduler.registerProvider(...)` al arrancar el módulo. El cálculo sigue la fila `TASK` de la spec 12 §3.4:
  - **solo la ocurrencia pendiente** (`nextDueAt`) de tareas no archivadas con `reminderMinutesBefore ≠ null` (la siguiente depende de cuándo se cierre esta);
  - **`fireAt`**: con hora, `nextDueAt − reminderMinutesBefore`; de todo el día, las **09:00 locales** del día de `nextDueAt` − `reminderMinutesBefore`;
  - **destinatarios**: `currentAssigneeId`; si es `null`, todos los miembros actuales del grupo;
  - **`title`** = "✅ {emoji} {título}" (sin emoji si no tiene); **`body`** = "Te toca hoy" o "Te toca el jue 12 nov a las 18:00" (sin hora si es de todo el día); sin asignado: "Sin asignar · vence el jue 12 nov"; **`url`** = `/g/<groupId>/tareas?destacar=<taskId>`;
  - `occurrenceAt = nextDueAt`.

  El filtrado por `fireAt` pasado u horizonte, las preferencias (`NotificationPreference.tasks`) y las horas de silencio los aplica el `ReminderScheduler`, no esta épica.
- **RN-07-23** **Llamadas tras el commit:** después de **crear, editar, completar, saltar y deshacer**, el servicio llama a `scheduler.upsertForSource('TASK', task.id)`; después de **borrar** y cuando una puntual queda **archivada** al completarse, a `scheduler.cancelForSource('TASK', task.id)`. Un fallo del scheduler nunca hace fallar la petición (spec 12, RN-12-17).

## 4. Modelo de datos

`Task` y `TaskCompletion` de `docs/02-modelo-datos.md` § TAREAS, y `Reminder` (lo gestiona el `ReminderScheduler`). Semántica fijada por esta spec:
- `rrule` sin `DTSTART`: la referencia de la recurrencia es siempre el `nextDueAt` vigente (RN-07-06, RN-07-07).
- `archivedAt != null` ⇔ **tarea puntual hecha** (RN-07-12). Ver los comentarios de `Task` en `docs/02-modelo-datos.md`.
- `TaskCompletion.dueAt` = ocurrencia cerrada; `assigneeId` = a quién le tocaba; `completedById` = quién la cerró.

## 5. API

Rutas bajo `/api/v1/groups/:groupId` con `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/tasks.ts`.

### DTO

```ts
taskCompletionDto = z.object({ id: uuid, taskId: uuid, dueAt: datetime.nullable(), assigneeId: uuid.nullable(),
  completedById: uuid.nullable(), skipped: z.boolean(), completedAt: datetime })
taskDto = z.object({
  id, groupId, title: z.string(), description: z.string().nullable(), emoji: z.string().nullable(),
  rrule: z.string().nullable(), nextDueAt: datetime.nullable(), allDay: z.boolean(),
  dueTime: timeString.nullable(),                    // "HH:mm" local, derivado (null si allDay o sin fecha)
  reminderMinutesBefore: int.nullable(), rotationMode: z.enum(['NONE','ROUND_ROBIN']),
  rotationUserIds: z.array(uuid), currentAssigneeId: uuid.nullable(), archivedAt: datetime.nullable(),
  lastCompletion: taskCompletionDto.nullable(),     // la más reciente
  createdById: uuid.nullable(), createdAt: datetime, updatedAt: datetime,
})
taskWithCompletionDto = taskDto.extend({ completion: taskCompletionDto })
```

### Entrada

```ts
recurrenceSpec = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('DAILY'), interval: z.number().int().min(1).max(30) }),
  z.object({ kind: z.literal('WEEKLY'), interval: z.number().int().min(1).max(12),
             weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7) }),   // ISO: 1 = lunes
  z.object({ kind: z.literal('MONTHLY'), interval: z.number().int().min(1).max(12),
             monthDay: z.union([z.number().int().min(1).max(28), z.literal(-1)]) }),
])
rruleString = z.string().max(120).refine(s => parseRrule(s) !== null, 'Repetición no válida')
taskScheduleInput = z.object({ rrule: rruleString.nullable(), startDate: dateString.nullable(), dueTime: timeString.nullable() })
  // + refines de RN-07-02
createTaskInput = z.object({
  title: z.string().trim().min(1).max(80), description: z.string().trim().max(500).nullable().default(null),
  emoji: z.string().max(8).nullable().default(null), schedule: taskScheduleInput,
  reminderMinutesBefore: z.number().int().min(0).max(10080).nullable().default(null),
  rotationMode: z.enum(['NONE','ROUND_ROBIN']).default('NONE'),
  rotationUserIds: z.array(uuid).max(20).default([]),
  currentAssigneeId: uuid.nullable().default(null),
})  // + refines de RN-07-15 y RN-07-16
updateTaskInput = createTaskInput.innerType().partial()   // refines sobre el estado resultante en el servicio
closeOccurrenceInput = z.object({ expectedDueAt: datetime.nullable() })   // complete y skip
tasksQuery = z.object({ assigneeId: uuid.optional(), includeDone: z.coerce.boolean().default(false) })
historyQuery = z.object({ cursor: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) })
```

La web trabaja con `RecurrenceSpec` y envía `rrule = buildRrule(spec)`; el asistente (E14) puede enviar la RRULE directamente, siempre dentro del subconjunto.

### Endpoints

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/tasks?assigneeId=&includeDone=` | `tasksQuery` | `taskDto[]`: activas (`archivedAt = null`) y, con `includeDone`, las archivadas de los últimos 30 días | 404, 422 |
| POST | `/tasks` | `createTaskInput` | `201 taskDto` | 422 |
| GET | `/tasks/:id` | — | `taskDto` | 404 |
| PATCH | `/tasks/:id` | `updateTaskInput` | `taskDto` | 404, 422 |
| DELETE | `/tasks/:id` | — | `204` | 404 (la web lo trata como éxito) |
| POST | `/tasks/:id/complete` | `closeOccurrenceInput` | `taskWithCompletionDto` | 404, 409 `CONFLICT` (+ `current`) |
| POST | `/tasks/:id/skip` | `closeOccurrenceInput` | `taskWithCompletionDto` | 404, 409, 422 (puntual) |
| GET | `/tasks/:id/history?cursor=&limit=` | `historyQuery` | `{ items: taskCompletionDto[], nextCursor }` (más reciente primero) | 404 |
| DELETE | `/tasks/:id/completions/:completionId` | — | `taskDto` | 404, 409 (no es la última) |

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `task.created` | `POST /tasks` | `TaskDto` |
| `task.updated` | `PATCH`, deshacer | `TaskDto` |
| `task.deleted` | `DELETE /tasks/:id` | `{ id }` |
| `task.completed` | `POST /complete` | `TaskDto & { completion }` |
| `task.skipped` | `POST /skip` | `TaskDto & { completion }` |
| `activity.created` | Ver §9 | `ActivityDto` |

Cliente (`apps/web/src/features/tasks/realtime.ts`): claves `['group', g, 'tasks', filtros]`, `['group', g, 'task', id]` y `['group', g, 'task', id, 'history']`. En `task.created/updated/completed/skipped` → *upsert* del `TaskDto` en todas las listas (quitándolo si ya está archivada y la lista no incluye hechas) y en el detalle; en `completed/skipped` también se invalida el historial de esa tarea. En `task.deleted` → quitarla y, si se está viendo su detalle, mostrar "Esta tarea se ha borrado". Filas cambiadas por otro miembro → onda.

## 7. Pantallas y UX

Ruta: `/g/:groupId/tareas` (`TasksPage`) con la vista en `?vista=mias|todas|calles` (por defecto `mias`) y el detalle de una tarea como hoja sobre la lista con `?destacar=<taskId>` (`TaskDetailSheet`, convención de deep link de `docs/08` y spec 15 RN-15-13: además de abrir la hoja, la fila hace scroll, recibe el foco y una onda; id inexistente → se ignora), que es también el destino de los recordatorios (spec 12) y de los enlaces del asistente (spec 14). Componentes de DESIGN.md: `Lane` (una calle por miembro), `LaneRope` (separador entre grupos; la **corchera roja/blanca** marca las vencidas como límite superado), `MemberDot` (a quién le toca), `DepthFigure` (contadores de la cabecera y de cada calle) y `ripple`.

### 7.1 Lista — `/g/:groupId/tareas`
- Título **"Tareas"**. Control segmentado: **"Mis tareas" | "Todas" | "Por calles"**. Cabecera con `DepthFigure`: "3 para hoy" (en "Mis tareas", las mías; en "Todas", las del hogar).
- Grupos (RN-07-10) con rótulo y `LaneRope`: **"Vencidas"** (corchera roja/blanca y texto de error), **"Hoy"**, **"Esta semana"**, **"Más adelante"**, **"Sin fecha"**. Los grupos vacíos no se muestran.
- Fila: botón circular de completar (`aria-label="Marcar Fregar los platos como hecha"`), emoji + título, línea secundaria con el vencimiento ("Hoy", "Hoy · 21:00", "Mañana", "jue 12", "Vencida hace 2 días", "Vencía hoy a las 9:00") y la repetición (`describeRecurrence`), y a la derecha `MemberDot` + "Le toca a Óscar" (o "Sin asignar"; icono de turnos si es `ROUND_ROBIN`).
  - **Un toque en el círculo la completa** (optimista). Toast: **"Hecha · Deshacer"** o, si rota, **"Hecha. Ahora le toca a Óscar · Deshacer"** (5 s). "Deshacer" llama a `DELETE …/completions/:completionId` con el `id` devuelto.
  - Un toque en el resto de la fila abre el detalle.
  - Menú (⋯) de la fila: **"Saltar esta vez"** (solo recurrentes; toast "Saltada. Ahora le toca a Óscar · Deshacer"), "Editar", "Borrar".
- Botón principal **"Nueva tarea"** (abre §7.4). Enlace al pie **"Ver hechas"** (`includeDone=true`, sección "Hechas (últimos 30 días)").
- **"Mis tareas"** = tareas con `currentAssigneeId` = yo. **"Todas"** = todas las activas.
- Estados: *cargando* = *skeleton* de 5 filas; *vacío en Mis tareas* = "No tienes tareas pendientes" + "Ver todas" y "Nueva tarea"; *vacío en Todas* = "Aún no hay tareas en este hogar" + "Crea la primera: fregar, sacar la basura, regar…" + "Nueva tarea"; *error* = "No se pudieron cargar las tareas" + "Reintentar"; *sin conexión* = banner y círculos y botones deshabilitados.
- **Conflicto `409`** al completar: se revierte lo optimista, se aplica `current` y se muestra el toast "Alguien ya ha marcado esta tarea".

### 7.2 Por calles — `?vista=calles`
- Un `Lane` por miembro actual (en el orden de `GET /groups/:g/members`), con `MemberDot` + nombre y `DepthFigure` con su número de tareas; y un último `Lane` **"Sin asignar"**.
- Cada calle muestra las tareas asignadas **vencidas, de hoy y del resto de la semana** como fichas compactas (emoji, título y día "hoy"/"jue"); las vencidas, con la corchera roja/blanca. Se puede completar desde la ficha (mismo toast).
- Pie: "Solo se muestran las tareas hasta el domingo".
- Calle vacía: "Nada esta semana".

### 7.3 Detalle — hoja `?destacar=<taskId>` (`TaskDetailSheet`)
- Emoji + título, descripción, `describeRecurrence`, "Próxima: jueves 12 nov · 21:00" (o "Sin fecha"; "Hecha el …" si está archivada), recordatorio ("Aviso 1 h antes" / "Sin recordatorio").
- **Le toca a:** `MemberDot` + nombre. Si es por turnos, el orden completo como fila de `MemberDot`s con el actual resaltado ("Después: Lucía").
- Botones: **"Hecha"**, **"Saltar esta vez"** (recurrentes), "Editar", "Borrar" (confirmación "¿Borrar la tarea Fregar los platos y su historial?").
- **Historial** (scroll infinito): "Ana la hizo · mar 10 nov" · "Óscar la hizo en el turno de Ana · lun 9 nov" · "Saltada · le tocaba a Lucía · dom 8 nov" ("Usuario eliminado" si `null`).
- Estados: *404* = "Esta tarea no existe o se ha borrado" + "Volver a tareas"; *error* = "Reintentar"; *sin conexión* = botones deshabilitados.

### 7.4 Formulario (`TaskFormDialog`, crear y editar, a pantalla completa)
- "Título" * (placeholder "Fregar los platos"), "Emoji" (opcional), "Descripción".
- **"¿Se repite?"**: selector con "No, una vez" · "Cada día" · "Cada semana" · "Cada mes".
  - Cada día: "Cada [1] día(s)".
  - Cada semana: "Cada [1] semana(s)" + 7 chips L M X J V S D (al menos uno; por defecto, el día de la fecha de inicio).
  - Cada mes: "Cada [1] mes(es)" + "El día [1–28]" o "El último día".
  - Debajo, en vivo: `describeRecurrence` ("Cada 2 semanas: sábado").
- **"Empieza el"** (fecha; en puntuales se llama **"Fecha"** y tiene la opción "Sin fecha") y **"Hora"** (opcional; "Todo el día" por defecto).
- **"¿Quién la hace?"**: segmentado **"Una persona"** (selector de miembro o "Sin asignar") | **"Por turnos"** (solo si se repite: chips de miembros en el orden en que se tocan, con subir/bajar, mínimo 2, y "Empieza:" con el primero por defecto).
- **"Recordatorio"**: las opciones de RN-07-21. Si el usuario no tiene ninguna suscripción push (hook de HOG-600), aparece la ayuda "Activa las notificaciones en tu perfil para recibir recordatorios".
- Botones **"Guardar"** y "Cancelar". Validación en línea en español.

## 8. Permisos

Sin roles ni propiedad: **cualquier miembro** crea, edita, completa (aunque no le toque), salta, deshace y borra cualquier tarea del grupo. Fuera del grupo: `404`. Sin sesión: `401`.

## 9. Actividad

`entityType = task`.

| Acción | `action` | `summary` |
|---|---|---|
| Crear | `created` | `creó la tarea Fregar los platos` |
| Editar | `updated` | `editó la tarea Fregar los platos` |
| Borrar | `deleted` | `borró la tarea Fregar los platos` |
| Completar (le tocaba a él o sin asignar) | `completed` | `completó Fregar los platos` |
| Completar (le tocaba a otro) | `completed` | `completó Fregar los platos (le tocaba a Óscar)` |
| Saltar | `skipped` | `saltó Fregar los platos esta vez` |
| Deshacer | `updated` | `volvió a dejar pendiente Fregar los platos` |
| Salida de un miembro (RN-07-18) | — | *(sin actividad)* |

## 10. Casos límite

- Dos miembros completan la misma tarea a la vez → el segundo recibe `409` (RN-07-11) y ve el toast.
- Completar antes de tiempo (ej. 2 de RN-07-08) → se cierra la ocurrencia pendiente, no la siguiente.
- Tarea atrasada varias semanas → la regla de no acumulación deja solo una pendiente (ej. 4).
- Cambio de hora → la hora local se conserva (ej. 9).
- "Cada mes, el último día" en febrero → 28 o 29 (ej. 8).
- Puntual sin fecha → aparece en "Sin fecha", nunca vence y no admite recordatorio.
- El asignado sale del grupo → RN-07-18; si la rotación se queda con 1 persona, pasa a fija.
- Deshacer después de que otro haya vuelto a completarla → `409` "No se puede deshacer: la tarea ha cambiado".
- Editar la programación de una tarea por turnos → el turno actual no cambia.
- `PATCH` que quita al asignado actual de `rotationUserIds` sin cambiar `currentAssigneeId` → `422`.
- Recordatorio cuyo momento ya ha pasado (por ejemplo "1 día antes" de una tarea de mañana a las 8:00 creada a las 10:00) → no se programa y la interfaz lo indica: "El recordatorio de esta vez ya ha pasado".
- Usuario eliminado → `completedById`/`assigneeId` = `null` → "Usuario eliminado" en el historial.
- La zona horaria del grupo cambia → las tareas existentes mantienen su `nextDueAt` en UTC; el siguiente cálculo usa la zona nueva.

## 11. Tests

**Unitarios (`shared`, `recurrence.spec.ts` y `tasks.spec.ts`):** `buildRrule`/`parseRrule` (ida y vuelta de todos los casos y rechazo de RRULE fuera del subconjunto), `describeRecurrence`, `firstOccurrence`, `nextOccurrence` con **todas las filas de RN-07-08** (con el reloj fijado al mié 11 nov 2026), `isOverdue` (todo el día y con hora), `bucketTasks` (incluido el domingo), `nextAssignee` (avance desde el asignado, asignado fuera de la lista).

**Integración (`apps/api/test/tasks/*.int.spec.ts`):** autorización (404 otro grupo, 401); crear recurrente sin `startDate` → 422; puntual con turnos → 422; completar recurrente con rotación (completación con `assigneeId` y `completedById` correctos, `nextDueAt` y `currentAssigneeId` nuevos); completar puntual la archiva; saltar puntual → 422; `expectedDueAt` antiguo → 409 con `current`; dos `complete` concurrentes → uno 200 y otro 409; deshacer la última restaura el estado y deshacer otra → 409; manejador `onMemberRemoved` (rotación de 3 a 2, de 2 a 1, asignado fijo); llamadas a `scheduler.upsertForSource`/`cancelForSource` de RN-07-23 (scheduler falso); `TaskRemindersProvider.computeForSource` (todo el día con base 09:00, con hora, sin asignado = todos, archivada = `[]`); eventos `task.*` y `ActivityLog`.

**Componentes (web):** selector de repetición (genera la RRULE y la descripción en vivo), formulario con turnos, fila (completar con un toque y toast con deshacer), agrupación, vista por calles, estados vacío, error y sin conexión.

**E2E:** **E2E-07** Ana crea "Sacar la basura", cada semana el día de hoy, por turnos [Ana, Óscar]; la completa → la fila muestra "Le toca a Óscar" y la próxima fecha dentro de 7 días; en el navegador de Óscar aparece en "Mis tareas" sin recargar.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `DELETE /tasks/:id/completions/:completionId` → `docs/04` (fila "Tareas").
- `409 CONFLICT` con `current` en `complete`/`skip` → `docs/04` (miembros de extensión).
- Parámetros `?vista=` y `?destacar=` (sustituye a `?task=`) → `docs/08`.
- `Reminder.url` de tareas `/g/<g>/tareas?destacar=<taskId>` → `docs/02` y RN-07-22 de esta spec.
- Comentarios de `Task` (`rrule` sin `DTSTART`, `nextDueAt` de todo el día, `archivedAt`) → `docs/02`.
- Glosario "Vencida", "Repetición" y "Por calles" → `docs/10`.

## 13. Fuera de alcance

- Gamificación: puntos, rachas, rankings o estadísticas de reparto (docs/00).
- Subtareas o listas de comprobación dentro de una tarea.
- Rotación ponderada o con reglas (por horario de trabajo, por días).
- Recurrencias fuera del subconjunto (anual, "el segundo martes", "cada N días tras completarla").
- Recordatorios de varias ocurrencias futuras a la vez.
- Pausar o archivar tareas recurrentes (solo se pueden borrar).
