# E01 · Autenticación y cuentas

> Rango: HOG-050 – HOG-099 · Fase 1 · Spec: `docs/specs/01-auth-cuentas.md` · Seguridad: `docs/03-seguridad.md`

---

### HOG-050 · Configurar Better Auth con email/username + contraseña, UUIDv7 y cookies entre subdominios

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-004, HOG-006, HOG-010
- **Spec:** `docs/specs/01-auth-cuentas.md#3-reglas-de-negocio` (RN-01-07 a RN-01-12, RN-01-20, RN-01-21)

**Descripción**
Montar Better Auth en `/api/auth/*` sobre Prisma con email + contraseña y el plugin `username`, IDs UUIDv7, sesión deslizante de 365 días y cookies compartidas entre `hogaria.obaiges.com` y `api.hogaria.obaiges.com`.

**Criterios de aceptación**
- [x] `apps/api/src/auth/auth.ts` exporta `auth = betterAuth({...})` con `prismaAdapter`, `emailAndPassword` (`enabled`, `minPasswordLength: 10`, `maxPasswordLength: 128`, `requireEmailVerification: true`), plugin `username()` (3–30, validador de RN-01-09), `advanced.database.generateId: () => uuidv7()`, `advanced.crossSubDomainCookies` con `COOKIE_DOMAIN` (desactivado si está vacío), `advanced.cookiePrefix: 'hogaria'`, `session.expiresIn = 31536000`, `session.updateAge = 86400`, `session.cookieCache` desactivado, `trustedOrigins: [APP_URL]` y `secret: BETTER_AUTH_SECRET`.
- [x] `emailVerification` configurado según RN-01-11 con `sendVerificationEmail` delegando en el `EmailSender` inyectado (en test, `FakeEmailSender`; el envío real y las plantillas son HOG-054).
- [x] En `main.ts`, `app.use('/api/auth', toNodeHandler(auth))` se monta **antes** de `express.json()`.
- [x] `nameSchema`, `emailSchema`, `usernameSchema` y `signUpInput`/`signInInput` creados en `packages/shared/src/schemas/auth.ts`.
- [x] Registro y login por email y por username funcionan con `supertest` en integración (con el email marcado como verificado en la factory).
- [x] La factory `loginAs(user)` de HOG-010 queda operativa.

**Notas técnicas**
- Si las tablas que espera Better Auth no coinciden con `docs/02-modelo-datos.md`, ajusta `user.fields`/`session.fields` en la configuración; no cambies el esquema sin actualizar el documento.
- Hasta HOG-052, el registro está abierto: **no desplegar a producción** sin HOG-052.
- Alternativa válida para integrarlo en Nest: `@thallesp/nestjs-better-auth`; documenta la elección en el PR.

**Tests**
- Unit: `usernameSchema` (válidos e inválidos de RN-01-09).
- Integración: `auth-basic.int.spec.ts` (registro crea `User` con id UUIDv7 y `Account credential`; login por email y por username; cookie con `HttpOnly`, `SameSite=Lax` y el dominio configurado; `get-session` devuelve el usuario).
- E2E: —

---

### HOG-051 · Añadir el login con Google y la vinculación de cuentas por email

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-050, HOG-023
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-06, RN-01-15, RN-01-24)

**Descripción**
Activar `socialProviders.google` en Better Auth con los scopes mínimos y la vinculación automática con cuentas existentes del mismo email verificado.

