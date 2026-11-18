# E02 · Grupos e invitaciones

> Rango: HOG-100 – HOG-149 · Fase 1 · Spec: `docs/specs/02-grupos-invitaciones.md`

---

### HOG-100 · Crear la API de grupos: crear con semilla, ver, editar y `/me/groups`

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-01 a RN-02-05, RN-02-07, RN-02-08, §5, §9)

**Descripción**
Implementar el módulo `groups` con la creación transaccional del grupo y su semilla, la consulta y edición del grupo y la lista de grupos del usuario, publicando eventos y actividad.

**Criterios de aceptación**
- [x] `apps/api/src/modules/groups/`: `groups.module.ts`, `groups.controller.ts`, `groups.service.ts`, `me-groups.controller.ts`.
- [x] `POST /groups` (`createGroupInput`) crea en una transacción `Group`, `GroupMember` CORAL, `ShoppingList` "Compra" 🛒, las 9 `ExpenseCategory` de `DEFAULT_EXPENSE_CATEGORIES` y `ActivityLog` "creó el hogar {emoji} {name}"; responde `201 myGroupDto`.
- [x] `GET /groups/:groupId` → `groupDto`; `PATCH /groups/:groupId` (`updateGroupInput`, al menos un campo) → `groupDto`, `ActivityLog` según §9 (solo si hay cambios reales), `group.updated` y `activity.created` tras el commit; si cambia `timezone`, `MembershipCache.invalidateGroup` y llamada a `onGroupTimezoneChanged` (registro vacío por ahora).
- [x] `GET /me/groups` → `myGroupDto[]` por `joinedAt` asc con `memberCount` y `myLaneColor`.
- [x] Esquemas en `packages/shared/src/schemas/groups.ts` (`groupNameSchema`, `groupEmojiSchema`, `timezoneSchema`, `createGroupInput`, `updateGroupInput`, `groupDto`, `myGroupDto`) y `pickLaneColor` en `src/groups/lane-colors.ts`.
- [x] `RealtimeEventDataMap` incluye `group.updated: GroupDto`.

**Notas técnicas**
- Patrón de mutación de `docs/01-arquitectura.md`: transacción → commit → `realtime.publish` → DTO.
- Bloqueo de fila del grupo con `$queryRaw` en *tagged template* (RN-02-08), helper `lockGroup(tx, groupId)` en `groups/group-lock.ts` para reutilizar en invitaciones y colores.

**Tests**
- Unit: `pickLaneColor`, `groupEmojiSchema`, `timezoneSchema`, constructores de `summary` de §9.
- Integración: `groups.int.spec.ts` (semilla completa; PATCH sin cambios no genera actividad ni evento; PATCH con nombre → evento y actividad; autorización 401/404 de `docs/03-seguridad.md`).
- E2E: —

---

### HOG-101 · Implementar el `GroupMemberGuard` con caché de 60 s y 404

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-055, HOG-004
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-26 a RN-02-29)

**Descripción**
Proteger todas las rutas `/groups/:groupId/**` comprobando la pertenencia al grupo, devolviendo 404 a quien no es miembro y dejando el contexto del grupo (zona horaria) disponible para los servicios.

**Criterios de aceptación**
- [x] `common/guards/group-member.guard.ts` aplicado a cualquier controlador con `:groupId` (decorador de clase `@GroupScoped()` que añade el guard y valida `groupId` como UUID).
- [x] `groupId` no UUID, grupo inexistente o no miembro → `404 NOT_FOUND` con el mismo cuerpo.
- [x] `common/cache/membership-cache.ts`: caché en memoria de 60 s por `userId:groupId` (positivos y negativos), con `invalidate(userId, groupId)` e `invalidateGroup(groupId)`.
- [x] `req.groupContext = { groupId, timezone, memberId, laneColor }` y decorador `@CurrentGroup()`.
- [x] Una regla de ESLint o un test de arquitectura falla si un controlador con ruta `groups/:groupId` no lleva `@GroupScoped()`.

