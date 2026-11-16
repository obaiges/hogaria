# E09 · Calendario y eventos

> Spec: `docs/specs/09-calendario.md` · Rango: HOG-450 – HOG-499 · Fase: 4
> Orden recomendado: HOG-450 → HOG-451 → HOG-452 → HOG-453 → HOG-454 → HOG-455 → HOG-456 → HOG-457 → HOG-458 → HOG-459 → HOG-460 → HOG-461.
> La capa "Facturas" del calendario es de la fase 5 y vive en E11 (HOG-561).

### HOG-450 · Esquemas zod y constantes del calendario

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/09-calendario.md#5-api`

**Descripción**
Esquemas de entrada y salida de eventos, consulta por rango y alcance, validador del subconjunto RRULE permitido y constantes de categorías y avisos.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/calendar.ts` exporta `createCalendarEventInput` (unión discriminada por `allDay`), `updateCalendarEventInput`, `eventScopeQuery`, `calendarEventDto`, `calendarOccurrenceDto`, `listEventsQuery` como en la spec.
- [ ] `rruleString` acepta solo el subconjunto de RN-09-08 (FREQ, INTERVAL 1–99, BYDAY solo con WEEKLY, COUNT 1–730 o UNTIL local flotante, nunca ambos, sin DTSTART) con mensajes en español.
- [ ] `reminderMinutesBefore`: ≤ 5, únicos y de `EVENT_REMINDER_OFFSETS` o `ALL_DAY_REMINDER_OFFSETS` según `allDay`.
- [ ] Duración máxima: 14 días con hora, 31 días todo el día; `listEventsQuery` ≤ 62 días.
- [ ] `packages/shared/src/constants/calendar.ts` con `EVENT_CATEGORY_META`, offsets y `ALL_DAY_REMINDER_TIME`.
- [ ] `describeRrule(rrule, startsAt, tz)` → texto ES ("Cada año", "Cada semana el lunes y el miércoles hasta el 25 de junio de 2027").

**Notas técnicas**
- Validar la sintaxis con un parser propio (split por `;`) antes de pasar a `rrule` para dar errores claros.

**Tests**
- Unit: RRULE válidas e inválidas (BYDAY con MONTHLY, COUNT+UNTIL, clave desconocida, DTSTART), offsets por tipo, `describeRrule`.

---

### HOG-451 · Expansión de recurrencias en la zona del grupo

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** shared
- **Depende de:** HOG-450
- **Spec:** `docs/specs/09-calendario.md#3-reglas-de-negocio`

**Descripción**
Función pura `expandEventOccurrences(event, from, to, tz)` con el algoritmo de hora de pared flotante (RN-09-09), `exdates`, eventos de todo el día y varios días, y `computeEventFireTimes(occurrence, offsets, allDay, tz)` para los avisos (RN-09-20).

**Criterios de aceptación**
- [ ] Puntual, diario, semanal con `BYDAY`, mensual, anual, `INTERVAL`, `COUNT` y `UNTIL` correctos.
- [ ] Un evento semanal a las 10:00 conserva las 10:00 locales antes y después del 25/10/2026 y del 29/03/2026.
- [ ] `exdates` excluye por igualdad exacta de instante.
- [ ] Incluye ocurrencias que empezaron antes de `from` y siguen activas.
- [ ] Mensual desde el 31 solo en meses de 31; anual desde el 29/02 solo en bisiestos.
- [ ] Todo el día: `occurrenceStartsAt` = 00:00 local; fin = 00:00 local del día siguiente al último.
- [ ] `computeEventFireTimes`: con hora `inicio − min`; todo el día 09:00 local del día de inicio `− min`.
- [ ] `formatEventReminderBody(occurrence, location, tz)` → "jue 12 nov · 17:30 · Lugar" / "jue 12 nov · todo el día".

**Notas técnicas**
- `packages/shared/src/calendar/expand.ts`. Librería `rrule` (ya en el stack) + `@date-fns/tz`.

**Tests**
- Unit: todos los casos anteriores y los de la spec §10.

---

### HOG-452 · API: crear, listar (con expansión) y obtener eventos

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-451, HOG-003, HOG-004, HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/09-calendario.md#5-api`

**Descripción**
`POST /groups/:g/events`, `GET /groups/:g/events?from&to[&ownerId]` con expansión de recurrencias y `GET /groups/:g/events/:id[?occurrence]` (nuevo, para los deep links).