**Criterios de aceptación**
- [ ] `socialProviders.google` con `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `prompt: 'select_account'` y scopes `openid email profile`.
- [ ] `account.accountLinking = { enabled: true, trustedProviders: ['google'] }`.
- [ ] Las cuentas creadas con Google quedan con `emailVerified = true` e `image` con la URL de Google.
- [ ] Los errores del *callback* redirigen a `APP_URL/entrar?error=<CODE>` (`errorCallbackURL`).
- [ ] `docs/06-despliegue.md` refleja las URIs de redirección usadas.

**Notas técnicas**
- La regla "Google sin cuenta y sin invitación se rechaza" la aplica el hook de HOG-052 (es el mismo `user.create.before`).
- En tests, el proveedor se prueba simulando el perfil de Google con la utilidad de pruebas de Better Auth o con un *mock* del intercambio de tokens; no se llama a Google.

**Tests**
- Unit: —
- Integración: `auth-google.int.spec.ts` (perfil simulado con email de un usuario existente verificado → se vincula; con email no verificado → no se vincula).
- E2E: —

---

### HOG-052 · Exigir invitación al registrarse (hooks de Better Auth y cookie `hogaria_invite`)

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-050, HOG-053, HOG-102
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-01 a RN-01-06) · `docs/specs/02-grupos-invitaciones.md` (RN-02-16, RN-02-17)

**Descripción**
Impedir que se cree ningún usuario sin una invitación válida (email o Google) y, cuando la hay, unir al nuevo usuario al grupo consumiendo la invitación.

**Criterios de aceptación**
- [ ] `apps/api/src/auth/invite-hooks.ts`: `databaseHooks.user.create.before` lee `hogaria_invite` de la cookie de la petición, valida la invitación (`ACTIVE`) y, si no es válida, lanza `APIError('FORBIDDEN', { code: 'INVITE_REQUIRED', message: 'Necesitas una invitación para registrarte' })` y registra `SecurityEvent SIGNUP_REJECTED_NO_INVITE`.
- [ ] `databaseHooks.user.create.after` llama a `InvitesService.consumeForNewUser(token, user.id)`, registra `SIGNUP_WITH_INVITE` y borra la cookie (`Max-Age=0`, mismo `Domain` y `Path`).
- [ ] Si el consumo falla en el `after` (carrera), el usuario se mantiene sin grupo y se registra un `warn` (RN-01-05).
- [ ] Con `SIGNUP_REQUIRES_INVITE=false` los hooks no exigen invitación (pero si hay cookie válida, la consumen).
- [ ] Aplica igual a `/sign-up/email` y al alta por Google (`/callback/google`); los usuarios de Google existentes entran sin invitación.
- [ ] El texto de `/registro` muestra los mensajes de `INVITE_REQUIRED` y de invitación caducada (spec 01 §7 y §10).

**Notas técnicas**
- La cookie la pone `GET /invites/:token` (HOG-102) con `Path=/api/auth`.
- `consumeForNewUser` reutiliza la transacción de RN-02-17; los eventos y la actividad se publican tras el commit igual que en `accept`.

**Tests**
- Integración: `signup-invite.int.spec.ts` (sin cookie → 403 + `SecurityEvent`; cookie válida → usuario + `GroupMember` + invitación usada + `invite.used` y `group.member.joined` publicados; cookie caducada/usada/revocada → 403; Google nuevo sin cookie → redirección con `INVITE_REQUIRED`).
- E2E: **E2E-03** (registro sin invitación rechazado) en `apps/web/e2e/auth-signup-no-invite.e2e.ts`.

---

### HOG-053 · Crear las pantallas web de entrar, registro y recuperar contraseña

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-050, HOG-055, HOG-008
- **Spec:** `docs/specs/01-auth-cuentas.md#7-pantallas-y-ux`

**Descripción**
Implementar `/entrar`, `/registro` y `/recuperar` con `authClient`, validación zod compartida y los textos y estados de la spec, más la protección de las rutas privadas.

**Criterios de aceptación**
- [x] `apps/web/src/lib/authClient.ts` con `createAuthClient({ baseURL: VITE_API_URL, plugins: [usernameClient()] })` y `fetchOptions.credentials = 'include'`.
- [x] `features/auth/pages/SignInPage.tsx`: un campo "Email o nombre de usuario" que llama a `signIn.email` si contiene `@` y a `signIn.username` (en minúsculas) si no; "Continuar con Google"; `?redirect` seguro; mensajes de `?error`; textos de error de la spec 01 §7.
- [x] `features/auth/pages/SignUpPage.tsx`: campos, ayudas, validación con `signUpInput` + "Las contraseñas no coinciden", cabecera con `hogaria:pendingInvite` si existe, estado "Revisa tu email" con reenvío limitado a 60 s.
- [x] `features/auth/pages/RecoverPasswordPage.tsx`: modo "pedir enlace" y modo `?token` con nueva contraseña; mensajes genéricos.
- [x] `features/auth/api.ts`: `useMe()` (`['me']`); loader `requireAuth` en el layout privado de `app/router.tsx` que redirige a `/entrar?volver=…` si `401`; las rutas públicas no lo usan; con sesión, `/entrar` y `/registro` redirigen a `/`.
- [x] Pantallas sin `AppHeader`/`BottomNav`, con el logo horizontal, accesibles (labels, `autocomplete`, foco al primer error) y correctas a 375 px en claro y oscuro.

