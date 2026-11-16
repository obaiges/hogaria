# 08 · Horarios de trabajo

> Épica: E08 · Tickets: `docs/tickets/E08-horarios.md` · Modelo: `docs/02-modelo-datos.md` (sección "Horarios de trabajo (personales)": `WorkSchedule`, `WorkScheduleSlot`, `WorkShiftOverride`)

## 1. Objetivo

Que cada miembro del hogar sepa de un vistazo **quién trabaja y cuándo** esta semana, para coordinar comidas, recogidas y tareas. Cada persona define su horario habitual (normalmente fijo, pero configurable por periodos) y marca las excepciones (libre, vacaciones, baja, horario especial). El horario es **personal**: solo lo edita su dueño y lo ven todos los miembros de cualquiera de sus grupos.

## 2. Historias de usuario

- **US-08-01** Como miembro, quiero ver en una sola pantalla el horario de esta semana de todos los miembros del hogar, una calle por persona, para organizar el día.
- **US-08-02** Como miembro, quiero definir mi horario habitual por días de la semana con varias franjas por día (jornada partida) para no tener que apuntarlo cada semana.
- **US-08-03** Como miembro con turnos de noche, quiero que una franja pueda terminar al día siguiente (22:00–06:00).
- **US-08-04** Como miembro, quiero aplicar una plantilla rápida ("L–V 8:00–15:00") y copiar un día a otros para configurar el horario en pocos toques.
- **US-08-05** Como miembro, quiero tener varios horarios con fechas de validez (por ejemplo, "Horario de verano" del 15/06 al 15/09) para que el horario cambie solo.
- **US-08-06** Como miembro, quiero marcar un día (o varios) como libre, vacaciones, baja u horario especial sin tocar mi horario habitual.
- **US-08-07** Como miembro, quiero ver los horarios de los demás en solo lectura, sin poder modificarlos.

## 3. Reglas de negocio

**Horarios (`WorkSchedule`)**

- **RN-08-01** Un horario pertenece a un único usuario (`userId`) y **no** pertenece a un grupo: el mismo horario se muestra en todos los grupos del usuario.
- **RN-08-02** Solo el dueño puede crear, editar o borrar sus horarios y excepciones. Las rutas de escritura son `/me/...`, así que no existe forma de editar el horario de otro (no hace falta comprobar `ownerId` en la ruta; en `PATCH`/`DELETE /me/work-schedules/:id` se busca por `id` **y** `userId = user.id`; si no existe → `404 NOT_FOUND`).
- **RN-08-03** Los rangos de validez `[validFrom, validTo]` (ambos inclusive; `validTo = null` = indefinido) de los horarios de un mismo usuario **no se solapan**. Si se solapan → `409 CONFLICT` con `detail: "Ya tienes un horario vigente en esas fechas"`.
- **RN-08-04** Al crear un horario con `closeOverlapping: true`, si existe **exactamente un** horario que se solapa y empieza **antes** que el nuevo (`existing.validFrom < new.validFrom`), en la misma transacción se fija `existing.validTo = new.validFrom − 1 día`. En cualquier otro caso de solape se responde `409 CONFLICT`.
- **RN-08-05** `validTo`, si existe, es ≥ `validFrom`. Si no → `422 VALIDATION_ERROR`.
- **RN-08-06** Un usuario tiene como máximo 20 horarios. El 21.º → `422 VALIDATION_ERROR` (`detail: "Has llegado al máximo de 20 horarios"`).
- **RN-08-07** Un horario tiene entre 0 y 21 franjas. Un horario sin franjas es válido (significa "no trabajo en este periodo", por ejemplo una excedencia).

**Franjas (`WorkScheduleSlot`, en la UI "turno")**

