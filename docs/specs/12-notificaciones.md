# 12 · Notificaciones y recordatorios

> Épica: E12 · Tickets: `docs/tickets/E12-notificaciones.md` · Modelo: `docs/02-modelo-datos.md` (sección "Notificaciones": `PushSubscription`, `NotificationPreference`, `Reminder`) · Arquitectura: `docs/01-arquitectura.md` §Recordatorios · ADR-001, ADR-004, ADR-010

## 1. Objetivo

Avisar a cada persona **en su fecha y hora** de lo que le toca: tareas, eventos propios y vencimientos de facturas, mediante Web Push (VAPID) en los dispositivos donde lo haya activado. Sin servicios de pago, sin Firebase en el cliente y **sin consultar la base de datos cada minuto** (Neon gratuito): los recordatorios se programan con temporizadores en memoria. Esta épica define también la **API pública del scheduler** que usan E07 (tareas), E09 (calendario) y E11 (facturas).

Solo recordatorios y alertas. **No** hay notificaciones push de actividad ("Ana añadió leche"): eso solo se ve dentro de la app.

## 2. Historias de usuario

- **US-12-01** Como miembro, quiero activar los avisos en mi móvil cuando me hacen falta (al crear algo con recordatorio), no nada más abrir la app.
- **US-12-02** Como usuario de iPhone, quiero que la app me explique cómo instalarla para poder recibir avisos.
- **US-12-03** Como miembro, quiero recibir un aviso a la hora configurada de mis tareas, mis eventos y las facturas de las que soy responsable.
- **US-12-04** Como miembro, quiero que al tocar el aviso se abra la app justo en la tarea, el evento o el recibo.
- **US-12-05** Como miembro, quiero elegir qué tipos de aviso recibo y unas horas de silencio.
- **US-12-06** Como miembro, quiero ver en qué dispositivos tengo los avisos activos, quitar uno y enviarme un aviso de prueba.

## 3. Reglas de negocio

### 3.1 Suscripciones push

- **RN-12-01** Una `PushSubscription` por **dispositivo y navegador** (`endpoint` único). `POST /me/push-subscriptions` es idempotente por `endpoint`: si ya existe, actualiza claves y `userAgent` y la asigna al usuario actual (un dispositivo compartido que cambia de cuenta deja de avisar a la anterior). Con `replacesEndpoint`, borra antes la suscripción con ese endpoint si es del mismo usuario.
- **RN-12-02** Como mucho 10 suscripciones por usuario. Al crear la 11.ª se borra la de `lastSuccessAt` más antigua (o `createdAt` si nunca tuvo éxito).
- **RN-12-03** **Limpieza de suscripciones muertas:** al enviar, si el servicio push responde `404` o `410`, la suscripción se borra en el acto. Cualquier otro error (5xx, timeout de 10 s, red) incrementa `failureCount`; al llegar a **3** se borra. Un envío correcto pone `failureCount = 0` y `lastSuccessAt = ahora`.
- **RN-12-04** **Cerrar sesión** en la web: antes de cerrar la sesión, el cliente llama a `DELETE /me/push-subscriptions/:id` de la suscripción de ese dispositivo y a `pushManager.getSubscription()?.unsubscribe()`. Si falla la red, la sesión se cierra igualmente (la suscripción quedará viva hasta que el usuario la quite o se reasigne).
- **RN-12-05** La clave pública VAPID llega a la web en `VITE_VAPID_PUBLIC_KEY`; la privada y `VAPID_SUBJECT` solo están en la API (`docs/06-despliegue.md`).

### 3.2 Permiso e instalación

- **RN-12-06** **Nunca** se pide permiso de notificaciones al abrir la app. Solo:
  1. al guardar algo con recordatorio (tarea con aviso, evento con avisos, factura con aviso) si el estado del dispositivo es `default` y el usuario no ha pulsado "Ahora no" en los últimos 14 días; o
  2. cuando el usuario pulsa "Activar avisos en este dispositivo" en Perfil.
  En ambos casos primero se muestra la hoja explicativa propia (`NotificationPrompt`) y solo al pulsar "Activar avisos" se llama a `Notification.requestPermission()` (dentro del gesto del usuario, necesario en iOS).
