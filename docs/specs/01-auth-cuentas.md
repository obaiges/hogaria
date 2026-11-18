# 01 · Autenticación y cuentas

> Épica: E01 · Tickets: `docs/tickets/E01-auth.md` · Modelo: `docs/02-modelo-datos.md#esquema-prisma` (sección AUTH: `User`, `Session`, `Account`, `Verification`, `SecurityEvent`) · Seguridad: `docs/03-seguridad.md`

## 1. Objetivo
Permitir que solo las personas invitadas creen una cuenta y que cualquier usuario entre con email o nombre de usuario + contraseña, o con Google, y mantenga la sesión abierta indefinidamente mientras use la app. Incluye verificación de email, recuperación y cambio de contraseña, gestión de sesiones por dispositivo, protección contra fuerza bruta, la creación del primer usuario por CLI y el bloqueo de usuarios por el administrador de la plataforma.

## 2. Historias de usuario
- **US-01-01** Como persona invitada, quiero crear una cuenta con mi nombre, email, nombre de usuario y contraseña para entrar en el hogar que me invitó.
- **US-01-02** Como persona invitada, quiero registrarme con "Continuar con Google" para no recordar otra contraseña.
- **US-01-03** Como persona sin invitación, quiero entender por qué no puedo registrarme ("Hogaria es solo por invitación").
- **US-01-04** Como usuario, quiero entrar con mi email **o** con mi nombre de usuario y mi contraseña.
- **US-01-05** Como usuario con cuenta de Google, quiero entrar con un toque.
- **US-01-06** Como usuario registrado con contraseña, quiero verificar mi email con un enlace para activar la cuenta.
- **US-01-07** Como usuario que ha olvidado la contraseña, quiero recibir un enlace para poner una nueva.
- **US-01-08** Como usuario, quiero no tener que volver a iniciar sesión mientras use la app (sesión indefinida).
- **US-01-09** Como usuario, quiero ver en qué dispositivos tengo la sesión abierta, cerrar uno concreto o cerrar todos los demás.
- **US-01-10** Como usuario, quiero cambiar mi contraseña sabiendo la actual, y que eso cierre mis otras sesiones.
- **US-01-11** Como usuario con contraseña, quiero vincular mi cuenta de Google con el mismo email para entrar de las dos formas.
- **US-01-12** Como usuario, quiero cerrar sesión en este dispositivo.
- **US-01-13** Como dueño de la instancia, quiero crear la primera cuenta (administrador) desde la línea de comandos.
- **US-01-14** Como administrador de la plataforma, quiero ver los usuarios de la instancia y bloquear o desbloquear a uno para cortarle el acceso.

## 3. Reglas de negocio

### Registro e invitación
- **RN-01-01** Con `SIGNUP_REQUIRES_INVITE=true` (valor por defecto y único usado en producción), **ningún usuario** se crea sin una invitación válida, sea por email + contraseña o por Google. La única excepción es la CLI `create-owner` (RN-01-30).
- **RN-01-02** La invitación viaja en la cookie `hogaria_invite` (token en claro, `HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Domain=COOKIE_DOMAIN`, `Path=/api/auth`, `Max-Age=3600`). La pone la API al responder `GET /api/v1/invites/:token` con una invitación válida (ver `docs/specs/02-grupos-invitaciones.md`).
- **RN-01-03** Antes de crear el usuario se lee la cookie, se calcula su SHA-256 y se busca una `GroupInvite` con `usedAt = null`, `revokedAt = null` y `expiresAt > now()`. Si no la hay: rechaza con `403` y `code: "INVITE_REQUIRED"`, y registra `SecurityEvent` `SIGNUP_REJECTED_NO_INVITE` (con `identifier` = email intentado, IP y user agent). Para `/sign-up/email` la comprobación va en el hook de **petición** (`hooks.before`), porque Better Auth convierte un `403` de `databaseHooks` del registro en un `200` genérico (protección contra enumeración con verificación de email obligatoria); para el resto de altas (callback de Google) va en `databaseHooks.user.create.before` (`apps/api/src/auth/invite-hooks.ts`, HOG-052).
- **RN-01-04** El hook `databaseHooks.user.create.after` acepta la invitación para el usuario recién creado llamando a `InvitesService.consumeForNewUser(token, userId)` (spec 02, RN-02-17), registra `SecurityEvent` `SIGNUP_WITH_INVITE` y borra la cookie `hogaria_invite` (`Max-Age=0`).
- **RN-01-05** Si en el `after` la invitación ya no se puede consumir (otra persona la usó entre el `before` y el `after`), el usuario queda creado **sin grupo**: no se borra la cuenta. Al entrar verá `/grupos` vacío (ver spec 02, caso límite).
- **RN-01-06** Login con Google de un usuario **existente** (por `Account` google o por vinculación por email, RN-01-24): siempre se permite, haya o no cookie de invitación. Login con Google de un email **sin cuenta** y sin invitación válida: se rechaza igual que RN-01-03 (Better Auth redirige a `APP_URL/entrar?error=INVITE_REQUIRED`).

