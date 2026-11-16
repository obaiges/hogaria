# E12 · Notificaciones y recordatorios

> Spec: `docs/specs/12-notificaciones.md` · Rango: HOG-600 – HOG-649 · Fase: 2
> Orden recomendado: HOG-600 → HOG-604 → HOG-601 → HOG-606 → HOG-602 → HOG-605 → HOG-603 → HOG-607.
> Los proveedores de recordatorios de cada fuente los implementan sus épicas: tareas en E07, eventos en HOG-454, facturas en HOG-554.

### HOG-600 · Suscripción push: VAPID, service worker y API de suscripciones

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** full-stack
- **Depende de:** HOG-002, HOG-003, HOG-004, HOG-005, HOG-015, HOG-055
- **Spec:** `docs/specs/12-notificaciones.md#31-suscripciones-push`

**Descripción**
Montar la base del Web Push sobre el service worker que ya existe (HOG-005 y HOG-015): manejador `push`, endpoints `GET/POST/DELETE /me/push-subscriptions` y utilidades del cliente para suscribirse con la clave VAPID. Sin esto no se puede enviar ningún aviso.

**Criterios de aceptación**
- [ ] `apps/web/src/sw.ts` (creado en HOG-005/HOG-015, que ya precachea el shell) añade el manejador `push`, mostrando siempre una notificación con `title`, `body`, `tag`, `icon`, `badge` y `data.url` (RN-12-24); payload no válido → "Hogaria" / "Tienes un aviso nuevo".
- [ ] `POST /me/push-subscriptions` valida `createPushSubscriptionInput`, es idempotente por `endpoint`, reasigna el endpoint al usuario actual, respeta `replacesEndpoint` y el máximo de 10 (borra la más antigua). 201 si es nueva, 200 si existía.
- [ ] `GET /me/push-subscriptions` devuelve `pushSubscriptionDto[]` con `deviceLabel` derivado del user agent ("Chrome en Android", "Safari en iPhone", "Firefox en Windows"…).
- [ ] `DELETE /me/push-subscriptions/:id` responde 204 y nunca borra la suscripción de otro usuario.
- [ ] `apps/web/src/lib/push.ts` exporta `subscribeThisDevice()` (con `VITE_VAPID_PUBLIC_KEY` convertida a `Uint8Array`) y `unsubscribeThisDevice()`.
- [ ] Al cerrar sesión se llama a `unsubscribeThisDevice()` antes de cerrar la sesión (RN-12-04), sin bloquear el cierre si falla.
- [ ] Esquemas zod en `packages/shared/src/schemas/notifications.ts`; `VAPID_*` en `.env.example` de api y web.

**Notas técnicas**
- API: `apps/api/src/modules/notifications/push-subscriptions.controller.ts` + `.service.ts`. El `deviceLabel` se calcula al vuelo, no se guarda.
- Iconos `public/icons/icon-192.png` y `badge-72.png` (monocromo) los define `DESIGN.md` §Logo; si aún no existen, usar provisionales y anotarlo.
- `sw.js` con `Cache-Control: no-cache` en `_headers` (`docs/06-despliegue.md`).
- No se piden permisos en este ticket (lo hace HOG-603).

**Tests**
- Unit: `deviceLabel` con 6 user agents de ejemplo; conversión de la clave VAPID.
- Integración: `apps/api/test/push-subscriptions.int.spec.ts` (idempotencia, reasignación, máximo 10, DELETE ajeno, 401).
- E2E: — (ver HOG-603).

---

### HOG-604 · PushSender: envío Web Push y limpieza de suscripciones muertas

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-600
- **Spec:** `docs/specs/12-notificaciones.md#36-disparo`

**Descripción**
Servicio inyectable que envía un payload a una suscripción con `web-push` y aplica la limpieza: borrar con 404/410, contar fallos y borrar al tercero. Se sustituye por un falso en los tests.

**Criterios de aceptación**
- [ ] `PushSender.send(subscription, payload): Promise<'ok' | 'gone' | 'error'>` con `TTL: 43200`, `urgency: 'high'`, `topic` (hash base64url ≤ 32 caracteres de `sourceType:sourceId`) y timeout de 10 s.
- [ ] `PushSender.sendToUser(userId, payload)` envía en paralelo a todas sus suscripciones y devuelve `{ sent, failed }`.
- [ ] 404/410 → borra la suscripción; otro error → `failureCount + 1` y borra al llegar a 3; éxito → `failureCount = 0`, `lastSuccessAt = now`.
- [ ] Payload JSON `{ v: 1, title, body, url, tag, reminderId, groupId }` ≤ 3 KB (si se pasa, se trunca `body`).
- [ ] `web-push.setVapidDetails` con `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` al arrancar; si faltan, la API arranca pero `PushSender` registra un aviso y no envía.
- [ ] `FakePushSender` en `apps/api/test/fakes/` que registra los envíos y permite simular 'gone' y 'error'.

