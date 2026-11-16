# 09 · Calendario y eventos

> Épica: E09 · Tickets: `docs/tickets/E09-calendario.md` · Modelo: `docs/02-modelo-datos.md` (sección "Calendario": `CalendarEvent`, enum `EventCategory`) · Recordatorios: `docs/specs/12-notificaciones.md`

## 1. Objetivo

Un calendario **compartido por el grupo** donde cada miembro apunta sus citas, cumpleaños y planes, y ve los de los demás en solo lectura. Admite eventos de todo el día, recurrentes (cumpleaños anual, extraescolar semanal) y varios recordatorios push para el dueño. Además, superpone en solo lectura lo que ya existe en otros módulos (tareas con fecha, horarios de trabajo y vencimientos de facturas) para tener la semana entera en un sitio.

## 2. Historias de usuario

- **US-09-01** Como miembro, quiero crear un evento con fecha, hora, lugar y categoría para que el hogar sepa lo que tengo.
- **US-09-02** Como miembro, quiero apuntar el cumpleaños de alguien como evento de todo el día que se repite cada año.
- **US-09-03** Como miembro, quiero recibir uno o varios avisos antes de mis eventos (el día antes y una hora antes).
- **US-09-04** Como miembro, quiero ver los eventos de todos en agenda, semana (por calles) y mes.
- **US-09-05** Como miembro, quiero ver los eventos de los demás sin poder editarlos ni borrarlos.
- **US-09-06** Como dueño de un evento recurrente, quiero cambiar o borrar solo una fecha o toda la serie.
- **US-09-07** Como miembro, quiero activar capas con las tareas con fecha, los horarios de trabajo y los vencimientos de facturas.

## 3. Reglas de negocio

**Propiedad**

- **RN-09-01** Todo evento tiene `ownerId` = usuario que lo crea. Nadie puede cambiar el dueño (el campo no existe en la entrada de `PATCH`).
- **RN-09-02** Solo el dueño puede editar o borrar un evento → si no, `403 FORBIDDEN_NOT_OWNER`. Todos los miembros del grupo lo ven.
- **RN-09-03** El evento pertenece a un solo grupo (`groupId`). Un usuario con varios grupos ve en cada uno solo los eventos de ese grupo.

**Campos y validación**

- **RN-09-04** `title` 1–120 caracteres (recortado); `description` ≤ 2000 o `null`; `location` ≤ 200 o `null`; `category` del enum `EventCategory` (por defecto `GENERAL`).
- **RN-09-05** Evento **con hora** (`allDay = false`): la entrada lleva `startsAt` y `endsAt` (ISO UTC), `endsAt > startsAt`, duración máxima 14 días.
- **RN-09-06** Evento **de todo el día** (`allDay = true`): la entrada lleva `startDate` y `endDate` (`YYYY-MM-DD`, ambos inclusive, `endDate ≥ startDate`, como mucho 31 días). Se guarda `startsAt` = 00:00 local de `startDate` y `endsAt` = 00:00 local del día **siguiente** a `endDate`, en la zona del grupo (fin exclusivo). La salida devuelve las cuatro propiedades.
- **RN-09-07** `startsAt` entre hoy − 5 años y hoy + 10 años; si no → `422`.

**Recurrencia**

- **RN-09-08** `rrule` es `null` (puntual) o una cadena RFC 5545 **sin `DTSTART`** (el inicio es `startsAt`). Subconjunto permitido (cualquier otra clave → `422`):
  - `FREQ` = `DAILY` | `WEEKLY` | `MONTHLY` | `YEARLY` (obligatorio).
  - `INTERVAL` = 1–99 (opcional, por defecto 1).
  - `BYDAY` = lista de `MO,TU,WE,TH,FR,SA,SU`, **solo** con `FREQ=WEEKLY`.
  - Como mucho uno de: `COUNT` = 1–730, o `UNTIL` = `YYYYMMDDTHHmmss` en hora local flotante (sin `Z`), ≥ inicio.
  - Ejemplos: cumpleaños `FREQ=YEARLY`; extraescolar `FREQ=WEEKLY;BYDAY=MO,WE`; cada 2 semanas hasta fin de curso `FREQ=WEEKLY;INTERVAL=2;UNTIL=20270625T235959`.