- **RN-12-07** **Estado del dispositivo** (`usePushStatus()` en `apps/web/src/lib/push.ts`), evaluado en este orden:
  1. `unsupported`: no existe `serviceWorker`, `PushManager` o `Notification`, y no es iOS.
  2. `ios-too-old`: iOS < 16.4 (versión leída del user agent `OS 16_3`; iPadOS con UA de Mac se detecta con `navigator.maxTouchPoints > 1`).
  3. `ios-needs-install`: iOS ≥ 16.4 y la app no está instalada (`!matchMedia('(display-mode: standalone)').matches && !navigator.standalone`).
  4. `denied`: `Notification.permission === 'denied'`.
  5. `default`: permiso no pedido.
  6. `granted-not-subscribed`: permiso concedido pero sin suscripción (o su `endpoint` no está en `GET /me/push-subscriptions`).
  7. `subscribed`.
- **RN-12-08** Con `granted-not-subscribed`, la app se suscribe sola (sin preguntar de nuevo) al arrancar con sesión iniciada y registra la suscripción en la API.

### 3.3 Recordatorios: almacenamiento y ciclo de vida

- **RN-12-09** Un `Reminder` es un aviso concreto para **un usuario**, una **ocurrencia** de una fuente (`sourceType` + `sourceId` + `occurrenceAt`) y un instante de envío `fireAt` (UTC). Unicidad: `(sourceType, sourceId, userId, fireAt)`.
- **RN-12-10** Estados: `PENDING` (programado) → `SENT` (entregado a ≥ 1 dispositivo) · `FAILED` (el usuario no tenía suscripciones o fallaron todas) · `CANCELLED` (la fuente cambió, se borró, se desactivó la categoría o el usuario ya no es miembro) · `MISSED` (el servidor estaba parado y pasó más de 1 h).
- **RN-12-11** **Horizonte de materialización: 7 días.** Solo existen filas `PENDING` con `fireAt ∈ (ahora, ahora + 7 días]`. Las de más adelante se crean en los ticks siguientes. Esto vale para **todas** las fuentes (puntuales y recurrentes).
- **RN-12-12** **Ventana en memoria: 24 h.** Solo los `PENDING` con `fireAt ≤ ahora + 24 h` tienen un `setTimeout` (en un `Map<reminderId, Timeout>`). El retardo es `max(0, fireAt − ahora)`.
- **RN-12-13** **Tick cada 6 h**: el `MaintenanceCron` de E03 (`@Cron('0 0 */6 * * *', { timeZone: 'Europe/Madrid' })` → 00:00, 06:00, 12:00 y 18:00; spec 03 RN-03-25) ejecuta los handlers del `SchedulerTickRegistry` por orden (`bills.materialize` de E11 con orden 10, `retention.purge` de E03 con 20, `assistant.purge` de E14 con 30). Esta épica registra el handler **`reminders.reconcile`** con orden 100, que hace, en este orden y aislando errores por paso:
  1. (Los handlers anteriores ya se han ejecutado.)
  2. **Reconciliación del horizonte:** para cada proveedor registrado, `computeForHorizon(ahora, ahora + 7 d)` y reconciliación en bloque (§3.5).
  3. **Recarga de la ventana:** `PENDING` con `fireAt ≤ ahora + 24 h` sin temporizador → crear temporizador.
  4. **Limpieza:** borrar `Reminder` con estado distinto de `PENDING` y `fireAt < ahora − 30 días`.
- **RN-12-14** **Arranque** (`onApplicationBootstrap`): (a) **recuperación**: `PENDING` con `fireAt < ahora` y `fireAt ≥ ahora − 1 h` → se envían ya; los de `fireAt < ahora − 1 h` → `MISSED` con un `updateMany`; (b) se llama a `MaintenanceCron.runNow()` (tick completo, RN-12-13) para cubrir los ticks perdidos mientras estuvo parado.
- **RN-12-15** **Una sola instancia** de la API (ADR-007). Aun así, el envío es idempotente: antes de enviar se "reclama" el recordatorio con `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'SENT', sentAt: now } })`; si `count = 0`, no se envía.
- **RN-12-16** Ningún proceso del scheduler consulta la base de datos fuera de: los ticks (4 al día), el arranque, las mutaciones de usuarios (que llaman a la API pública) y el momento de disparar un recordatorio (1 lectura + escrituras de estado). Cumple ADR-004.

### 3.4 API pública del scheduler (para E07, E09, E11 y E02)