**Notas técnicas**
- `checkPasswordPolicy` y la lista común se cargan con `import('@hogaria/shared/common-passwords')` cuando HOG-058 exista; hasta entonces, solo `passwordSchema`.
- La redirección de entrada (`/`) es de HOG-104; hasta entonces `/` puede llevar a `/grupos`.

**Tests**
- Unit (componentes con MSW): `SignInPage` elige el endpoint según `@` y muestra "Email, usuario o contraseña incorrectos"; `SignUpPage` contraseñas distintas y estado "Revisa tu email"; `RecoverPasswordPage` mensaje genérico.
- Integración: —
- E2E: cubierto en HOG-052 (E2E-03), HOG-056 (E2E-02) y HOG-103 (E2E-01).

---

### HOG-054 · Enviar los emails de verificación y de recuperación de contraseña con Resend

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-050, HOG-053
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-11 a RN-01-19, §7 "Emails")

**Descripción**
Implementar `ResendEmailSender` con las plantillas en español y completar los flujos de verificación (incluido el reenvío al intentar entrar) y de restablecimiento de contraseña.

**Criterios de aceptación**
- [ ] `apps/api/src/email/resend-email-sender.ts` implementa `EmailSender` con el SDK de Resend y `EMAIL_FROM`; en `NODE_ENV=test` se usa `FakeEmailSender`.
- [ ] Plantillas `apps/api/src/auth/emails/verify-email.ts` y `reset-password.ts` (HTML con estilos en línea + texto plano) con los textos de la spec 01 §7.
- [ ] Verificación: `callbackURL = APP_URL/`, caduca en 24 h, `sendOnSignIn` reenvía al intentar entrar sin verificar, `autoSignInAfterVerification`.
- [ ] Restablecimiento: `sendResetPassword` con `redirectTo = APP_URL/recuperar`, caduca en 30 min, un solo uso, `revokeSessionsOnPasswordReset: true`; `SecurityEvent PASSWORD_RESET_REQUESTED` solo si el usuario existe; `PASSWORD_CHANGED` al restablecer.
- [ ] `SignInPage` muestra "Tu email aún no está verificado. Te hemos reenviado el enlace." con `EMAIL_NOT_VERIFIED`.
- [ ] Un fallo de Resend se registra en el log y no revela nada al usuario (la respuesta sigue siendo la genérica).

**Notas técnicas**
- Límite gratuito de Resend: 100 emails/día (`docs/06-despliegue.md`); los límites de reenvío son de HOG-058.

**Tests**
- Integración: `email-flows.int.spec.ts` (registro envía email con enlace válido; abrir el enlace verifica y crea sesión; reset con token reutilizado → 400; reset revoca todas las sesiones; email inexistente → misma respuesta y ningún email).
- E2E: parte de **E2E-01** (HOG-103).

---

### HOG-055 · Implementar el `AuthGuard` global, `@CurrentUser`, `@Public` y `GET /me`

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-050, HOG-006
- **Spec:** `docs/specs/01-auth-cuentas.md#52-rutas-rest-propias-apiv1` · `docs/03-seguridad.md#autorización`

**Descripción**
Exigir sesión en toda la API salvo las rutas públicas, exponer el usuario actual a los controladores y al `RequestContext`, y crear `GET /me`.