**Notas técnicas**
- La consulta: `groupMember.findUnique({ where: { groupId_userId }, select: { id, laneColor, group: { select: { timezone } } } })`.

**Tests**
- Unit: `MembershipCache` con temporizadores falsos (caducidad, invalidaciones).
- Integración: `group-member.guard.int.spec.ts` (miembro → 200; otro usuario → 404; UUID inválido → 404; tras invalidar, el cambio de pertenencia se ve al instante).
- E2E: —

---

### HOG-102 · Crear la API de invitaciones: crear, listar, revocar, consultar pública y aceptar

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-100, HOG-150, HOG-151, HOG-153
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-06, RN-02-10 a RN-02-19, §5, §6, §9)

**Descripción**
Implementar las invitaciones de un solo uso con token aleatorio (solo se guarda el hash), su listado y revocación, la consulta pública que prepara el registro y la aceptación por usuarios con sesión, con un consumo atómico reutilizable por el hook de registro.

**Criterios de aceptación**
- [x] `modules/groups/invites.controller.ts`, `public-invites.controller.ts` e `invites.service.ts`; `invite-token.ts` con `generateInviteToken()` y `hashInviteToken()`.
- [x] `POST /groups/:g/invites` → `201 createdGroupInviteDto` (token y URL solo aquí); throttler 20/día por usuario; 409 si hay 20 `ACTIVE` o el grupo está lleno; `ActivityLog` "creó una invitación"; `invite.created` sin token.
- [x] `GET /groups/:g/invites` según RN-02-14; `DELETE /groups/:g/invites/:id` según RN-02-15 con `ActivityLog` "revocó una invitación" e `invite.revoked`.
- [x] `GET /invites/:token` (`@Public`, 30/min por IP): `alreadyMember` si hay sesión y ya es miembro; `410 INVITE_INVALID` si no está activa; cookie `hogaria_invite` (`HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Domain=COOKIE_DOMAIN`, `Path=/api/auth`, `Max-Age=3600`) si es válida y no hay sesión.
- [x] `POST /invites/:token/accept` y `InvitesService.consumeForNewUser(token, userId)` comparten `consumeInvite(tx, …)` (RN-02-17); tras el commit: `MembershipCache.invalidate`, `RealtimeRooms.joinGroup`, `group.member.joined`, `invite.used` y `activity.created`.
- [x] Esquemas en `packages/shared/src/schemas/invites.ts` (`inviteStatusSchema`, `groupInviteDto`, `createdGroupInviteDto`, `publicInviteDto`, `acceptInviteResultDto`) e `inviteStatus()` en `src/groups/invite-status.ts`; eventos `invite.*` y `group.member.joined` en `RealtimeEventDataMap`.

**Notas técnicas**
- Comparación por hash: `tokenHash` es `@unique`, la búsqueda es por igualdad (no hace falta comparación en tiempo constante).
- Nunca se registra el token en los logs (redacta la ruta `/invites/:token` en `nestjs-pino`).

**Tests**
- Unit: `inviteStatus`, `generateInviteToken` (43 caracteres base64url), `hashInviteToken`.
- Integración: `invites.int.spec.ts` (todos los casos de la spec 02 §11 de invitaciones, incluidas las aceptaciones concurrentes con `Promise.all` y el token ausente de la lista; autorización 401/404).
- E2E: —

---

### HOG-103 · Crear el flujo web de invitación `/invite/:token`

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-102, HOG-052, HOG-054, HOG-107
- **Spec:** `docs/specs/02-grupos-invitaciones.md#7-pantallas-y-ux` ("/invite/:token") · `docs/specs/01-auth-cuentas.md#7-pantallas-y-ux` ("/registro")

**Descripción**
Implementar la página pública de invitación con sus estados (válida con y sin sesión, ya miembro, no válida, hogar lleno) y conectar el registro, el login y Google con la invitación pendiente.