### Datos de la cuenta
- **RN-01-07** `name` (nombre visible): obligatorio, 1–50 caracteres tras `trim`.
- **RN-01-08** `email`: obligatorio en el registro con contraseña, formato válido, se guarda en minúsculas, único.
- **RN-01-09** `username`: obligatorio en el registro con contraseña, 3–30 caracteres, solo `a-z`, `0-9`, `_` y `.`, sin empezar ni acabar por `.`. Better Auth lo guarda normalizado en minúsculas en `username` y tal cual en `displayUsername`. Único sin distinguir mayúsculas. Las cuentas creadas con Google no tienen `username` hasta que lo pongan en el perfil (E16).
- **RN-01-10** Política de contraseña (esquema `passwordSchema` + función `checkPasswordPolicy(password, { email, username })` de `packages/shared`): longitud 10–128; no puede estar en la lista local de las 10 000 contraseñas más comunes (comparación en minúsculas); no puede contener el email completo, la parte local del email (si tiene ≥ 4 caracteres) ni el username (sin distinguir mayúsculas). Se aplica en registro, restablecimiento y cambio de contraseña, **siempre en el servidor** (hook `before` de Better Auth en `/sign-up/email`, `/reset-password` y `/change-password`). Fallo → `422` con `code: "VALIDATION_ERROR"` y el mensaje concreto de la tabla de §7.

### Verificación de email
- **RN-01-11** Las cuentas con contraseña nacen con `emailVerified = false`. Better Auth se configura con `emailAndPassword.requireEmailVerification = true`, `emailVerification.sendOnSignUp = true`, `emailVerification.sendOnSignIn = true`, `emailVerification.autoSignInAfterVerification = true` y `emailVerification.expiresIn = 86400` (24 h).
- **RN-01-12** El enlace de verificación lleva `callbackURL = APP_URL/`. Al pulsarlo, Better Auth verifica, crea la sesión y redirige a `/`, donde la web aplica la redirección de entrada (spec 02, RN-02-30).
- **RN-01-13** Intentar entrar con contraseña correcta y email sin verificar → Better Auth responde `403 EMAIL_NOT_VERIFIED` y reenvía el email. La web muestra "Tu email aún no está verificado. Te hemos reenviado el enlace."
- **RN-01-14** Reenviar el email de verificación (`/send-verification-email`) se limita a 1 vez cada 60 s y 5 veces por hora por email (RN-01-27).
- **RN-01-15** Las cuentas de Google llegan con `emailVerified = true`.

### Contraseña
- **RN-01-16** Recuperar contraseña: `POST /api/auth/request-password-reset` con `redirectTo = APP_URL/recuperar`. La respuesta y el texto de la interfaz son **siempre** los mismos exista o no la cuenta: "Si existe una cuenta con ese email, te hemos enviado un enlace." Se registra `SecurityEvent` `PASSWORD_RESET_REQUESTED` solo si la cuenta existe (con su `userId`).
- **RN-01-17** El token de restablecimiento caduca a los 30 min (`resetPasswordTokenExpiresIn = 1800`) y es de un solo uso. Al restablecer, se revocan **todas** las sesiones del usuario (`revokeSessionsOnPasswordReset = true`) y se registra `PASSWORD_CHANGED`.
- **RN-01-18** Cambiar contraseña (`POST /api/auth/change-password`) exige `currentPassword` y se llama siempre con `revokeOtherSessions: true`: la sesión actual sigue abierta y las demás se revocan (RN-01-22). Se registra `PASSWORD_CHANGED`.
- **RN-01-19** Una cuenta solo de Google no tiene contraseña (`meDto.hasPassword = false`): la pantalla de cambio de contraseña no se muestra. Puede crearse una con "Recuperar contraseña" usando su email (Better Auth crea la cuenta `credential` al restablecer).

### Sesiones
- **RN-01-20** Cookie de sesión de Better Auth: `httpOnly`, `Secure` (producción), `SameSite=Lax`, dominio `COOKIE_DOMAIN` (`.hogaria.obaiges.com` en producción; vacío en local), prefijo `hogaria`. `session.expiresIn = 31536000` (365 días) y `session.updateAge = 86400` (1 día): renovación deslizante, sesión indefinida mientras se use. `session.cookieCache` **desactivado** para que una revocación sea inmediata.
- **RN-01-21** Cada petición autenticada consulta la sesión en la BBDD (Better Auth `getSession`). No hay más tráfico a la BBDD sin peticiones del usuario (ADR-004).
- **RN-01-22** Al revocar sesiones (una concreta, "todas las demás", cambio de contraseña, restablecimiento o bloqueo por el administrador) el servidor, tras borrar las filas `Session`: (1) registra `SecurityEvent` `SESSION_REVOKED` (uno por operación, con el `userId`); (2) publica `session.revoked` (`{}`) en la sala `user:<userId>`; (3) desconecta los sockets cuyo `socket.data.sessionId` pertenezca a las sesiones revocadas (`RealtimeGateway.disconnectSessions`, spec 03).
- **RN-01-23** Cerrar sesión (`/sign-out`) borra la sesión actual y registra `LOGOUT`. No publica `session.revoked`.
- **RN-01-24** Vinculación de cuentas: `account.accountLinking = { enabled: true, trustedProviders: ['google'] }`. Si un usuario con contraseña entra con Google con el **mismo email verificado**, se vincula a su cuenta. Desde Perfil → Seguridad puede vincular Google de forma explícita (`linkSocial`).