- **RN-09-09** **Expansión en hora de pared** (función pura `expandEventOccurrences(event, from, to, tz)` en `packages/shared`): las ocurrencias conservan la hora local del evento aunque cambie el horario de verano. Algoritmo:
  1. Convertir `startsAt` a hora de pared en `tz` y representarla como fecha "flotante" (un `Date` cuyos campos UTC son los campos locales).
  2. `RRule.fromString(rrule)` con `dtstart` = esa fecha flotante y sin `tzid`.
  3. `rule.between(flotante(from) − duración, flotante(to), true)`.
  4. Cada ocurrencia flotante se convierte a instante real con `zonedToUtc(campos, tz)` → `occurrenceStartsAt`. Fin: con hora, `occurrenceStartsAt + (endsAt − startsAt)`; de todo el día, 00:00 local del día `inicio + nDías`.
  5. Se descartan las que están en `exdates` (comparación exacta de instante con `occurrenceStartsAt`).
  6. Se devuelven las que se solapan con `[from, to)`.
  Las horas inexistentes o ambiguas se resuelven como en RN-08-20 (adelante; primera).
- **RN-09-10** **Meses y años cortos** (comportamiento RFC 5545, sin corrección): `FREQ=MONTHLY` desde un día 31 solo ocurre en meses de 31 días; `FREQ=YEARLY` desde el 29 de febrero solo ocurre en años bisiestos. El formulario avisa: "Este evento solo se repetirá en los meses que tengan día 31" / "Este evento solo se repetirá en los años bisiestos".
- **RN-09-11** **Clave de ocurrencia:** cada ocurrencia se identifica por `(eventId, occurrenceStartsAt)`. Para un evento puntual, `occurrenceStartsAt = startsAt`.

**Editar y borrar ocurrencias** (`?scope=this|all&occurrence=<ISO>`)

- **RN-09-12** En un evento **puntual**, `scope` se ignora (o debe ser `all`); `occurrence` no se usa.
- **RN-09-13** En un evento **recurrente**, `scope` es obligatorio en `PATCH` y `DELETE` → si falta, `422`. Con `scope=this`, `occurrence` es obligatorio y debe ser una ocurrencia real no excluida de la serie (comprobado expandiendo un rango de ±1 día alrededor) → si no, `404 NOT_FOUND`.
- **RN-09-14** `DELETE ?scope=this&occurrence=X`: añade `X` a `exdates` de la serie. Emite `event.updated` con la serie.
- **RN-09-15** `PATCH ?scope=this&occurrence=X` (en una transacción):
  1. Añade `X` a `exdates` de la serie.
  2. Crea un evento **nuevo y puntual** (`rrule = null`, `exdates = []`) del mismo dueño, copiando los campos de la serie, sustituyendo `startsAt`/`endsAt` por los de la ocurrencia `X` y aplicando encima los campos del `PATCH`.
  3. El `PATCH` con `scope=this` **no** puede incluir `rrule` → `422`.
  Respuesta `{ series, detached }`. Emite `event.updated` (serie) y `event.created` (nuevo). El evento nuevo no queda enlazado a la serie: si después se borra la serie, el nuevo permanece.
- **RN-09-16** `PATCH ?scope=all`: modifica la serie. Si cambian `startsAt`, `allDay`, `startDate` o `rrule`, se **vacía `exdates`** (las exclusiones antiguas ya no corresponden a ninguna ocurrencia). El formulario lo avisa antes de guardar: "Las fechas que borraste de esta serie volverán a aparecer".
- **RN-09-17** `DELETE ?scope=all` (o evento puntual): borrado físico del evento.
- **RN-09-18** Convertir un evento recurrente en puntual = `PATCH ?scope=all` con `rrule: null` (se queda solo la primera ocurrencia, la de `startsAt`).

**Recordatorios**

- **RN-09-19** `reminderMinutesBefore` es un array de 0 a 5 valores **distintos**, cada uno de la lista permitida:
  - Evento con hora: `EVENT_REMINDER_OFFSETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]` ("A la hora del evento", "5 min antes", …, "1 día antes", "2 días antes", "1 semana antes").
  - Evento de todo el día: `ALL_DAY_REMINDER_OFFSETS = [0, 1440, 2880, 10080]` ("El mismo día a las 9:00", "El día antes a las 9:00", "2 días antes a las 9:00", "1 semana antes a las 9:00").
  Un valor fuera de la lista correspondiente → `422`.