**Criterios de aceptación**
- [x] `features/groups/pages/InvitePage.tsx` pide `GET /invites/:token` con `credentials: 'include'` y muestra los textos de la spec.
- [x] Sin sesión: "Crear cuenta" guarda `sessionStorage['hogaria:pendingInvite']` y va a `/registro`; "Ya tengo cuenta" va a `/entrar?volver=/invite/:token`; "Continuar con Google" usa `callbackURL = APP_URL/invite/:token`.
- [x] Con sesión: "Unirme a {groupName}" → `POST accept` → `/g/:groupId` con toast; `alreadyMember` → navegación directa con "Ya formas parte de {groupName}".
- [x] `410` → `ErrorState` "Invitación no válida o caducada"; `409` → "Este hogar ya tiene el máximo de 20 miembros"; sin conexión → botones deshabilitados.
- [x] Tras unirse, `['me', 'groups']` se invalida.

**Notas técnicas**
- `sessionStorage` siempre en `try/catch`.

**Tests**
- Unit (componentes con MSW): los cinco estados.
- E2E: **E2E-01** (`apps/web/e2e/signup-invite.e2e.ts`: crear invitación vía helper → abrir enlace → registrarse con email y contraseña → abrir el enlace de verificación de `GET /test/emails` → aterriza en `/g/:groupId` del grupo).

---

### HOG-104 · Crear el selector y la creación de hogares (`/grupos`) y la redirección de entrada

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-100, HOG-053, HOG-008, HOG-009
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-30, §7 "/" y "/grupos")

**Descripción**
Implementar la pantalla "Tus hogares" con la creación de hogar en un `Sheet`, y la ruta `/` que lleva a cada usuario a su hogar.

**Criterios de aceptación**
- [x] `features/groups/api.ts`: `useMyGroups()` (`['me', 'groups']`) y `useCreateGroup()` (añade el nuevo `myGroupDto` a la caché).
- [x] `features/groups/pages/GroupsPage.tsx` con lista, "Crear hogar", estados de carga, vacío ("Aún no perteneces a ningún hogar."), error y sin conexión.
- [x] `Sheet` "Crear hogar" con nombre, rejilla de 12 emojis + "Otro emoji", validación con `createGroupInput`; éxito → `/g/:groupId` y toast "Hogar creado".
- [x] Ruta `/` (`app/routes/RootRedirect.tsx`) aplica RN-02-30 (`hogaria:lastGroupId` → un solo grupo → `/grupos`).

**Tests**
- Unit: `resolveLandingRoute(groups, lastGroupId)` (los tres casos y `lastGroupId` obsoleto); `GroupsPage` vacío y con datos.
- E2E: parte de **E2E-04** (HOG-105).

---

### HOG-105 · Crear los ajustes del grupo: datos del hogar, miembros, color de calle e invitaciones

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-102, HOG-107, HOG-108, HOG-009
- **Spec:** `docs/specs/02-grupos-invitaciones.md#7-pantallas-y-ux` ("/g/:groupId/ajustes", secciones 1–4)

**Descripción**
Implementar "Ajustes del grupo" con la edición del hogar, la lista de miembros, el selector de color de calle y la gestión de invitaciones con "Compartir enlace" (Web Share API) y "Copiar enlace".

**Criterios de aceptación**
- [x] `features/groups/pages/GroupSettingsPage.tsx` en `/g/:groupId/ajustes` con las secciones HOGAR, MIEMBROS, TU COLOR DE CALLE e INVITACIONES y sus textos.
- [x] Editar hogar en `Sheet` (nombre, emoji, zona horaria con el aviso) con actualización optimista.
- [x] Selector de 8 colores de 44 px; ocupados deshabilitados con la inicial y `aria-label` "Coral, lo tiene Ana"; guardado optimista con rollback y mensaje de `409`; "Todos los colores están en uso" si aplica.
- [x] "Invitar a alguien" → `Sheet` con la URL, el aviso "Este enlace solo se muestra ahora…", "Compartir enlace" (solo si existe `navigator.share`; cancelar no es error) y "Copiar enlace" (con alternativa de selección si no hay `clipboard`).
- [x] Lista "Pendientes" con "Revocar" (`Dialog`) y "Anteriores (30 días)" plegable.
- [x] Estados por sección: carga, error con "Reintentar", vacío ("No hay invitaciones pendientes") y sin conexión.

