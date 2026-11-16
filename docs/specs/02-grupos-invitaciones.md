# 02 · Grupos e invitaciones

> Épica: E02 · Tickets: `docs/tickets/E02-grupos.md` · Modelo: `docs/02-modelo-datos.md#esquema-prisma` (sección GRUPOS: `Group`, `LaneColor`, `GroupMember`, `GroupInvite`; "Datos semilla al crear un grupo"; "Asignación de `laneColor`") · Seguridad: `docs/03-seguridad.md#registro-solo-por-invitación`

## 1. Objetivo
Que cualquier usuario pueda crear un hogar (grupo), invitar a otras personas con un enlace de un solo uso que caduca a los 10 días, ver quién forma parte, elegir su color de calle y salir o expulsar a alguien, sin roles. Es la base de la autorización de todos los módulos: todo dato del hogar cuelga de `groupId` y pasa por el `GroupMemberGuard`.

## 2. Historias de usuario
- **US-02-01** Como usuario, quiero crear un hogar con un nombre y un emoji para organizar mi casa.
- **US-02-02** Como usuario con varios hogares, quiero elegir en cuál estoy y cambiar de uno a otro.
- **US-02-03** Como miembro, quiero generar un enlace de invitación y compartirlo por WhatsApp (o copiarlo) para que alguien entre en el hogar.
- **US-02-04** Como miembro, quiero ver las invitaciones pendientes y revocar una que ya no quiero que funcione.
- **US-02-05** Como persona que abre un enlace de invitación, quiero ver a qué hogar me invitan y quién, y unirme con un toque (si ya tengo cuenta) o crear la cuenta (si no la tengo).
- **US-02-06** Como miembro, quiero ver los miembros del hogar con su color de calle.
- **US-02-07** Como miembro, quiero cambiar mi color de calle por uno libre.
- **US-02-08** Como miembro, quiero cambiar el nombre, el emoji y la zona horaria del hogar.
- **US-02-09** Como miembro, quiero salir de un hogar.
- **US-02-10** Como miembro, quiero expulsar a otro miembro (por ejemplo, un antiguo compañero de piso).
- **US-02-11** Como último miembro de un hogar, quiero saber que si salgo el hogar se borra con todos sus datos.
- **US-02-12** Como usuario, quiero que al abrir la app me lleve directamente a mi hogar.

## 3. Reglas de negocio

### Grupos
- **RN-02-01** Cualquier usuario autenticado puede crear grupos, sin límite. Validación (`createGroupInput`): `name` 1–40 caracteres tras `trim`; `emoji` exactamente un grafema (`Intl.Segmenter`) que contenga `\p{Extended_Pictographic}`, por defecto `🏠`; `timezone` zona IANA válida (`Intl.supportedValuesOf('timeZone')` o `Europe/Madrid`; en el servidor se valida con `Intl.DateTimeFormat` sin lanzar), por defecto `Europe/Madrid`. Los nombres de grupo no son únicos.
- **RN-02-02** Crear un grupo es **una sola transacción** que escribe: `Group` (`createdById` = usuario), `GroupMember` del creador con `laneColor = CORAL`, `ShoppingList` "Compra" (emoji `🛒`, `position = 0`, `createdById` = usuario), las 9 `ExpenseCategory` por defecto (en el orden de `DEFAULT_EXPENSE_CATEGORIES` de `packages/shared`, `position` 0–8) y el `ActivityLog` "creó el hogar". Si algo falla, no se crea nada.
- **RN-02-03** Cualquier miembro puede editar `name`, `emoji` y `timezone` (`updateGroupInput`, todos opcionales, al menos uno). Last-write-wins.
- **RN-02-04** Cambiar la `timezone` invalida la caché del `GroupMemberGuard` de **todo** el grupo (RN-02-26) y cambia la interpretación de los días (`@db.Date`) de todos los módulos a partir de ese momento. No se reescriben datos. Los módulos con recordatorios (E12) los recalculan al recibir la llamada `onGroupTimezoneChanged(groupId)` (hook equivalente a RN-02-22; hasta que exista E12 no hace nada).
- **RN-02-05** `GET /me/groups` devuelve los grupos del usuario ordenados por `GroupMember.joinedAt` ascendente, sin paginar.
- **RN-02-06** Máximo de miembros por grupo: `MAX_GROUP_MEMBERS = 20` (`packages/shared/src/constants/groups.ts`). Aceptar una invitación de un grupo lleno → `409 CONFLICT` "Este hogar ya tiene el máximo de 20 miembros" y la invitación **no** se consume. Crear una invitación en un grupo lleno → mismo error.