- **RN-09-20** Instante de aviso (`fireAt`) de cada ocurrencia y cada valor:
  - Con hora: `fireAt = occurrenceStartsAt − minutos`.
  - Todo el día: `fireAt = zonedToUtc(fecha de inicio de la ocurrencia + "09:00", tz) − minutos` (constante `ALL_DAY_REMINDER_TIME = "09:00"`).
- **RN-09-21** Los recordatorios de evento **solo los recibe el dueño** (`ownerId`). El proveedor `EVENT` del `ReminderScheduler` (ver `docs/specs/12-notificaciones.md` §3.4) los materializa para las ocurrencias cuyo `fireAt` cae en los próximos 7 días. Tras cada `POST`, `PATCH` o `DELETE` (cualquier `scope`), el servicio llama, después del commit, a `scheduler.upsertForSource('EVENT', id)` (serie y, si existe, evento nuevo) o `scheduler.cancelForSource('EVENT', id)` si se borra la serie.
- **RN-09-22** Contenido del push: `title` = `"<emoji de categoría> <título>"` (p. ej. "🎂 Cumpleaños de Lucía"); `body` = `"jue 12 nov · 17:30 · Clínica Dental Sonrisa"` (fecha corta, hora local o "todo el día", y lugar si existe); `url` = `/g/<groupId>/calendario?fecha=<YYYY-MM-DD local>&destacar=<id>&ocurrencia=<occurrenceStartsAt ISO>` (`ocurrencia` solo en eventos recurrentes).

**Capas de solo lectura**

- **RN-09-23** El calendario superpone tres capas que **no son eventos** y nunca se editan desde el calendario (tocar un elemento navega a su módulo):
  | Capa | Fuente | Qué muestra | Al tocar |
  |---|---|---|---|
  | Tareas | `GET /groups/:g/tasks` (E07) | Tareas no archivadas con `nextDueAt` en el rango: **solo la próxima ocurrencia pendiente** de cada tarea | `/g/:g/tareas?destacar=<id>` |
  | Horarios | `GET /groups/:g/work-schedules?from&to` (E08) | Turnos efectivos y estados Libre/Vacaciones/Baja de cada miembro | `/g/:g/horarios?semana=<lunes>` |
  | Facturas | `GET /groups/:g/bill-payments?from&to&status=PENDING` (E11) | Recibos pendientes por `periodDueDate` (solo los materializados: próximos 60 días) | `/g/:g/facturas?destacar=<id>` |
- **RN-09-24** Las capas se activan con interruptores; el estado se guarda en `localStorage` (`hogaria:calendar-layers:<groupId>`) con valores por defecto Tareas: sí · Horarios: no · Facturas: sí. Si `localStorage` falla, se usan los valores por defecto. Los eventos del calendario siempre se muestran.
- **RN-09-25** La composición de capas se hace **en el cliente** con las consultas de cada módulo y las mismas claves de TanStack Query que usan esos módulos, para que sus eventos en tiempo real también refresquen el calendario. No hay endpoint agregado.

## 4. Modelo de datos

`CalendarEvent` (enum `EventCategory`) y `Reminder` (`sourceType = EVENT`) de `docs/02-modelo-datos.md`. Sin cambios de esquema.

Constantes en `packages/shared/src/constants/calendar.ts`:

```ts
export const EVENT_CATEGORY_META = {
  GENERAL:  { label: 'General',    emoji: '📌', icon: 'CalendarDays' },
  BIRTHDAY: { label: 'Cumpleaños', emoji: '🎂', icon: 'Cake' },
  MEDICAL:  { label: 'Médico',     emoji: '🩺', icon: 'Stethoscope' },
  SCHOOL:   { label: 'Colegio',    emoji: '🎒', icon: 'School' },
  WORK:     { label: 'Trabajo',    emoji: '💼', icon: 'Briefcase' },
  SOCIAL:   { label: 'Social',     emoji: '🥂', icon: 'Users' },
  TRAVEL:   { label: 'Viaje',      emoji: '✈️', icon: 'Plane' },
  OTHER:    { label: 'Otros',      emoji: '🏷️', icon: 'Tag' },
} as const;
export const EVENT_REMINDER_OFFSETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080] as const;
export const ALL_DAY_REMINDER_OFFSETS = [0, 1440, 2880, 10080] as const;
export const ALL_DAY_REMINDER_TIME = '09:00';
```