**Notas técnicas**
- `apps/api/src/modules/notifications/push-sender.service.ts`. Logs sin el endpoint completo (solo el host del servicio push).

**Tests**
- Unit: mapeo de respuestas de `web-push` (`statusCode` 201/404/410/500/timeout) a resultados y efectos en `failureCount`.
- Integración: con `FakePushSender` en el resto de tickets.

---

### HOG-601 · ReminderScheduler y API pública de recordatorios

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-004, HOG-106, HOG-153, HOG-604
- **Spec:** `docs/specs/12-notificaciones.md#34-api-pública-del-scheduler-para-e07-e09-e11-y-e02`

**Descripción**
Núcleo de recordatorios sin polling: registro de proveedores, `upsertForSource`/`cancelForSource`/`cancelForUserInGroup`/`cancelForUser`/`rebuildGroup`, reconciliación con la tabla `Reminder`, temporizadores en memoria (ventana 24 h) y disparo con reclamación atómica. Es la API que usan E07, E09 y E11.

**Criterios de aceptación**
- [ ] El `SchedulerModule` global (creado en HOG-153 con `MaintenanceCron` y `SchedulerTickRegistry`) pasa a exportar también `ReminderScheduler` y los tipos `ReminderSourceType`, `DesiredReminder`, `ReminderSourceProvider` exactamente como en la spec §3.4.
- [ ] `upsertForSource` llama a `provider.computeForSource(id, now, now + 7 d)` y reconcilia según RN-12-19 (todas las ramas), creando, reprogramando o quitando temporizadores solo para `fireAt ≤ now + 24 h`.
- [ ] `cancelForSource` y `cancelForUserInGroup` pasan los `PENDING` a `CANCELLED` y quitan sus temporizadores.
- [ ] `rebuildGroup` usa `computeForGroup` si el proveedor lo tiene y reconcilia las fuentes del grupo.
- [ ] `cancelForUser(userId)` solo quita de memoria los temporizadores del usuario (lo usa el borrado de cuenta, HOG-808, antes de borrar las filas).
- [ ] Registra los manejadores de E02: en `MemberRemovedHooks` (tras el commit) `cancelForUserInGroup(userId, groupId)` y después `rebuildGroup(groupId)`; al unirse un miembro (aceptar invitación, HOG-102) `rebuildGroup(groupId)`; en `onGroupDeleted` quita los temporizadores del grupo y en `onGroupTimezoneChanged` llama a `rebuildGroup(groupId)`.
- [ ] `ReminderDispatcher.dispatch(id)` aplica RN-12-21 pasos 1, 2 y 5 (carga, membresía, reclamación `updateMany` con `status: 'PENDING'`, envío con `PushSender.sendToUser`, `SENT`/`FAILED`). Los pasos 3 y 4 (preferencias) quedan como un punto de extensión `ReminderGate` que HOG-602 implementa; por defecto deja pasar.
- [ ] Ninguna llamada pública lanza hacia el llamante: los errores se registran (RN-12-17).
- [ ] Sin consultas a la BBDD salvo en las llamadas públicas y en el disparo (RN-12-16).

**Notas técnicas**
- Archivos: `reminder-scheduler.service.ts`, `reminder-dispatcher.service.ts`, `reminder-timers.ts` (Map de `Timeout`), `reminder-reconcile.ts` (función pura de diff, testeable sin BBDD).
- `onModuleDestroy`: `clearTimeout` de todos.
- Proveedor de prueba `FakeReminderProvider` en `apps/api/test/fakes/` para los tests.
- El tick de 6 h y la recuperación al arrancar son de HOG-606.

**Tests**
- Unit: `reminder-reconcile.ts` (crear, actualizar, revivir `CANCELLED`, no tocar `SENT`/`FAILED`/`MISSED`, cancelar sobrantes, descartar fuera de horizonte).
- Integración: `apps/api/test/scheduler.int.spec.ts` con `vi.useFakeTimers()` + `FakePushSender` + `FakeReminderProvider`: upsert → avanzar reloj → push enviado y `SENT`; cancel; usuario no miembro → `CANCELLED`; sin suscripciones → `FAILED`; doble `dispatch` envía una vez.

---

### HOG-606 · Reconciliación en el tick de 6 h, recuperación al arrancar y limpieza

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-601
- **Spec:** `docs/specs/12-notificaciones.md#33-recordatorios-almacenamiento-y-ciclo-de-vida`

**Descripción**
Handler `reminders.reconcile` (orden 100) del `SchedulerTickRegistry`, que ejecuta el `MaintenanceCron` de HOG-153 (no se crea otro cron): reconcilia el horizonte de 7 días de cada proveedor, recarga la ventana de 24 h y limpia recordatorios antiguos. Al arrancar, recupera los `PENDING` vencidos (< 1 h se envían, el resto `MISSED`) y ejecuta un tick.