### Colores de calle
- **RN-02-07** Al unirse un miembro, `laneColor = pickLaneColor(coloresEnUso)` (función pura en `packages/shared/src/groups/lane-colors.ts`): el primer color de `LANE_COLOR_ORDER = ['CORAL','SEA','SUN','LEAF','VIOLET','ROSE','ORANGE','SLATE']` que no use nadie; si están todos en uso, el color **menos usado**, y a igualdad, el primero en ese orden.
- **RN-02-08** La asignación de color y el alta del miembro se hacen en una transacción que bloquea la fila del grupo (`SELECT id FROM groups WHERE id = $1 FOR UPDATE` con `$queryRaw` en *tagged template*) para que dos altas simultáneas no reciban el mismo color libre.
- **RN-02-09** Cada miembro puede cambiar **solo su propio** color (`PATCH /groups/:g/members/me`, `updateMyMemberInput { laneColor }`). Si otro miembro ya lo tiene → `409 CONFLICT` "Ese color ya lo tiene {nombre}". Elegir el color que ya tiene → `200` sin cambios ni evento. La comprobación se hace en la misma transacción con bloqueo de RN-02-08.

### Invitaciones
- **RN-02-10** Cualquier miembro puede crear invitaciones. El token son 32 bytes de `crypto.randomBytes` en base64url (43 caracteres). En la BBDD solo se guarda `tokenHash` = SHA-256 en hexadecimal (`hashInviteToken()` en `apps/api/src/modules/groups/invite-token.ts`). `expiresAt = createdAt + 10 días` (`INVITE_TTL_DAYS = 10` en shared). La URL es `${APP_URL}/invite/${token}`.
- **RN-02-11** El token en claro **solo** se devuelve en la respuesta de `POST /groups/:g/invites`. Después no se puede recuperar: la lista de invitaciones no lo incluye y la interfaz lo deja claro ("Este enlace solo se muestra ahora").
- **RN-02-12** Límites: 20 invitaciones creadas al día por usuario (throttler, `429 RATE_LIMITED`) y como mucho 20 invitaciones `ACTIVE` por grupo (`409 CONFLICT` "Hay demasiadas invitaciones pendientes. Revoca alguna").
- **RN-02-13** Estado calculado (`inviteStatus()` en shared, nunca guardado): `REVOKED` si `revokedAt`; si no, `USED` si `usedAt`; si no, `EXPIRED` si `expiresAt <= now`; si no, `ACTIVE`.
- **RN-02-14** `GET /groups/:g/invites` devuelve las `ACTIVE` más las no activas creadas en los últimos 30 días, ordenadas por `createdAt` descendente.
- **RN-02-15** Revocar: cualquier miembro, solo invitaciones `ACTIVE` (pone `revokedAt = now()`). Revocar una no activa → `409 CONFLICT` "Esta invitación ya no está activa".
- **RN-02-16** `GET /invites/:token` es **público** (`@Public()`), limitado a 30 peticiones por minuto por IP. Busca por `tokenHash`:
  - Si hay sesión y el usuario ya es miembro del grupo de esa invitación (sea cual sea su estado) → `200` con `alreadyMember: true` y `groupId`.
  - Si no existe o no está `ACTIVE` → `410 INVITE_INVALID` (mismo error para todos los casos: no se distingue caducada, usada, revocada o inexistente).
  - Si está `ACTIVE` → `200` con `alreadyMember: false`, `groupId: null`, y **pone la cookie `hogaria_invite`** (spec 01, RN-01-02) solo si la petición no trae sesión.
- **RN-02-17** Consumo de una invitación (común a `POST /invites/:token/accept` y a `InvitesService.consumeForNewUser(token, userId)` que llama el hook de registro de la spec 01): en **una** transacción, (1) bloquea el grupo (RN-02-08); (2) si el usuario ya es miembro, termina con `alreadyMember: true` **sin consumir** la invitación; (3) comprueba el máximo de miembros (RN-02-06); (4) consume con `updateMany({ where: { tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now, usedById: userId } })` y, si `count !== 1`, `410 INVITE_INVALID`; (5) crea el `GroupMember` con el color de RN-02-07; (6) escribe `ActivityLog` "se unió al hogar" con `actorId` = nuevo miembro. Tras el commit llama a `scheduler.rebuildGroup(groupId)` (E12) para que el nuevo miembro reciba los avisos "para todos".
- **RN-02-18** Tras el commit de un consumo: invalida la caché del guard para (userId, groupId) (RN-02-26), une los sockets del usuario a la sala del grupo (`RealtimeRooms.joinGroup`, spec 03), y publica en la sala del grupo `group.member.joined` (`GroupMemberDto`), `invite.used` (`GroupInviteDto`) y `activity.created`.
- **RN-02-19** Las invitaciones no van dirigidas a un email concreto: cualquiera con el enlace puede usarlo una vez.