## 5. API

Rutas bajo `/api/v1/groups/:groupId`, con `AuthGuard` + `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/calendar.ts`.

```ts
const eventBase = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().default(null),
  location: z.string().trim().max(200).nullable().default(null),
  category: z.enum(EVENT_CATEGORIES).default('GENERAL'),
  rrule: rruleString.nullable().default(null),          // RN-09-08 (refine con parser propio + rrule)
  reminderMinutesBefore: z.array(z.number().int()).max(5).default([]), // refine: únicos y de la lista según allDay
});

export const createCalendarEventInput = z.discriminatedUnion('allDay', [
  eventBase.extend({ allDay: z.literal(false), startsAt: z.string().datetime(), endsAt: z.string().datetime() }),
  eventBase.extend({ allDay: z.literal(true),  startDate: isoDate, endDate: isoDate }),
]);

// PATCH: todos los campos opcionales. Si se envía allDay, deben venir sus campos de fecha correspondientes.
// Si no se envía allDay, se admiten startsAt/endsAt (evento con hora) o startDate/endDate (todo el día) según el evento actual.
export const updateCalendarEventInput = z.object({
  title, description, location, category, rrule, reminderMinutesBefore,   // .optional()
  allDay: z.boolean().optional(),
  startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional(),
  startDate: isoDate.optional(), endDate: isoDate.optional(),
});

export const eventScopeQuery = z.object({
  scope: z.enum(['this', 'all']).optional(),           // obligatorio si el evento es recurrente
  occurrence: z.string().datetime().optional(),        // obligatorio con scope=this
});

export const calendarEventDto = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(), ownerId: z.string().uuid(),
  title: z.string(), description: z.string().nullable(), location: z.string().nullable(),
  category: z.enum(EVENT_CATEGORIES), allDay: z.boolean(),
  startsAt: z.string().datetime(), endsAt: z.string().datetime(),
  startDate: isoDate, endDate: isoDate,                 // días locales (endDate inclusive) — también en eventos con hora
  rrule: z.string().nullable(), exdates: z.array(z.string().datetime()),
  reminderMinutesBefore: z.array(z.number().int()),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const calendarOccurrenceDto = calendarEventDto.extend({
  occurrenceStartsAt: z.string().datetime(),
  occurrenceEndsAt: z.string().datetime(),
  isRecurring: z.boolean(),
});

export const listEventsQuery = z.object({
  from: z.string().datetime(), to: z.string().datetime(),   // to > from, máximo 62 días
  ownerId: z.string().uuid().optional(),
});
```

| Método | Ruta | Entrada | Salida | Errores |
|---|---|---|---|---|
| GET | `/groups/:g/events?from&to[&ownerId]` | `listEventsQuery` | `{ items: calendarOccurrenceDto[] }` ordenado por `occurrenceStartsAt`, sin paginar | 401, 404, 422 (rango > 62 días) |
| GET | `/groups/:g/events/:id[?occurrence]` | `occurrence` opcional | `calendarOccurrenceDto` (sin `occurrence`: la primera ocurrencia ≥ ahora, o la última si ya pasaron todas) | 401, 404 |
| POST | `/groups/:g/events` | `createCalendarEventInput` | 201 `calendarEventDto` | 401, 404, 422 |
| PATCH | `/groups/:g/events/:id?scope&occurrence` | `updateCalendarEventInput` + `eventScopeQuery` | `scope=all`/puntual: `calendarEventDto` · `scope=this`: `{ series: calendarEventDto, detached: calendarEventDto }` | 401, 403 `FORBIDDEN_NOT_OWNER`, 404, 422 |
| DELETE | `/groups/:g/events/:id?scope&occurrence` | `eventScopeQuery` | 204 | 401, 403, 404, 422 |

