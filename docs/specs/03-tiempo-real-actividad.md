# 03 · Tiempo real y actividad

> Épica: E03 · Tickets: `docs/tickets/E03-tiempo-real.md` · Modelo: `docs/02-modelo-datos.md#esquema-prisma` (sección ACTIVIDAD: `ActivityLog`) · Contratos: `docs/04-api-y-tiempo-real.md#tiempo-real-socketio` · Decisiones: ADR-004, ADR-006, ADR-015

## 1. Objetivo
Que cualquier cambio de un miembro llegue al instante a los demás dispositivos del hogar sin recargar (principio "Lo compartido se ve al instante"), con una señal visual —la onda— que indica que lo ha hecho otra persona. Que el hogar tenga un historial legible de lo que ha pasado en los últimos 90 días. Y que, sin conexión, la app lo diga claramente y no deje editar (no hay modo offline).

## 2. Historias de usuario
- **US-03-01** Como miembro, quiero ver los cambios de los demás al momento, sin recargar, para no comprar dos veces lo mismo ni hacer una tarea ya hecha.
- **US-03-02** Como miembro, quiero distinguir de un vistazo qué ha cambiado otra persona (onda con su color de calle).
- **US-03-03** Como miembro, quiero que mis propios cambios no "parpadeen" ni se dupliquen cuando vuelven por el tiempo real.
- **US-03-04** Como miembro, quiero que al recuperar la conexión la app se ponga al día sola.
- **US-03-05** Como miembro, quiero ver un feed de actividad del hogar ("Ana añadió Leche a Compra") agrupado por días.
- **US-03-06** Como miembro sin conexión, quiero un aviso claro y que la app no me deje hacer cambios que se perderían.
- **US-03-07** Como miembro, quiero que si me expulsan o se cierra mi sesión desde otro dispositivo, la app reaccione al instante.

## 3. Reglas de negocio

### Conexión (servidor)
- **RN-03-01** Socket.IO se monta en el mismo servidor HTTP de NestJS (`@nestjs/platform-socket.io`), espacio de nombres por defecto `/`, `path: "/realtime"`, CORS con `origin: APP_URL` y `credentials: true`, transportes `['websocket', 'polling']`. Adaptador en memoria (una sola instancia de API).
- **RN-03-02** Autenticación en el handshake (middleware `io.use`): se pasan las cabeceras del handshake (cookie) a `auth.api.getSession()`. Sin sesión → `next(err)` con `err.message = 'UNAUTHENTICATED'` y `err.data = { code: 'UNAUTHENTICATED' }`. Usuario con `blockedAt` → igual con `ACCOUNT_BLOCKED`. El `Origin` del handshake debe ser `APP_URL` (o `http://localhost:5173` en desarrollo); si no, `UNAUTHENTICATED`.
- **RN-03-03** Al conectar: `socket.data = { userId, sessionId }`; une el socket a `user:<userId>` y, con **una** consulta (`groupMember.findMany({ where: { userId }, select: { groupId } })`), a `group:<groupId>` por cada grupo. Es la única consulta a la BBDD del ciclo de vida de un socket.
- **RN-03-04** El socket es **solo de bajada**: el servidor no registra manejadores de eventos del cliente (ni `join`, ni escrituras). Lo que emita el cliente se ignora. Las mutaciones van siempre por REST (AGENTS.md §5).
- **RN-03-05** Sin consultas periódicas: se usan los `pingInterval` (25 s) y `pingTimeout` (20 s) por defecto de Socket.IO, que no tocan la BBDD (ADR-004).
- **RN-03-06** `RealtimeRooms` (`apps/api/src/realtime/realtime-rooms.service.ts`) ajusta las salas sin que el cliente intervenga: `joinGroup(userId, groupId)` = `io.in('user:<userId>').socketsJoin('group:<groupId>')`; `leaveGroup(userId, groupId)` = `socketsLeave`. Lo llaman los servicios de grupos al unirse, salir, ser expulsado o borrarse el grupo (spec 02, RN-02-18/20/21).
- **RN-03-07** `RealtimeGateway.disconnectSessions(userId, { sessionIds?: string[], exceptSessionId?: string })` desconecta (`socket.disconnect(true)`) los sockets de `user:<userId>` cuyo `socket.data.sessionId` esté en `sessionIds`, o todos menos `exceptSessionId`, o todos si no se pasa nada. Lo usa la revocación de sesiones (spec 01, RN-01-22), **después** de publicar `session.revoked`.
- **RN-03-08** Una sesión que caduca o se borra mientras el socket está conectado no lo desconecta por sí sola; el siguiente `GET`/mutación REST recibe `401` y el siguiente intento de reconexión falla en el handshake (RN-03-21).