### Salir, expulsar y borrar
- **RN-02-20** Salir (`POST /groups/:g/leave`): cualquier miembro. Si quedan otros miembros: en una transacción borra su `GroupMember`, ejecuta los `MemberRemovedHooks` (RN-02-22) y escribe `ActivityLog` "salió del hogar". Tras el commit: publica `group.member.left` (`{ userId }`) en la sala del grupo **antes** de sacar de la sala a los sockets del usuario (así sus otros dispositivos también se enteran), después `RealtimeRooms.leaveGroup(userId, groupId)`, invalida la caché del guard y publica `activity.created`.
- **RN-02-21** Si el que sale es el **último** miembro, el grupo se borra: en una transacción se borran las filas con `groupId` que no tienen FK a `Group` (`Reminder`, `AiConversation` con sus `AiMessage` en cascada) y después el `Group` (el resto cae en cascada). Tras el commit: publica `group.member.left` a la sala (solo quedan sus propios sockets), los saca de la sala, invalida toda la caché del guard del grupo y llama a `onGroupDeleted(groupId)` (E12 cancela los temporizadores en memoria; hasta que exista no hace nada). No queda `ActivityLog` (se borra con el grupo).
- **RN-02-22** `MemberRemovedHooks`: registro en `apps/api/src/modules/groups/member-removed.hooks.ts` donde cada módulo registra `onMemberRemoved(tx, { groupId, userId })`, que se ejecuta **dentro** de la transacción de salida o expulsión. E02 crea el mecanismo sin manejadores; la lógica de salida vive en `GroupsService.removeMember(tx, groupId, userId, { reason: 'LEFT' | 'REMOVED' | 'ACCOUNT_DELETED' })`, que acepta una transacción externa para que el borrado de cuenta (spec 16, RN-16-21) la reutilice. Salir de un grupo **borra el contenido personal del usuario en ese grupo** (ADR-019). Manejadores que registra cada épica (todos dependen de HOG-106):
  - **E06** (`meals.member-removed.ts`, RN-06-30): quita `userId` de `MealPlanEntry.forUserIds` y **borra** las entradas que eran solo para él.
  - **E07** (`tasks.member-removed.ts`, RN-07-18): lo quita de `Task.rotationUserIds` y, si era `currentAssigneeId`, pasa al siguiente de la rotación (o `null`).
  - **E09**: borra sus `CalendarEvent` de ese grupo.
  - **E10**: borra sus `Expense` y `Budget` de ese grupo.
  - **E11**: `Bill.responsibleUserId = null` en las facturas del grupo de las que era responsable.
  - **E14**: `AssistantConversationsService.deleteAllForMember(groupId, userId)` borra sus `AiConversation` (y `AiMessage`) de ese grupo.
  - **E12** (tras el commit, no dentro de la transacción): `scheduler.cancelForUserInGroup(userId, groupId)` y después `scheduler.rebuildGroup(groupId)`, que recalcula los avisos "para todos" y los de las tareas reasignadas.
  Los manejadores no emiten eventos ni actividad propios: los clientes invalidan las queries afectadas al recibir `group.member.left`.
- **RN-02-23** Expulsar (`DELETE /groups/:g/members/:userId`): cualquier miembro puede expulsar a otro (no hay roles). Mismos efectos que RN-02-20 para el expulsado, con `ActivityLog` "expulsó a {nombre} del hogar" (`actorId` = quien expulsa, `metadata = { userId }`). Expulsarse a uno mismo → `422 VALIDATION_ERROR` "Para salir del hogar, usa «Salir del hogar»". `userId` que no es miembro → `404 NOT_FOUND`. Se puede volver a invitar al expulsado.
- **RN-02-24** El contenido compartido creado por quien sale o es expulsado (listas, productos, recetas, tareas, facturas, actividad) se queda en el grupo. Los DTO muestran su nombre (el usuario sigue existiendo) aunque ya no sea miembro; si además borró su cuenta, "Usuario eliminado".
- **RN-02-25** Los datos personales que no dependen del grupo (`WorkSchedule`, `WorkShiftOverride`, `DietProfile`) no se tocan al salir.

