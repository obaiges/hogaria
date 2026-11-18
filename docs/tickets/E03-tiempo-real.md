# E03 · Tiempo real y actividad

> Rango: HOG-150 – HOG-199 · Fase 1 · Spec: `docs/specs/03-tiempo-real-actividad.md` · Contratos: `docs/04-api-y-tiempo-real.md#tiempo-real-socketio`

---

### HOG-150 · Crear el `RealtimeGateway` con autenticación en el handshake y salas de usuario y grupo

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-055, HOG-014
- **Spec:** `docs/specs/03-tiempo-real-actividad.md` (RN-03-01 a RN-03-08)

**Descripción**
Montar Socket.IO en `/realtime`, autenticar cada conexión con la cookie de Better Auth, unir el socket a su sala de usuario y a las de sus grupos, y ofrecer a los servicios el ajuste de salas y la desconexión por sesión.

**Criterios de aceptación**
- [x] `apps/api/src/realtime/realtime.gateway.ts` (`@WebSocketGateway({ path: '/realtime', cors: { origin, credentials: true }, transports: ['websocket', 'polling'] })`) y `realtime.module.ts` global.
- [x] Middleware `io.use` (`realtime/socket-auth.middleware.ts`): sesión válida y no bloqueada, `Origin` permitido; si no, `connect_error` con `UNAUTHENTICATED` o `ACCOUNT_BLOCKED` en `err.message` y `err.data.code`.
- [x] Al conectar: `socket.data = { userId, sessionId }`, `join('user:<userId>')` y `join('group:<id>')` por cada membresía con **una** consulta.
- [x] Sin manejadores `@SubscribeMessage` (socket solo de bajada).
- [x] `realtime/realtime-rooms.service.ts` con `joinGroup(userId, groupId)` y `leaveGroup(userId, groupId)`.
- [x] `RealtimeGateway.disconnectSessions(userId, { sessionIds?, exceptSessionId? })`.
- [x] En local funciona a través del proxy de Vite (`/realtime`, `ws: true`).

**Notas técnicas**
- Sin adaptador Redis (una instancia). Mantén los valores por defecto de `pingInterval`/`pingTimeout`.
- No hay consultas a la BBDD salvo la de conexión (ADR-004).

**Tests**
- Integración: `apps/api/test/realtime/gateway.int.spec.ts` con `socket.io-client` (sin cookie → `UNAUTHENTICATED`; bloqueado → `ACCOUNT_BLOCKED`; salas correctas para un usuario con 2 grupos; `joinGroup`/`leaveGroup` cambian lo que recibe; `disconnectSessions` solo desconecta la sesión indicada; un evento emitido por el cliente no tiene efecto).
- E2E: —

---

### HOG-151 · Crear el `RealtimePublisher` y el catálogo tipado de eventos en `shared`

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-150, HOG-002, HOG-006
- **Spec:** `docs/specs/03-tiempo-real-actividad.md` (RN-03-09 a RN-03-14)

**Descripción**
Crear el único punto de emisión de eventos, que construye el sobre con el actor y el `clientMutationId` del contexto de la petición, y el catálogo tipado que ata cada evento a su `data`.

**Criterios de aceptación**
- [x] `apps/api/src/realtime/realtime.publisher.ts` con `publish(groupId, event, data, opts?)`, `publishToUser(userId, event, data)` (`groupId: null`) y `publishToUserGroups(userId, event, data)` (un sobre por grupo).
- [x] `actorId`/`clientMutationId` desde `RequestContext`; `opts.actorId: null` para eventos de sistema; fuera de petición, ambos `null`.
- [x] Los fallos de emisión se registran con `warn` y no se propagan.
- [x] `packages/shared/src/realtime.ts`: `RealtimeEventDataMap` y `REALTIME_EVENT_SCHEMAS` con `session.revoked: {}`; los eventos de grupos, invitaciones y actividad los añaden HOG-100/102/108/154 y el resto cada épica. Publicar un evento sin entrada en el mapa no compila.
- [x] Con `NODE_ENV !== 'production'`, `publish` valida `data` con `REALTIME_EVENT_SCHEMAS[event]` y lanza si no cumple.
- [x] `FakeRealtimePublisher` en `apps/api/test/fakes/` que guarda los sobres publicados, para los tests de integración de todos los módulos.