**Notas técnicas**
- Hooks en `features/groups/api.ts`: `useGroup`, `useUpdateGroup`, `useMembers`, `useUpdateMyLaneColor`, `useInvites`, `useCreateInvite`, `useRevokeInvite`; claves `['group', g, 'detail' | 'members' | 'invites']`.

**Tests**
- Unit (componentes): colores ocupados, `Sheet` del enlace sin `navigator.share`, revocar.
- E2E: **E2E-04** (`apps/web/e2e/group-invite.e2e.ts`: A crea un hogar → genera enlace → B (usuario existente) lo abre y se une → ambos ven a los dos en MIEMBROS).

---

### HOG-106 · Implementar salir del grupo, expulsar a un miembro y borrar el grupo al salir el último

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** full-stack
- **Depende de:** HOG-105, HOG-150, HOG-152
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-20 a RN-02-25, RN-02-32, §7 "Zona de peligro" y menú de miembro)

**Descripción**
Permitir salir de un hogar y expulsar a otro miembro, borrando el hogar entero cuando sale el último, con el mecanismo de limpieza por módulo y la reacción inmediata en los dispositivos afectados.

**Criterios de aceptación**
- [x] `POST /groups/:g/leave` y `DELETE /groups/:g/members/:userId` (204) en `members.service.ts`, con la transacción, los `MemberRemovedHooks`, la actividad ("salió del hogar" / "expulsó a {nombre} del hogar"), y tras el commit: `group.member.left` **antes** de `RealtimeRooms.leaveGroup`, `MembershipCache.invalidate` y `activity.created`.
- [x] Último miembro: borra `Reminder` y `AiConversation` del grupo y el `Group`; `MembershipCache.invalidateGroup`; llama a `onGroupDeleted(groupId)` (registro vacío por ahora).
- [x] `member-removed.hooks.ts`: registro `register(handler)` y ejecución en la transacción; sin manejadores en E02.
- [x] Expulsarse a uno mismo → `422`; `userId` no miembro → `404`.
- [x] Web: "ZONA DE PELIGRO" con "Salir del hogar" (texto distinto si es el último: "Salir y borrar hogar") y menú de miembro "Expulsar del hogar", con los diálogos y toasts de la spec.
- [x] Manejador de `group.member.left` para el usuario actual (RN-02-32): quita el grupo de `['me', 'groups']`, elimina `['group', g]` y navega a `/grupos` con "Ya no formas parte de {nombre}" si era el activo.

**Notas técnicas**
- `onGroupTimezoneChanged` y `onGroupDeleted` viven en `modules/groups/group-lifecycle.hooks.ts` (E12 los usará).
- La lógica vive en `removeMember(tx, groupId, userId, { reason: 'LEFT' | 'REMOVED' | 'ACCOUNT_DELETED' })`, que acepta una transacción externa para reutilizarla en el borrado de cuenta (HOG-808).
- Manejadores que registran otras épicas en `MemberRemovedHooks`: HOG-305 (E06, comensales), HOG-356 (E07, turnos y asignado), HOG-453 (E09, eventos), HOG-502 y HOG-504 (E10, gastos y presupuestos), HOG-551 (E11, responsable), HOG-601 (E12, recordatorios; también `onGroupDeleted` y `onGroupTimezoneChanged`) y HOG-708 (E14, conversaciones).

**Tests**
- Integración: `leave-remove.int.spec.ts` (los casos de la spec 02 §11; el expulsado recibe 404 al instante; el socket del expulsado deja de recibir eventos del grupo; el último borra el grupo y sus `Reminder`/`AiConversation`).
- Unit (web): diálogo de último miembro.
- E2E: —