### Bloqueo y fuerza bruta
- **RN-01-25** Un usuario con `blockedAt != null` no puede crear sesión: el hook `databaseHooks.session.create.before` rechaza con `403` y `code: "ACCOUNT_BLOCKED"`. El `AuthGuard` también devuelve `403 ACCOUNT_BLOCKED` si encuentra una sesión de un usuario bloqueado (defensa en profundidad).
- **RN-01-26** Rate limit de login (`/sign-in/email` y `/sign-in/username`), contado **solo con intentos fallidos**: 5 por minuto por (IP + identificador normalizado) y 20 por hora por identificador. Al superarlo: `429`, `code: "RATE_LIMITED"` y cabecera `Retry-After` (segundos). Los contadores viven en memoria (`LoginRateLimiter`, un solo proceso de API) y se reinician al reiniciar la API. Un login correcto pone a cero el contador de (IP + identificador).
- **RN-01-27** Otros límites de `/api/auth/*` (también en memoria, por IP salvo indicación): `/sign-up/email` 5 por hora; `/request-password-reset` 3 por hora por email y 10 por hora por IP; `/send-verification-email` RN-01-14; resto de rutas de auth 60 por minuto. Mismo formato de error que RN-01-26.
- **RN-01-28** `SecurityEvent` registra: `LOGIN_SUCCESS` (userId, IP, UA), `LOGIN_FAILED` (`identifier` intentado, IP, UA, `userId` si el identificador existe), `LOGOUT`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `SESSION_REVOKED`, `SIGNUP_WITH_INVITE`, `SIGNUP_REJECTED_NO_INVITE`. Nunca contraseñas, tokens ni cookies. Retención de 180 días: la purga la hace el handler `retention.purge` de `MaintenanceCron` (spec 03, RN-03-24).
- **RN-01-29** Mensaje genérico de login para usuario inexistente, contraseña incorrecta o cuenta sin contraseña: "Email, usuario o contraseña incorrectos". El tiempo de respuesta no depende de si el usuario existe (Better Auth hashea igualmente; verificarlo en el test).

### Administración de la plataforma
- **RN-01-30** `pnpm --filter api cli create-owner --email <email> --username <username> [--name <nombre>]` crea un usuario con `isPlatformAdmin = true`, `emailVerified = true` y una cuenta `credential`. La contraseña se pide por consola sin eco (dos veces) o se lee de la variable `OWNER_PASSWORD` si existe (para entornos sin TTY). Valida la política RN-01-10. Falla con mensaje claro si el email o el username ya existen o si **ya existe** un usuario con `isPlatformAdmin = true` (solo hay un dueño de la instancia). No crea grupos: el administrador crea su hogar desde `/grupos`.
- **RN-01-31** Solo un usuario con `isPlatformAdmin = true` accede a `/api/v1/admin/*`. Cualquier otro recibe `404 NOT_FOUND` (no se revela que la ruta existe). En la web, `/admin` muestra "No encontrado" a quien no es administrador y el enlace a `/admin` solo aparece en Perfil para el administrador.
- **RN-01-32** Bloquear (`POST /admin/users/:id/block`): pone `blockedAt = now()` (si ya estaba bloqueado, no cambia la fecha y responde igual), borra todas sus sesiones, aplica RN-01-22 y registra `SecurityEvent` `ACCOUNT_BLOCKED` (`userId` = usuario bloqueado, `identifier` = id del administrador). No se puede bloquear a uno mismo ni a otro administrador → `422 VALIDATION_ERROR` "No puedes bloquear a este usuario". El usuario bloqueado sigue siendo miembro de sus grupos y su contenido sigue visible.
- **RN-01-33** Desbloquear (`POST /admin/users/:id/unblock`): `blockedAt = null`. Idempotente. Registra `SecurityEvent` `ACCOUNT_UNBLOCKED` (`userId` = usuario, `identifier` = id del administrador). El usuario debe volver a iniciar sesión.