Consulta del listado: `where: { groupId, OR: [{ rrule: null, startsAt: { lt: to }, endsAt: { gt: from } }, { rrule: { not: null }, startsAt: { lt: to } }] }` y expansión en memoria. Las series con `UNTIL`/`COUNT` agotados se descartan tras expandir.

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `event.created` | `POST`, y el evento nuevo de un `PATCH scope=this` | `CalendarEventDto` |
| `event.updated` | `PATCH scope=all`, y la serie en `PATCH`/`DELETE scope=this` | `CalendarEventDto` |
| `event.deleted` | `DELETE scope=all` o de un evento puntual | `{ id }` |

Cliente: cualquier `event.*` invalida `['group', groupId, 'events']` (todos los rangos), porque un cambio de serie afecta a muchas ocurrencias. Si el autor es otro, la fila o bloque del evento hace la **onda** al reaparecer.

## 7. Pantallas y UX

Ruta: `/g/:groupId/calendario` (desde "Más" → "Calendario"). Parámetros: `?vista=agenda|semana|mes` (por defecto `agenda`), `?fecha=YYYY-MM-DD` (día de referencia, por defecto hoy) y `?destacar=<id>` con `&ocurrencia=<ISO>` en los eventos recurrentes (abre la hoja de detalle y reproduce la onda; es el destino de los avisos push y de los enlaces del asistente y del Inicio, que llevan también `?fecha=`; convención de `docs/08`).

### 7.1 Estructura común

- Cabecera: "Calendario", `SegmentedControl` "Agenda · Semana · Mes", navegador "‹ noviembre 2026 ›" / "‹ 9–15 nov ›" y "Hoy".
- Botón "Capas" → hoja con interruptores "Tareas", "Horarios de trabajo", "Facturas" (RN-09-24).
- `Fab` "+" → hoja "Nuevo evento" con la fecha de referencia precargada.
- Cada evento muestra el `MemberDot` de su dueño; el color de calle del dueño tiñe el borde izquierdo del bloque. Los elementos de capas usan estilo secundario (borde discontinuo, icono de su módulo: `CheckSquare` tareas, `Briefcase` horarios, `Receipt` facturas) y nunca el color de calle como relleno.
- Recibos vencidos en la capa Facturas: texto "Vencida" y `LaneRope` variante `limit` como separador (nunca solo color).

### 7.2 Agenda (lista)

- Lista por días desde la fecha de referencia hasta +30 días ("Hoy", "Mañana", "jueves 12 de noviembre"). Carga más al llegar al final (siguiente bloque de 30 días).
- Fila: hora ("17:30–18:30" o "Todo el día"), emoji de categoría, título, lugar, `MemberDot` del dueño, icono de repetición si es recurrente.
- Vacío: `EmptyState` "No hay nada en el calendario en los próximos 30 días" + "Crear evento".

### 7.3 Semana por calles

- Patrón "Semana por calles" de `DESIGN.md`: en el móvil, selector de día "L M X J V S D" y una `Lane` por miembro con sus eventos del día como chips ("17:30 Dentista"); en ≥ 600 px, días en columnas.
- Con la capa Horarios activa, el turno del miembro aparece como primer chip de su calle ("Turno 08:00–15:00").
- Las tareas con asignado aparecen en la calle del asignado; las tareas sin asignado y las facturas aparecen en una calle final "Hogar" (sin color de calle, borde `--grout-strong`).
- Los eventos de todo el día van primero en la calle.

### 7.4 Mes

- Rejilla de 6 semanas (lunes a domingo), día actual resaltado. Cada día muestra como mucho 3 puntos (`MemberDot` de 8 px por dueño de eventos; icono pequeño para tareas y facturas) y "+N".
- La capa Horarios **no** se dibuja en la vista mes (demasiado densa).
- Tocar un día → lista de ese día bajo la rejilla (mismo formato que la agenda).

### 7.5 Detalle de evento (hoja)

- Título, categoría, fechas ("jueves 12 de noviembre · 17:30–18:30" o "Todo el día"), repetición en texto ("Cada año", "Cada semana el lunes y el miércoles hasta el 25 de junio de 2027"), lugar, descripción, recordatorios ("1 día antes, 1 hora antes") y dueño ("Creado por Ana").
- **Si soy el dueño:** botones "Editar" y "Borrar".
- **Si no soy el dueño:** sin botones de edición, con el aviso "Solo Ana puede cambiar este evento". Los recordatorios no se muestran (son del dueño).