**Criterios de aceptación**
- [x] `common/guards/auth.guard.ts` registrado como `APP_GUARD`: obtiene la sesión con `auth.api.getSession({ headers })`; sin sesión → `401 UNAUTHENTICATED`; usuario con `blockedAt` → `403 ACCOUNT_BLOCKED`.
- [x] Decoradores `@Public()` (en `/health`, `/health/db`, `GET /invites/:token` y los de `test-support`) y `@CurrentUser()` → `{ id, name, email, isPlatformAdmin, sessionId }`.
- [x] El guard rellena `userId`, `userName` y `sessionId` en el `RequestContext` (HOG-006).
- [x] `GET /api/v1/me` devuelve `meDto` (`packages/shared/src/schemas/me.ts`) con `hasPassword` y `hasGoogle` calculados desde `Account`.
- [x] El throttler (HOG-014) usa `userId` como clave cuando hay sesión.

**Notas técnicas**
- `fromNodeHeaders` de `better-auth/node` para pasar las cabeceras de Express.
- Una consulta de sesión por petición (RN-01-21); no añadas caché.

**Tests**
- Unit: —
- Integración: `me.int.spec.ts` (sin cookie → 401; con cookie → `meDto` válido según zod; bloqueado → 403; ruta `@Public` accesible sin cookie).
- E2E: —

---

### HOG-056 · Gestionar sesiones: listar, cerrar una, cerrar las demás y cerrar sesión, con `session.revoked`

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 5
- **Capa:** full-stack
- **Depende de:** HOG-053, HOG-055, HOG-150, HOG-151
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-20 a RN-01-23, §6, §7 "Perfil → Seguridad")

**Descripción**
Permitir ver los dispositivos con sesión abierta, cerrar uno o todos los demás y cerrar sesión, avisando en tiempo real a los dispositivos afectados.

**Criterios de aceptación**
- [ ] Hooks `after` de Better Auth en `/revoke-session`, `/revoke-other-sessions` y `/revoke-sessions` (`apps/api/src/auth/session-hooks.ts`): registran `SESSION_REVOKED`, publican `session.revoked` (`{}`) con `RealtimePublisher.publishToUser` y llaman a `RealtimeGateway.disconnectSessions` con las sesiones afectadas.
- [ ] `/sign-out` registra `LOGOUT` y no publica evento.
- [ ] `features/auth/components/SecuritySection.tsx` con la lista "Dispositivos" (`sessionDto` construido desde `authClient.listSessions()`, `deviceLabel` con `describeUserAgent` de shared, chip "Este dispositivo"), "Cerrar sesión" por fila con `Dialog`, "Cerrar sesión en todos los demás" y "Cerrar sesión" del dispositivo actual; estados de carga, error y sin conexión.
- [ ] Si `/perfil` no existe aún (E16), se crea una página mínima `/perfil` con la sección "SEGURIDAD"; E16 la ampliará sin moverla.
- [ ] Manejador de `session.revoked` en `features/auth/realtime.ts`: `getSession()`; si es `null` → limpia caché, desconecta el socket y navega a `/entrar` con el aviso "Se ha cerrado tu sesión en este dispositivo"; si no → invalida `['me', 'sessions']`.

**Notas técnicas**
- `describeUserAgent(ua)` en `packages/shared/src/auth/user-agent.ts`, sin librerías pesadas (navegador + sistema por expresiones regulares simples).
- Para "cerrar las demás", `disconnectSessions(userId, { exceptSessionId })`.

**Tests**
- Unit: `describeUserAgent` (Chrome Android, Safari iPhone, Firefox escritorio, vacío → "Dispositivo desconocido").
- Integración: `sessions.int.spec.ts` (revocar otra sesión → esa cookie da 401, evento publicado a `user:<id>`, `SecurityEvent`; "cerrar las demás" conserva la actual).
- E2E: **E2E-02** (`apps/web/e2e/auth-login.e2e.ts`: login con username, cerrar sesión, volver a entrar; login fallido con error genérico).

---

### HOG-057 · Crear la CLI `create-owner` para el primer usuario administrador

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-050, HOG-058
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-30)

**Descripción**
Permitir crear desde la consola el usuario dueño de la instancia (sin invitación), ya verificado y con `isPlatformAdmin = true`.