## 4. Modelo de datos
- `User` (incluye `username`, `displayUsername`, `isPlatformAdmin`, `blockedAt`, `aiNoticeAcceptedAt`), `Session`, `Account`, `Verification`: tablas de Better Auth en `docs/02-modelo-datos.md`.
- `SecurityEvent` y `SecurityEventType`: `docs/02-modelo-datos.md`.
- `GroupInvite`: lo usa el hook de registro (lectura y consumo; el detalle está en la spec 02).
- IDs UUIDv7 también para las tablas de Better Auth: `advanced.database.generateId: () => uuidv7()` (paquete `uuidv7`).
- `SecurityEventType` incluye `ACCOUNT_BLOCKED` y `ACCOUNT_UNBLOCKED` (RN-01-32/33) y `EMAIL_VERIFIED` (opcional).

## 5. API

### 5.1 Rutas de Better Auth (`/api/auth/*`, sin versión)
Las gestiona Better Auth montado con `toNodeHandler(auth)` en Express. La web las llama **solo** a través de `authClient` (`apps/web/src/lib/authClient.ts`, `better-auth/react` + `usernameClient()`). Los nombres de ruta corresponden a la versión de Better Auth fijada en HOG-001; si cambian, se actualiza esta tabla. Los errores de estas rutas usan el formato de Better Auth (`{ code, message }`), con nuestros `code` de `packages/shared/src/errors.ts` cuando el error lo lanza un hook nuestro.

| Método | Ruta | Entrada (zod de `packages/shared/src/schemas/auth.ts`) | Salida | Errores |
|---|---|---|---|---|
| POST | `/api/auth/sign-up/email` | `signUpInput` `{ name, email, username, password }` (+ `callbackURL` que pone el cliente) | `{ user }` sin sesión (requiere verificación) | `403 INVITE_REQUIRED` · `422 VALIDATION_ERROR` (política, email o username con formato inválido) · `422 USER_ALREADY_EXISTS`/`USERNAME_IS_ALREADY_TAKEN` (de Better Auth, se muestran como "Ese email ya tiene cuenta" / "Ese nombre de usuario ya existe") · `429 RATE_LIMITED` |
| POST | `/api/auth/sign-in/email` | `signInInput` `{ identifier, password }` → el cliente envía `{ email, password }` si `identifier` contiene `@` | sesión + `{ user }` | `401 INVALID_EMAIL_OR_PASSWORD` · `403 EMAIL_NOT_VERIFIED` · `403 ACCOUNT_BLOCKED` · `429 RATE_LIMITED` |
| POST | `/api/auth/sign-in/username` | `signInInput` → `{ username, password }` si no contiene `@` | sesión + `{ user }` | igual que arriba (`INVALID_USERNAME_OR_PASSWORD` se trata como `INVALID_EMAIL_OR_PASSWORD`) |
| POST | `/api/auth/sign-in/social` | `{ provider: 'google', callbackURL, errorCallbackURL: APP_URL/entrar }` | redirección a Google | — |
| GET | `/api/auth/callback/google` | (Google) | redirección a `callbackURL` | redirección a `APP_URL/entrar?error=INVITE_REQUIRED` o `?error=ACCOUNT_BLOCKED` |
| POST | `/api/auth/sign-out` | — | `{ success: true }` | `401` |
| GET | `/api/auth/get-session` | — | `{ session, user } \| null` | — |
| GET | `/api/auth/verify-email?token&callbackURL` | (enlace del email) | redirección a `callbackURL` | redirección con `?error=INVALID_TOKEN` o `TOKEN_EXPIRED` |
| POST | `/api/auth/send-verification-email` | `{ email, callbackURL }` | `{ status: true }` | `429 RATE_LIMITED` |
| POST | `/api/auth/request-password-reset` | `requestPasswordResetInput` `{ email }` + `redirectTo` | `{ status: true }` (siempre) | `429 RATE_LIMITED` |
| POST | `/api/auth/reset-password` | `resetPasswordInput` `{ token, newPassword }` | `{ status: true }` | `400 INVALID_TOKEN` · `422 VALIDATION_ERROR` |
| POST | `/api/auth/change-password` | `changePasswordInput` `{ currentPassword, newPassword }` + `revokeOtherSessions: true` | `{ user }` | `400 INVALID_PASSWORD` (contraseña actual incorrecta) · `422 VALIDATION_ERROR` |
| GET | `/api/auth/list-sessions` | — | `Session[]` de Better Auth; la web lo transforma a `sessionDto[]` | `401` |
| POST | `/api/auth/revoke-session` | `{ token }` | `{ status: true }` | `401` |
| POST | `/api/auth/revoke-other-sessions` | — | `{ status: true }` | `401` |
| POST | `/api/auth/link-social` | `{ provider: 'google', callbackURL }` | redirección | — |