**Notas técnicas**
- Documenta en el JSDoc de `publish` que solo se llama **después** del commit.

**Tests**
- Unit: sobre correcto (`event`, `groupId`, `actorId`, `clientMutationId`, `at`); `X-Client-Mutation-Id` inválido → `null`; validación de `data` en test; error de emisión no lanza.
- Integración: un endpoint de prueba que publica con cabecera `X-Client-Mutation-Id` llega al socket con ese id.
- E2E: —

---

### HOG-152 · Crear el `RealtimeProvider` web: despacho a la caché de Query, deduplicación, onda y reconexión

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-151, HOG-005, HOG-006, HOG-009, HOG-053
- **Spec:** `docs/specs/03-tiempo-real-actividad.md` (RN-03-15 a RN-03-21)

**Descripción**
Conectar la web al socket con un único proveedor que reparte cada evento al manejador de su feature, ignora los eventos de las mutaciones propias, marca la onda en los cambios de otros y se pone al día al reconectar.

**Criterios de aceptación**
- [x] `apps/web/src/lib/socket.ts` (creación y destrucción del socket) y `app/providers/RealtimeProvider.tsx` montado en el layout autenticado; se desconecta al cerrar sesión.
- [x] `lib/realtime/mutation-registry.ts` (últimos 200, rellenado por `apiClient` antes de enviar).
- [x] `lib/realtime/dispatcher.ts` y `lib/realtime/handlers.ts` (`registerHandlers({ [event]: (envelope, ctx) => void })`, con `ctx = { queryClient, meId, markRipple }`); `NON_DEDUPED_EVENTS = ['activity.created', 'ai.quota.updated']`.
- [x] `lib/realtime/ripple-store.ts` (Zustand): `markRipple(entityKey, laneColor)` durante 1 000 ms y `useRipple(entityKey)`; solo si `actorId` es otro usuario; el color se resuelve con `['group', groupId, 'members']`.
- [x] Reconexión: en cada `connect` que no sea el primero, invalida `['group', activeGroupId]` y `['me', 'groups']` con refetch y el resto de `['group']` con `refetchType: 'none'`.
- [x] `connect_error` con `UNAUTHENTICATED`/`ACCOUNT_BLOCKED` → detiene la reconexión, limpia la caché y navega a `/entrar`.
- [x] Guía breve en el JSDoc de `handlers.ts`: cómo añade una feature sus manejadores (`features/<x>/realtime.ts`) y la regla de *updater* que no crea queries (RN-03-18).

**Notas técnicas**
- El estado de conexión y el banner son de HOG-155; aquí solo se exponen los eventos `connect`/`disconnect` al `connection-store` (stub).

**Tests**
- Unit: `mutation-registry`, `dispatcher` (dedupe con excepción, desconocidos ignorados), `ripple-store` (temporizadores falsos; sin onda para el propio usuario), reconexión (mock de socket emite `connect` dos veces → una invalidación).
- E2E: cubierto en HOG-156.

---

### HOG-153 · Crear el `ActivityService` con escritura en transacción, *summaries* en español, `MaintenanceCron` y purga de retención

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-004, HOG-006, HOG-010, HOG-151
- **Spec:** `docs/specs/03-tiempo-real-actividad.md` (RN-03-24 a RN-03-29, §4)

**Descripción**
Crear el servicio que todos los módulos usan para registrar la actividad dentro de su transacción y publicarla tras el commit, las utilidades de texto y la retención de 90 días (más la de `SecurityEvent`) dentro del único cron de 6 h (`MaintenanceCron` + `SchedulerTickRegistry`, que crea este ticket).