**Criterios de aceptación**
- [ ] `pnpm --filter api cli create-owner --email <email> --username <username> [--name <nombre>]` (`apps/api/src/cli/main.ts` + `create-owner.command.ts`, con `nest-commander` o un *bootstrap* de `NestFactory.createApplicationContext`).
- [ ] Pide la contraseña dos veces sin eco, o la lee de `OWNER_PASSWORD`; valida `passwordSchema` + `checkPasswordPolicy`.
- [ ] Crea `User` (`emailVerified = true`, `isPlatformAdmin = true`, `name` = `--name` o el username) y `Account credential` con el hash de Better Auth, en una transacción, sin pasar por los hooks de invitación.
- [ ] Errores claros y código de salida ≠ 0: email o username ya existen; "Ya existe un administrador de la plataforma".
- [ ] El comando funciona dentro del contenedor de producción (`docker compose exec api node dist/cli/main.js create-owner …`), documentado en `deploy/README.md`.

**Notas técnicas**
- No crea grupos ni invitaciones.

**Tests**
- Integración: `create-owner.int.spec.ts` (crea admin que puede hacer login; segunda ejecución falla; contraseña común falla).
- E2E: —

---

### HOG-058 · Añadir rate limiting de auth, `SecurityEvent` y política de contraseñas

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** full-stack
- **Depende de:** HOG-050, HOG-002
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-10, RN-01-14, RN-01-25 a RN-01-29)

**Descripción**
Proteger `/api/auth/*` contra fuerza bruta y abuso, registrar los eventos de seguridad y aplicar en el servidor la política de contraseñas compartida.

**Criterios de aceptación**
- [x] `packages/shared`: `checkPasswordPolicy(password, { email, username })` y la lista de 10 000 contraseñas comunes en `src/auth/common-passwords.ts`, exportada como subruta `@hogaria/shared/common-passwords` (no entra en el *bundle* principal de la web).
- [x] Hook `before` de Better Auth en `/sign-up/email`, `/reset-password` y `/change-password` que aplica la política y responde `422 VALIDATION_ERROR` con el mensaje de la spec.
- [x] `apps/api/src/auth/login-rate-limiter.ts` (en memoria): 5 fallos/min por IP+identificador y 20 fallos/h por identificador; éxito reinicia el contador de IP+identificador; al superarlo, `429 RATE_LIMITED` con `Retry-After`.
- [x] Límites de RN-01-27 para `/sign-up/email`, `/request-password-reset`, `/send-verification-email` y el resto de `/api/auth/*`.
- [x] `SecurityEventService.record(type, { userId?, identifier?, ip, userAgent })` y registro de `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED` (RN-01-28) desde hooks `after`.
- [x] Bloqueo: `databaseHooks.session.create.before` rechaza a usuarios con `blockedAt` (`403 ACCOUNT_BLOCKED`).
- [x] La web (`SignInPage`) muestra "Demasiados intentos. Vuelve a intentarlo en {n} min." y "Tu cuenta está bloqueada. Habla con el administrador.". _(Hecho en `apps/web/src/features/auth/auth-errors.ts` con `signInErrorMessage`; la pantalla `SignInPage` es de HOG-053 y debe usarlo.)_

**Notas técnicas**
- IP real tras Caddy: `app.set('trust proxy', 1)` y `advanced.ipAddress.ipAddressHeaders: ['x-forwarded-for']`.
- La purga de 180 días la hace `RetentionJob` (HOG-153).

**Tests**
- Unit (shared): `checkPasswordPolicy` (casos de la spec 01 §11).
- Unit (api): `LoginRateLimiter` con temporizadores falsos.
- Integración: `auth-security.int.spec.ts` (6.º fallo → 429 con `Retry-After`; `LOGIN_FAILED` con `identifier`; contraseña común en registro y en reset → 422; usuario bloqueado no crea sesión; tiempo de respuesta similar con usuario inexistente).
- E2E: —

---