`apps/api/src/scheduler/` exporta `SchedulerModule` con:

```ts
// apps/api/src/scheduler/reminder.types.ts
export type ReminderSourceType = 'TASK' | 'EVENT' | 'BILL';

export interface DesiredReminder {
  userId: string;
  groupId: string;
  occurrenceAt: Date;   // ocurrencia (UTC)
  fireAt: Date;         // cuándo enviar (UTC), SIN aplicar horas de silencio
  title: string;        // ≤ 60 caracteres
  body: string;         // ≤ 140 caracteres
  url: string;          // ruta de la PWA, p. ej. "/g/<groupId>/tareas?destacar=<id>"
}

/** Lo implementa cada módulo que tiene recordatorios y lo registra en onModuleInit. */
export interface ReminderSourceProvider {
  readonly sourceType: ReminderSourceType;
  /** Recordatorios deseados de UNA fuente con fireAt en (from, to]. [] si no existe, está archivada o no tiene aviso. */
  computeForSource(sourceId: string, from: Date, to: Date): Promise<DesiredReminder[]>;
  /** Todas las fuentes de este tipo con recordatorios en (from, to], en ≤ 3 consultas. Clave = sourceId. */
  computeForHorizon(from: Date, to: Date): Promise<Map<string, DesiredReminder[]>>;
}

// apps/api/src/scheduler/reminder-scheduler.service.ts
export class ReminderScheduler {
  registerProvider(provider: ReminderSourceProvider): void;
  /** Recalcula y reconcilia los recordatorios de una fuente. Llamar DESPUÉS del commit de crear/editar. */
  upsertForSource(sourceType: ReminderSourceType, sourceId: string): Promise<void>;
  /** Cancela (CANCELLED) todos los PENDING de una fuente y sus temporizadores. Llamar tras borrar o archivar. */
  cancelForSource(sourceType: ReminderSourceType, sourceId: string): Promise<void>;
  /** Cancela los PENDING de un usuario en un grupo (sale o es expulsado). */
  cancelForUserInGroup(userId: string, groupId: string): Promise<void>;
  /** Reconciliación de todas las fuentes de un grupo (alguien entra o sale: cambian los destinatarios "todos"). */
  rebuildGroup(groupId: string): Promise<void>;
  /** Borrado de cuenta (spec 16): limpia los temporizadores en memoria del usuario (sus filas caen en cascada). */
  cancelForUser(userId: string): Promise<void>;
}

// apps/api/src/scheduler/scheduler-tick.registry.ts (lo crea E03, HOG-153; esta épica solo registra handlers)
export class SchedulerTickRegistry {
  register(handler: { name: string; order: number; run: (now: Date) => Promise<void> }): void;
}
```

- **RN-12-17** Las llamadas a la API pública **nunca** hacen fallar la petición del usuario: se ejecutan tras el commit y, si lanzan, se registra el error (`logger.error` con `sourceType`, `sourceId`) y el siguiente tick lo corrige.
- **RN-12-18** `rebuildGroup(groupId)` requiere un método extra opcional del proveedor: si existe `computeForGroup(groupId, from, to)`, se usa; si no, se usa `computeForHorizon` filtrando por `groupId`. Los tres proveedores de este documento implementan `computeForGroup`.

**Cómo calcula cada fuente `fireAt` y destinatarios** (los implementan las épicas dueñas; aquí está el contrato):

| Fuente | Implementa | Ocurrencias | `fireAt` | Destinatarios | `title` / `body` / `url` |
|---|---|---|---|---|---|
| `TASK` | E07 (`modules/tasks/task-reminders.provider.ts`) | Solo `nextDueAt` (la próxima ocurrencia pendiente) de tareas no archivadas con `reminderMinutesBefore ≠ null` | Tarea con hora (`allDay = false`): `nextDueAt − reminderMinutesBefore`. Tarea de día (`allDay = true`): `zonedToUtc(díaLocal(nextDueAt) + "09:00", tz) − reminderMinutesBefore` | `currentAssigneeId`; si es `null`, **todos los miembros actuales** del grupo | "✅ <emoji> <título>" / "Te toca hoy" o "Te toca el jue 12 nov a las 18:00" (sin asignado: "Sin asignar · vence el jue 12 nov") / `/g/<g>/tareas?destacar=<id>` |
| `EVENT` | E09 (`modules/calendar/event-reminders.provider.ts`) | Ocurrencias expandidas (RN-09-09) | Ver RN-09-20 (cada valor de `reminderMinutesBefore`; todo el día con base 09:00) | Solo `ownerId` | RN-09-22 |
| `BILL` | E11 (`modules/bills/bill-reminders.provider.ts`) | Recibos `PENDING` de facturas no archivadas con `reminderDaysBefore ≠ null` | RN-11-20 (09:00 local de `periodDueDate − reminderDaysBefore`) | `responsibleUserId`; si es `null`, todos los miembros actuales | RN-11-22 |