### Autorización
- **RN-02-26** `GroupMemberGuard` (`apps/api/src/common/guards/group-member.guard.ts`) se aplica a toda ruta con `:groupId`. Si `groupId` no es un UUID válido → `404 NOT_FOUND`. Consulta `GroupMember` por `(groupId, userId)` incluyendo `group.timezone`. Cachea en memoria **60 s** por clave `userId:groupId`, tanto el resultado positivo como el negativo (`MembershipCache`, `Map` con caducidad). Métodos de invalidación: `invalidate(userId, groupId)` (alta, salida, expulsión) e `invalidateGroup(groupId)` (cambio de zona horaria, borrado del grupo).
- **RN-02-27** El guard deja en la petición `req.groupContext = { groupId, timezone, memberId, laneColor }`, accesible con el decorador `@CurrentGroup()`. Los servicios usan `groupContext.timezone` para las fechas del grupo.
- **RN-02-28** Grupo inexistente y grupo ajeno responden **igual**: `404 NOT_FOUND` con el mismo cuerpo (no se revela que existe).
- **RN-02-29** Toda consulta de los servicios de grupo filtra por `groupId` (`findFirst({ where: { id, groupId } })`).

### Navegación web
- **RN-02-30** Redirección de entrada (la aplica la ruta `/` y el final de cualquier login sin `?redirect`): si `localStorage['hogaria:lastGroupId']` es uno de los grupos de `GET /me/groups` → `/g/:groupId`; si no, si el usuario tiene exactamente un grupo → `/g/:groupId`; si no → `/grupos`. Las lecturas y escrituras de `localStorage` van en `try/catch`.
- **RN-02-31** El layout `/g/:groupId` (`GroupLayout` con `GroupProvider`) carga `GET /groups/:g` y `GET /groups/:g/members`; si responde 404 muestra la pantalla "No encontrado" (E2E-15). Si carga bien, guarda `hogaria:lastGroupId`.
- **RN-02-32** Al recibir `group.member.left` con `userId` igual al usuario actual (expulsado, o salió desde otro dispositivo): se quita el grupo de `['me', 'groups']`, se borran las queries `['group', groupId]` y, si era el grupo activo, se navega a `/grupos` con el toast "Ya no formas parte de {nombre}".

## 4. Modelo de datos
- `Group`, `GroupMember`, `GroupInvite`, enum `LaneColor`: `docs/02-modelo-datos.md`.
- Semilla del grupo: `ShoppingList` y `ExpenseCategory` (mismas tablas de E04 y E10; E02 solo las inserta).
- `ActivityLog` (escritura con `ActivityService`, spec 03).
- `Reminder` y `AiConversation` tienen `groupId` sin FK a `Group`: se borran a mano al borrar el grupo (RN-02-21).
- No hay cambios de esquema. `MAX_GROUP_MEMBERS` y las acciones `removed`/`revoked` de `ActivityLog` están en `docs/02-modelo-datos.md`.

## 5. API