**Criterios de aceptación**
- [ ] `POST` fija `ownerId = user.id`, convierte `startDate`/`endDate` a instantes en la zona del grupo (RN-09-06), valida rangos (RN-09-07) y devuelve 201 `calendarEventDto` (con `startDate`/`endDate` calculados).
- [ ] `GET` lista con la consulta de la spec §5 y expansión en memoria, ordenado por `occurrenceStartsAt`, sin paginar; 422 si el rango supera 62 días.
- [ ] `GET :id` sin `occurrence` → primera ocurrencia ≥ ahora o la última; con `occurrence` no válida → 404.
- [ ] `event.created` tras el commit; actividad "creó el evento Dentista (jue 12 nov)".
- [ ] Llamada a `scheduler.upsertForSource('EVENT', id)` tras el commit si hay avisos (si HOG-601 no está hecho, se deja la llamada detrás de una interfaz y se activa en HOG-454).

**Notas técnicas**
- `apps/api/src/modules/calendar/calendar-events.controller.ts` + `calendar-events.service.ts`.
- `GET /groups/:g/events/:id` ya está en el catálogo de `docs/04`.

**Tests**
- Integración `apps/api/test/calendar.int.spec.ts`: crear con hora y todo el día; listado con serie semanal y `exdates`; 422; 404 desde otro grupo; 401; evento realtime.

---

### HOG-453 · API: editar y borrar con alcance (solo este / toda la serie) y propiedad

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-452, HOG-106
- **Spec:** `docs/specs/09-calendario.md#3-reglas-de-negocio`

**Descripción**
`PATCH` y `DELETE /groups/:g/events/:id?scope=this|all&occurrence=` con las reglas RN-09-12 a RN-09-18 y la comprobación de dueño.

**Criterios de aceptación**
- [ ] No dueño → `403 FORBIDDEN_NOT_OWNER` en `PATCH` y `DELETE`.
- [ ] Recurrente sin `scope` → 422; `scope=this` sin `occurrence` o con ocurrencia inexistente/excluida → 422/404.
- [ ] `DELETE scope=this` añade el `exdate`; `PATCH scope=this` añade `exdate` y crea el evento puntual en una transacción y responde `{ series, detached }`; `rrule` en `scope=this` → 422.
- [ ] `PATCH scope=all` vacía `exdates` si cambian `startsAt`, `allDay`, `startDate` o `rrule`.
- [ ] Eventos realtime y actividad de la spec §6 y §9.
- [ ] Llamadas a `upsertForSource` (serie y nuevo) o `cancelForSource` tras el commit.
- [ ] `calendar.member-removed.ts` registra en `MemberRemovedHooks` (HOG-106) un manejador que, con el `tx` recibido, borra los `CalendarEvent` del usuario en ese grupo (contenido personal, ADR de salida del grupo); sus recordatorios los cancela el manejador de E12 (`cancelForUserInGroup`).

**Notas técnicas**
- La comprobación de ocurrencia expande ±1 día alrededor de `occurrence` con `expandEventOccurrences`.

**Tests**
- Integración: cada rama de alcance; 403 como otro miembro; salir del grupo borra los eventos del usuario y no los de otros; transacción (si falla la creación del nuevo, no se añade el `exdate`).

---

### HOG-454 · Proveedor de recordatorios de eventos (`EVENT`)

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-601, HOG-452
- **Spec:** `docs/specs/12-notificaciones.md#34-api-pública-del-scheduler-para-e07-e09-e11-y-e02`

**Descripción**
Implementar `EventRemindersProvider` (`ReminderSourceProvider` con `sourceType = 'EVENT'`) y registrarlo en el `ReminderScheduler`.

**Criterios de aceptación**
- [ ] `computeForSource`: expande ocurrencias del evento en el horizonte (considerando el offset máximo de 7 días), calcula `fireAt` con `computeEventFireTimes` y devuelve un `DesiredReminder` por ocurrencia y offset con `fireAt ∈ (from, to]`, solo para `ownerId`.
- [ ] `title`, `body` y `url` según RN-09-22 (`/g/<groupId>/calendario?fecha=<YYYY-MM-DD>&destacar=<eventId>`, más `&ocurrencia=<ISO>` si es recurrente).
- [ ] `computeForHorizon` en ≤ 3 consultas (eventos con avisos: puntuales con `startsAt` en `[from, to + 7 d]` y todas las series con avisos que no hayan terminado).
- [ ] `computeForGroup` filtra por `groupId`.
- [ ] Registrado en `onModuleInit` del `CalendarModule`.