Al completar o saltar una tarea, cambiar el asignado (rotación), cambiar `nextDueAt` o `reminderMinutesBefore`, E07 llama a `upsertForSource('TASK', id)`; al archivar o borrar, a `cancelForSource('TASK', id)`.

### 3.5 Reconciliación

- **RN-12-19** Dada una fuente y su lista deseada (descartando las de `fireAt ≤ ahora` y `> ahora + 7 d`), se compara con las filas existentes de esa fuente con `fireAt > ahora` por la clave `(userId, fireAt)`:
  - Deseada sin fila → `create` `PENDING`.
  - Deseada con fila `PENDING` → `update` si cambian `title`, `body`, `url` u `occurrenceAt`.
  - Deseada con fila `CANCELLED` → vuelve a `PENDING` con el contenido nuevo.
  - Deseada con fila `SENT`, `FAILED` o `MISSED` → no se toca (ya se gestionó).
  - Fila `PENDING` no deseada → `CANCELLED`.
  - Después se sincronizan los temporizadores en memoria de esas filas (crear, reprogramar o quitar).
- **RN-12-20** En el tick, la reconciliación es en bloque: 1 consulta de las filas existentes de ese tipo en el horizonte, `createMany({ skipDuplicates: true })`, `updateMany` por grupos de ids para cancelar, y `update` individuales solo para los cambios de contenido.

### 3.6 Disparo

- **RN-12-21** Cuando vence un temporizador, `ReminderDispatcher.dispatch(reminderId)`:
  1. Carga el recordatorio (si no es `PENDING`, termina), las preferencias del usuario (por defecto todo activado y sin silencio si no hay fila), sus suscripciones y la zona del grupo (1 consulta con `include`).
  2. Si el usuario ya no es miembro de `groupId` → `CANCELLED`.
  3. Si la categoría está desactivada en sus preferencias (`tasks` para `TASK`, `events` para `EVENT`, `bills` para `BILL`) → `CANCELLED`.
  4. **Horas de silencio:** si la hora local (zona del grupo) de ahora está dentro de `[quietHoursStart, quietHoursEnd)` (con cruce de medianoche si `start > end`), se pospone: `fireAt` = siguiente `quietHoursEnd` local; se actualiza la fila y se crea el temporizador. Si al actualizar choca con la unicidad (ya hay otro recordatorio de la misma fuente para ese usuario a esa hora) → `CANCELLED`.
  5. Reclama (RN-12-15) y envía en paralelo a todas las suscripciones (RN-12-22). Si no tiene suscripciones → `FAILED`. Si ninguna entrega → `FAILED`. Si al menos una → queda `SENT`.
- **RN-12-22** **Envío** (`PushSender.send(subscription, payload)` sobre `web-push`): `TTL` = 43 200 s (12 h), `urgency: 'high'`, `topic` = hash corto (≤ 32 caracteres base64url) de `sourceType:sourceId` para que el servicio push sustituya un aviso no entregado de la misma fuente. Payload JSON (≤ 3 KB):
  ```json
  { "v": 1, "title": "🎂 Cumpleaños de Lucía", "body": "jue 12 nov · todo el día",
    "url": "/g/<groupId>/calendario?fecha=<YYYY-MM-DD>&destacar=<id>&ocurrencia=<iso>", "tag": "EVENT:<sourceId>:<occurrenceAt>",
    "reminderId": "<uuid>", "groupId": "<uuid>" }
  ```
- **RN-12-23** Los cambios de preferencias **no** recalculan nada: se aplican en el momento del disparo (RN-12-21, pasos 3 y 4). Así nunca hay que recorrer recordatorios al cambiar preferencias.

### 3.7 Service worker y deep links