Esquemas en `packages/shared/src/schemas/groups.ts` e `invites.ts`. Todas las rutas `/groups/:groupId/**` pasan `AuthGuard` + `GroupMemberGuard`.

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/me/groups` | — | `myGroupDto[]` | `401` |
| POST | `/groups` | `createGroupInput` `{ name, emoji?, timezone? }` | `201` `myGroupDto` | `401` · `422 VALIDATION_ERROR` |
| GET | `/groups/:groupId` | — | `groupDto` | `401` · `404` |
| PATCH | `/groups/:groupId` | `updateGroupInput` `{ name?, emoji?, timezone? }` (al menos uno) | `groupDto` | `401` · `404` · `422` |
| GET | `/groups/:groupId/members` | — | `groupMemberDto[]` (orden `joinedAt` asc) | `401` · `404` |
| PATCH | `/groups/:groupId/members/me` | `updateMyMemberInput` `{ laneColor }` | `groupMemberDto` | `401` · `404` · `409 CONFLICT` · `422` |
| DELETE | `/groups/:groupId/members/:userId` | — | `204` | `401` · `404` · `422` (a uno mismo) |
| POST | `/groups/:groupId/leave` | — | `204` | `401` · `404` |
| POST | `/groups/:groupId/invites` | — (cuerpo vacío) | `201` `createdGroupInviteDto` | `401` · `404` · `409 CONFLICT` (grupo lleno o 20 activas) · `429 RATE_LIMITED` |
| GET | `/groups/:groupId/invites` | — | `groupInviteDto[]` | `401` · `404` |
| DELETE | `/groups/:groupId/invites/:inviteId` | — | `groupInviteDto` (ya revocada) | `401` · `404` · `409 CONFLICT` |
| GET | `/invites/:token` | — (público; sesión opcional) | `publicInviteDto` (+ `Set-Cookie: hogaria_invite` según RN-02-16) | `410 INVITE_INVALID` · `429` |
| POST | `/invites/:token/accept` | — | `acceptInviteResultDto` | `401` · `409 CONFLICT` (grupo lleno) · `410 INVITE_INVALID` |

Esquemas:
- `groupDto = { id, name, emoji, timezone, createdById: string | null, createdAt, updatedAt }`.
- `myGroupDto = groupDto & { memberCount: number, myLaneColor: LaneColor, joinedAt: string }`.
- `createGroupInput = { name: groupNameSchema, emoji: groupEmojiSchema.default('🏠'), timezone: timezoneSchema.default('Europe/Madrid') }`; `updateGroupInput = createGroupInput.partial()` + `.refine(al menos una clave)`.
- `laneColorSchema = z.enum(LANE_COLOR_ORDER)`; `updateMyMemberInput = { laneColor: laneColorSchema }`.
- `groupMemberDto = { id, groupId, userId, name, username: string | null, image: string | null, laneColor: LaneColor, joinedAt }`.
- `inviteStatusSchema = z.enum(['ACTIVE','USED','REVOKED','EXPIRED'])`.
- `groupInviteDto = { id, groupId, status, createdById: string | null, createdByName: string | null, usedById: string | null, usedByName: string | null, expiresAt, usedAt: string | null, revokedAt: string | null, createdAt }`.
- `createdGroupInviteDto = { invite: groupInviteDto, token: string, url: string }`.
- `publicInviteDto = { groupName, groupEmoji, invitedByName: string | null, expiresAt, alreadyMember: boolean, groupId: string | null }` (`groupId` solo si `alreadyMember`).
- `acceptInviteResultDto = { groupId: string, alreadyMember: boolean }`.

## 6. Eventos en tiempo real

Todos en la sala `group:<groupId>`, con el sobre de `docs/04-api-y-tiempo-real.md`.

| Evento | Cuándo | data |
|---|---|---|
| `group.updated` | `PATCH /groups/:g` con cambios | `GroupDto` |
| `group.member.joined` | Tras consumir una invitación (accept o registro) | `GroupMemberDto` |
| `group.member.updated` | Cambio de `laneColor` | `GroupMemberDto` |
| `group.member.left` | Salir, ser expulsado o borrado del grupo por salir el último | `{ userId }` |
| `invite.created` | `POST /groups/:g/invites` (sin token) | `GroupInviteDto` |
| `invite.revoked` | `DELETE /groups/:g/invites/:id` | `GroupInviteDto` |
| `invite.used` | Tras consumir la invitación | `GroupInviteDto` |
| `activity.created` | Tras cada `ActivityLog` de §9 | `ActivityDto` (spec 03) |

Manejo en el cliente (`apps/web/src/features/groups/realtime.ts`):
- `group.updated` → `setQueryData(['group', g, 'detail'])` y actualiza el elemento en `['me', 'groups']`.
- `group.member.joined` → añade a `['group', g, 'members']` (si no estaba) y suma 1 a `memberCount` en `['me', 'groups']`. Si `userId` es el usuario actual (se unió desde otro dispositivo) → `invalidateQueries(['me', 'groups'])`. Onda en la fila del miembro.
- `group.member.updated` → reemplaza en `['group', g, 'members']`; si es el actual, actualiza `myLaneColor`.
- `group.member.left` → RN-02-32 si es el usuario actual; si no, lo quita de `['group', g, 'members']` y resta 1 a `memberCount`.
- `invite.*` → *upsert* por `id` en `['group', g, 'invites']`.

## 7. Pantallas y UX

### `/` — redirección de entrada
Sin interfaz propia: muestra un `Skeleton` de pantalla completa mientras resuelve RN-02-30.

### `/grupos` — `features/groups/pages/GroupsPage.tsx`
- Sin `BottomNav` (no hay grupo activo). Cabecera con el logo y el avatar (enlace a `/perfil`).
- Título "Tus hogares". Lista de filas de 56 px: emoji grande, nombre (Barlow 600), "{n} miembros" y un `MemberDot` de 20 px con `myLaneColor`. Pulsar → `/g/:groupId`.
- Botón "Crear hogar" (`secondary`, ancho completo, al final de la lista).
- Vacío (`EmptyState` con rejilla de azulejo): "Aún no perteneces a ningún hogar." + acción "Crear hogar" + texto "¿Te han invitado? Abre el enlace que te enviaron."
- Cargando: 3 filas `Skeleton`. Error: `ErrorState` "No se han podido cargar tus hogares" + "Reintentar". Sin conexión: `OfflineBanner` y "Crear hogar" deshabilitado.
- **Sheet "Crear hogar"**: "Nombre del hogar" (placeholder "Casa Baiges"), "Emoji" (rejilla de 12 sugerencias `🏠 🏡 🏘️ 🏢 🛖 🏰 ⛺ 🌊 🌻 🐱 🐶 ❤️` + campo "Otro emoji"), botón "Crear hogar". La zona horaria no se pide (por defecto `Europe/Madrid`). Éxito → navega a `/g/:groupId` con el toast "Hogar creado".

### `/invite/:token` — `features/groups/pages/InvitePage.tsx` (pública)
- Cargando: tarjeta `Skeleton`.
- Válida y sin sesión: "{invitedByName} te invita a unirte a" + "{emoji} {groupName}" (Barlow Condensed 600) + "La invitación caduca el {fecha larga, p. ej. 21 de noviembre}." Botones: "Crear cuenta" (`primary`) → guarda `sessionStorage['hogaria:pendingInvite'] = { token, groupName, groupEmoji }` y va a `/registro`; "Continuar con Google" (`secondary`, `callbackURL = APP_URL/invite/:token`: si es un usuario nuevo, el hook de registro le une al grupo y al volver la página recibe `alreadyMember: true` y navega al hogar; si ya tenía cuenta, vuelve con sesión y ve el botón "Unirme a {groupName}"); enlace "Ya tengo cuenta" → guarda `pendingInvite` y va a `/entrar?volver=/invite/:token`.
- Válida y con sesión: misma cabecera + botón "Unirme a {groupName}" → `POST accept` → navega a `/g/:groupId` con el toast "Te has unido a {groupName}". `alreadyMember: true` (en la carga o al aceptar) → navega directamente a `/g/:groupId` con el toast "Ya formas parte de {groupName}".
- `410`: `ErrorState` sin "Reintentar": "Invitación no válida o caducada" + "Pide a alguien del hogar que te envíe un enlace nuevo." + botón "Ir a Hogaria" (→ `/`).
- `409` (lleno): "Este hogar ya tiene el máximo de 20 miembros".
- Sin conexión: `OfflineBanner` y botones deshabilitados.

### `/g/:groupId/ajustes` — `features/groups/pages/GroupSettingsPage.tsx` ("Ajustes del grupo")
Secciones separadas por encabezados en versalitas (`DESIGN.md` §4):
1. **HOGAR**: fila con emoji + nombre → `Sheet` "Editar hogar" (nombre, emoji y "Zona horaria" con `Select` de `Intl.supportedValuesOf('timeZone')` y `Europe/Madrid` y `Atlantic/Canary` arriba). Al cambiar la zona horaria, aviso en el sheet: "Las fechas del hogar se interpretarán en la nueva zona horaria." Toast "Cambios guardados".
2. **MIEMBROS ({n})**: una fila por miembro: `MemberAvatar` 36 px con su color, nombre, "@username" si tiene y "(tú)" en la propia. Menú de fila (no en la propia): "Expulsar del hogar" → `Dialog` "¿Expulsar a {nombre}? Dejará de ver el hogar y se borrarán sus eventos, gastos y conversaciones de este hogar. Podrás invitarle de nuevo." Botón `danger` "Expulsar". Toast "{nombre} ya no está en el hogar".
3. **TU COLOR DE CALLE**: 8 muestras circulares de 44 px con los tokens `--lane-*` de `DESIGN.md`; la actual con anillo de foco y check; las ocupadas por otro, deshabilitadas con la inicial del miembro y `aria-label` "Coral, lo tiene Ana". Pulsar una libre la guarda al momento (actualización optimista). Vista previa: `Lane` de ejemplo con su nombre.
4. **INVITACIONES**: botón "Invitar a alguien" (`primary`) → crea la invitación y abre el `Sheet` "Enlace de invitación": URL en un campo de solo lectura, "Este enlace solo se muestra ahora. Sirve para una persona y caduca el {fecha}." Botones "Compartir enlace" (solo si existe `navigator.share`; comparte `{ title: 'Únete a {groupName} en Hogaria', text: '{tu nombre} te invita a {groupName} en Hogaria', url }`; si el usuario cancela, no se muestra error) y "Copiar enlace" (`navigator.clipboard.writeText`; toast "Enlace copiado"; si falla, selecciona el texto del campo). Debajo, lista "Pendientes": "Creada por {nombre} · caduca {en N días}" + botón `ghost` "Revocar" → `Dialog` "¿Revocar esta invitación? El enlace dejará de funcionar." Toast "Invitación revocada". Lista plegable "Anteriores (30 días)": "Usada por {nombre}", "Revocada" o "Caducada".
5. **ZONA DE PELIGRO**: botón `danger` "Salir del hogar" → `Dialog`. Si quedan más miembros: "¿Salir de {groupName}? Dejarás de ver sus datos y se borrarán tus eventos, gastos y conversaciones de este hogar." Si es el último: "Eres el último miembro. Si sales, {groupName} y **todos sus datos** se borrarán para siempre." y el botón dice "Salir y borrar hogar". Tras salir → `/grupos` (o redirección de entrada) con el toast "Has salido de {groupName}".
- Estados: cargando (skeleton por sección), error por sección con "Reintentar", sin conexión (`OfflineBanner` y todos los controles deshabilitados), vacío en "Pendientes": "No hay invitaciones pendientes".

### "No encontrado" (`GroupLayout`, E2E-15)
`ErrorState` sin "Reintentar": "No encontrado" + "Este hogar no existe o no formas parte de él." + botón "Ir a mis hogares" (→ `/grupos`).

### Selector de hogar
El selector de la `AppHeader` (HOG-750) usa `['me', 'groups']`: lista de hogares con emoji, "Crear hogar" y "Ver todos" (→ `/grupos`). E02 expone el hook `useMyGroups()` y `useActiveGroup()`.

## 8. Permisos
- Todo miembro: ver y editar el grupo, ver miembros, crear, listar y revocar invitaciones, expulsar a otros miembros, salir.
- Cada miembro: cambiar **solo** su color de calle.
- No miembros: `404` en cualquier ruta del grupo. `GET /invites/:token` es público.
- No hay roles ni "propietario del grupo" (`createdById` es informativo).

## 9. Actividad

`ActivityService.record(tx, …)` con estos valores (`summary` sin el nombre del actor; la interfaz lo antepone, spec 03):

| Acción | `entityType` | `entityId` | `action` | `summary` | `metadata` |
|---|---|---|---|---|---|
| Crear grupo | `group` | `Group.id` | `created` | `creó el hogar {emoji} {name}` | — |
| Editar nombre | `group` | `Group.id` | `updated` | `cambió el nombre del hogar a «{name}»` | `{ fields: ['name'] }` |
| Editar solo emoji | `group` | `Group.id` | `updated` | `cambió el emoji del hogar a {emoji}` | `{ fields: ['emoji'] }` |
| Editar solo zona horaria | `group` | `Group.id` | `updated` | `cambió la zona horaria del hogar a {timezone}` | `{ fields: ['timezone'] }` |
| Editar varios campos | `group` | `Group.id` | `updated` | `actualizó los datos del hogar` | `{ fields: [...] }` |
| Unirse | `group_member` | `GroupMember.id` | `joined` | `se unió al hogar` | — |
| Salir | `group_member` | `GroupMember.id` | `left` | `salió del hogar` | — |
| Expulsar | `group_member` | `GroupMember.id` | `removed` | `expulsó a {nombre} del hogar` | `{ userId }` |
| Crear invitación | `group_invite` | `GroupInvite.id` | `created` | `creó una invitación` | — |
| Revocar invitación | `group_invite` | `GroupInvite.id` | `revoked` | `revocó una invitación` | — |

El cambio de color de calle **no** genera actividad. El uso de una invitación no genera una entrada aparte (la cubre "se unió al hogar"). El `PATCH` sin cambios reales no genera actividad ni evento.

## 10. Casos límite
- Dos personas aceptan la misma invitación a la vez: una consume (RN-02-17 paso 4) y la otra recibe `410`.
- Un miembro abre una invitación de su propio grupo: `alreadyMember: true` → navega al grupo y la invitación sigue `ACTIVE`.
- Expulsado mientras tiene la app abierta en ese grupo: RN-02-32. Sus peticiones posteriores al grupo reciben `404` (como mucho tras 60 s de caché, que se invalida al expulsar, así que en la práctica al instante).
- Dos miembros se expulsan mutuamente a la vez: el segundo recibe `404` (ya no es miembro).
- El último miembro sale mientras otro usuario está aceptando una invitación: el borrado del grupo bloquea la fila; la aceptación posterior recibe `410` (la invitación se borró en cascada).
- Más de 8 miembros: los colores se repiten según RN-02-07; ese miembro no puede cambiar a ningún color ocupado (todas las muestras ocupadas se ven deshabilitadas, con el texto "Todos los colores están en uso").
- `navigator.share` no existe (escritorio) o falla: solo se ofrece "Copiar enlace".
- `navigator.clipboard` no disponible (contexto no seguro): el campo queda seleccionado y se muestra "Mantén pulsado para copiar".
- Usuario sin grupos tras registrarse (invitación consumida por otro a la vez, spec 01 RN-01-05): `/grupos` vacío; puede crear su propio hogar o pedir otro enlace.
- `hogaria:lastGroupId` apunta a un grupo del que ya no es miembro: RN-02-30 lo ignora y lo borra.
- `timezone` inválida enviada a mano: `422`.
- Emoji compuesto (familia `👨‍👩‍👧`, banderas): es un solo grafema, se acepta.

## 11. Tests
- **Unit (shared)**: `pickLaneColor` (vacío → CORAL; con CORAL → SEA; los 8 usados → menos usado; empate → orden), `inviteStatus` (los 4 estados y prioridad REVOKED > USED > EXPIRED), `groupEmojiSchema` (un emoji, dos emojis, texto, familia), `timezoneSchema`.
- **Unit (api)**: `MembershipCache` (caducidad de 60 s con temporizadores falsos, `invalidate`, `invalidateGroup`), `hashInviteToken`, constructores de `summary`.
- **Integración (`apps/api/test/groups/*.int.spec.ts`)**:
  - Crear grupo → semilla completa (lista "Compra", 9 categorías, miembro CORAL, `ActivityLog`).
  - Autorización obligatoria (`docs/03-seguridad.md`): usuario de otro grupo → 404 en `GET`, `PATCH /groups/:g`, `GET members`, `POST invites`, `DELETE invites/:id`, `DELETE members/:id`; sin sesión → 401; `groupId` no UUID → 404; grupo inexistente → 404 con el mismo cuerpo.
  - Invitación: crear devuelve token y guarda solo el hash; `GET /invites/:token` válido pone la cookie; caducada (reloj falso +10 días), usada y revocada → 410; aceptar con miembro existente → `alreadyMember` sin consumir; aceptaciones concurrentes (`Promise.all`) → una 200 y una 410; grupo con 20 miembros → 409 sin consumir; 21.ª invitación activa → 409.
  - Color: cambiar a uno ocupado → 409; dos altas simultáneas reciben colores distintos.
  - Salir: con más miembros → `GroupMember` borrado, `ActivityLog` y evento `group.member.left`; el último → grupo y `Reminder`/`AiConversation` del grupo borrados.
  - Expulsar: a uno mismo → 422; a otro → 204 y el expulsado recibe 404 al instante en `GET /groups/:g`.
  - Eventos: cada mutación publica el evento de §6 con `actorId` y `clientMutationId` (fake de `RealtimePublisher`).
- **Componentes (web)**: `InvitePage` (estados válido sin sesión, válido con sesión, `alreadyMember`, 410), `GroupSettingsPage` (muestras de color ocupadas deshabilitadas, diálogo de último miembro), `GroupsPage` (vacío).
- **E2E**: **E2E-04** (crear grupo → generar enlace → otro usuario lo acepta → ambos se ven como miembros, en dos contextos), **E2E-15** (URL de un grupo ajeno → "No encontrado"), y participa en **E2E-01** (registro con invitación).

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- Hooks de salida de E06, E07, E09, E10, E11, E12 y E14 + `removeMember(tx, …, { reason })` → RN-02-22 de esta spec, `docs/01` (hooks de ciclo de vida) y ADR-019 en `docs/09` (amplía ADR-014).
- `rebuildGroup` al unirse un miembro → RN-02-17 de esta spec.
- `ActivityLog.action` con `removed` y `revoked` → `docs/02`.
- 30 peticiones/min por IP en `GET /invites/:token` y 20 invitaciones activas por grupo → `docs/03` (Rate limiting).
- `MAX_GROUP_MEMBERS = 20` → `docs/02` ("Límite de miembros").
- `GET /invites/:token` con `alreadyMember` y cookie, y `DELETE /invites/:id` con el DTO revocado → `docs/04` (fila "Invitaciones").

## 13. Fuera de alcance
- Roles, "dueño del grupo" o permisos por miembro.
- Invitaciones por email o dirigidas a una persona concreta, y códigos QR.
- Transferir contenido de un miembro a otro al salir.
- Archivar un grupo sin borrarlo.
- Cambiar el avatar del grupo por una imagen.