### Publicación (servidor)
- **RN-03-09** `RealtimePublisher` (`apps/api/src/realtime/realtime.publisher.ts`) es el **único** punto que emite. Todos los eventos se emiten en el canal `"evt"` con el sobre `RealtimeEnvelope` (`docs/04-api-y-tiempo-real.md`). Métodos:
  - `publish(groupId, event, data, opts?)` → sala `group:<groupId>`.
  - `publishToUser(userId, event, data)` → sala `user:<userId>`, con `groupId: null` (`docs/04-api-y-tiempo-real.md`).
  - `publishToUserGroups(userId, event, data)` → un sobre por cada grupo del usuario (una consulta de membresías), cada uno con su `groupId`, a su sala `group:<id>`. Para `schedule.updated` y `diet.updated`.
- **RN-03-10** `actorId` y `clientMutationId` se toman del `RequestContext` (AsyncLocalStorage, HOG-006): `actorId` = usuario autenticado de la petición, `clientMutationId` = cabecera `X-Client-Mutation-Id` si es un UUID válido (si no, `null`). `opts.actorId: null` fuerza un evento de sistema (scheduler). Fuera de una petición (cron), ambos son `null`. `at` = `new Date().toISOString()` en el momento de publicar.
- **RN-03-11** Se publica **solo después del commit** de la transacción (patrón de mutación de `docs/01-arquitectura.md`). Nunca dentro de `prisma.$transaction`. Si la emisión falla, se registra en el log (`warn`) y la petición REST **no** falla.
- **RN-03-12** El tipo de `data` está atado al nombre del evento: `publish<E extends RealtimeEventName>(groupId, event: E, data: RealtimeEventDataMap[E])`. Con `NODE_ENV !== 'production'`, el publisher valida `data` con el esquema zod del catálogo (`REALTIME_EVENT_SCHEMAS[event]`) y lanza si no cumple (detecta DTOs incompletos en los tests).
- **RN-03-13** Catálogo (`packages/shared/src/realtime.ts`): `REALTIME_CHANNEL = 'evt'`, `REALTIME_EVENTS` (array `as const` con **todos** los nombres de la tabla de `docs/04-api-y-tiempo-real.md`), `RealtimeEventName`, `RealtimeEnvelope<T>`, `RealtimeEventDataMap` y `REALTIME_EVENT_SCHEMAS`. E03 define los `data` de `group.*`, `invite.*`, `activity.created` y `session.revoked`; cada épica añade los suyos al mapa en su ticket (un evento sin entrada en el mapa no compila al publicarse).
- **RN-03-14** Eventos de borrado: `data` es `{ id }` (o lo que diga la tabla de `docs/04`). El resto lleva el DTO **completo** del recurso tras el cambio, nunca un parche parcial.