- **RN-12-24** Service worker propio `apps/web/src/sw.ts` (vite-plugin-pwa `injectManifest`, ADR-010): precache del shell con Workbox (`precacheAndRoute(self.__WB_MANIFEST)`) y estos manejadores:
  - `push`: parsea el JSON (si falla, muestra "Hogaria" / "Tienes un aviso nuevo" y `url = "/"`) y **siempre** llama a `self.registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { url, groupId }, timestamp: Date.now() })` dentro de `event.waitUntil` (obligatorio por `userVisibleOnly`).
  - `notificationclick`: cierra la notificación y, dentro de `waitUntil`: busca un cliente de la misma origen (`clients.matchAll({ type: 'window', includeUncontrolled: true })`); si existe, `client.focus()` y `client.postMessage({ type: 'NAVIGATE', url })`; si no, `clients.openWindow(url)`.
  - `pushsubscriptionchange`: vuelve a suscribirse con la clave VAPID y hace `fetch(API_URL + '/api/v1/me/push-subscriptions', { method: 'POST', credentials: 'include', body: { ..., replacesEndpoint: oldEndpoint } })`. Si falla, la app lo corregirá al abrir (RN-12-08).
- **RN-12-25** La app escucha `navigator.serviceWorker.onmessage` en `apps/web/src/app/` y, con `NAVIGATE`, llama a `router.navigate(url)`. Si `url` lleva un `groupId` distinto del grupo activo, cambia de grupo antes de navegar. Si el usuario ya no es miembro, la ruta del grupo muestra "No encontrado" (E2E-15).
- **RN-12-26** Formato de `url` por fuente (rutas de `docs/08-convenciones.md` + parámetros de consulta):
  - Tarea: `/g/<groupId>/tareas?destacar=<taskId>` (E07 abre la hoja de la tarea; convención `?destacar=` de `docs/08`).
  - Evento: `/g/<groupId>/calendario?fecha=<YYYY-MM-DD>&destacar=<eventId>&ocurrencia=<ISO>` (`ocurrencia` solo en eventos recurrentes).
  - Recibo: `/g/<groupId>/facturas?destacar=<billPaymentId>`.

### 3.8 Preferencias

- **RN-12-27** `NotificationPreference` por usuario (no por grupo): `tasks`, `events`, `bills` (por defecto `true`) y horas de silencio `quietHoursStart`/`quietHoursEnd` (`HH:mm`, ambas `null` o ambas con valor y distintas → si no, `422`). Si no existe fila, `GET` devuelve los valores por defecto y `PUT` la crea (upsert).
- **RN-12-28** Las horas de silencio se interpretan en la zona del grupo de cada recordatorio.

### 3.9 Aviso de prueba

- **RN-12-29** `POST /me/push-subscriptions/test` envía a **todas** las suscripciones del usuario un aviso "Aviso de prueba" / "Si ves esto, los avisos funcionan en este dispositivo" con `url = "/perfil"`, sin crear `Reminder` y sin aplicar preferencias. Límite: 5 por hora y usuario (`429 RATE_LIMITED`). Responde `{ sent, failed }` y aplica la limpieza de RN-12-03.

## 4. Modelo de datos

`PushSubscription`, `NotificationPreference`, `Reminder` (enums `ReminderSource`, `ReminderStatus`) de `docs/02-modelo-datos.md`. Sin cambios de esquema. `Reminder.url` usa las rutas en español de `docs/08` (`?destacar=`, `?fecha=`).

## 5. API

Rutas personales `/api/v1/me/...` con `AuthGuard`. Esquemas en `packages/shared/src/schemas/notifications.ts`.

```ts
export const createPushSubscriptionInput = z.object({
  endpoint: z.string().url().max(2048),                  // https obligatorio
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(300).nullable().default(null),
  replacesEndpoint: z.string().url().max(2048).optional(),
});
export const pushSubscriptionDto = z.object({
  id: z.string().uuid(),
  endpoint: z.string(),                                  // el cliente lo compara con el suyo para saber "este dispositivo"
  deviceLabel: z.string(),                               // derivado del userAgent en servidor: "Chrome en Android", "Safari en iPhone"
  createdAt: z.string().datetime(),
  lastSuccessAt: z.string().datetime().nullable(),
});
export const notificationPreferencesDto = z.object({
  tasks: z.boolean(), events: z.boolean(), bills: z.boolean(),
  quietHoursStart: hhmm.nullable(), quietHoursEnd: hhmm.nullable(),
});
export const putNotificationPreferencesInput = notificationPreferencesDto; // refine: ambos null o ambos distintos
export const testPushResultDto = z.object({ sent: z.number().int(), failed: z.number().int() });
```