**Criterios de aceptación**
- [ ] `apps/api/src/activity/activity.service.ts`: `record(tx, input)` (valida `entityType`/`action`, recorta `summary` a 200) y `publishCreated(row)` (construye `ActivityDto` con `actorName` del `RequestContext` y publica `activity.created`), sin consultas extra.
- [ ] `apps/api/src/activity/summary.ts`: `truncateName(name, 60)` y `quoteRename(name)` → `«name»`.
- [ ] `packages/shared/src/activity.ts`: `ACTIVITY_ENTITY_TYPES`, `ACTIVITY_ACTIONS` y tipos; `packages/shared/src/schemas/activity.ts`: `activityDto`, `activityQuery`; `activity.created` en `RealtimeEventDataMap`.
- [ ] `apps/api/src/scheduler/scheduler-tick.registry.ts`: `SchedulerTickRegistry.register({ name, order, run })`, exportado por un `SchedulerModule` global para que los demás módulos registren sus handlers en `onModuleInit`.
- [ ] `apps/api/src/scheduler/maintenance.cron.ts`: `MaintenanceCron`, el **único** cron de 6 h (`@Cron('0 0 */6 * * *', { timeZone: 'Europe/Madrid' })`, `@nestjs/schedule`), que solo ejecuta los handlers del registro por `order`, aislando los errores (uno que falla se registra y no detiene los demás) y sin solapar ticks.
- [ ] `apps/api/src/scheduler/retention.job.ts`: handler `retention.purge` (orden 20) que borra `ActivityLog` > 90 días y `SecurityEvent` > 180 días, como mucho una vez cada 24 h (`lastRunAt` en memoria).
- [ ] Ningún otro cron toca la BBDD (los demás módulos solo registran handlers: `bills.materialize` E11 orden 10, `assistant.purge` E14 orden 30, `reminders.reconcile` E12 orden 100).

**Notas técnicas**
- `record` recibe el `tx` de Prisma (`Prisma.TransactionClient`); nunca abre su propia transacción.

**Tests**
- Unit: `truncateName`, `record` rechaza `entityType` desconocido, `RetentionJob` (temporizadores falsos: dos ticks en < 24 h → una ejecución); `MaintenanceCron` ejecuta los handlers por `order` y aísla un handler que lanza.
- Integración: `activity-service.int.spec.ts` (una transacción que falla después de `record` no deja fila; purga borra lo antiguo y conserva lo reciente).
- E2E: —

---

### HOG-154 · Crear la pantalla de actividad `/g/:groupId/actividad` y su evento `activity.created`

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-153, HOG-152, HOG-107, HOG-101
- **Spec:** `docs/specs/03-tiempo-real-actividad.md` (RN-03-28, RN-03-30 a RN-03-32, §5, §6, §7)

**Descripción**
Exponer el feed de actividad paginado del grupo y mostrarlo agrupado por días en la zona del hogar, con las entradas nuevas llegando en tiempo real.

**Criterios de aceptación**
- [ ] `apps/api/src/activity/activity.controller.ts`: `GET /groups/:g/activity` con `activityQuery`, orden por `id` desc, `nextCursor`, `actorName` resuelto con una consulta por página.
- [ ] `features/activity/api.ts`: `useActivity()` (*infinite query* `['group', g, 'activity']`).
- [ ] `features/activity/pages/ActivityPage.tsx`: grupos "Hoy"/"Ayer"/"lunes 9 de noviembre" en la zona del grupo, filas con `MemberDot` (neutro si no es miembro), "**{actorName}** {summary}" / "Usuario eliminado" / sistema, hora relativa u "HH:mm", paginación infinita con "Cargar más" de respaldo y texto final "No hay actividad anterior (se guarda 90 días)".
- [ ] Estados: carga (8 filas `Skeleton`), vacío ("Todavía no hay actividad. Lo que hagáis en el hogar aparecerá aquí."), error ("No se ha podido cargar la actividad" + "Reintentar") y sin conexión.
- [ ] `features/activity/realtime.ts`: `activity.created` inserta al principio de la primera página (sin duplicar por `id`), onda si es de otro, e invalida `['group', g, 'dashboard']`.
- [ ] La ruta queda accesible desde "Más" cuando exista HOG-750.