### Cliente
- **RN-03-15** Un único socket por pestaña, creado por `RealtimeProvider` (`apps/web/src/app/providers/RealtimeProvider.tsx`) dentro del layout autenticado, con `io(VITE_API_URL, { path: '/realtime', withCredentials: true, transports: ['websocket', 'polling'] })` (en local, URL relativa por el proxy de Vite). Reconexión automática de Socket.IO (`reconnectionDelay` 1 000 ms, `reconnectionDelayMax` 5 000 ms). Al cerrar sesión se desconecta y se destruye.
- **RN-03-16** Registro de mutaciones propias (`apps/web/src/lib/realtime/mutation-registry.ts`): el `apiClient` añade cada `X-Client-Mutation-Id` (`crypto.randomUUID()`) **antes** de enviar la petición. Guarda los últimos **200** (cola circular + `Set`).
- **RN-03-17** Despacho (`apps/web/src/lib/realtime/dispatcher.ts`): un solo listener de `"evt"`. Si `envelope.clientMutationId` está en el registro **y** el evento no está en `NON_DEDUPED_EVENTS = ['activity.created', 'ai.quota.updated']`, se ignora. Si no, se busca el manejador registrado para `envelope.event` (cada feature exporta los suyos en `features/<x>/realtime.ts` y se registran en `apps/web/src/lib/realtime/handlers.ts`). Evento sin manejador → se ignora (`console.debug` solo en desarrollo).
- **RN-03-18** Los manejadores usan `setQueryData` con un *updater* que no hace nada si la query no está en caché (`old === undefined → undefined`), o `invalidateQueries` cuando el cambio afecta a vistas calculadas. Se aplican también a grupos no activos si tienen datos en caché.
- **RN-03-19** Onda: si `envelope.actorId !== null` y es distinto del usuario actual, y el evento es de creación o modificación (no `*.deleted`), el manejador llama a `markRipple(entityKey, actorLaneColor)` (`apps/web/src/lib/realtime/ripple-store.ts`, Zustand). `entityKey` = `"<entityType>:<id>"` (p. ej. `"shopping_item:0193…"`). La marca dura 1 000 ms y se consume con `useRipple(entityKey)` → `{ active: boolean, laneColor }`, que los componentes pasan a `Lane` (`highlight="ripple"`) o a la clase de animación de filas de HOG-009. Los cambios del propio usuario desde otro dispositivo (mismo `actorId`) se aplican **sin** onda. Las animaciones respetan `prefers-reduced-motion` (`DESIGN.md` §6).
- **RN-03-20** Reconexión: en cada evento `connect` que **no** sea el primero, el cliente invalida `['group', activeGroupId]` y `['me', 'groups']` (con refetch) y marca como obsoletas el resto de `['group']` (`refetchType: 'none'`). No se reproducen eventos perdidos (`docs/01-arquitectura.md#reconexión`).
- **RN-03-21** `connect_error` con `UNAUTHENTICATED` o `ACCOUNT_BLOCKED`: se detiene la reconexión, se limpia la caché y se navega a `/entrar` (con el mensaje de bloqueo si aplica).
- **RN-03-22** Estado de conexión (`apps/web/src/lib/realtime/connection-store.ts`): `'online' | 'reconnecting' | 'offline'`. Es `offline` si `navigator.onLine === false` **o** el socket lleva desconectado `OFFLINE_GRACE_MS = 5000` o más; `reconnecting` durante esos primeros 5 s; `online` en otro caso. Al arrancar, mientras el socket conecta por primera vez, cuenta como `online` salvo que `navigator.onLine` sea `false` o pasen 5 s sin conectar. En las pantallas públicas (sin socket) solo cuenta `navigator.onLine`.
- **RN-03-23** Sin conexión (`offline`): se muestra `OfflineBanner` ("Sin conexión. Los cambios no se guardarán") bajo la cabecera, y **todos** los controles que mutan datos se deshabilitan mediante `useCanEdit()` (o la prop `requiresConnection` de `Button`, `Checkbox`, `Fab` y los envíos de formulario). Además, `apiClient` rechaza cualquier mutación (`POST`/`PATCH`/`PUT`/`DELETE`) en estado `offline` con `OfflineError` sin enviarla, y la interfaz muestra el toast "Sin conexión. Los cambios no se guardarán". Las mutaciones de TanStack Query usan `networkMode: 'always'` para que **nunca** se encolen. Las lecturas en caché se siguen viendo. Al volver a `online`, el banner desaparece sin toast.