Esquemas compartidos (todos en `packages/shared/src/schemas/auth.ts`):
- `passwordSchema` = `z.string().min(10).max(128)`. La comprobación de lista común e identidad es `checkPasswordPolicy()` (devuelve `null` o el mensaje ES). La lista vive en `packages/shared/src/auth/common-passwords.ts` y se exporta por la ruta `@hogaria/shared/common-passwords` para que la web la cargue con `import()` dinámico solo en las pantallas de contraseña.
- `usernameSchema`, `emailSchema` (`z.string().trim().toLowerCase().email().max(254)`), `nameSchema` (`z.string().trim().min(1).max(50)`).
- `signUpInput = { name: nameSchema, email: emailSchema, username: usernameSchema, password: passwordSchema }`.
- `signInInput = { identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(128) }`.
- `requestPasswordResetInput = { email: emailSchema }` · `resetPasswordInput = { token: z.string().min(1), newPassword: passwordSchema }` · `changePasswordInput = { currentPassword: z.string().min(1), newPassword: passwordSchema }`.
- `sessionDto = { id, createdAt, updatedAt, expiresAt, ipAddress: string | null, userAgent: string | null, deviceLabel: string, isCurrent: boolean, token: string }` (lo construye la web; `deviceLabel` sale de `describeUserAgent(ua)` en `packages/shared`, p. ej. "Chrome en Android", "Safari en iPhone", "Dispositivo desconocido").

### 5.2 Rutas REST propias (`/api/v1`)

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/me` | — | `meDto` | `401 UNAUTHENTICATED` · `403 ACCOUNT_BLOCKED` |
| GET | `/admin/users?cursor&limit&q` | `adminUsersQuery` `{ cursor?: uuid, limit?: 1–100 (50), q?: string ≤ 100 }` (busca en nombre, email y username, sin distinguir mayúsculas) | `{ items: adminUserDto[], nextCursor: string \| null }` (orden por `id` descendente) | `401` · `404 NOT_FOUND` (no admin) |
| POST | `/admin/users/:id/block` | — | `adminUserDto` | `401` · `404` · `422 VALIDATION_ERROR` (uno mismo u otro admin) |
| POST | `/admin/users/:id/unblock` | — | `adminUserDto` | `401` · `404` |

- `meDto` (`packages/shared/src/schemas/me.ts`) = `{ id, name, email, emailVerified, username: string | null, displayUsername: string | null, image: string | null, isPlatformAdmin: boolean, aiNoticeAcceptedAt: string | null, hasPassword: boolean, hasGoogle: boolean, createdAt }`. `hasPassword`/`hasGoogle` se calculan con las `Account` del usuario. E16 amplía este mismo esquema con `googleImage`, `preferInitialsAvatar` y `linkedProviders` (spec 16 §5); `hasGoogle` se mantiene (= `linkedProviders` incluye `google`).
- `adminUserDto` (`packages/shared/src/schemas/admin.ts`) = `{ id, name, email, username: string | null, image: string | null, isPlatformAdmin, emailVerified, blockedAt: string | null, createdAt, groupCount: number, lastActiveAt: string | null }` (`lastActiveAt` = máximo `Session.updatedAt`).
- `PATCH /me`, `DELETE /me` y `GET /me/export` pertenecen a E16 (`docs/specs/16-perfil-rgpd.md`).

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `session.revoked` | Tras revocar una sesión concreta, "todas las demás", cambiar o restablecer la contraseña o bloquear al usuario (RN-01-22). Sala `user:<userId>` | `{}` |

El cliente, al recibirlo, llama a `authClient.getSession()`. Si devuelve `null`, limpia la caché de TanStack Query, desconecta el socket y navega a `/entrar` con el aviso "Se ha cerrado tu sesión en este dispositivo". Si la sesión sigue viva, invalida `['me', 'sessions']` (la lista de dispositivos de Perfil → Seguridad) y no hace nada más.

## 7. Pantallas y UX
Todas siguen `DESIGN.md`: formularios de una columna, `Input` de 16 px con label visible, `Button` `primary` a ancho completo, logo horizontal (`docs/design/logo-horizontal.svg` / `-dark.svg`) arriba. Las pantallas públicas no muestran `AppHeader` ni `BottomNav`. Fondo con la rejilla de azulejo permitida (cabecera de héroe).

### `/entrar` — `features/auth/pages/SignInPage.tsx`
- Título "Entrar". Campos: "Email o nombre de usuario" (`autocomplete="username"`), "Contraseña" (`autocomplete="current-password"`, botón de mostrar/ocultar con `aria-label` "Mostrar contraseña").
- Botones: "Entrar" (`primary`), separador "o", "Continuar con Google" (`secondary`, logo G oficial monocromo permitido como excepción de marca de terceros).
- Enlaces: "¿Has olvidado tu contraseña?" → `/recuperar`. Pie: "¿No tienes cuenta? Hogaria funciona solo por invitación: pide a alguien de tu hogar que te envíe un enlace."
- Parámetro `?volver=` (lo pone `RequireAuth`, spec 15 RN-15-09): solo se respeta si empieza por `/`, no empieza por `//` y no contiene `://`. Tras entrar → `volver` o la redirección de entrada (spec 02, RN-02-30).
- Parámetro `?cuenta=borrada` (tras borrar la cuenta, spec 16): aviso "Tu cuenta se ha borrado. ¡Gracias por usar Hogaria!".
- Parámetro `?sesion=cerrada` (tras `session.revoked` con la sesión de este dispositivo revocada, §5): aviso "Se ha cerrado tu sesión en este dispositivo".
- Pie con enlaces a `/legal/privacidad` y `/legal/terminos` (spec 16, RN-16-27).
- Parámetro `?error=` (vuelta de Google): `INVITE_REQUIRED` → "Necesitas una invitación para crear una cuenta." · `ACCOUNT_BLOCKED` → "Tu cuenta está bloqueada. Habla con el administrador." · otro → "No se ha podido entrar con Google. Inténtalo de nuevo."
- Errores: credenciales → "Email, usuario o contraseña incorrectos" · `EMAIL_NOT_VERIFIED` → "Tu email aún no está verificado. Te hemos reenviado el enlace." · `RATE_LIMITED` → "Demasiados intentos. Vuelve a intentarlo en {n} min." (redondeo hacia arriba de `Retry-After`) · `ACCOUNT_BLOCKED` → mensaje de arriba.
- Cargando: botón con estado "Entrando…" deshabilitado. Si ya hay sesión al abrir → redirección de entrada.