---

### HOG-107 · Crear el contexto de grupo activo en la web (`GroupLayout`) y la pantalla "No encontrado"

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-100, HOG-101, HOG-053, HOG-008
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-30, RN-02-31, §7 "No encontrado" y "Selector de hogar")

**Descripción**
Crear el layout de las rutas `/g/:groupId/*` que carga el grupo y sus miembros, expone el grupo activo al resto de features y muestra "No encontrado" si el grupo no existe o es ajeno.

**Criterios de aceptación**
- [x] `features/groups/GroupLayout.tsx` + `GroupProvider` con `useActiveGroup()` → `{ group, members, me: GroupMemberDto, timezone }`.
- [x] Carga `['group', g, 'detail']` y `['group', g, 'members']`; si alguno responde 404 → `ErrorState` "No encontrado" + "Este hogar no existe o no formas parte de él." + "Ir a mis hogares".
- [x] Al cargar bien, guarda `hogaria:lastGroupId` (con `try/catch`).
- [x] Las rutas `/g/:groupId/*` de `app/router.tsx` cuelgan de este layout (HOG-750 monta `AppShell` dentro o alrededor sin duplicar la carga).

**Notas técnicas**
- `useActiveGroup().timezone` es la zona que deben usar `lib/dates.ts` y todas las pantallas del grupo.

**Tests**
- Unit (componentes con MSW): 404 muestra "No encontrado"; 200 guarda `lastGroupId`.
- E2E: **E2E-15** (`apps/web/e2e/authz-foreign-group.e2e.ts`: un usuario abre `/g/<id de otro grupo>/compra` y ve "No encontrado").

---

### HOG-108 · Crear la API de miembros: listar y cambiar el color de calle propio

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-100
- **Spec:** `docs/specs/02-grupos-invitaciones.md` (RN-02-09, §5, §6)

**Descripción**
Exponer la lista de miembros del grupo y el cambio del color de calle del propio usuario, con conflicto si el color está ocupado.

**Criterios de aceptación**
- [x] `modules/groups/members.controller.ts` y `members.service.ts`.
- [x] `GET /groups/:g/members` → `groupMemberDto[]` por `joinedAt` asc (con `name`, `username`, `image` del usuario).
- [x] `PATCH /groups/:g/members/me` (`updateMyMemberInput`): en transacción con `lockGroup`; ocupado → `409 CONFLICT` "Ese color ya lo tiene {nombre}"; mismo color → 200 sin evento; cambio → `group.member.updated` (sin actividad).
- [x] `groupMemberDto` y `updateMyMemberInput` en `packages/shared/src/schemas/groups.ts`; `group.member.updated` en `RealtimeEventDataMap`.

**Tests**
- Integración: `members.int.spec.ts` (lista ordenada; color ocupado → 409; cambios simultáneos al mismo color → uno 200 y otro 409; autorización 401/404).
- E2E: —

---

### HOG-109 · Aplicar en la web los eventos en tiempo real de grupos, miembros e invitaciones

- **Épica:** E02 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-152, HOG-105
- **Spec:** `docs/specs/02-grupos-invitaciones.md#6-eventos-en-tiempo-real`

**Descripción**
Registrar los manejadores de `group.updated`, `group.member.*` e `invite.*` para que los ajustes, el selector de hogar y la cabecera se actualicen sin recargar, con onda en las filas cambiadas por otros.

**Criterios de aceptación**
- [x] `features/groups/realtime.ts` con los manejadores de la spec 02 §6, registrados en `lib/realtime/handlers.ts`.
- [x] Onda (`markRipple`) en la fila del miembro unido o actualizado y en la invitación creada o revocada por otro.
- [x] El manejador de `group.member.left` reutiliza la lógica de RN-02-32 de HOG-106.

**Tests**
- Unit: cada manejador sobre un `QueryClient` de prueba (no crea la query si no existía; *upsert* por `id`; `memberCount` correcto).
- E2E: cubierto en HOG-156.