**Notas técnicas**
- `apps/api/src/modules/calendar/event-reminders.provider.ts`.

**Tests**
- Integración: evento con avisos [1440, 60] → 2 recordatorios para el dueño; ningún otro miembro recibe; fuera de horizonte no se crea; editar la hora reprograma; borrar cancela.

---

### HOG-455 · Hooks de datos y tiempo real del calendario (web)

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-452, HOG-006, HOG-152
- **Spec:** `docs/specs/09-calendario.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks TanStack Query de eventos y mutaciones con alcance, y manejador de `event.*`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/calendar/api.ts`: `useEvents(groupId, from, to)` (`['group', groupId, 'events', { from, to }]`), `useEvent(groupId, id, occurrence)`, `useCreateEvent`, `useUpdateEvent({ scope, occurrence })`, `useDeleteEvent({ scope, occurrence })`, con `X-Client-Mutation-Id`.
- [ ] Actualización optimista solo en eventos puntuales; en series se invalida tras la respuesta.
- [ ] `realtime.ts`: `event.*` invalida `['group', groupId, 'events']` y registra la onda del evento si el autor es otro.

**Tests**
- Unit: el manejador invalida la clave correcta.

---

### HOG-456 · Pantalla Calendario: estructura, agenda y detalle

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-455, HOG-009, HOG-750, HOG-756
- **Spec:** `docs/specs/09-calendario.md#7-pantallas-y-ux`

**Descripción**
Ruta `/g/:groupId/calendario` con cabecera, `SegmentedControl` de vistas, navegador, vista Agenda, hoja de detalle (solo lectura para no dueños) y estados.

**Criterios de aceptación**
- [ ] Parámetros `?vista`, `?fecha` y `?destacar=<eventId>[&ocurrencia=<ISO>]` (`ocurrencia` solo en recurrentes; abre el detalle y reproduce la onda con `useDeepLinkDate`/`useDeepLinkHighlight` de HOG-756; si no existe → toast "Este evento ya no existe").
- [ ] Agenda de 30 días con carga del siguiente bloque al final; agrupada por día ("Hoy", "Mañana", "jueves 12 de noviembre").
- [ ] Filas con hora o "Todo el día", emoji, título, lugar, `MemberDot` del dueño e icono de repetición.
- [ ] Detalle: dueño ve "Editar"/"Borrar"; no dueño ve "Solo Ana puede cambiar este evento" y no ve recordatorios.
- [ ] Estados: skeleton, vacío, error, sin conexión (Fab deshabilitado).
- [ ] Entrada "Calendario" en "Más".

**Notas técnicas**
- `apps/web/src/features/calendar/pages/CalendarPage.tsx`, `components/AgendaView.tsx`, `components/EventDetailSheet.tsx`.

**Tests**
- Componentes: agenda con eventos de dos dueños; detalle de solo lectura; deep link a evento borrado.

---

### HOG-457 · Formulario de evento: recurrencia, avisos y diálogo de alcance

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-456, HOG-603
- **Spec:** `docs/specs/09-calendario.md#76-crear-o-editar-evento-hoja`

**Descripción**
Hoja de crear/editar evento con todos los campos, repetición (incluida la personalizada), avisos, autoconfiguración de cumpleaños, avisos de meses cortos y diálogo "Solo este evento / Todos los eventos de la serie".

**Criterios de aceptación**
- [ ] Campos y textos de la spec §7.6; validación con `zodResolver`.
- [ ] Repetir: opciones simples y "Personalizado" (cada N, días de la semana, termina nunca / fecha / tras N veces) que generan una RRULE válida del subconjunto.
- [ ] Categoría "Cumpleaños" en evento nuevo → todo el día, cada año y aviso "El día antes a las 9:00".
- [ ] Avisos de RN-09-10 en línea; aviso de RN-09-16 antes de guardar `scope=all` que vacía exclusiones.
- [ ] Editar o borrar un recurrente abre el diálogo de alcance; "Solo este evento" oculta "Repetir".
- [ ] Tras guardar con avisos, llama a `maybeAsk()` de `useNotificationPrompt` (HOG-603).
- [ ] Toasts "Evento creado/actualizado/borrado".

