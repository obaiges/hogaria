# E08 · Horarios de trabajo

> Spec: `docs/specs/08-horarios.md` · Rango: HOG-400 – HOG-449 · Fase: 4
> Orden recomendado: HOG-400 → HOG-401 → HOG-402 → HOG-403 → HOG-404 → HOG-405 → HOG-406 → HOG-407 → HOG-408.

### HOG-400 · Esquemas zod y constantes de horarios

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/08-horarios.md#5-api`

**Descripción**
Definir en `packages/shared` los esquemas de entrada y salida de horarios, excepciones y la vista de grupo, más las constantes (etiquetas, estados y plantillas rápidas) y el validador de solapes semanal.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/work-schedules.ts` exporta exactamente los esquemas de la spec §5 (`createWorkScheduleInput`, `updateWorkScheduleInput`, `workScheduleDto`, `putWorkShiftOverrideInput`, `bulkWorkShiftOverrideInput`, `workShiftOverrideDto`, `effectiveShiftDto`, `effectiveDayDto`, `groupWorkSchedulesQuery`, `groupWorkSchedulesDto`) y sus tipos `z.infer`.
- [ ] `hhmm` acepta solo minutos múltiplos de 5; `endTime ≠ startTime`; `validTo ≥ validFrom`; masivo ≤ 62 días; vista de grupo ≤ 42 días.
- [ ] `findSlotOverlaps(slots)` implementa RN-08-10 (línea semanal circular de 10 080 min) y devuelve los índices en conflicto; el `refine` de `slots` lo usa con el mensaje "Se solapa con otra franja del <día>".
- [ ] `packages/shared/src/constants/work-schedules.ts` con `SHIFT_OVERRIDE_LABELS`, `EFFECTIVE_DAY_STATUS(_LABELS)` y `WORK_SCHEDULE_TEMPLATES` (5 plantillas de la spec).

**Notas técnicas**
- `isoDate` y `hhmm` reutilizables en `packages/shared/src/schemas/common.ts` si no existen.
- Nombres de días en español para mensajes: `WEEKDAY_LABELS = ['lunes', …, 'domingo']`.

**Tests**
- Unit: casos válidos e inválidos de cada esquema; `findSlotOverlaps` (mismo día, franjas que se tocan, domingo nocturno contra lunes temprano, jornada partida válida); plantillas válidas según sus propios esquemas.

---

### HOG-401 · Cálculo puro del horario efectivo (DST y turnos nocturnos)

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** shared
- **Depende de:** HOG-400
- **Spec:** `docs/specs/08-horarios.md#3-reglas-de-negocio`

**Descripción**
Función pura `computeEffectiveDay(date, schedules, override, tz)` y `computeEffectiveRange(from, to, schedules, overrides, tz)` que aplican RN-08-18 a RN-08-22, con instantes UTC correctos en los cambios de hora.

**Criterios de aceptación**
- [ ] Devuelve `effectiveDayDto` con el `status` correcto para los 7 estados.
- [ ] Turnos ordenados por `startTime`; `endsNextDay` cuando `endTime < startTime`.
- [ ] `startsAt`/`endsAt` en UTC con `@date-fns/tz`; hora inexistente desplazada hacia delante; hora ambigua → primera (RN-08-20).
- [ ] `durationMinutes` = diferencia real de instantes (turno 22:00–06:00 del 24/10/2026 → 540; del 28/03/2026 → 420).
- [ ] `computeEffectiveRange` devuelve un día por fecha del rango y `weeklyMinutes` como suma.
- [ ] Utilidad cliente `continuationFromPreviousDay(prevDay)` para el chip "hasta 06:00" (RN-08-19).

**Notas técnicas**
- `packages/shared/src/work-schedules/effective-schedule.ts`. Sin acceso a BBDD ni a `Date.now()` (la fecha llega por parámetro).
- Usar `TZDate` de `@date-fns/tz` para construir instantes locales; documentar en el código la regla de horas inexistentes/ambiguas y cubrirla con test (si la librería no se comporta así, corregir a mano).