### 7.6 Crear o editar evento (hoja)

- Campos: "Título" (autofocus), "Categoría" (chips con emoji), interruptor "Todo el día", "Empieza" / "Termina" (fecha + hora, o solo fecha), "Repetir" (No se repite · Cada día · Cada semana · Cada mes · Cada año · Personalizado), "Lugar", "Descripción", "Avisos" (lista de chips con los valores permitidos; "+ Añadir aviso", máximo 5).
- Al elegir la categoría "Cumpleaños" en un evento nuevo: activa "Todo el día", pone "Repetir: Cada año" y un aviso "El día antes a las 9:00" (el usuario puede cambiarlo).
- "Personalizado": "Cada [N] [días/semanas/meses/años]", con semanas los días "L M X J V S D", y "Termina: Nunca · El [fecha] · Tras [N] veces".
- Cambiar "Empieza" mueve "Termina" para conservar la duración.
- Avisos de RN-09-10 en línea.
- Si hay algún aviso y los permisos de notificación del dispositivo no están concedidos, al guardar se abre el `NotificationPrompt` de E12 (ver `docs/specs/12-notificaciones.md` §7.3).
- **Editar o borrar un evento recurrente:** antes de enviar, `Dialog` "¿Qué quieres cambiar?" / "¿Qué quieres borrar?" con "Solo este evento" (`scope=this`) · "Todos los eventos de la serie" (`scope=all`) · "Cancelar". En "Solo este evento" no se muestra el campo "Repetir".
- Borrar un evento puntual: `Dialog` "¿Borrar «Dentista»?" [Borrar] [Cancelar].
- Toasts: "Evento creado", "Evento actualizado", "Evento borrado".

### 7.7 Estados

- Cargando: skeleton de 5 filas (agenda), de calles (semana) o rejilla (mes).
- Error: `ErrorState` "No hemos podido cargar el calendario" + "Reintentar". Si falla solo una capa, aviso discreto en la hoja de capas: "No se han podido cargar las facturas" y el resto se muestra.
- Sin conexión: `OfflineBanner`; `Fab`, "Editar" y "Borrar" deshabilitados.
- Evento no encontrado (enlace o push de un evento borrado): toast "Este evento ya no existe" y se queda en la vista.

## 8. Permisos

| Acción | Quién |
|---|---|
| Ver eventos y ocurrencias del grupo | Cualquier miembro |
| Crear evento | Cualquier miembro (queda como dueño) |
| Editar, borrar, cambiar recordatorios | Solo el dueño (`403 FORBIDDEN_NOT_OWNER`) |
| Recibir avisos push del evento | Solo el dueño |

## 9. Actividad

`entityType = "calendar_event"`. Fecha corta en la zona del grupo.

| Acción | `action` | `summary` |
|---|---|---|
| Crear | `created` | "creó el evento Dentista (jue 12 nov)" |
| Editar (`scope=all` o puntual) | `updated` | "editó el evento Dentista" |
| Editar solo una fecha (`scope=this`) | `updated` | "cambió el evento Extraescolar del lun 16 nov" |
| Borrar (`scope=all` o puntual) | `deleted` | "borró el evento Dentista" |
| Borrar solo una fecha | `updated` | "quitó el evento Extraescolar del lun 16 nov" |

## 10. Casos límite