### Actividad
- **RN-03-24** Retención: un `RetentionJob` (`apps/api/src/scheduler/retention.job.ts`) borra los `ActivityLog` con `createdAt` anterior a 90 días y los `SecurityEvent` anteriores a 180 días (`deleteMany`). Se registra como handler `retention.purge` (orden 20) del `SchedulerTickRegistry` y se ejecuta **como mucho una vez cada 24 h** (marca `lastRunAt` en memoria: el primer tick tras arrancar la API lo ejecuta).
- **RN-03-25** Esta épica (HOG-153) crea en `apps/api/src/scheduler/` el **`MaintenanceCron`** (`maintenance.cron.ts`, `@Cron('0 0 */6 * * *', { timeZone: 'Europe/Madrid' })`) y el **`SchedulerTickRegistry`** (`scheduler-tick.registry.ts`, `register({ name, order, run(now) })`). `MaintenanceCron` es el **único** cron que toca la BBDD (ADR-004): en cada tick ejecuta los handlers por `order` ascendente, aislando los errores de cada uno (se registran y se sigue con el siguiente); expone `runNow()`, que E12 llama al arrancar. Handlers previstos: `bills.materialize` (E11, 10), `retention.purge` (E03, 20), `assistant.purge` (E14, 30) y `reminders.reconcile` (E12, 100). Ningún módulo crea un cron propio.
- **RN-03-25** `ActivityService.record(tx, input)` (`apps/api/src/activity/activity.service.ts`) se llama **dentro** de la transacción de la mutación. `input = { groupId, actorId: string | null, entityType: ActivityEntityType, entityId, action: ActivityAction, summary, metadata?: Record<string, unknown> }`. Valida `entityType` y `action` contra `ACTIVITY_ENTITY_TYPES` y `ACTIVITY_ACTIONS` de shared y recorta `summary` a 200 caracteres. Devuelve la fila creada.
- **RN-03-26** Tras el commit, el servicio llama a `ActivityService.publishCreated(row)`, que construye el `ActivityDto` (con `actorName` = nombre del usuario del `RequestContext` si `actorId` es él; `null` si `actorId` es `null`) y publica `activity.created` en el grupo. Sin consultas adicionales.
- **RN-03-27** `summary`: español, pretérito perfecto simple, tercera persona, **sin el nombre del actor** y en minúscula inicial ("añadió Leche a Compra"). Los nombres que escriben los usuarios se insertan tal cual, recortados a 60 caracteres con "…" (`truncateName()` en `apps/api/src/activity/summary.ts`); solo los renombrados usan comillas angulares («»). Cada módulo define sus textos en `modules/<x>/<x>.activity.ts` y en su spec §9.
- **RN-03-28** Representación: la interfaz muestra "**{actorName}** {summary}". Si `actorId` es `null` (sistema) → solo el `summary` con la inicial en mayúscula. Si `actorId` no es `null` pero `actorName` sí (cuenta borrada) → "**Usuario eliminado** {summary}".
- **RN-03-29** Generan actividad **solo** las mutaciones de contenido compartido del grupo enumeradas en el §9 de cada spec. No la generan: lecturas, datos personales que no son del grupo (horarios, dieta), uso de IA, conversaciones del asistente, cambio de color de calle, sesiones ni autenticación.
- **RN-03-30** `GET /groups/:g/activity` pagina por cursor sobre `id` (UUIDv7) en orden descendente (`?cursor=&limit=`, por defecto 50, máximo 100). Resuelve `actorName` con una única consulta `user.findMany({ where: { id: { in: actorIds } }, select: { id, name } })` por página.
- **RN-03-31** La actividad es de solo lectura: no hay endpoints para editarla ni borrarla. La ven todos los miembros, incluidas las entradas anteriores a su llegada al grupo (dentro de los 90 días).
- **RN-03-32** En la pantalla, las entradas se agrupan por día **en la zona horaria del grupo** ("Hoy", "Ayer", y después "lunes 9 de noviembre"), con la hora relativa si es de hoy ("hace 5 min") y la hora "HH:mm" en los demás días.