**Tests**
- Unit: todos los casos de la spec §10 y §11 (DST marzo y octubre, nocturno + excepción del día siguiente, cambio de horario a mitad de semana, `NO_SCHEDULE`, `NOT_WORKING`, `CUSTOM` nocturno).

---

### HOG-402 · API de mis horarios (`/me/work-schedules`)

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-400, HOG-003, HOG-004, HOG-055, HOG-151, HOG-153
- **Spec:** `docs/specs/08-horarios.md#5-api`

**Descripción**
CRUD de horarios personales con validación de solapes de validez, sustitución de franjas, `closeOverlapping`, evento `schedule.updated` en todos los grupos del usuario y actividad neutra por grupo.

**Criterios de aceptación**
- [ ] `GET/POST /me/work-schedules`, `PATCH/DELETE /me/work-schedules/:id` según la tabla de la spec.
- [ ] Búsqueda siempre por `id` y `userId = user.id`; de otro usuario → 404.
- [ ] Solape de validez → `409 CONFLICT` "Ya tienes un horario vigente en esas fechas"; `closeOverlapping: true` cierra el anterior según RN-08-04 en la misma transacción; comprobación dentro de la transacción (bloqueo o `Serializable`).
- [ ] Máximo 20 horarios (RN-08-06).
- [ ] `PATCH` con `slots` sustituye todas las franjas en la transacción.
- [ ] Tras el commit, `schedule.updated { userId }` a cada grupo del usuario y `ActivityLog` por grupo con los `summary` de la spec §9 (`entityType = work_schedule`).

**Notas técnicas**
- `apps/api/src/modules/schedules/work-schedules.controller.ts` + `work-schedules.service.ts`.
- `RealtimePublisher` necesita un método para publicar en varios grupos; si no existe, iterar `publish(groupId, …)` sobre los `GroupMember` del usuario.

**Tests**
- Integración `apps/api/test/work-schedules.int.spec.ts`: CRUD; 409; `closeOverlapping`; 20 máximo; 401; 404 con id ajeno; eventos y actividad en 2 grupos.

---

### HOG-403 · API de excepciones (`/me/work-shift-overrides`)

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-402
- **Spec:** `docs/specs/08-horarios.md#5-api`

**Descripción**
Excepciones de un día (`GET/PUT/DELETE /me/work-shift-overrides/:date`), listado por rango, creación masiva y borrado por rango (endpoints del catálogo de `docs/04-api-y-tiempo-real.md`).

**Criterios de aceptación**
- [ ] `PUT` crea o sustituye con `putWorkShiftOverrideInput` (unión discriminada: horas solo en `CUSTOM`).
- [ ] `GET :date` → 404 si no hay; `DELETE :date` → 204 aunque no exista.
- [ ] `GET ?from&to` (≤ 400 días) ordenado por fecha.
- [ ] `POST /bulk` aplica RN-08-16 (≤ 62 días, sin `CUSTOM`, `onlyWorkingDays` usando el horario vigente de cada día con `computeEffectiveDay`) en una transacción; sobrescribe.
- [ ] `DELETE ?from&to` (≤ 62 días) devuelve `{ deleted }`.
- [ ] Fechas dentro de ±400 días de hoy en `Europe/Madrid` (RN-08-17) → si no, 422.
- [ ] Tras cada escritura: `schedule.updated` en todos los grupos del usuario y una actividad neutra por grupo ("cambió su horario del lun 9 nov" / "… del 3 al 14 ago"), sin tipo ni nota.

**Notas técnicas**
- `apps/api/src/modules/schedules/work-shift-overrides.controller.ts` + `.service.ts`. Rutas estáticas (`/bulk`) declaradas antes de `/:date`.
- Las rutas ya están en el catálogo de `docs/04-api-y-tiempo-real.md`.

**Tests**
- Integración: cada endpoint; masivo con `onlyWorkingDays` sobre L–V (no crea sábados ni domingos); 422 con `CUSTOM` masivo y rango > 62; `summary` sin la palabra "Baja".

---

### HOG-404 · Vista calculada `GET /groups/:g/work-schedules`

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-401, HOG-403, HOG-101
- **Spec:** `docs/specs/08-horarios.md#5-api`