- **RN-08-08** `weekday` va de 1 (lunes) a 7 (domingo), ISO 8601. `startTime` y `endTime` tienen formato `HH:mm` de 24 h, con minutos múltiplos de 5 (`^([01]\d|2[0-3]):[0-5][05]$`).
- **RN-08-09** Si `endTime < startTime`, la franja **termina al día siguiente** (turno nocturno). `endTime = startTime` no se permite → `422` (`"La hora de fin debe ser distinta de la de inicio"`). Por tanto una franja dura como mucho 23 h 55 min.
- **RN-08-10** Las franjas de un horario, colocadas en una línea semanal circular de 10 080 minutos (lunes 00:00 = minuto 0; una franja nocturna del domingo continúa en el lunes), **no se solapan entre sí**. Dos franjas que se tocan (una acaba 14:00 y otra empieza 14:00) no se solapan. Si se solapan → `422` con `errors[].path = "slots.<i>"` y mensaje `"Se solapa con otra franja del <día>"`.
- **RN-08-11** `label` es opcional, máximo 40 caracteres ("Turno mañana", "Teletrabajo").
- **RN-08-12** Al editar un horario, si el `PATCH` incluye `slots`, **sustituye todas** las franjas (borrar e insertar en la misma transacción). Sin `slots`, las franjas no cambian.

**Excepciones (`WorkShiftOverride`)**

- **RN-08-13** Hay como mucho una excepción por usuario y día (`@@unique([userId, date])`). `PUT /me/work-shift-overrides/:date` crea o sustituye.
- **RN-08-14** Tipos: `DAY_OFF` "Libre", `VACATION` "Vacaciones", `SICK` "Baja", `CUSTOM` "Horario especial". Solo `CUSTOM` lleva `startTime` y `endTime` (obligatorios, misma validación que RN-08-08/09; puede cruzar medianoche). En el resto, `startTime` y `endTime` deben ser `null` → si no, `422`.
- **RN-08-15** `note` opcional, máximo 120 caracteres. **La nota es visible para todos los miembros** de los grupos del usuario (el formulario lo indica: "La verán los miembros de tus hogares").
- **RN-08-16** La creación masiva (`POST /me/work-shift-overrides/bulk`) aplica el mismo tipo y nota a cada día de `[from, to]` (máximo 62 días; si no → `422`). Con `onlyWorkingDays: true` solo crea excepción en los días en que el horario habitual tiene al menos una franja (sirve para "Vacaciones del 3 al 14 de agosto" sin marcar los fines de semana). `CUSTOM` no se permite en masivo → `422`. Sobrescribe las excepciones existentes en esos días.
- **RN-08-17** Se pueden crear excepciones en días pasados y futuros, en un rango de ±400 días respecto a hoy (zona del grupo de referencia, ver RN-08-21). Fuera de rango → `422`.

**Horario efectivo**

- **RN-08-18** El **horario efectivo** de un usuario en un día local `D` se calcula así (función pura `computeEffectiveDay` en `packages/shared`):
  1. Si hay excepción ese día: `DAY_OFF` → estado `DAY_OFF`, sin turnos; `VACATION` → `VACATION`; `SICK` → `SICK`; `CUSTOM` → estado `CUSTOM` con un único turno `startTime–endTime`.
  2. Si no, se busca el horario con `validFrom ≤ D ≤ (validTo ?? ∞)`. Si no hay ninguno → estado `NO_SCHEDULE` ("Sin horario").
  3. Si hay horario, los turnos son sus franjas con `weekday = díaISO(D)`, ordenadas por `startTime`. Si hay al menos una → estado `WORKING`; si no hay ninguna → `NOT_WORKING` ("No trabaja").
- **RN-08-19** Un turno nocturno **pertenece al día en que empieza**. La franja del viernes 22:00–06:00 aparece en el viernes con `endsNextDay = true`. Una excepción del sábado **no** anula el turno que empezó el viernes. En la vista, el sábado muestra la continuación como un chip secundario "hasta 06:00 (turno del viernes)", calculado en el cliente a partir del día anterior.
- **RN-08-20** Cada turno efectivo lleva, además de `startTime`/`endTime` locales, sus instantes `startsAt` y `endsAt` en UTC, calculados en la zona horaria del grupo consultado:
  - `startsAt = zonedToUtc(D + startTime, tz)`.
  - `endsAt = zonedToUtc((endsNextDay ? D + 1 : D) + endTime, tz)`.
  - **Hora inexistente** (adelanto de hora, último domingo de marzo, 02:00–02:59 en `Europe/Madrid`): se desplaza hacia delante la diferencia (02:30 → 03:30 CEST).
  - **Hora ambigua** (retraso de hora, último domingo de octubre, 02:00–02:59 se repite): se toma la **primera** (CEST, el instante anterior).
  - La duración que se muestra (`durationMinutes`) es `endsAt − startsAt` en minutos. Ejemplo: turno 22:00–06:00 del sábado 24/10/2026 → dura **9 h** (la noche del 25/10 se retrasa la hora). Turno 22:00–06:00 del sábado 28/03/2026 → dura **7 h**.