**Criterios de aceptación**
- [ ] `reminders.reconcile` se registra con `SchedulerTickRegistry.register({ name: 'reminders.reconcile', order: 100, run })`; como tiene el orden más alto, corre después de `bills.materialize` (10), `retention.purge` (20) y `assistant.purge` (30) (RN-12-13).
- [ ] Pasos del handler: reconciliación en bloque por proveedor (`computeForHorizon`, RN-12-20) → recarga de la ventana → borrado de no `PENDING` con `fireAt < now − 30 d`.
- [ ] Un error en un proveedor se registra y no detiene los demás pasos.
- [ ] `onApplicationBootstrap`: recuperación (RN-12-14) y un tick completo del `MaintenanceCron`.
- [ ] Ningún otro cron del scheduler toca la BBDD con frecuencia menor de 6 h (ADR-004).

**Notas técnicas**
- `SchedulerTickRegistry.register({ name, order, run })` se llama desde `onModuleInit` de cada módulo (E11 `bills.materialize` orden 10; E03 `retention.purge` orden 20; E14 `assistant.purge` orden 30).
- En tests, desactivar el cron y llamar a `tick(now)` a mano.

**Tests**
- Integración: recuperación (< 1 h enviado, > 1 h `MISSED`); reconciliación en bloque idempotente (dos ticks seguidos no crean duplicados); limpieza de 30 días; contador de consultas Prisma acotado por tick con 2 proveedores falsos.

---

### HOG-602 · Preferencias de notificación (API + UI) y su aplicación al disparar

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-601, HOG-600, HOG-750, HOG-008
- **Spec:** `docs/specs/12-notificaciones.md#38-preferencias`

**Descripción**
Endpoints `GET/PUT /me/notification-preferences`, la sección "Notificaciones" de `/perfil` (interruptores por tipo, horas de silencio, dispositivos y estado de este dispositivo) y el `ReminderGate` que aplica preferencias y horas de silencio en el momento del disparo.

**Criterios de aceptación**
- [ ] `GET` devuelve los valores por defecto (`true`, `true`, `true`, `null`, `null`) si no hay fila; `PUT` hace upsert y valida que las horas de silencio sean ambas `null` o ambas distintas (`422`).
- [ ] `ReminderGate` implementa RN-12-21 pasos 3 y 4: categoría desactivada → `CANCELLED`; dentro de horas de silencio (zona del grupo, con cruce de medianoche) → `fireAt` = siguiente fin de silencio, fila actualizada y temporizador nuevo; choque de unicidad → `CANCELLED`.
- [ ] Componente `NotificationSettings` en `apps/web/src/features/notifications/` con las secciones y textos de la spec §7.1 ("Este dispositivo", "Qué quieres que te avisemos", "Horas de silencio", "Tus dispositivos").
- [ ] Si `/perfil` no existe aún, se crea una página mínima `/perfil` con esta sección (E16 la integrará).
- [ ] Interruptores con actualización optimista y rollback; "Quitar" dispositivo con `Dialog`.
- [ ] Estados cargando, error y sin conexión.

**Notas técnicas**
- API: `apps/api/src/modules/notifications/notification-preferences.controller.ts` + `.service.ts`; `apps/api/src/scheduler/reminder-gate.ts`.
- Utilidad pura `isInQuietHours(localTime, start, end)` y `nextQuietEnd(now, start, end, tz)` en `packages/shared/src/dates/quiet-hours.ts`.
- Las preferencias no recalculan recordatorios (RN-12-23).

**Tests**
- Unit: `isInQuietHours` / `nextQuietEnd` (23:00–08:00, 08:00–23:00, borde exacto, día de cambio de hora).
- Integración: preferencias por defecto, `422`; disparo con categoría desactivada → `CANCELLED`; disparo en silencio → pospuesto y enviado al avanzar el reloj.
- Componentes: `NotificationSettings` con MSW (cambio de interruptor, error, sin conexión).

---

### HOG-605 · Deep links al tocar la notificación

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-600, HOG-750
- **Spec:** `docs/specs/12-notificaciones.md#37-service-worker-y-deep-links`

**Descripción**
Al tocar una notificación, enfocar la app abierta y navegar al destino, o abrir una ventana nueva si no hay ninguna. Incluye `pushsubscriptionchange`.