### `/registro` — `features/auth/pages/SignUpPage.tsx`
- Si `sessionStorage['hogaria:pendingInvite']` (`{ token, groupName, groupEmoji }`, lo guarda `/invite/:token`) existe: cabecera "Crea tu cuenta para unirte a {emoji} {groupName}". Si no: aviso informativo "Hogaria es solo por invitación. Si te han invitado, abre el enlace que te enviaron." y el formulario sigue visible (el servidor decide, E2E-03).
- Campos: "Nombre" (`autocomplete="name"`, ayuda "Así te verán en el hogar"), "Email", "Nombre de usuario" (ayuda "Solo minúsculas, números, punto y guion bajo"), "Contraseña" (`autocomplete="new-password"`, ayuda "Mínimo 10 caracteres"), "Repite la contraseña".
- Botones: "Crear cuenta" (`primary`), "Continuar con Google" (`secondary`, `callbackURL = APP_URL/`). Enlace "¿Ya tienes cuenta? Entrar".
- Validación en cliente con `signUpInput` + "Las contraseñas no coinciden" + `checkPasswordPolicy` (lista común cargada con `import()`).
- Mensajes de política: "La contraseña debe tener al menos 10 caracteres" · "La contraseña es demasiado larga (máximo 128)" · "Esa contraseña es demasiado común. Elige otra" · "La contraseña no puede contener tu email ni tu nombre de usuario".
- Errores del servidor: `INVITE_REQUIRED` → "Necesitas una invitación para registrarte. Pide a alguien de tu hogar que te envíe un enlace." · email duplicado → "Ese email ya tiene cuenta. ¿Quieres entrar?" (enlace) · username duplicado → "Ese nombre de usuario ya existe".
- Éxito (contraseña): la misma página pasa al estado "Revisa tu email": "Te hemos enviado un enlace a {email}. Ábrelo para activar tu cuenta." + "Reenviar email" (deshabilitado 60 s con cuenta atrás "Reenviar en {s} s") + "Volver a entrar". Se borra `hogaria:pendingInvite`.

### `/recuperar` — `features/auth/pages/RecoverPasswordPage.tsx`
- Sin `?token`: "Recuperar contraseña", campo "Email", botón "Enviar enlace". Tras enviar: "Si existe una cuenta con ese email, te hemos enviado un enlace. Caduca en 30 minutos."
- Con `?token`: "Nueva contraseña", campos "Nueva contraseña" y "Repite la contraseña", botón "Guardar contraseña". Éxito: "Contraseña cambiada. Ya puedes entrar." + botón "Entrar" → `/entrar`.
- Con `?error=INVALID_TOKEN` o token rechazado: `ErrorState` "El enlace no es válido o ha caducado." + "Pedir otro enlace".