| Método | Ruta | Entrada | Salida | Errores |
|---|---|---|---|---|
| GET | `/me/push-subscriptions` | — | `pushSubscriptionDto[]` | 401 |
| POST | `/me/push-subscriptions` | `createPushSubscriptionInput` | 201 (nueva) o 200 (existente) `pushSubscriptionDto` | 401, 422 |
| DELETE | `/me/push-subscriptions/:id` | — | 204 (también si no existe o es de otro usuario: no revela nada y no borra lo ajeno) | 401 |
| POST | `/me/push-subscriptions/test` | — | `testPushResultDto` | 401, 429 |
| GET | `/me/notification-preferences` | — | `notificationPreferencesDto` | 401 |
| PUT | `/me/notification-preferences` | `putNotificationPreferencesInput` | `notificationPreferencesDto` | 401, 422 |

## 6. Eventos en tiempo real

Ninguno. Las suscripciones y preferencias son personales y no afectan a otros miembros. (Los recordatorios no generan eventos: su efecto es el push.)

## 7. Pantallas y UX

### 7.1 Perfil → sección "Notificaciones"

Sección dentro de `/perfil` (componente `NotificationSettings` en `apps/web/src/features/notifications/`, exportado para que E16 lo monte en `/perfil#notificaciones`). Si cuando se implemente E12 la página `/perfil` aún no existe (E16 es de la fase 6), HOG-602 crea una página `/perfil` mínima con esta sección y E16 la integrará después.

- **"Este dispositivo"**: estado según RN-12-07:
  - `subscribed`: "Avisos activados en este dispositivo" + "Enviar aviso de prueba" + "Desactivar en este dispositivo".
  - `default` / `granted-not-subscribed`: "Avisos desactivados" + botón primario "Activar avisos en este dispositivo".
  - `denied`: "Has bloqueado los avisos en este navegador. Para activarlos, abre los ajustes del navegador → Notificaciones → hogaria.obaiges.com → Permitir." (sin botón de activar).
  - `ios-needs-install`: "Para recibir avisos en iPhone, instala Hogaria en la pantalla de inicio" + "Cómo instalarla" (abre la guía §7.4).
  - `ios-too-old`: "Tu iPhone necesita iOS 16.4 o posterior para recibir avisos".
  - `unsupported`: "Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizados".
- **"Qué quieres que te avisemos"**: interruptores "Tareas", "Eventos del calendario", "Facturas" (`PUT` inmediato con actualización optimista).
- **"Horas de silencio"**: interruptor y dos selectores "Desde" / "Hasta" (por defecto 23:00–08:00). Ayuda: "Los avisos que caigan en este horario te llegarán al terminar".
- **"Tus dispositivos"**: lista de `GET /me/push-subscriptions` con `deviceLabel`, "Último aviso: hace 2 días" y "Quitar" (con `Dialog`). El de este dispositivo lleva la etiqueta "Este dispositivo".
- Toasts: "Aviso de prueba enviado" (con `failed > 0`: "No hemos podido enviar el aviso a 1 dispositivo"), "Avisos activados", "Avisos desactivados en este dispositivo".

### 7.2 Notificación recibida

- Título y cuerpo del payload, icono de la app. Al tocarla: abre o enfoca la app en el deep link (RN-12-25). La pantalla destino abre la hoja del elemento; si ya no existe, el toast del módulo ("Esta tarea ya no existe", "Este evento ya no existe", "Este recibo ya no existe").

### 7.3 Petición de permiso en contexto (`NotificationPrompt`)

- `Sheet` que se abre según RN-12-06. Texto:
  - Título: "¿Te avisamos a tiempo?"
  - Cuerpo: "Hogaria puede enviarte un aviso en este dispositivo cuando llegue la hora de tus tareas, eventos y facturas. Solo recordatorios, nada más."
  - Botones: "Activar avisos" (primario) y "Ahora no" (`ghost`; guarda `hogaria:push-prompt-dismissed-at` en `localStorage`, con `try/catch`).