## 4. Modelo de datos
- `ActivityLog`: `docs/02-modelo-datos.md`. Índice `(groupId, createdAt)`; la paginación usa `id` (UUIDv7, ordenado en el tiempo).
- `SecurityEvent`: solo para la purga (RN-03-24).
- Constantes nuevas en shared (no son esquema): `ACTIVITY_ENTITY_TYPES = ['group','group_member','group_invite','shopping_list','shopping_item','product','recipe','meal_plan_entry','task','calendar_event','expense','expense_category','budget','bill','bill_payment'] as const` y `ACTIVITY_ACTIONS = ['created','updated','deleted','checked','unchecked','cleared','completed','skipped','joined','left','removed','revoked','paid','unpaid'] as const` (`packages/shared/src/activity.ts`). Cada épica puede añadir valores en su ticket.

## 5. API

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/groups/:groupId/activity?cursor&limit` | `activityQuery` `{ cursor?: string opaco, limit?: int 1–100 (50) }` (`packages/shared/src/schemas/activity.ts`, basado en `cursorQuery` de `schemas/pagination.ts`) | `{ items: activityDto[], nextCursor: string \| null }` | `401` · `404` · `422` |

- `activityDto = { id, groupId, actorId: string | null, actorName: string | null, entityType: ActivityEntityType, entityId, action: ActivityAction, summary, metadata: Record<string, unknown> | null, createdAt }`.
- `cursorQuery = { cursor?: z.string().min(1).max(512) (opaco, base64url; ver `encodeCursor`/`decodeCursor` en `packages/shared/src/schemas/pagination.ts`), limit?: z.coerce.number().int().min(1).max(100).default(50) }` y `paginated(itemSchema)` = `{ items: itemSchema[], nextCursor: string | null }` (genéricos para todas las listas paginadas).

**Conexión Socket.IO** (no es REST): `wss://api.hogaria.obaiges.com`, `path: /realtime`, cookie de sesión. Errores de handshake: `UNAUTHENTICATED`, `ACCOUNT_BLOCKED`.

## 6. Eventos en tiempo real

E03 aporta la infraestructura de **todos** los eventos de `docs/04-api-y-tiempo-real.md`. Los propios de esta épica:

| Evento | Cuándo | data |
|---|---|---|
| `activity.created` | Tras el commit de cualquier mutación que escribe `ActivityLog` (RN-03-26). Sala `group` | `ActivityDto` |
| `session.revoked` | Definido en la spec 01 (RN-01-22). Sala `user` | `{}` |

Manejo en el cliente (`features/activity/realtime.ts`): `activity.created` → si existe la *infinite query* `['group', g, 'activity']`, inserta el elemento al principio de la primera página (si no estaba por `id`) y marca la onda si el actor es otro. También invalida `['group', g, 'dashboard']` si existe (E15 decide si muestra actividad en Inicio).

## 7. Pantallas y UX