### Perfil → Seguridad (`features/auth/components/SecuritySection.tsx`, montado en `/perfil`)
- Encabezado de sección "SEGURIDAD".
- "Cambiar contraseña" (solo si `hasPassword`): abre `Sheet` con "Contraseña actual", "Nueva contraseña", "Repite la contraseña". Éxito: toast "Contraseña cambiada. Se han cerrado tus otras sesiones." Error de contraseña actual: "La contraseña actual no es correcta".
- "Google": si `hasGoogle` → "Cuenta de Google vinculada"; si no → botón "Vincular cuenta de Google".
- "Dispositivos": lista de `sessionDto` ordenada por `updatedAt` desc. Cada fila: `deviceLabel`, "Última actividad {fecha relativa}" y, si `isCurrent`, chip "Este dispositivo". Acción por fila (no en la actual): "Cerrar sesión" → `Dialog` "¿Cerrar la sesión en {deviceLabel}?" → toast "Sesión cerrada". Botón "Cerrar sesión en todos los demás" (deshabilitado si solo hay una) → `Dialog` de confirmación → toast "Has cerrado las demás sesiones".
- "Cerrar sesión" (`danger`, ancho completo) → sin confirmación, `signOut`, limpia caché y socket → `/entrar`.
- Estados: cargando (skeleton de 3 filas), error ("No se han podido cargar tus dispositivos" + "Reintentar"), sin conexión (botones deshabilitados).

### `/admin` — `features/admin/pages/AdminUsersPage.tsx`
- Título "Usuarios de la instancia". Buscador "Buscar por nombre, email o usuario". Lista: `MemberAvatar` (sin color de calle: tono neutro), nombre, email, "@username", "{n} hogares", "Activo {fecha relativa}" o "Nunca", chip "Administrador" o chip "Bloqueado" (variante límite con texto).
- Acción: "Bloquear" → `Dialog` "¿Bloquear a {nombre}? No podrá entrar y se cerrarán todas sus sesiones." / "Desbloquear". Toasts "Usuario bloqueado" / "Usuario desbloqueado".
- Estados: cargando (skeleton), vacío de búsqueda "No hay usuarios que coincidan", error con "Reintentar", sin conexión (acciones deshabilitadas). Paginación "Cargar más".

### Emails (Resend, `apps/api/src/auth/emails/`)
- Verificación — asunto "Confirma tu email en Hogaria". Cuerpo: "Hola, {name}. Pulsa el botón para activar tu cuenta de Hogaria." Botón "Confirmar email". "El enlace caduca en 24 horas. Si no has creado una cuenta, ignora este email."
- Restablecimiento — asunto "Restablece tu contraseña de Hogaria". Cuerpo: "Pulsa el botón para elegir una contraseña nueva." Botón "Cambiar contraseña". "El enlace caduca en 30 minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este email."
- HTML simple con estilos en línea y versión de texto plano. Remitente `EMAIL_FROM`.

### Arranque de sesión en la web
- `features/auth/api.ts`: `useMe()` (`queryKey: ['me']`, `GET /api/v1/me`, `staleTime` 5 min) y `useSessions()` (`['me', 'sessions']`).
- `app/router.tsx`: las rutas privadas cuelgan de un layout con `loader` `requireAuth` que pide `['me']` con `queryClient.ensureQueryData`; si `401` → `redirect('/entrar?volver=<ruta actual codificada>')`. Las públicas (`/entrar`, `/registro`, `/recuperar`, `/invite/:token`, `/legal/*`) no lo llevan.
- `apiClient` ante `401` en cualquier petición: limpia la caché y navega a `/entrar`. Ante `403 ACCOUNT_BLOCKED`: igual, con el mensaje de bloqueo.

## 8. Permisos
- Rutas de Better Auth y `GET /api/v1/invites/:token`: públicas (`@Public()` en lo propio).
- `GET /me`, sesiones, cambio de contraseña y cerrar sesión: el propio usuario autenticado.
- `/admin/*`: solo `isPlatformAdmin` (`PlatformAdminGuard`, 404 si no).
- No hay roles de grupo en esta épica.

## 9. Actividad
La autenticación **no** escribe `ActivityLog` (es personal, no del grupo). La única actividad relacionada es "se unió al grupo", que genera el consumo de la invitación (spec 02, §9). La trazabilidad de seguridad va a `SecurityEvent`.

## 10. Casos límite
- Registro con email que ya tiene cuenta **y** cookie de invitación válida: Better Auth rechaza por duplicado; la invitación **no** se consume. La web sugiere entrar; tras entrar, la persona vuelve a `/invite/:token` (guardado en `hogaria:pendingInvite`) y acepta.
- La cookie `hogaria_invite` caduca (1 h) mientras la persona rellena el formulario: el registro falla con `INVITE_REQUIRED`. Mensaje adicional en ese caso si existe `hogaria:pendingInvite`: "Tu invitación ha caducado en este navegador. Vuelve a abrir el enlace." (botón que lleva a `/invite/:token`).
- Dos personas usan el mismo enlace a la vez: ver RN-01-05.
- Verificación pulsada en otro dispositivo (p. ej., el ordenador): Better Auth crea sesión en ese navegador; en el móvil la persona entra normalmente con su contraseña.
- Enlace de verificación caducado: Better Auth redirige a `/?error=TOKEN_EXPIRED`, que, sin sesión, lleva a `/entrar` (que muestra "El enlace ha caducado. Entra para recibir otro."); al intentar entrar se reenvía el email (RN-01-13).
- Google devuelve un email no verificado (raro): no se vincula con una cuenta existente (RN-01-24); si no hay cuenta, aplica la regla de invitación.
- Usuario bloqueado con la app abierta: recibe `session.revoked` (o el siguiente `401`) y vuelve a `/entrar`.
- Usuario bloqueado intenta "Recuperar contraseña": recibe el email (no se revela nada), pero al restablecer no podrá crear sesión (`ACCOUNT_BLOCKED`).
- Varias pestañas abiertas: cerrar sesión en una provoca `401` en las demás en su siguiente petición.
- Username con mayúsculas en el login (`Ana.G`): se normaliza a minúsculas antes de llamar a `/sign-in/username`.
- Identificador con `@` pero que en realidad es un username: imposible, el username no admite `@`.
- Reinicio de la API: los contadores de rate limit se pierden (aceptado, un solo proceso).