**Descripción**
Endpoint que devuelve el horario efectivo de cada miembro actual del grupo y cada día del rango, en como mucho 3 consultas.

**Criterios de aceptación**
- [ ] Protegido con `GroupMemberGuard` (404 si no eres miembro).
- [ ] `from`/`to` ≤ 42 días, si no 422.
- [ ] Miembros ordenados: usuario actual primero, luego por `joinedAt` (RN-08-23); solo miembros actuales (RN-08-24).
- [ ] Usa `Group.timezone` para los instantes; respuesta `groupWorkSchedulesDto` validada.
- [ ] Máximo 3 consultas Prisma (miembros, horarios con franjas que tocan el rango, excepciones del rango).

**Notas técnicas**
- Método en `work-schedules.service.ts` (`getGroupView`), controller `apps/api/src/modules/schedules/group-work-schedules.controller.ts`.
- Lo consume también la herramienta `get_work_schedules` del asistente (E14) y la capa del calendario (HOG-460).

**Tests**
- Integración: grupo de 3 miembros con horario, excepción y sin horario; 404 desde otro grupo; 401; 422; contador de consultas ≤ 3.

---

### HOG-405 · Hooks de datos y tiempo real de horarios (web)

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-404, HOG-006, HOG-152
- **Spec:** `docs/specs/08-horarios.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks TanStack Query para la vista de grupo y para mis horarios y excepciones, con mutaciones optimistas y el manejador de `schedule.updated`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/schedules/api.ts`: `useGroupWorkSchedules(groupId, from, to)` (clave `['group', groupId, 'work-schedules', { from, to }]`), `useMyWorkSchedules()` (`['me', 'work-schedules']`), `useMyOverrides(from, to)` (`['me', 'work-shift-overrides', { from, to }]`) y las mutaciones (`useCreateWorkSchedule`, `useUpdateWorkSchedule`, `useDeleteWorkSchedule`, `usePutOverride`, `useDeleteOverride`, `useBulkOverrides`, `useDeleteOverridesRange`), todas con `X-Client-Mutation-Id`.
- [ ] `realtime.ts`: `schedule.updated` invalida `['group', groupId, 'work-schedules']` y, si es el propio usuario, las claves `['me', …]`; marca la calle del `userId` para la onda si el autor es otro.
- [ ] Tras cualquier mutación propia, invalida la vista de grupo de todos los grupos en caché.

**Notas técnicas**
- La onda se gestiona con el mecanismo común de HOG-152 (registro de `ripple` por clave).

**Tests**
- Unit/componentes: el manejador de `schedule.updated` invalida las claves correctas (con un `QueryClient` de prueba).

---

### HOG-406 · Pantalla "Horarios": semana por calles

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-405, HOG-009, HOG-750
- **Spec:** `docs/specs/08-horarios.md#71-semana-del-hogar-pantalla-principal`

**Descripción**
Ruta `/g/:groupId/horarios` con navegador de semana, selector de día en móvil, una `Lane` por miembro, chips por estado y turno, total semanal, hoja de solo lectura para otros miembros y todos los estados obligatorios.

**Criterios de aceptación**
- [ ] Parámetro `?semana=YYYY-MM-DD` (lunes); "Hoy" vuelve a la semana actual; flechas cambian de semana.
- [ ] < 600 px: selector "L M X J V S D" y calles del día; ≥ 600 px: días en columnas (patrón de `DESIGN.md`).
- [ ] Chips y textos exactos de la spec §7.1 para cada estado, turno nocturno "(+1)" y continuación "hasta 06:00".
- [ ] Total semanal "37,5 h esta semana" con coma decimal.
- [ ] Tocar la calle de otro → hoja de solo lectura con "Solo Ana puede cambiar su horario"; tocar la mía → abre la hoja de excepción (HOG-408; hasta entonces, botón deshabilitado).
- [ ] Botón "Editar mi horario" (abre HOG-407 con `?panel=mi-horario`).
- [ ] Estados: skeleton, vacío "Aún nadie ha apuntado su horario", mi tarjeta "Apunta tu horario…", error con "Reintentar", sin conexión con edición deshabilitada.
- [ ] Onda en la calle cuando cambia el horario de otro; respeta `prefers-reduced-motion`.
- [ ] Entrada "Horarios" en el menú "Más" (si HOG-750 lo dejó preparado).
- [ ] Funciona a 375 px y en modo oscuro.

