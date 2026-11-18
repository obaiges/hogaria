# 17 · Calidad, seguridad y producción

> Épica: E17 · Tickets: `docs/tickets/E17-calidad.md` · Referencias: `docs/03-seguridad.md`, `docs/06-despliegue.md`, `docs/07-testing.md` · Fase: 6
> Esta spec adapta la plantilla: en lugar de historias de usuario usa **checklists verificables** (`CHK-…`). Cada casilla indica **cómo** se verifica (test automático, comando o revisión manual). Un ticket de E17 se cierra cuando todas sus casillas están marcadas con su evidencia.

## 1. Objetivo

Dejar Hogaria listo para uso diario real con 0 €: seguridad revisada y endurecida, autorización probada de forma sistemática, suite e2e completa en CI, accesibilidad y rendimiento medidos automáticamente, observabilidad mínima, copias de seguridad cifradas con restauración probada, mantenimiento de dependencias, un runbook de incidencias, datos de demo y la documentación al día.

## 2. Checklists (sustituyen a las historias)

### 2.1 Revisión de seguridad (contra `docs/03-seguridad.md`)

| ID | Comprobación | Verificación |
|---|---|---|
| CHK-SEC-01 | Toda ruta exige sesión salvo `@Public()` (`/health`, `GET /invites/:token`, `/api/auth/*`) | Test de introspección (RN-17-07) |
| CHK-SEC-02 | Toda ruta con `:groupId` lleva `GroupMemberGuard` | Test de introspección |
| CHK-SEC-03 | Recursos con propiedad devuelven `403 FORBIDDEN_NOT_OWNER` al no dueño (eventos, gastos, presupuestos, horarios, excepciones, dieta) y 404 en conversaciones ajenas | Matriz de autorización (RN-17-08) |
| CHK-SEC-04 | Ninguna consulta de datos de grupo busca solo por `id` | Regla ESLint/grep en CI: prohibido `findUnique({ where: { id` en `modules/**` salvo lista blanca comentada; revisión manual del resto |
| CHK-SEC-05 | Política de contraseña (10–128, top 10 000, no contiene email/username) | Tests de E01 existentes pasan; revisión |
| CHK-SEC-06 | Rate limit de login 5/min por IP+identificador y 20/h por identificador, con `Retry-After` | Test de integración |
| CHK-SEC-07 | Cookie de sesión `HttpOnly; Secure; SameSite=Lax; Domain=.hogaria.obaiges.com` en producción | Comando `curl -I` documentado en el runbook + test de configuración |
| CHK-SEC-08 | Recuperación de contraseña: enlace 30 min, un solo uso, respuesta genérica | Tests de E01 |
| CHK-SEC-09 | Invitaciones: 32 bytes, solo SHA-256 en BBDD, 10 días, un uso, revocables | Tests de E02 |
| CHK-SEC-10 | Registro sin invitación rechazado (también con Google) | E2E-03 |
| CHK-SEC-11 | CSRF: comprobación de `Origin` en métodos no GET (API y Better Auth `trustedOrigins`) | Test: `POST` con `Origin: https://evil.example` → 403 |
| CHK-SEC-12 | CSP y cabeceras web de RN-17-01/02 servidas en producción | Test de `_headers` + comando del runbook |
| CHK-SEC-13 | helmet, CORS estricto y `x-powered-by` desactivado en la API | Test de integración de cabeceras |
| CHK-SEC-14 | Prohibido `dangerouslySetInnerHTML` | Regla ESLint `react/no-danger` en `error` |
| CHK-SEC-15 | `$queryRaw` solo con tagged templates; prohibido `$queryRawUnsafe`/`$executeRawUnsafe` | Regla ESLint `no-restricted-properties` |
| CHK-SEC-16 | Imágenes: magic bytes, 5 MB, 4 por petición, nunca a disco | Tests de HOG-650 |
| CHK-SEC-17 | Logs sin contraseñas, tokens, cookies, cuerpos ni rutas con token en claro | Test de redacción (RN-17-17) |
| CHK-SEC-18 | Socket.IO autentica por cookie y solo une a salas de grupos propios; expulsión fuerza `leave` | Tests de E03 |
| CHK-SEC-19 | `GEMINI_API_KEY` y demás secretos nunca en el bundle web | Test de CI: `grep` de los valores de prueba de secretos y de nombres `GEMINI_`, `BETTER_AUTH_SECRET`, `VAPID_PRIVATE` en `apps/web/dist` → 0 coincidencias |
| CHK-SEC-20 | `.env` de la VM con permisos `600`; SSH solo con clave; `unattended-upgrades` y `fail2ban` activos | Comandos del runbook, revisión manual anotada |
| CHK-SEC-21 | Endpoints `/test/*` solo existen con `NODE_ENV=test` | Test: arrancar con `NODE_ENV=production` y comprobar 404 |
| CHK-SEC-22 | OpenAPI `/api/docs` solo en desarrollo | Mismo test |
| CHK-SEC-23 | Dependencias sin vulnerabilidades altas o críticas en producción | `pnpm audit --prod --audit-level=high` en CI |
| CHK-SEC-24 | Sin secretos en el repositorio | `gitleaks` en CI |
| CHK-SEC-25 | Usuario bloqueado no puede entrar y sus sesiones se revocan | Tests de E01 (HOG-059) |
| CHK-SEC-26 | Exportación sin secretos ni datos de terceros | Test de HOG-806 |