**Notas técnicas**
- `apps/web/src/features/calendar/components/EventFormSheet.tsx`, `RecurrencePicker.tsx`, `ReminderOffsetsPicker.tsx`, `ScopeDialog.tsx`.

**Tests**
- Componentes: RRULE generada para cada opción; cumpleaños; diálogo de alcance envía `scope` y `occurrence`.

---

### HOG-458 · Vista semana por calles

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-456
- **Spec:** `docs/specs/09-calendario.md#73-semana-por-calles`

**Descripción**
Vista "Semana" con una `Lane` por miembro (selector de día en móvil, columnas en ≥ 600 px) y calle final "Hogar" para elementos sin persona.

**Criterios de aceptación**
- [ ] Chips "17:30 Dentista" en la calle del dueño; todo el día primero.
- [ ] Eventos de varios días en cada día con "día 2 de 5".
- [ ] Calle "Hogar" (sin color de calle) preparada para las capas (HOG-460, HOG-561).
- [ ] Tocar un chip abre el detalle.
- [ ] 375 px sin scroll horizontal dentro de las calles.

**Tests**
- Componentes: distribución de eventos por calle y día.

---

### HOG-459 · Vista mes

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-456
- **Spec:** `docs/specs/09-calendario.md#74-mes`

**Descripción**
Rejilla de 6 semanas con puntos por dueño y lista del día seleccionado.

**Criterios de aceptación**
- [ ] Consulta de 42 días; lunes primero; hoy resaltado.
- [ ] Hasta 3 indicadores por día y "+N"; `aria-label` por día ("12 de noviembre, 3 eventos").
- [ ] Tocar un día muestra su lista bajo la rejilla.
- [ ] La capa Horarios no se pinta en esta vista.

**Tests**
- Componentes: indicadores y "+N"; selección de día.

---

### HOG-460 · Capas de solo lectura: tareas y horarios

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P2 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-458, HOG-459, HOG-405, HOG-352
- **Spec:** `docs/specs/09-calendario.md#3-reglas-de-negocio`

**Descripción**
Hoja "Capas" con interruptores persistidos en `localStorage` y pintado de las capas Tareas y Horarios en agenda, semana y mes según RN-09-23 a RN-09-25. Deja el registro de capas preparado para "Facturas" (HOG-561).

**Criterios de aceptación**
- [ ] Interruptores "Tareas", "Horarios de trabajo" (y "Facturas" oculto hasta HOG-561); por defecto Tareas sí, Horarios no; guardado en `hogaria:calendar-layers:<groupId>` con `try/catch`.
- [ ] Tareas: solo `nextDueAt` en el rango, en la calle del asignado o en "Hogar"; tocar → `/g/:g/tareas?destacar=<id>`.
- [ ] Horarios: primer chip "Turno 08:00–15:00" o estado ("Vacaciones") en la calle del miembro (agenda y semana; no en mes); tocar → `/g/:g/horarios?semana=<lunes>`.
- [ ] Estilo secundario (borde discontinuo e icono del módulo); usan las mismas claves de Query que sus módulos para refrescarse en tiempo real.
- [ ] Si falla una capa, aviso "No se han podido cargar las tareas" en la hoja y el resto se muestra.

**Notas técnicas**
- `apps/web/src/features/calendar/layers/` con un registro `{ id, label, useItems(range) }` por capa.

**Tests**
- Componentes: interruptores persisten; capa que falla no rompe la vista.

---

### HOG-461 · E2E-10: propiedad de eventos

- **Épica:** E09 · **Fase:** 4 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-457, HOG-011
- **Spec:** `docs/specs/09-calendario.md#11-tests`

**Descripción**
Flujo crítico E2E-10 de `docs/07-testing.md` con dos contextos de navegador.

**Criterios de aceptación**
- [ ] `apps/web/e2e/calendar.e2e.ts`: Ana crea "Dentista" → lo ve con "Editar"; Óscar abre "Dentista" → ve "Solo Ana puede cambiar este evento" sin "Editar" ni "Borrar"; Óscar crea uno propio y lo edita.
- [ ] Pasa en Mobile Chrome (Pixel 7) y Mobile Safari (iPhone 14).

**Tests**
- E2E: E2E-10.