- Con `ios-needs-install`, la hoja muestra la guía de instalación (§7.4) en lugar del botón de activar. Con `denied`, `unsupported` o `ios-too-old` **no** se abre (no molesta en cada guardado).
- Tras conceder: suscribir (`pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`) → `POST /me/push-subscriptions` → toast "Avisos activados". Si el usuario rechaza en el diálogo del sistema → toast "Sin permiso no podemos avisarte. Puedes activarlo en Perfil".
- El guardado del elemento (tarea, evento, factura) **no** espera a la hoja: se guarda primero y la hoja aparece después.

### 7.4 Guía de instalación (`InstallGuide`)

- Hoja accesible desde Perfil ("Cómo instalar Hogaria"), desde el `NotificationPrompt` y desde un aviso discreto en Inicio la primera semana (cerrable) cuando el dispositivo es iOS sin instalar.
- **iPhone / iPad (Safari):** 1. "Toca el botón Compartir (el cuadrado con una flecha hacia arriba) en la barra de Safari." 2. "Elige «Añadir a pantalla de inicio»." 3. "Pulsa «Añadir»." 4. "Abre Hogaria desde el icono nuevo y activa los avisos en Perfil." Nota: "En iPhone los avisos solo funcionan con la app instalada y con iOS 16.4 o posterior." Si el navegador iOS no es Safari: "Abre hogaria.obaiges.com en Safari para instalarla".
- **Android (Chrome/Edge):** si el navegador emitió `beforeinstallprompt`, botón "Instalar app" que llama a `prompt()`; si no: "Abre el menú ⋮ y elige «Instalar aplicación» o «Añadir a pantalla de inicio»". Nota: "En Android los avisos funcionan también sin instalar".
- Ilustraciones lineales simples (iconografía de `DESIGN.md`), sin capturas de terceros.

### 7.5 Estados

- Cargando dispositivos/preferencias: skeleton. Error: `ErrorState` "No hemos podido cargar tus avisos" + "Reintentar". Sin conexión: interruptores y botones deshabilitados.

## 8. Permisos

Todo es personal: cada usuario solo ve, crea y borra sus suscripciones y sus preferencias. Los recordatorios no tienen API de lectura (no se exponen). Un `DELETE` con el id de una suscripción ajena responde `204` sin borrar nada.

## 9. Actividad

Ninguna. Ni las suscripciones, ni las preferencias, ni el envío de recordatorios generan `ActivityLog`.

## 10. Casos límite

- **Servidor parado** de 03:00 a 05:30 con un aviso a las 04:00 y otro a las 05:00: al arrancar, el de las 05:00 (hace < 1 h) se envía; el de las 04:00 pasa a `MISSED` (RN-12-14).
- **Cambio de hora (DST):** `fireAt` es UTC calculado en hora de pared por cada proveedor, así que un aviso "a las 9:00" sigue a las 9:00 local tras el cambio. El cron de 6 h usa `timeZone: 'Europe/Madrid'`; el 29/03 y el 25/10 el tick de las 00:00/06:00 se ejecuta igual (no cae en la hora inexistente o repetida).
- **Horas de silencio que cruzan medianoche** (23:00–08:00): un aviso a las 23:30 se pospone a las 08:00 del día siguiente; uno a las 07:59 a las 08:00 de ese día. Con 08:00–23:00 (sin cruce) también funciona.
- **Fuente editada justo cuando el temporizador dispara:** la reclamación atómica (RN-12-15) y la cancelación por reconciliación son excluyentes; como mucho se envía el aviso antiguo una vez.
- **Evento con aviso "a la hora" creado para dentro de 30 s:** `fireAt` futuro dentro de la ventana → temporizador inmediato.
- **Usuario sin dispositivos** (nunca activó avisos): sus recordatorios terminan en `FAILED`. No se reintenta.
- **Dispositivo compartido entre dos cuentas:** el endpoint se reasigna al último usuario que lo registró (RN-12-01).
- **Suscripción caducada** (`410` de FCM/APNs): se borra al primer envío. Si era la única, el recordatorio queda `FAILED` y la próxima vez que el usuario abra la app el estado será `granted-not-subscribed` y se volverá a suscribir (RN-12-08).
- **Miembro que entra al grupo:** E02 llama a `rebuildGroup` y empieza a recibir los avisos "para todos" (tareas sin asignado, facturas sin responsable) desde ese momento.
- **Miembro que sale:** E02 llama a `cancelForUserInGroup` y `rebuildGroup`; además, el disparo comprueba la membresía (RN-12-21 paso 2).
- **Muchos avisos a la misma hora** (08:00 tras horas de silencio): se envían todos, cada uno con su `tag`; el sistema operativo los agrupa.
- **Límite de `setTimeout`:** ventana de 24 h (86 400 000 ms) muy por debajo del máximo de 2³¹ − 1 ms.
- **Plan B (Render dormido, ADR-007):** los temporizadores se pierden mientras duerme; la recuperación al arrancar (RN-12-14) aplica la regla de 1 h.