### 2.2 Calidad y producción

| ID | Comprobación | Verificación |
|---|---|---|
| CHK-QA-01 | E2E-01 … E2E-16 pasan en Pixel 7 y iPhone 14 en CI | Job `e2e` verde |
| CHK-QA-02 | Matriz de autorización cubre todas las rutas de grupo y personales | Test que falla si una ruta descubierta no está en la matriz |
| CHK-QA-03 | Cobertura ≥ 80 % en `packages/shared` y `*.service.ts` | Umbral de Vitest en CI |
| CHK-QA-04 | 0 violaciones de axe (WCAG 2.2 AA) en las pantallas de RN-17-11, en claro y oscuro | `a11y.e2e.ts` |
| CHK-QA-05 | Lighthouse móvil: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95 | LHCI en CI |
| CHK-QA-06 | PWA instalable (manifest, iconos, SW, arranque sin red con aviso) | `pwa.e2e.ts` |
| CHK-QA-07 | Presupuestos de tamaño de bundle | `size-limit` en CI |
| CHK-QA-08 | Logs JSON con retención ≤ 14 días en la VM | Config + comando del runbook |
| CHK-QA-09 | Healthcheck de Docker y (opcional) monitor externo | `docker inspect` / panel de UptimeRobot |
| CHK-QA-10 | Copia semanal cifrada en Object Storage, 8 últimas | Listado del bucket anotado en el runbook |
| CHK-QA-11 | Restauración probada y registrada | Fila en "Registro de pruebas de restauración" de `deploy/README.md` |
| CHK-QA-12 | Dependabot activo | PRs automáticas visibles |
| CHK-QA-13 | Runbook completo | Revisión con la lista de RN-17-27 |
| CHK-QA-14 | Seed de demo reproducible | `pnpm db:seed` dos veces seguidas sin error |
| CHK-QA-15 | Documentación final al día | Checklist de RN-17-30 |

## 3. Reglas (requisitos verificables)