- **DST:** evento semanal "lunes 10:00" creado en octubre sigue a las 10:00 local tras el cambio de hora del 25/10/2026 (instante UTC distinto). Cumpleaños de todo el día el 29/03 se muestra en el día correcto aunque ese día dure 23 h.
- **Evento con hora que cruza medianoche** (cena 21:00–01:00): aparece en el día de inicio en agenda y semana; en el mes cuenta solo en el día de inicio.
- **Evento de varios días** (viaje del 10 al 14, todo el día): aparece en cada día del rango en agenda, semana y mes (con indicador "día 2 de 5").
- **Ocurrencia en el límite del rango:** la consulta resta la duración del evento al inicio (RN-09-09 paso 3) para incluir ocurrencias que empezaron antes de `from` y siguen activas.
- **`scope=this` sobre una ocurrencia ya excluida** → `404`. Sobre la primera ocurrencia → funciona igual (se excluye `startsAt` de la serie).
- **Todas las ocurrencias excluidas:** la serie sigue existiendo pero no muestra nada. No se borra sola.
- **Recordatorio con `fireAt` en el pasado** (evento creado para dentro de 10 min con aviso de 1 h): no se crea ese recordatorio; los demás sí.
- **Dueño sale del grupo:** sus eventos de ese grupo se borran (manejador de E09 en `MemberRemovedHooks`, spec 02 RN-02-22, ADR-019) y sus recordatorios se cancelan (`scheduler.cancelForUserInGroup`). **Dueño borra su cuenta:** se borran todos sus eventos (`docs/02` nota de `CalendarEvent`).
- **Zona horaria del grupo distinta de la del dispositivo:** todo se muestra en la zona del grupo (`lib/dates.ts`), nunca en la del navegador.
- **Rango de consulta > 62 días** → `422`. La vista mes pide 42 días; la agenda bloques de 30.
- **`UNTIL` anterior al inicio** → `422`. `COUNT` y `UNTIL` juntos → `422`. `BYDAY` con `FREQ=MONTHLY` → `422`.
- **Concurrencia:** dos dispositivos del dueño editan a la vez → last-write-wins.

## 11. Tests

- **Unit (`packages/shared`):** `expandEventOccurrences` (puntual, semanal con `BYDAY`, anual de cumpleaños, `COUNT`, `UNTIL`, `exdates`, DST marzo/octubre, día 31 mensual, 29 de febrero anual, evento de varios días, todo el día); validador de `rrule` (claves permitidas y combinaciones prohibidas); cálculo de `fireAt` (con hora y todo el día a las 9:00); formato del `body` del push.
- **Integración (`apps/api/test/calendar.int.spec.ts`):** CRUD; listado con expansión y orden; `PATCH scope=this` crea evento y añade `exdate` en una transacción; `scope=all` vacía `exdates` al cambiar `startsAt`; `DELETE scope=this`; `422` sin `scope` en recurrente; `403 FORBIDDEN_NOT_OWNER` al editar o borrar como otro miembro; `404` desde otro grupo; `401` sin sesión; eventos realtime emitidos; llamadas a `scheduler.upsertForSource`/`cancelForSource` (scheduler simulado); proveedor `EVENT` devuelve recordatorios solo para el dueño y solo en el horizonte.
- **Componentes:** formulario (cumpleaños autoconfigura, avisos de meses cortos, diálogo de alcance), hoja de detalle en solo lectura para no dueños.
- **E2E-10** (`apps/web/e2e/calendar.e2e.ts`): Ana crea un evento → lo ve editable; Óscar (mismo grupo) abre el evento de Ana → ve "Solo Ana puede cambiar este evento" y no hay botones "Editar" ni "Borrar"; Óscar crea uno propio y sí puede editarlo.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `GET /groups/:g/events/:id?occurrence=` → `docs/04` (fila "Calendario").
- Comentarios de `allDay`/`endsAt` y `exdates` → `docs/02`.
- Glosario "Ocurrencia", "Solo este evento / Toda la serie", "Capas del calendario" y categorías → `docs/10`.
- Borrar los eventos del miembro que sale y `cancelForUserInGroup` → spec 02 (RN-02-22) y ADR-019.
- Deep link `?fecha=&destacar=<eventId>[&ocurrencia=<ISO>]` (sustituye a `?event=&occurrence=`) → `docs/08`, `docs/02` (`Reminder.url`) y RN-09-22/§7 de esta spec.

## 13. Fuera de alcance

- Sincronización con Google Calendar u otros (importar/exportar ICS).
- Invitados o asistentes a un evento; eventos de otros como "míos".
- "Este y los siguientes" al editar una serie.
- Recurrencias complejas (`BYMONTHDAY`, `BYSETPOS`, "el segundo martes de cada mes").
- Arrastrar y soltar eventos en las vistas.
- Avisos push para eventos de otros miembros.