**Notas técnicas**
- `apps/web/src/features/schedules/pages/SchedulesPage.tsx`, `components/MemberScheduleLane.tsx`, `components/ShiftChip.tsx`. Fechas con `lib/dates.ts` en la zona del grupo.

**Tests**
- Componentes: `MemberScheduleLane` con cada estado; navegación de semana; hoja de solo lectura para otro miembro; estados vacío y error con MSW.

---

### HOG-407 · Editor "Mi horario": plantillas, franjas y copiar día

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-405, HOG-008, HOG-406
- **Spec:** `docs/specs/08-horarios.md#72-mi-horario-hoja-a-pantalla-completa`

**Descripción**
Hoja a pantalla completa con la lista de mis horarios (Vigente/Programado/Finalizado) y el formulario de horario con validez, plantillas rápidas, franjas por día, "Copiar día…" y el flujo de `closeOverlapping`.

**Criterios de aceptación**
- [ ] Lista con estado calculado con la fecha de hoy y resumen ("L–V 08:00–15:00").
- [ ] Formulario React Hook Form + `zodResolver(createWorkScheduleInput)`: nombre, desde, hasta con "Sin fecha de fin", 7 bloques de días con "+ Añadir franja", etiqueta opcional y aviso "Termina al día siguiente".
- [ ] Plantillas (`WORK_SCHEDULE_TEMPLATES`) con confirmación si ya hay franjas.
- [ ] "Copiar día…": elegir días destino y sustituir sus franjas (solo formulario).
- [ ] Errores de solape en línea; `409` de la API → diálogo "¿Terminarlo el … y empezar el nuevo el …?" que reenvía con `closeOverlapping: true` cuando hay un único horario anterior indefinido; si no, error en "Desde".
- [ ] Borrar con `Dialog`. Toasts "Horario guardado" / "Horario borrado".
- [ ] Accesible: labels visibles, selectores de hora con `aria-label` "Entra el lunes", objetivos de 44 px.

**Notas técnicas**
- `apps/web/src/features/schedules/components/MyScheduleSheet.tsx`, `ScheduleForm.tsx`, `CopyDaySheet.tsx`. `useFieldArray` por día.

**Tests**
- Componentes: aplicar plantilla, copiar lunes a martes–viernes, error de solape, flujo `409` → `closeOverlapping`.

---

### HOG-408 · Excepciones de día: libre, vacaciones, baja y horario especial

- **Épica:** E08 · **Fase:** 4 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-406
- **Spec:** `docs/specs/08-horarios.md#73-excepción-de-un-día-hoja`

**Descripción**
Hoja "Cambiar el lunes 9 de noviembre" desde mi calle: elegir tipo, horas (horario especial), nota, aplicar a varios días y quitar la excepción, con deshacer.

**Criterios de aceptación**
- [ ] Muestra "Normalmente: 08:00–15:00" (o "No trabajas" / "Sin horario").
- [ ] Opciones "Libre", "Vacaciones", "Baja", "Horario especial" (con "Entra"/"Sale"); nota con la ayuda "La verán los miembros de tus hogares".
- [ ] "Aplicar a varios días" (no con "Horario especial") con "Hasta" y "Solo días laborables" → `POST /bulk`.
- [ ] "Quitar excepción" → `DELETE`.
- [ ] Toast "Horario del lunes actualizado" con "Deshacer" (restaura el estado anterior con `PUT`/`DELETE`); masivo: "Vacaciones marcadas del 3 al 14 de agosto".
- [ ] Deshabilitada sin conexión.

**Notas técnicas**
- `apps/web/src/features/schedules/components/DayOverrideSheet.tsx`.

**Tests**
- Componentes: cada tipo envía el cuerpo correcto; masivo; deshacer llama al endpoint inverso.