- **RN-08-21** Las horas `HH:mm` son horas de pared, sin zona. Se interpretan en la zona horaria (`Group.timezone`) del grupo desde el que se consulta. Si un usuario está en dos grupos con zonas distintas, en cada grupo ve sus horas igual ("08:00") y los instantes UTC difieren. Para validar fechas (RN-08-17) en rutas `/me` se usa la zona `Europe/Madrid`.
- **RN-08-22** El total semanal de horas de un miembro es la suma de `durationMinutes` de los turnos de los 7 días de la semana mostrada (los turnos que empiezan el domingo cuentan entero en esa semana). Se muestra con un decimal: "37,5 h".

**Vista de grupo**

- **RN-08-23** `GET /groups/:g/work-schedules?from&to` devuelve el horario efectivo de **cada miembro actual** del grupo para cada día de `[from, to]` (ambos inclusive, máximo 42 días; si no → `422`). Los miembros salen ordenados: primero el usuario actual, después por `joinedAt`.
- **RN-08-24** Los horarios de un usuario que ya no es miembro del grupo no aparecen en ese grupo.

## 4. Modelo de datos

Tablas de `docs/02-modelo-datos.md`: `WorkSchedule`, `WorkScheduleSlot`, `WorkShiftOverride` (enum `ShiftOverrideType`). Se borran en cascada con el usuario. Sin cambios de esquema (`WorkScheduleSlot.endTime`: si `endTime < startTime` el turno acaba al día siguiente; `endTime = startTime` no se permite).

Constantes nuevas en `packages/shared/src/constants/work-schedules.ts`:

```ts
export const SHIFT_OVERRIDE_LABELS = {
  DAY_OFF: 'Libre', VACATION: 'Vacaciones', SICK: 'Baja', CUSTOM: 'Horario especial',
} as const;

export const EFFECTIVE_DAY_STATUS = ['WORKING', 'NOT_WORKING', 'NO_SCHEDULE', 'DAY_OFF', 'VACATION', 'SICK', 'CUSTOM'] as const;
export const EFFECTIVE_DAY_STATUS_LABELS = {
  WORKING: 'Trabaja', NOT_WORKING: 'No trabaja', NO_SCHEDULE: 'Sin horario',
  DAY_OFF: 'Libre', VACATION: 'Vacaciones', SICK: 'Baja', CUSTOM: 'Horario especial',
} as const;

// Plantillas rápidas: solo rellenan el formulario; no se guardan como entidad.
export const WORK_SCHEDULE_TEMPLATES = [
  { id: 'weekdays-8-15',   label: 'L–V 8:00–15:00',  slots: weekdays(['08:00', '15:00']) },
  { id: 'weekdays-9-17',   label: 'L–V 9:00–17:00',  slots: weekdays(['09:00', '17:00']) },
  { id: 'weekdays-split',  label: 'L–V partida 9:00–14:00 y 16:00–19:00', slots: weekdays(['09:00', '14:00'], ['16:00', '19:00']) },
  { id: 'weekdays-night',  label: 'L–V noche 22:00–6:00', slots: weekdays(['22:00', '06:00']) },
  { id: 'weekend-10-14',   label: 'Fines de semana 10:00–14:00', slots: weekend(['10:00', '14:00']) },
] as const;
// weekdays(...) genera la franja para weekday 1..5; weekend(...) para 6..7. label de franja = null.
```

## 5. API

Base `/api/v1`. Todas requieren sesión (`AuthGuard`). Las rutas de grupo, además, `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/work-schedules.ts`.