**Tests**
- Integración: `activity.int.spec.ts` (paginación y `nextCursor`; `actorName` `null` para usuario borrado; 401/404).
- Unit (web): agrupación por días con `Europe/Madrid` y `Atlantic/Canary` cerca de medianoche; representación de "Usuario eliminado" y de sistema; manejador sin duplicados.
- E2E: —

---

### HOG-155 · Mostrar el banner de sin conexión y bloquear la edición

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-152, HOG-008, HOG-009
- **Spec:** `docs/specs/03-tiempo-real-actividad.md` (RN-03-22, RN-03-23, §7 "OfflineBanner") · ADR-015

**Descripción**
Calcular el estado de conexión combinando `navigator.onLine` y el socket, mostrar el aviso "Sin conexión. Los cambios no se guardarán" y deshabilitar toda edición mientras dure, sin encolar mutaciones.

**Criterios de aceptación**
- [ ] `lib/realtime/connection-store.ts` con `'online' | 'reconnecting' | 'offline'` y `OFFLINE_GRACE_MS = 5000`, escuchando `online`/`offline` del navegador y `connect`/`disconnect` del socket.
- [ ] `useConnectionStatus()` y `useCanEdit()`; la prop `requiresConnection` de `Button`, `Checkbox` y envíos de formulario (y `Fab` cuando exista) deshabilita el control cuando `useCanEdit()` es `false`, con `aria-disabled` y `title` "Sin conexión".
- [ ] `components/ui/OfflineBanner.tsx` (corchera roja `LaneRope variant="limit"`, `role="status"`, `aria-live="polite"`) exportado para que el `AppShell` lo monte (HOG-752); no aparece en `reconnecting`.
- [ ] `apiClient` lanza `OfflineError` sin enviar ninguna mutación en `offline` y la interfaz muestra el toast "Sin conexión. Los cambios no se guardarán".
- [ ] Las mutaciones de TanStack Query tienen `networkMode: 'always'` (no se encolan).

**Tests**
- Unit: transiciones del `connection-store` con temporizadores falsos; `OfflineBanner` visible solo en `offline`; `Button requiresConnection` deshabilitado; `apiClient` rechaza mutaciones en `offline`.
- E2E: cubierto en HOG-156.

---

### HOG-156 · Añadir el e2e de tiempo real entre dos dispositivos y sin conexión

- **Épica:** E03 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-011, HOG-109, HOG-155
- **Spec:** `docs/specs/03-tiempo-real-actividad.md#11-tests`

**Descripción**
Comprobar de punta a punta que dos miembros en navegadores distintos ven los cambios del otro sin recargar y que, sin conexión, aparece el aviso y la edición se bloquea. Es la base de E2E-05, que E04 completa con la lista de la compra.

**Criterios de aceptación**
- [ ] `apps/web/e2e/realtime-group.e2e.ts` usa `twoMembers(browser)` de HOG-011.
- [ ] A cambia el nombre del hogar en Ajustes → B lo ve en su pantalla de ajustes sin recargar (en menos de 3 s).
- [ ] A crea una invitación → aparece en "Pendientes" de B.
- [ ] `contextB.setOffline(true)` → B ve "Sin conexión. Los cambios no se guardarán" y "Invitar a alguien" deshabilitado; `setOffline(false)` → el banner desaparece y los datos se recargan.
- [ ] Pasa en Pixel 7 y en iPhone 14.

**Tests**
- E2E: el propio archivo (precursor de **E2E-05**).