### `/g/:groupId/actividad` — `features/activity/pages/ActivityPage.tsx`
- Acceso desde la pestaña "Más" de la navegación (HOG-750). Título "Actividad".
- Lista agrupada por día (RN-03-32). Encabezado de día en versalitas Barlow Condensed (`DESIGN.md` §4). Fila de 48–56 px con divisor de junta, sin tarjetas: `MemberDot` de 28 px con el color de calle del actor (resuelto con `['group', g, 'members']`; tono neutro si ya no es miembro, es sistema o "Usuario eliminado"), texto "**Ana** añadió Leche a Compra" (RN-03-28) y, a la derecha, la hora (`tabular-nums`, `--ink-muted`).
- Paginación infinita: al llegar al final se pide la siguiente página; si falla, botón "Cargar más".
- Las filas nuevas de otros miembros reciben la onda (RN-03-19).
- Estados: cargando (8 filas `Skeleton`); vacío (`EmptyState`): "Todavía no hay actividad. Lo que hagáis en el hogar aparecerá aquí."; error: `ErrorState` "No se ha podido cargar la actividad" + "Reintentar"; sin conexión: `OfflineBanner` y se sigue viendo lo que ya estaba en caché. Final de la lista: "No hay actividad anterior (se guarda 90 días)".
- No hay acciones sobre las filas en esta versión.

### `OfflineBanner` — `apps/web/src/components/ui/OfflineBanner.tsx`
- Visual según `DESIGN.md` §8: franja con la corchera roja (`LaneRope` variante `limit`) bajo la `AppHeader`, texto "Sin conexión. Los cambios no se guardarán", `role="status"` y `aria-live="polite"`.
- Se monta en el layout raíz para que aparezca en todas las pantallas (también públicas).
- Estado `reconnecting`: no se muestra banner (evita parpadeos en cortes de menos de 5 s).

### Onda
- Visual y duración en `DESIGN.md` §6: barrido de `--primary-soft` de izquierda a derecha con el color de calle del autor en el borde izquierdo, 700 ms, `--ease-water`; con `prefers-reduced-motion`, solo cambio de fondo durante 1 s. El componente que la pinta es de HOG-009; E03 solo decide cuándo (RN-03-19).

## 8. Permisos
- Socket: solo usuarios autenticados y no bloqueados. Cada socket solo está en las salas de sus grupos y en la suya.
- Actividad: la ven todos los miembros del grupo (`GroupMemberGuard`). Nadie la edita ni la borra.

## 9. Actividad
E03 no genera entradas propias: define el mecanismo (`ActivityService`, RN-03-25 a RN-03-29) y la pantalla. Las entradas de grupos e invitaciones están en la spec 02, §9.

## 10. Casos límite
- El autor recibe su propio evento: se ignora por `clientMutationId` (RN-03-17), salvo `activity.created`.
- El mismo usuario con dos dispositivos: el evento del dispositivo A llega al B (otro `clientMutationId`) y se aplica sin onda.
- Evento que llega antes que la respuesta REST de la mutación propia: el `clientMutationId` ya está en el registro (se añade antes de enviar), así que se ignora.
- Evento de un grupo cuyos datos no están en caché: el *updater* no hace nada (RN-03-18).
- Un usuario se une a un grupo desde el móvil con la app también abierta en el ordenador: `RealtimeRooms.joinGroup` une también el socket del ordenador; `group.member.joined` con su propio `userId` invalida `['me', 'groups']` y el selector muestra el hogar nuevo.
- Socket que reconecta tras suspender el móvil: RN-03-20 invalida y recarga el grupo activo.
- `navigator.onLine` es `true` pero no hay salida real a internet (wifi cautiva): el socket no conecta y a los 5 s el estado pasa a `offline`.
- La API se reinicia (despliegue): todos los sockets reconectan con *backoff*; durante menos de 5 s no hay banner.
- El reloj del móvil está desfasado: la agrupación por días usa `createdAt` del servidor y la zona del grupo; la hora relativa puede mostrar "hace 0 min" como mínimo (nunca valores negativos).
- `activity.created` de una entrada que ya llegó por la recarga de la página: se descarta por `id`.
- Purga mientras alguien pagina la actividad antigua: la página siguiente simplemente llega más corta o vacía.
- Muchos eventos seguidos (p. ej. `bulk_created`): los manejadores hacen un único `setQueryData` por evento; no hay que agrupar.