```ts
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5][05]$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);       // YYYY-MM-DD válido (refine)

export const workScheduleSlotInput = z.object({
  weekday: z.number().int().min(1).max(7),
  startTime: hhmm,
  endTime: hhmm,                                   // refine: endTime !== startTime
  label: z.string().trim().max(40).nullable().default(null),
});

export const createWorkScheduleInput = z.object({
  name: z.string().trim().min(1).max(60),
  validFrom: isoDate,
  validTo: isoDate.nullable(),                     // refine: >= validFrom
  slots: z.array(workScheduleSlotInput).max(21),   // refine: sin solapes (RN-08-10)
  closeOverlapping: z.boolean().default(false),    // RN-08-04
});

export const updateWorkScheduleInput = createWorkScheduleInput
  .omit({ closeOverlapping: true }).partial();     // slots presentes = sustitución completa

export const workScheduleDto = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  validFrom: isoDate,
  validTo: isoDate.nullable(),
  slots: z.array(workScheduleSlotInput.extend({ id: z.string().uuid() })), // ordenadas por weekday, startTime
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const putWorkShiftOverrideInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CUSTOM'), startTime: hhmm, endTime: hhmm, note: z.string().trim().max(120).nullable().default(null) }),
  z.object({ type: z.enum(['DAY_OFF', 'VACATION', 'SICK']), note: z.string().trim().max(120).nullable().default(null) }),
]);

export const bulkWorkShiftOverrideInput = z.object({
  from: isoDate, to: isoDate,                      // refine: to >= from, máx. 62 días
  type: z.enum(['DAY_OFF', 'VACATION', 'SICK']),
  note: z.string().trim().max(120).nullable().default(null),
  onlyWorkingDays: z.boolean().default(true),
});

export const workShiftOverrideDto = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), date: isoDate,
  type: z.enum(['DAY_OFF', 'VACATION', 'SICK', 'CUSTOM']),
  startTime: hhmm.nullable(), endTime: hhmm.nullable(), note: z.string().nullable(),
});

export const effectiveShiftDto = z.object({
  startTime: hhmm, endTime: hhmm, label: z.string().nullable(),
  startsAt: z.string().datetime(), endsAt: z.string().datetime(),
  endsNextDay: z.boolean(), durationMinutes: z.number().int(),
});

export const effectiveDayDto = z.object({
  date: isoDate,
  status: z.enum(EFFECTIVE_DAY_STATUS),
  scheduleId: z.string().uuid().nullable(),        // horario aplicado (null si excepción o sin horario)
  overrideNote: z.string().nullable(),
  shifts: z.array(effectiveShiftDto),
});

export const groupWorkSchedulesQuery = z.object({ from: isoDate, to: isoDate }); // máx. 42 días
export const groupWorkSchedulesDto = z.object({
  from: isoDate, to: isoDate, timezone: z.string(),
  members: z.array(z.object({
    userId: z.string().uuid(),
    weeklyMinutes: z.number().int(),               // suma de durationMinutes del rango completo
    days: z.array(effectiveDayDto),                // un elemento por día del rango, en orden
  })),
});
```

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/me/work-schedules` | — | `workScheduleDto[]` (ordenados por `validFrom` desc) | 401 |
| POST | `/me/work-schedules` | `createWorkScheduleInput` | 201 `workScheduleDto` | 401, 409 `CONFLICT` (solape), 422 |
| PATCH | `/me/work-schedules/:id` | `updateWorkScheduleInput` | `workScheduleDto` | 401, 404, 409, 422 |
| DELETE | `/me/work-schedules/:id` | — | 204 | 401, 404 |
| GET | `/me/work-shift-overrides/:date` | — | `workShiftOverrideDto` | 401, 404 (no hay excepción ese día) |
| PUT | `/me/work-shift-overrides/:date` | `putWorkShiftOverrideInput` | `workShiftOverrideDto` | 401, 422 |
| DELETE | `/me/work-shift-overrides/:date` | — | 204 (también si no existía) | 401 |
| GET | `/me/work-shift-overrides?from&to` | query `{ from, to }` (máx. 400 días) | `workShiftOverrideDto[]` ordenadas por fecha | 401, 422 |
| POST | `/me/work-shift-overrides/bulk` | `bulkWorkShiftOverrideInput` | `{ items: workShiftOverrideDto[] }` | 401, 422 |
| DELETE | `/me/work-shift-overrides?from&to` | query `{ from, to }` (máx. 62 días) | `{ deleted: number }` | 401, 422 |
| GET | `/groups/:g/work-schedules?from&to` | `groupWorkSchedulesQuery` | `groupWorkSchedulesDto` | 401, 404 (no miembro), 422 |

**Implementación del endpoint calculado:** 3 consultas como máximo (miembros del grupo con `timezone`; `WorkSchedule` + `slots` de esos usuarios cuyo rango toca `[from, to]`; `WorkShiftOverride` de esos usuarios en `[from, to]`) y el cálculo en memoria con `computeEffectiveDay`. Nunca una consulta por día o por miembro.

## 6. Eventos en tiempo real

| Evento | Cuándo | data | Sala |
|---|---|---|---|
| `schedule.updated` | Tras crear, editar o borrar un horario, y tras cualquier escritura de excepciones (individual, masiva o borrado por rango) | `{ userId }` | `group:<id>` de **todos** los grupos del usuario (un envío por grupo) |

El cliente, al recibirlo, invalida `['group', groupId, 'work-schedules']` (todas las semanas en caché) y, si `userId` es el propio, `['me', 'work-schedules']` y `['me', 'work-shift-overrides']`. El calendario (capa Horarios) usa la misma clave, así que también se refresca. La fila de la calle de ese miembro reproduce la **onda** si el autor es otro.

## 7. Pantallas y UX

Ruta: `/g/:groupId/horarios` (acceso desde "Más" → "Horarios"). Patrón **Semana por calles** de `DESIGN.md`.

### 7.1 Semana del hogar (pantalla principal)

- Cabecera: título "Horarios"; navegador de semana "‹ 9–15 nov ›" (lunes a domingo) y botón "Hoy". Parámetro de URL `?semana=YYYY-MM-DD` (lunes de la semana) para que la vista sea enlazable.
- **Móvil (< 600 px):** selector de día en Barlow Condensed "L M X J V S D" con el día actual marcado; debajo, una `Lane` por miembro con el contenido de ese día. Al entrar se selecciona hoy si la semana mostrada lo contiene; si no, el lunes.
- **≥ 600 px:** rejilla con los días como columnas y una `Lane` por miembro como fila.
- Contenido de cada `Lane` (chips en línea, sin scroll horizontal):
  - `WORKING`: un chip por turno "08:00–15:00" (+ " · Turno mañana" si hay etiqueta). Turno nocturno: "22:00–06:00 (+1)".
  - Continuación de un turno nocturno del día anterior: chip secundario "hasta 06:00".
  - `CUSTOM`: chip "Horario especial 10:00–14:00".
  - `DAY_OFF` "Libre", `VACATION` "Vacaciones", `SICK` "Baja": chip de estado con icono lucide (`Coffee`, `Palmtree`, `Thermometer`). Con nota: icono de nota y texto en la segunda línea.
  - `NOT_WORKING`: "No trabaja" en `--ink-muted`. `NO_SCHEDULE`: "Sin horario" en `--ink-faint`.
  - Al final de la calle: total semanal "37,5 h esta semana" (en la vista móvil, bajo el nombre).
- Calles separadas por `LaneRope` (variante normal).
- Tocar **mi** calle en un día → hoja "Cambiar el lunes 9 de noviembre" (§7.3). Tocar la calle de **otro** → hoja de solo lectura con su día ("Ana · lunes 9 nov · 08:00–15:00 · Turno mañana") y el aviso "Solo Ana puede cambiar su horario".
- Botón secundario fijo arriba: "Editar mi horario" → hoja a pantalla completa §7.2 (`?panel=mi-horario`).
- Estados:
  - Cargando: skeleton de 3 calles.
  - Vacío (nadie tiene horario): `EmptyState` "Aún nadie ha apuntado su horario" + acción "Apuntar mi horario".
  - Yo sin horario pero otros sí: tarjeta en mi calle "Apunta tu horario para que los demás sepan cuándo trabajas" + "Apuntar".
  - Error: `ErrorState` "No hemos podido cargar los horarios" + "Reintentar".
  - Sin conexión: `OfflineBanner`; "Editar mi horario" y las hojas de edición deshabilitados.
- Tiempo real: `schedule.updated` de otro miembro → onda en su calle.

### 7.2 Mi horario (hoja a pantalla completa)

- Lista de mis horarios con su estado calculado con la fecha de hoy: "Vigente" (`--primary-soft`), "Programado" (empieza en el futuro), "Finalizado" (`--ink-faint`). Cada fila: nombre, "Desde 01/09/2026" / "Del 15/06 al 15/09/2026", resumen "L–V 08:00–15:00".
- Botón "Nuevo horario". Si no hay ninguno, `EmptyState` "No tienes horario. Empieza con una plantilla" + chips de plantillas.
- **Formulario de horario** (`Sheet`):
  - "Nombre" (por defecto "Mi horario"), "Desde" (por defecto hoy), "Hasta" con interruptor "Sin fecha de fin" (activado por defecto).
  - "Plantillas rápidas": chips de `WORK_SCHEDULE_TEMPLATES`. Al tocar una, si ya hay franjas, confirmar "¿Sustituir las franjas actuales por «L–V 8:00–15:00»?" [Sustituir] [Cancelar].
  - 7 bloques "Lunes" … "Domingo". Cada uno con sus franjas (dos selectores de hora "Entra" / "Sale", campo "Etiqueta (opcional)", botón quitar) y "+ Añadir franja". Si la hora de salida es menor que la de entrada se muestra "Termina al día siguiente".
  - Menú del día "Copiar día…": hoja con casillas de los otros 6 días y "Copiar". **Sustituye** las franjas de los días marcados por copias de las del día origen (operación solo de formulario; no hay endpoint).
  - Validación en vivo con los mismos esquemas zod: "Se solapa con otra franja del martes", "La hora de fin debe ser distinta de la de inicio".
  - Guardar: si la API responde `409` por solape y hay un único horario anterior indefinido, diálogo "Tu horario «Invierno» no tiene fecha de fin. ¿Terminarlo el 14/06/2026 y empezar el nuevo el 15/06?" [Sí, cambiar] → reenvía con `closeOverlapping: true`. En otro caso, error en el campo "Desde": "Ya tienes un horario vigente en esas fechas".
  - Borrar: `Dialog` "¿Borrar el horario «Verano»? Esta acción no se puede deshacer" [Borrar] [Cancelar].

### 7.3 Excepción de un día (hoja)

- Título "Cambiar el lunes 9 de noviembre". Muestra el horario habitual de ese día ("Normalmente: 08:00–15:00").
- Opciones (radio grande): "Libre", "Vacaciones", "Baja", "Horario especial" (muestra "Entra"/"Sale").
- "Nota (opcional)" con ayuda "La verán los miembros de tus hogares".
- Interruptor "Aplicar a varios días" (no disponible con "Horario especial") → campo "Hasta" y casilla "Solo días laborables" (marcada) → `POST /me/work-shift-overrides/bulk`.
- Si ya hay excepción: botón "Quitar excepción" (vuelve al horario habitual) → `DELETE`.
- Toast tras guardar: "Horario del lunes actualizado" con "Deshacer" (5 s) que restaura el estado anterior (el cliente guarda la excepción previa o su ausencia y llama a `PUT`/`DELETE`). En masivo: "Vacaciones marcadas del 3 al 14 de agosto" sin deshacer.

## 8. Permisos

| Acción | Quién |
|---|---|
| Ver el horario efectivo de un miembro | Cualquier miembro de un grupo que compartan (solo vía `GET /groups/:g/work-schedules`) |
| Ver la lista completa de horarios y excepciones (`/me/...`) | Solo el dueño |
| Crear, editar o borrar horarios y excepciones | Solo el dueño (rutas `/me`) |

No hay forma de leer los horarios de un usuario que no comparte grupo con quien consulta.

## 9. Actividad

Como el horario no tiene `groupId`, cada escritura crea **una fila de `ActivityLog` por grupo** del usuario (en la misma transacción) y emite `activity.created` a cada grupo. `entityType`: `work_schedule` o `work_shift_override`.

| Acción | `action` | `summary` (ES) |
|---|---|---|
| Crear horario | `created` | "apuntó su horario de trabajo «Verano»" |
| Editar horario | `updated` | "actualizó su horario de trabajo «Verano»" |
| Borrar horario | `deleted` | "borró su horario de trabajo «Verano»" |
| Excepción de un día (crear, cambiar o quitar) | `updated` | "cambió su horario del lun 9 nov" |
| Excepciones masivas | `updated` | "cambió su horario del 3 al 14 ago" (`entityId` = id de la primera excepción) |

El `summary` **nunca** incluye el tipo de excepción ni la nota (la baja es un dato de salud; se ve en la vista de horarios, pero no se difunde en el feed).

## 10. Casos límite

- **Cambio de hora (DST) en `Europe/Madrid`:** ver RN-08-20. Tests obligatorios con el 29/03/2026 y el 25/10/2026: franja 02:30–06:00 del domingo 29/03 → `startsAt` = 01:30Z (03:30 CEST); turno 22:00–06:00 del sábado 24/10 → 9 h; del sábado 28/03 → 7 h.
- **Turno que cruza medianoche del domingo:** domingo 22:00–06:00 termina el lunes; para el solape (RN-08-10) choca con una franja del lunes 05:00–13:00.
- **Turno nocturno y excepción al día siguiente:** viernes 22:00–06:00 + sábado `DAY_OFF` → el viernes muestra el turno completo y el sábado "Libre" y el chip "hasta 06:00".
- **Cambio de horario a mitad de semana:** horario A hasta el miércoles y B desde el jueves → cada día usa el suyo. La semana suma ambos.
- **Último día de validez con turno nocturno:** el turno que empieza el último día de `validTo` cuenta entero aunque termine al día siguiente.
- **Usuario en varios grupos:** sus cambios emiten `schedule.updated` en todos; su horario aparece en todos.
- **Usuario que sale del grupo:** desaparece de la vista de ese grupo (RN-08-24); sus horarios siguen existiendo para sus otros grupos.
- **Usuario borrado:** sus horarios y excepciones se borran en cascada.
- **Rango > 42 días** en la vista de grupo → `422`. La vista semanal pide 7 días; la capa del calendario (mes) pide como mucho 42.
- **Concurrencia:** el mismo usuario edita desde dos dispositivos → last-write-wins; el segundo dispositivo recibe `schedule.updated` y refresca.
- **Validación de solape de validez con concurrencia:** se comprueba dentro de la transacción con `SELECT … FOR UPDATE` de los horarios del usuario (o `prisma.$transaction` con aislamiento `Serializable`), para que dos `POST` simultáneos no creen horarios solapados.

## 11. Tests

- **Unit (`packages/shared`):**
  - `computeEffectiveDay`: cada estado (`WORKING`, `NOT_WORKING`, `NO_SCHEDULE`, `DAY_OFF`, `VACATION`, `SICK`, `CUSTOM`), jornada partida ordenada, turno nocturno con `endsNextDay`, cambio de horario por validez, DST de marzo y octubre (casos de §10).
  - Validador de solapes semanal circular (RN-08-10), incluido domingo → lunes y franjas que se tocan.
  - Esquemas zod: `hhmm` con minutos múltiplos de 5, `endTime ≠ startTime`, `validTo ≥ validFrom`, rango máximo del masivo.
  - `WORK_SCHEDULE_TEMPLATES` generan franjas válidas.
- **Integración (`apps/api/test/work-schedules.int.spec.ts`):**
  - CRUD de horarios; `409` por solape; `closeOverlapping` cierra el anterior; `PATCH` con `slots` sustituye.
  - Excepciones: `PUT` crea y sustituye; masivo con `onlyWorkingDays`; borrado por rango.
  - Vista de grupo: miembros ordenados, excepciones aplicadas, `422` con rango > 42 días, número de consultas acotado (máximo 3, con un contador del cliente Prisma en el test).
  - `schedule.updated` emitido a todos los grupos del usuario; `ActivityLog` creado en cada grupo con el `summary` neutro.
  - Autorización: 401 sin sesión; 404 en `GET /groups/:g/work-schedules` de un grupo ajeno; 404 al hacer `PATCH /me/work-schedules/:id` con el id del horario de otro usuario.
- **Componentes (web):** formulario de horario (plantilla, copiar día, error de solape, aviso "Termina al día siguiente"); calle con cada estado; hoja de solo lectura para otro miembro.
- **E2E:** no hay ID de flujo crítico en `docs/07-testing.md` para horarios.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `GET`/`DELETE /me/work-shift-overrides?from&to` y `POST /me/work-shift-overrides/bulk` → `docs/04` (fila "Horarios").
- Comentario de `WorkScheduleSlot.endTime` → `docs/02`.
- Glosario "Horario efectivo", "Plantilla de horario", "Copiar día", "No trabaja" y "Sin horario" → `docs/10`.

## 13. Fuera de alcance

- Notificaciones push de turnos ("Mañana entras a las 6:00") y su preferencia.
- Horario especial (`CUSTOM`) con varias franjas en un mismo día.
- Rotaciones de turnos automáticas (semana A / semana B). Se resuelven con varios horarios con validez.
- Sincronización con calendarios externos.
- Horarios de personas que no son usuarios (por ejemplo, el horario del colegio de un niño: se apunta como evento recurrente del calendario).