### Cabeceras y CSP (web, `apps/web/public/_headers`)
- **RN-17-01** Para `/*`:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com; font-src 'self'; connect-src 'self' https://api.hogaria.obaiges.com wss://api.hogaria.obaiges.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://api.hogaria.obaiges.com; frame-ancestors 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()
  X-Frame-Options: DENY
  Cross-Origin-Opener-Policy: same-origin
  ```
  Es la CSP canónica de `docs/03-seguridad.md`. `form-action` incluye la API porque el inicio de sesión con Google navega a `/api/auth/*`.
- **RN-17-02** `/sw.js` y `/theme-init.js`: `Cache-Control: no-cache`. `/assets/*` (nombres con hash): `Cache-Control: public, max-age=31536000, immutable`. `/index.html`: `Cache-Control: no-cache`.
- **RN-17-03** Un test (`apps/web/test/headers.spec.ts`) parsea `_headers` y comprueba cada cabecera y directiva de RN-17-01/02.

### Endurecimiento de la API
- **RN-17-04** `app.set('trust proxy', 1)` (detrás de Caddy) para que las IPs de rate limit y `SecurityEvent` sean las reales. `app.disable('x-powered-by')`. helmet con valores por defecto (la API solo sirve JSON). Límite de cuerpo JSON **1 MB** (multipart lo limita multer). Timeout de petición de 30 s, salvo el SSE del asistente (60 s, spec 14).
- **RN-17-05** Middleware de `Origin` para métodos no GET: permitido solo `APP_URL` (y `http://localhost:5173` fuera de producción). Peticiones sin `Origin` y sin cookie de sesión (p. ej. healthchecks) no se ven afectadas; con cookie y sin `Origin` válido → 403.
- **RN-17-06** Socket.IO: `maxHttpBufferSize: 10_000` (el cliente nunca envía datos), CORS igual que REST, `pingInterval` 25 s, y desconexión forzada de los sockets del usuario en `session.revoked`, bloqueo y borrado de cuenta.

### Autorización sistemática
- **RN-17-07** **Test de introspección** (`apps/api/test/security/route-guards.int.spec.ts`): arranca la app, recorre todas las rutas registradas (`DiscoveryService` + metadatos de Nest) y falla si: una ruta no `@Public()` no está protegida por `AuthGuard`; una ruta con `:groupId` no tiene `GroupMemberGuard`; una ruta `@Public()` no está en la lista blanca `PUBLIC_ROUTES` del test.
- **RN-17-08** **Matriz de autorización** (`apps/api/test/security/authorization-matrix.int.spec.ts`): un archivo de casos por módulo (`apps/api/test/security/matrix/<modulo>.cases.ts`) con, para cada endpoint: cómo crear el recurso, el cuerpo válido y su tipo (`group`, `owned`, `private`, `personal`). El helper `runAuthorizationCases()` genera automáticamente:
  - sin sesión → 401;
  - usuario de otro grupo → 404 (GET, PATCH, DELETE y acciones `POST`);
  - `owned`: miembro no dueño → 403 `FORBIDDEN_NOT_OWNER` en PATCH/DELETE y 200 en GET;
  - `private` (conversaciones del asistente): miembro no autor → 404;
  - `personal` (`/me/**`): nunca devuelve datos de otro usuario.
  El test falla si alguna ruta descubierta (RN-17-07) no aparece en ningún archivo de casos (salvo `PUBLIC_ROUTES` y `/api/auth/*`).

### E2E en CI
- **RN-17-09** Job `e2e`: Postgres como `service`, API en `NODE_ENV=test` (fakes de Gemini, push y email), web construida y servida con `vite preview`, Playwright con los proyectos **Pixel 7** y **iPhone 14**, **2 shards**, `retries: 1` en CI, `trace: 'on-first-retry'`, vídeo y captura solo en fallo, y subida de `playwright-report/` y trazas como artefacto si falla.
- **RN-17-10** Presupuesto de minutos (GitHub Free, 2000 min/mes en repos privados): el CI **solo se lanza a mano** (`workflow_dispatch`, ADR-020), nunca en push ni en pull request; el input `e2e` decide si corren también los e2e. Caché de pnpm y de los navegadores de Playwright. Objetivo: ≤ 12 min por ejecución de e2e.

### Accesibilidad
- **RN-17-11** `apps/web/e2e/a11y.e2e.ts` con `@axe-core/playwright` (etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) en tema claro y oscuro sobre: `/entrar`, `/registro` (con invitación), `/grupos`, Inicio, hoja "Más", `/compra`, una lista, `/comidas`, `/recetas`, una receta, `/nevera` (pasos 1 y 4 con fake), `/tareas`, `/calendario`, `/horarios`, `/gastos`, `/facturas`, `/asistente` (con una propuesta), `/actividad`, `/ajustes`, `/perfil`, diálogo de borrar cuenta, `/legal/privacidad`, `NotFoundPage`. **0 violaciones**. Las excepciones (si un falso positivo lo exige) se declaran por regla y selector en `a11y.exceptions.ts` con un comentario que lo justifique.
- **RN-17-12** Revisión manual (anotada en el PR del ticket): navegación completa con teclado, VoiceOver en iOS y TalkBack en Android en los flujos E2E-05, E2E-06, E2E-07 y E2E-09, zoom al 200 % sin pérdida de contenido, `prefers-reduced-motion` sin animaciones, objetivos táctiles ≥ 44 px.

### Rendimiento y PWA
- **RN-17-13** Lighthouse CI (`@lhci/cli`, preset móvil, 3 ejecuciones por URL, mediana) sobre `/entrar`, Inicio y una lista de la compra, con la API de test y el seed de demo (inicio de sesión con un `puppeteerScript`). Umbrales: **Rendimiento ≥ 90**, **Accesibilidad ≥ 95**, **Buenas prácticas ≥ 95**. Informes en `temporary-public-storage` **no** (son datos de la app): se guardan como artefacto de CI.
- **RN-17-14** La categoría "PWA" ya no existe en Lighthouse (≥ v12), así que el objetivo "PWA ≥ 90" se sustituye por `apps/web/e2e/pwa.e2e.ts`, que comprueba: manifest con `name`, `short_name`, `lang: "es"`, `start_url`, `display: "standalone"`, `theme_color`, `background_color` e iconos 192 y 512 (uno `maskable`); `apple-touch-icon` y `apple-mobile-web-app-capable`; service worker registrado que controla la página; y que, sin red, la app arranca desde la caché y muestra "Sin conexión. Los cambios no se guardarán".
- **RN-17-15** Bundle: una ruta = un chunk (`lazy`, HOG-750). `manualChunks`: `react`, `router`, `query` en `vendor`; Recharts solo en el chunk de gastos. Fuentes Barlow solo en `woff2` y subconjunto `latin` + `latin-ext`. Presupuestos con `size-limit` (gzip): JS inicial (entrada + vendor) **≤ 200 KB**; cada chunk de ruta **≤ 100 KB**; CSS total **≤ 50 KB**. `pnpm --filter web analyze` genera el informe con `rollup-plugin-visualizer` (no en CI).

### Observabilidad (0 €)
- **RN-17-16** Logs de la API con `nestjs-pino` en JSON a stdout, nivel `LOG_LEVEL` (`info` en producción). Docker usa el driver `journald`; `/etc/systemd/journald.conf.d/hogaria.conf` fija `MaxRetentionSec=14day` y `SystemMaxUse=500M` (retención declarada en la política de privacidad).
- **RN-17-17** Cada petición registra: `requestId` (cabecera `X-Request-Id` o UUID nuevo, devuelta en la respuesta), método, **plantilla de ruta** (`/api/v1/invites/:token`, nunca la URL real), estado, duración, `userId` y `groupId` si existen. Redacción obligatoria (`redact`): `req.headers.cookie`, `req.headers.authorization`, `res.headers["set-cookie"]`, `*.password`, `*.token`, `*.newPassword`, `*.currentPassword`. Nunca se registran cuerpos ni query strings. Los 5xx registran el stack (solo en el log).
- **RN-17-18** Eventos de negocio relevantes se registran a nivel `info` con un campo `event`: `account.deleted` (`userId`), `data.exported` (`userId`), `ai.call` (`feature`, `model`, `success`, `ms`), `reminder.sent`/`reminder.failed` (`reminderId`), `backup.*` (en el script).
- **RN-17-19** `GET /health` → `{ status: "ok", version: "<git sha corto>", uptimeSeconds }` sin tocar la BBDD (ADR-004). El `Dockerfile.api` declara `HEALTHCHECK` con `node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` cada 30 s.
- **RN-17-20** Monitor externo **opcional** con **UptimeRobot** (plan gratuito): monitor HTTP cada 5 min a `https://api.hogaria.obaiges.com/health` y a `https://hogaria.obaiges.com/`, con alerta por email. No despierta Neon.

### Copias de seguridad
- **RN-17-21** `deploy/backup.sh` (bash, `set -euo pipefail`), ejecutado por un *timer* de systemd (`deploy/systemd/hogaria-backup.service` + `.timer`, `OnCalendar=Sun *-*-* 04:00:00 Europe/Madrid`, `Persistent=true`):
  1. `docker run --rm postgres:17-alpine pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL"` (la versión de `pg_dump` debe ser ≥ la de Neon; se comprueba al implementar).
  2. Se cifra **en tubería** con `age -r "$BACKUP_AGE_RECIPIENT"` (el volcado en claro **nunca** se escribe a disco) a `/var/tmp/hogaria-<UTC>.dump.age`.
  3. Se sube con `rclone` al bucket privado de Oracle Object Storage (API compatible S3) `hogaria-backups/hogaria-YYYYMMDDTHHMMSSZ.dump.age`.
  4. Se conservan las **8 más recientes**; las anteriores se borran (`rclone lsf` ordenado + `rclone deletefile`).
  5. Se borra el archivo temporal (trampa `trap` también en error) y, si existe `BACKUP_HEARTBEAT_URL` (p. ej. Healthchecks.io gratuito), se hace `curl` al terminar con éxito (o a `/fail` si falla).
- **RN-17-22** Configuración en `/opt/hogaria/backup.env` (permisos `600`): `BACKUP_DATABASE_URL` (conexión **directa** de Neon con un rol de solo lectura `hogaria_backup`), `BACKUP_AGE_RECIPIENT` (clave pública), `RCLONE_CONFIG_OCI_*` (tipo `s3`, proveedor `Other`, endpoint `https://<namespace>.compat.objectstorage.<región>.oraclecloud.com`, claves "Customer Secret Key"), `BACKUP_BUCKET`, `BACKUP_HEARTBEAT_URL` (opcional).
- **RN-17-23** La **clave privada** de `age` se genera fuera de la VM (`age-keygen`) y se guarda en el gestor de contraseñas del administrador y en una copia offline. **Nunca** está en la VM ni en el repo.
- **RN-17-24** El bucket es privado y está en una región de la UE; como red de seguridad tiene una regla de ciclo de vida que borra objetos de más de 70 días.

### Restauración
- **RN-17-25** Procedimiento en `deploy/README.md` → "Restaurar una copia":
  1. `rclone copy oci:hogaria-backups/<archivo> .` en el equipo del administrador.
  2. `age -d -i hogaria-backup.key <archivo> | pg_restore --no-owner --no-privileges --clean --if-exists -d <destino>`.
  3. Verificación con `deploy/verify-restore.sql`: recuentos de `users`, `groups`, `group_members`, `shopping_items`, `recipes`, `tasks`, `calendar_events`, `expenses`, `bills` y última fila de `_prisma_migrations`, comparados con los valores anotados en el log del backup (el script registra los recuentos al hacerlo).
  4. **Producción:** restaurar en una **rama nueva de Neon** o base vacía, cambiar `DATABASE_URL`/`DIRECT_URL` en el `.env` de la VM y `docker compose up -d`. Después, volver a borrar las cuentas eliminadas tras la fecha de la copia: se identifican **antes de restaurar** con los `SecurityEvent ACCOUNT_DELETED` posteriores a la fecha de la copia en la base actual (si sigue accesible) o, si no, con los eventos `account.deleted` del log de los últimos 14 días (`journalctl CONTAINER_NAME=hogaria-api | grep account.deleted`), y se borran ejecutando `pnpm --filter api cli delete-user --id <uuid>` (spec 16, RN-16-26).
- **RN-17-26** La restauración se **prueba de verdad** en una base local (Docker, puerto 5433) antes de dar E17 por cerrado, y después cada 6 meses. Cada prueba se anota en la tabla "Registro de pruebas de restauración" de `deploy/README.md` (fecha, archivo, duración, recuentos, resultado, quién).

### Runbook, dependencias, seed y documentación
- **RN-17-27** `deploy/README.md` contiene, además del aprovisionamiento (HOG-022), un **runbook de incidencias** con, para cada caso, *síntoma → diagnóstico (comandos) → solución*: API caída o reiniciándose; 502 de Caddy; certificado TLS no renovado; Neon suspendida o sin horas de cómputo; Gemini saturado o clave revocada; emails que no llegan (límites de Resend, SPF/DKIM); notificaciones push que no llegan (VAPID, suscripciones caducadas); disco lleno; VM reiniciada (recuperación de recordatorios: `PENDING` < 1 h se envían, el resto `MISSED`); dependencia vulnerable; **rotación de secretos** (`BETTER_AUTH_SECRET` cierra todas las sesiones; claves VAPID obligan a re-suscribirse; `GEMINI_API_KEY`; secreto OAuth de Google; contraseña de Neon; credenciales de Object Storage); cuenta comprometida (bloquear desde `/admin`); restauración (RN-17-25); comprobaciones de seguridad (`curl -I` de cabeceras y cookie, permisos del `.env`, `fail2ban-client status`).
- **RN-17-28** Dependabot (`.github/dependabot.yml`): ecosistemas `npm` (raíz del monorepo pnpm), `github-actions` y `docker` (`/deploy`), semanal, con grupos `minor-and-patch` por ecosistema y como mucho 5 PR abiertas. CI ejecuta `pnpm audit --prod --audit-level=high` en el job `checks` y `gitleaks` (acción oficial, gratuita).
- **RN-17-29** **Seed de demo** (`apps/api/prisma/seed.ts`, `pnpm db:seed`): **se niega a ejecutarse con `NODE_ENV=production`** o si `DATABASE_URL` apunta a un host `*.neon.tech`. Es idempotente (borra antes a los usuarios con email `@demo.hogaria.local` y sus grupos) y determinista (sin aleatoriedad; fechas relativas a "hoy" en `Europe/Madrid`). Crea:
  - Usuarios (contraseña común `demo-hogaria-2026`, email verificado): **Ana** (`ana@demo.hogaria.local`, `ana`, aviso de IA aceptado), **Óscar** (`oscar@demo.hogaria.local`, `oscar`, `isPlatformAdmin`), **Lucía** (`lucia@demo.hogaria.local`, `lucia`, vegetariana, alérgica al huevo).
  - Grupo **"Casa Demo"** 🏠 con los tres y grupo **"Piso Playa"** 🏖️ solo con Ana (para probar el selector de hogar).
  - En "Casa Demo": listas "Compra" (8 productos, 2 marcados) y "Mercadona" (5), 4 indispensables; 8 recetas (1 `AI_FRIDGE`); menú de la semana actual (comida y cena de lunes a viernes); 6 tareas (2 con rotación semanal, 1 vencida); horarios de Ana (L–V 08:00–15:00) y Óscar (turnos de mañana/tarde alternos) y una excepción de vacaciones; 5 eventos (cumpleaños de Lucía anual, dentista de Ana, cena del sábado…); 12 gastos del mes en 5 categorías y un presupuesto superado; facturas Alquiler, Luz, Internet y Agua con recibos pendientes y pagados; 20 entradas de actividad.
- **RN-17-30** **Actualización final de la documentación** (checklist del ticket): versiones exactas en `docs/01`; catálogo de endpoints de `docs/04` contrastado con `pnpm --filter api routes:list` (script que imprime las rutas descubiertas); límites de servicios gratuitos de `docs/06` con fecha de verificación; E2E-01…16 en `docs/07`; glosario sin términos huérfanos; las secciones 12 de todas las specs sin cambios pendientes (se aplicaron el 2026-11-11; ADR-017 y ADR-018 ya existen) y ADRs nuevos si esta épica toma decisiones adicionales; `README.md` raíz con arranque rápido; comandos de `AGENTS.md` §7 verificados; `BOARD.md` coherente.

## 4. Modelo de datos

Sin cambios. Se crea un rol de BBDD de solo lectura `hogaria_backup` en Neon (no es parte del esquema Prisma; se documenta en `deploy/README.md`).

## 5. API

| Método | Ruta | Entrada | Salida | Errores |
|---|---|---|---|---|
| `GET` | `/health` | — | `{ status: "ok", version: string, uptimeSeconds: number }` | — |
| `GET` | `/health/db` | — | `{ status: "ok", latencyMs: number }` | 503 si la BBDD no responde |

Solo con `NODE_ENV=test` (no existen en otros entornos): `GET /test/emails` (`docs/07`) y `POST /test/reset` (vacía tablas para e2e, si los e2e lo necesitan).

CLI nueva (`apps/api/src/cli/`): `delete-user --id <uuid>` (reutiliza `UserDeletionService` de E16, para el procedimiento de RN-17-25) y `routes:list`.

## 6. Eventos en tiempo real

Ninguno nuevo.

## 7. Pantallas y UX

Sin pantallas nuevas. Afecta a todas por accesibilidad (RN-17-11/12) y rendimiento (RN-17-13/15). `RouteErrorPage` (E15) cubre los fallos de carga de chunk tras un despliegue.

## 8. Permisos

- `/health` y `/health/db` son públicos (`@Public()`); `/health/db` está limitado a 6 peticiones/min por IP.
- El seed y las CLI solo se ejecutan con acceso a la máquina.

## 9. Actividad

No aplica.

## 10. Casos límite

- `pg_dump` más antiguo que el servidor de Neon → el backup falla; el heartbeat avisa y el runbook indica subir la etiqueta de la imagen `postgres`.
- Neon suspendida a las 04:00: el primer intento la despierta (0,5–1 s); `pg_dump` lo tolera.
- Bucket lleno (20 GB): imposible con 8 copias de pocos MB; el runbook indica cómo comprobar el tamaño.
- Lighthouse inestable en CI: mediana de 3 ejecuciones; si aun así falla por ruido, se reintenta una vez el job (no se bajan umbrales).
- Falso positivo de axe por componentes de terceros (Radix): se declara en `a11y.exceptions.ts` con justificación; nunca se desactiva una regla globalmente.
- WebKit en CI más lento: `timeout` de test 60 s en el proyecto iPhone 14.
- Dependabot propone una versión mayor que rompe: se cierra la PR y se crea un ticket de migración.

## 11. Tests

- Unit: `headers.spec.ts` (RN-17-03); test de redacción de logs (un log con cookie y password sale con `[Redacted]`); `backup.sh` con `shellcheck` en CI.
- Integración: `route-guards.int.spec.ts` (RN-17-07), `authorization-matrix.int.spec.ts` (RN-17-08), cabeceras de la API y CSRF (CHK-SEC-11/13), entorno de producción sin `/test/*` ni `/api/docs` (CHK-SEC-21/22), `GET /health` sin consultar la BBDD (espía en Prisma).
- E2E: la suite completa **E2E-01 … E2E-16** (RN-17-09), `a11y.e2e.ts`, `pwa.e2e.ts`.
- Rendimiento: LHCI (RN-17-13) y `size-limit` (RN-17-15).
- Manual: revisión de accesibilidad (RN-17-12) y prueba de restauración (RN-17-26), con evidencias en el PR y en `deploy/README.md`.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- CSP y `Permissions-Policy` ampliadas → `docs/03` (Protecciones web).
- Plantilla de ruta y lista de redacción de logs → `docs/03` (Privacidad, Logs).
- CI: `e2e` solo en PR y push a `main` con 2 shards, `lhci`, `size-limit`, `pnpm audit`, `gitleaks`, `a11y.e2e.ts` y `pwa.e2e.ts` → `docs/07`.
- `deploy/systemd/`, `verify-restore.sql`, `backup.env`, journald 14 días, UptimeRobot, Healthchecks.io y rol `hogaria_backup` → `docs/06`.
- ADR-017 (journald 14 días) y ADR-018 (instalabilidad PWA con Playwright) → `docs/09`.
- Forma de `GET /health` y `GET /health/db` → `docs/04` (fila "Salud").
- Comandos `delete-user`, `routes:list` y `analyze` → `AGENTS.md` §7.

## 13. Fuera de alcance

- Servicios de monitorización de errores de terceros (Sentry, etc.): añadirían otro encargado del tratamiento.
- Métricas y paneles (Prometheus/Grafana).
- Pruebas de carga.
- Pentest externo.
- Copias de seguridad más frecuentes que semanales o réplicas en otra nube.
- Alta disponibilidad (más de una instancia de la API).