### HOG-059 · Crear la administración de plataforma: listar, bloquear y desbloquear usuarios

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P2 · **Puntos:** 5
- **Capa:** full-stack
- **Depende de:** HOG-055, HOG-056, HOG-008
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-31 a RN-01-33, §5.2, §7 "/admin")

**Descripción**
Dar al administrador de la plataforma una pantalla para ver los usuarios de la instancia y bloquear o desbloquear su acceso.

**Criterios de aceptación**
- [ ] `apps/api/src/modules/admin/`: `PlatformAdminGuard` (404 si no es `isPlatformAdmin`), `GET /admin/users` (cursor, `q`, `adminUserDto` con `groupCount` y `lastActiveAt`), `POST /admin/users/:id/block` y `/unblock`.
- [ ] Bloquear: `blockedAt = now()` (idempotente), borra sus sesiones, publica `session.revoked` y desconecta sus sockets; uno mismo u otro admin → `422`.
- [ ] Esquemas `adminUsersQuery` y `adminUserDto` en `packages/shared/src/schemas/admin.ts`.
- [ ] `features/admin/pages/AdminUsersPage.tsx` en `/admin` con buscador, lista, chips "Administrador"/"Bloqueado", diálogos y toasts de la spec; estados de carga, vacío de búsqueda, error y sin conexión; "No encontrado" para no administradores.
- [ ] Enlace a `/admin` en `/perfil` solo si `me.isPlatformAdmin`.

**Notas técnicas**
- El `SecurityEvent` de bloqueo usa `ACCOUNT_BLOCKED` / `ACCOUNT_UNBLOCKED` de `SecurityEventType` (`docs/02-modelo-datos.md`), con `userId` = usuario afectado e `identifier` = id del administrador.

**Tests**
- Integración: `admin.int.spec.ts` (no admin → 404 en las tres rutas; bloquear → sesiones borradas y 403 en el siguiente login; bloquearse → 422; desbloquear es idempotente; búsqueda por username).
- Unit (web): `AdminUsersPage` oculta "Bloquear" en administradores.
- E2E: —

---

### HOG-060 · Permitir cambiar la contraseña desde Perfil → Seguridad

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** full-stack
- **Depende de:** HOG-056, HOG-058
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-18, RN-01-19, §7)

**Descripción**
Añadir a la sección de seguridad el cambio de contraseña con la actual, que cierra las demás sesiones.

**Criterios de aceptación**
- [ ] Botón "Cambiar contraseña" visible solo si `me.hasPassword`; abre `Sheet` con "Contraseña actual", "Nueva contraseña" y "Repite la contraseña".
- [ ] Llama a `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`.
- [ ] Éxito: toast "Contraseña cambiada. Se han cerrado tus otras sesiones."; contraseña actual incorrecta: "La contraseña actual no es correcta"; política: mensajes de la spec.
- [ ] El hook de sesiones (HOG-056) publica `session.revoked` y desconecta los demás sockets; `PASSWORD_CHANGED` registrado (HOG-058).

**Tests**
- Integración: `change-password.int.spec.ts` (otra sesión recibe 401 y la actual sigue válida; contraseña actual incorrecta → 400).
- Unit (web): el botón no aparece con `hasPassword = false`.
- E2E: —

---

### HOG-061 · Permitir vincular una cuenta de Google desde Perfil → Seguridad

- **Épica:** E01 · **Fase:** 1 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-051, HOG-056
- **Spec:** `docs/specs/01-auth-cuentas.md` (RN-01-24, §7)

**Descripción**
Mostrar si la cuenta tiene Google vinculado y permitir vincularlo de forma explícita.

**Criterios de aceptación**
- [ ] Si `me.hasGoogle`: texto "Cuenta de Google vinculada". Si no: botón "Vincular cuenta de Google" → `authClient.linkSocial({ provider: 'google', callbackURL: APP_URL/perfil })`.
- [ ] Al volver, `['me']` se invalida y se muestra el toast "Cuenta de Google vinculada"; si Google devuelve otro email ya usado por otra cuenta, "Esa cuenta de Google ya está vinculada a otro usuario".

**Tests**
- Unit (web): estados vinculado / no vinculado.
- E2E: —