## 11. Tests
- **Unit (`packages/shared`)**: `passwordSchema` y `checkPasswordPolicy` (longitud 9/10/128/129, contraseña común, contiene email, parte local < 4 caracteres, contiene username en mayúsculas); `usernameSchema` (válidos e inválidos: `.ana`, `ana.`, `ana-g`, 2 y 31 caracteres); `describeUserAgent`.
- **Unit (api)**: `LoginRateLimiter` (5/min por IP+identificador, 20/h por identificador, reinicio tras éxito, `Retry-After` correcto) con temporizadores falsos.
- **Integración (`apps/api/test/auth/*.int.spec.ts`)**:
  - Registro sin cookie → 403 `INVITE_REQUIRED` + `SecurityEvent SIGNUP_REJECTED_NO_INVITE`; con cookie válida → usuario creado, `GroupMember` creado, invitación usada, cookie borrada, `SIGNUP_WITH_INVITE`; con invitación caducada, usada o revocada → 403.
  - Registro con contraseña común → 422.
  - Login sin verificar → 403 `EMAIL_NOT_VERIFIED` y email reenviado (fake de Resend).
  - Login por email y por username; fallo genérico; 6.º intento fallido en un minuto → 429 con `Retry-After`.
  - Usuario bloqueado → no puede entrar (403 `ACCOUNT_BLOCKED`) y `GET /me` con una sesión previa → 403.
  - `GET /me` sin sesión → 401; con sesión → `meDto` válido según el esquema zod.
  - Revocar otra sesión → la cookie revocada recibe 401, se emite `session.revoked` a `user:<id>` (fake de publisher) y `SecurityEvent SESSION_REVOKED`.
  - Restablecer contraseña → todas las sesiones revocadas; token reutilizado → 400.
  - `/admin/users` con no admin → 404; bloquear a sí mismo → 422; bloquear → sesiones borradas.
  - CLI `create-owner`: crea admin verificado; segunda ejecución → error "Ya existe un administrador".
- **Componentes (web)**: `SignInPage` (envía a `/sign-in/username` o `/sign-in/email` según `@`; muestra el error genérico), `SignUpPage` (contraseñas no coinciden; estado "Revisa tu email"), `SecuritySection` (oculta "Cambiar contraseña" sin `hasPassword`).
- **E2E**: **E2E-01** (registro con invitación → verificar email con `GET /test/emails` → entrar al grupo), **E2E-02** (login con username, cerrar sesión, volver a entrar; login fallido con error genérico), **E2E-03** (registro sin invitación rechazado).

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `SecurityEventType` `ACCOUNT_BLOCKED`/`ACCOUNT_UNBLOCKED` → `docs/02` (enum y comentario de `identifier`) y RN-01-32/33 de esta spec.
- `SecurityEventType` `EMAIL_VERIFIED` (opcional) → `docs/02`.
- Sesiones con las rutas reales de Better Auth (`list-sessions`, `revoke-session`, `revoke-other-sessions`) → `docs/04` (fila "Yo") y `docs/03` (Gestión de sesiones).
- `RealtimeEnvelope.groupId: string | null` → `docs/04` (sobre y `session.revoked`).
- Fuerza bruta solo con intentos fallidos, en memoria, y límites de RN-01-27 → `docs/03` (tabla de autenticación).
- Retención de 180 días de `SecurityEvent` con `retention.purge` de `MaintenanceCron` → `docs/03` (Retenciones), `docs/02` y RN-01-28.
- `/entrar` con `?volver=` y `?cuenta=borrada` (specs 15 y 16) → §7 de esta spec y `docs/08`.

## 13. Fuera de alcance
- 2FA, passkeys y biometría (plugins preparados, no activos).
- Registro abierto (`SIGNUP_REQUIRES_INVITE=false`): la variable existe, pero no se diseña una UX para ello.
- Editar nombre, username, email o foto, exportar datos y borrar la cuenta (E16).
- Cambio de email.
- Otros proveedores OAuth.
- Notificar por email los inicios de sesión nuevos.