## 11. Tests
- **Unit (shared)**: `REALTIME_EVENTS` contiene exactamente los nombres de `docs/04` (test de instantánea), `REALTIME_EVENT_SCHEMAS` valida los `data` de E02/E03, `activityDto`, `cursorQuery`.
- **Unit (web)**: `mutation-registry` (límite de 200, el más antiguo sale), `dispatcher` (ignora propios salvo `NON_DEDUPED_EVENTS`; llama al manejador correcto; desconocidos ignorados), `ripple-store` (caduca a 1 000 ms con temporizadores falsos; no marca si `actorId` es el usuario actual), `connection-store` (transiciones `online → reconnecting → offline` a los 5 s; `navigator.onLine = false` → `offline` inmediato), `apiClient` rechaza mutaciones en `offline` con `OfflineError`.
- **Unit (api)**: `RealtimePublisher` (sobre correcto con `actorId`/`clientMutationId` del contexto; `X-Client-Mutation-Id` inválido → `null`; validación de `data` fuera de producción; un fallo de emisión no lanza), `RetentionJob` (borra > 90 días de actividad y > 180 de `SecurityEvent`; no se ejecuta dos veces en 24 h), `truncateName`.
- **Integración (`apps/api/test/realtime/*.int.spec.ts`, con `socket.io-client`)**: conexión sin cookie → `connect_error` `UNAUTHENTICATED`; usuario bloqueado → `ACCOUNT_BLOCKED`; un usuario con 2 grupos recibe eventos de ambos y no de un tercero; tras `joinGroup` recibe eventos del grupo nuevo y tras `leaveGroup` deja de recibirlos; `disconnectSessions` desconecta solo los sockets de esa sesión; `publishToUser` llega solo a `user:<id>`.
- **Integración (`apps/api/test/activity/*.int.spec.ts`)**: `GET /activity` pagina en orden descendente con `nextCursor`; `actorName` resuelto y `null` para un usuario borrado; usuario de otro grupo → 404; sin sesión → 401; una mutación que falla a mitad no deja `ActivityLog` (transacción).
- **Componentes (web)**: `ActivityPage` (agrupado "Hoy"/"Ayer" con zona del grupo, "Usuario eliminado", vacío, error), `OfflineBanner` (aparece en `offline`, no en `reconnecting`).
- **E2E**: `apps/web/e2e/realtime-group.e2e.ts` con dos contextos (helper de doble contexto de HOG-011): A cambia el nombre del hogar y B lo ve sin recargar; A añade una invitación y la lista de B se actualiza; `context.setOffline(true)` en B muestra el banner y deshabilita "Invitar a alguien". Es la base de **E2E-05**, que se completa en E04 con la lista de la compra.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `RealtimeEnvelope.groupId` nullable y un sobre por grupo en `schedule.updated`/`diet.updated` → `docs/04`.
- Excepción `NON_DEDUPED_EVENTS` → `docs/04` (Reglas del cliente, punto 2).
- Definición de "sin conexión" (5 s) y `networkMode: 'always'` → `docs/04` (Reglas del cliente, punto 5).
- `MaintenanceCron` + `SchedulerTickRegistry` como único cron, creados por E03 → `docs/01` (Recordatorios y Ventana de Neon) y RN-03-24/25 de esta spec.
- Retención de `ActivityLog` con `retention.purge` → `docs/02` (comentario de `ActivityLog`) y `docs/03` (Retenciones).

## 13. Fuera de alcance
- Notificaciones push de actividad (solo se ven dentro de la app; `docs/00-vision-alcance.md`).
- Reproducir eventos perdidos durante una desconexión (se invalida y se recarga).
- Indicadores de presencia ("Ana está conectada") y "escribiendo…".
- Filtros del feed de actividad por miembro o por módulo, y enlaces desde una entrada al elemento.
- Varias instancias de API (adaptador Redis de Socket.IO).
- Modo offline y cola de mutaciones.