## 11. Tests

- **Unit (`apps/api/src/scheduler/*.spec.ts`, `packages/shared`):** reconciliación (todas las ramas de RN-12-19); cálculo de horas de silencio con y sin cruce de medianoche y con DST; `topic` ≤ 32 caracteres; `deviceLabel` desde user agents de ejemplo; refine de preferencias.
- **Integración (`apps/api/test/scheduler.int.spec.ts`)** con `vi.useFakeTimers()` y `PushSender` falso (registra envíos, `docs/07-testing.md`):
  - `upsertForSource` crea filas y temporizadores solo en horizonte y ventana; `cancelForSource` cancela y quita temporizadores.
  - Al avanzar el reloj se envía el push con el payload correcto y la fila pasa a `SENT`.
  - Recuperación al arrancar: < 1 h se envía, > 1 h `MISSED`.
  - Preferencia desactivada → `CANCELLED`; horas de silencio → `fireAt` pospuesto.
  - `404`/`410` borra la suscripción; 3 fallos borran; éxito resetea `failureCount`.
  - Usuario que ya no es miembro → `CANCELLED`.
  - Tick: ejecuta handlers del registro en orden y aislando errores; limpieza de > 30 días; número de consultas por tick acotado.
  - Reclamación idempotente: dos `dispatch` del mismo id envían una vez.
- **Integración (`apps/api/test/push-subscriptions.int.spec.ts`):** `POST` idempotente por endpoint y reasignación entre usuarios; máximo 10; `DELETE` de una ajena no borra; `test` con `429` al 6.º; preferencias por defecto y `422`.
- **Componentes (web):** `usePushStatus` con cada estado simulado (UA de iOS 16.3/17, standalone, permisos); `NotificationPrompt` no se abre en `denied`; "Ahora no" respeta 14 días; `InstallGuide` muestra los pasos de iOS o Android.
- **E2E:** según `docs/07-testing.md`, el push no se prueba de punta a punta. Sí se comprueba en Playwright (Chromium, con permiso `notifications` concedido en el contexto) que "Activar avisos en este dispositivo" registra la suscripción en la API (`GET /me/push-subscriptions` devuelve 1). No tiene ID de flujo crítico propio.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `DELETE /me/push-subscriptions/:id` y `POST /me/push-subscriptions/test` → `docs/04` (fila "Yo").
- `Reminder.url` con rutas en español y `?destacar=` (convención única de la spec 15) → `docs/02` y `docs/08`.
- `upsertForSource`/`cancelForSource`, horizonte de 7 días para todas las fuentes, `SchedulerTickRegistry` y `FAILED` sin suscripciones → `docs/01` (Recordatorios); el registro lo crea E03 y esta épica registra `reminders.reconcile` (RN-12-13).
- `rebuildGroup` al unirse y `cancelForUserInGroup` + `rebuildGroup` al salir → spec 02 (RN-02-17 y RN-02-22).
- Alineación de la spec 07 (09:00 locales, destinatarios, `url`, `TaskRemindersProvider`) → RN-07-22 de la spec 07.
- Glosario de notificaciones y estados de `Reminder` → `docs/10`.
- `cancelForUser(userId)` para el borrado de cuenta (spec 16) → §3.4 de esta spec y `docs/01`.

## 13. Fuera de alcance

- Notificaciones push de actividad de otros miembros.
- Avisos de turnos de trabajo, de presupuesto superado o de recibos vencidos.
- Email o SMS como canal alternativo.
- Centro de notificaciones dentro de la app (historial de avisos).
- Acciones dentro de la notificación ("Marcar como hecha").
- Varias instancias de la API con reparto de temporizadores.