**Criterios de aceptación**
- [ ] `notificationclick` en `sw.ts`: cierra, busca cliente con `clients.matchAll({ type: 'window', includeUncontrolled: true })`; si hay, `focus()` + `postMessage({ type: 'NAVIGATE', url })`; si no, `clients.openWindow(url)`.
- [ ] La app escucha `navigator.serviceWorker` `message` y navega con el router; si `url` es de otro grupo, cambia de grupo activo antes.
- [ ] `pushsubscriptionchange` vuelve a suscribirse y hace `POST /me/push-subscriptions` con `replacesEndpoint` y `credentials: 'include'`.
- [ ] Solo se aceptan `url` relativas que empiezan por `/` (se ignora cualquier otra, por seguridad).
- [ ] Al arrancar con sesión y estado `granted-not-subscribed`, la app se resuscribe sola (RN-12-08).

**Notas técnicas**
- Listener en `apps/web/src/app/ServiceWorkerBridge.tsx`. Las páginas destino (tareas, calendario, facturas) leen `?destacar=` (y `?fecha=`/`?ocurrencia=` en calendario) en sus propios tickets (HOG-361, HOG-456, HOG-556), con las utilidades de HOG-756.

**Tests**
- Unit: validación de `url` relativa; manejador de mensajes del SW (navegación y cambio de grupo) con un router de prueba.

---

### HOG-603 · Guía de instalación PWA / iOS y petición de permiso en contexto

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-600, HOG-602, HOG-750
- **Spec:** `docs/specs/12-notificaciones.md#73-petición-de-permiso-en-contexto-notificationprompt`

**Descripción**
`usePushStatus()` con los 7 estados, la hoja `NotificationPrompt` que piden los formularios con recordatorio (tareas, eventos, facturas) y la guía `InstallGuide` para iOS y Android. El permiso nunca se pide al abrir la app.

**Criterios de aceptación**
- [ ] `usePushStatus()` en `apps/web/src/lib/push.ts` devuelve `unsupported | ios-too-old | ios-needs-install | denied | default | granted-not-subscribed | subscribed` según RN-12-07.
- [ ] `useNotificationPrompt()` expone `maybeAsk()` para llamar **después** de guardar un elemento con aviso; solo abre la hoja en `default` (y no descartada en 14 días) o `ios-needs-install`.
- [ ] `NotificationPrompt` con los textos de la spec; "Activar avisos" llama a `Notification.requestPermission()` dentro del gesto y luego a `subscribeThisDevice()`; "Ahora no" guarda la fecha en `localStorage` con `try/catch`.
- [ ] `InstallGuide` con los pasos de iPhone/iPad (Safari y otros navegadores iOS) y Android (botón "Instalar app" si hubo `beforeinstallprompt`).
- [ ] Botón "Cómo instalar Hogaria" en la sección de Perfil y aviso cerrable en Inicio para iOS sin instalar (solo los primeros 7 días desde el primer acceso, guardado en `localStorage`).
- [ ] Ningún código llama a `requestPermission` fuera de `NotificationPrompt` o del botón de Perfil (regla documentada en el README de la feature).

**Notas técnicas**
- `apps/web/src/features/notifications/components/NotificationPrompt.tsx`, `InstallGuide.tsx`. Captura `beforeinstallprompt` en `apps/web/src/app/` al arrancar.
- HOG-360 (tareas), HOG-457 (eventos) y HOG-557 (facturas) llaman a `maybeAsk()`.

**Tests**
- Componentes: `usePushStatus` con UA de iOS 16.3, iOS 17 sin instalar, iOS 17 instalado, Android, permiso `denied`; la hoja no aparece en `denied`; "Ahora no" la silencia 14 días.
- E2E: Playwright (Chromium, permiso `notifications` concedido) → Perfil → "Activar avisos en este dispositivo" → `GET /me/push-subscriptions` devuelve 1 elemento.

---

### HOG-607 · Aviso de prueba

- **Épica:** E12 · **Fase:** 2 · **Prioridad:** P2 · **Puntos:** 1
- **Capa:** full-stack
- **Depende de:** HOG-604, HOG-602
- **Spec:** `docs/specs/12-notificaciones.md#39-aviso-de-prueba`

**Descripción**
`POST /me/push-subscriptions/test` y botón "Enviar aviso de prueba" en Perfil, para comprobar que los avisos llegan (útil en iOS).

**Criterios de aceptación**
- [ ] Envía a todas las suscripciones del usuario "Aviso de prueba" / "Si ves esto, los avisos funcionan en este dispositivo" con `url = "/perfil"`, sin crear `Reminder` ni aplicar preferencias.
- [ ] Devuelve `{ sent, failed }`; aplica la limpieza de suscripciones muertas.
- [ ] 5 por hora y usuario; el 6.º → `429 RATE_LIMITED`.
- [ ] Toasts "Aviso de prueba enviado" / "No hemos podido enviar el aviso a N dispositivos".

**Notas técnicas**
- Throttle con `@Throttle` de `@nestjs/throttler` en la ruta.

**Tests**
- Integración: envío con `FakePushSender`, `429` al 6.º, 401.
