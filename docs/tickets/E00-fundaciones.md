# E00 · Fundaciones

> Rango: HOG-001 – HOG-049 · Fase 0 · Sin spec propia: se basa en `docs/01-arquitectura.md`, `docs/06-despliegue.md`, `docs/07-testing.md`, `docs/08-convenciones.md`, `docs/03-seguridad.md` y `DESIGN.md`.
> Bloques: HOG-001–019 repositorio, paquetes y calidad · HOG-020–029 infraestructura y despliegue.
> Nota: `docs/06-despliegue.md` cita "HOG-022" para `deploy/README.md`; el aprovisionamiento manual y ese README son **HOG-021**, y HOG-022 es el despliegue continuo.

---

### HOG-001 · Crear el monorepo con pnpm, Turborepo y configuración compartida

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** —
- **Spec:** `docs/01-arquitectura.md#monorepo` · `docs/08-convenciones.md`

**Descripción**
Crear la base del repositorio: workspaces de pnpm, Turborepo, TypeScript estricto compartido, ESLint (flat config) y Prettier, para que todos los paquetes compilen y se revisen igual desde el primer día.

**Criterios de aceptación**
- [x] Existen `package.json` raíz (con `packageManager` fijado), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` y `.nvmrc` con la Node LTS vigente.
- [x] `packages/config` exporta `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `moduleResolution: "bundler"` o `"nodenext"` según paquete), `eslint.config.js` y `prettier.config.js`.
- [x] Reglas de ESLint activas: `@typescript-eslint/no-explicit-any` (error), `react/no-danger` (error), orden de imports y prohibición de `console.log` (se permite `console.debug` y `console.warn`).
- [x] Scripts raíz: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm db:migrate`, `pnpm db:seed` delegan en Turborepo o en el filtro correspondiente (pueden fallar con "sin paquetes" hasta que existan las apps).
- [x] `.gitignore` incluye `node_modules`, `dist`, `.turbo`, `coverage`, `playwright-report`, `test-results` y `.env*` salvo `.env.example`. `.editorconfig` presente.
- [x] Las versiones exactas elegidas (Node, pnpm, TypeScript, React, Vite, NestJS, Prisma, Better Auth, Socket.IO, TanStack Query, Tailwind, Playwright, Vitest) se anotan en `docs/01-arquitectura.md#stack-y-versiones-objetivo`.
- [x] `pnpm lint && pnpm typecheck` pasan en el repo vacío.

**Notas técnicas**
- Alias de imports `@/` por app y `@hogaria/shared` (workspace `workspace:*`).
- Turborepo: `build` depende de `^build`; `lint`, `typecheck` y `test` cacheables; `dev` persistente sin caché.
- No añadas Husky todavía (opcional en E17).

**Tests**
- Unit: —
- Integración: —
- E2E: —

---

### HOG-002 · Crear `packages/shared` con dinero, fechas, errores, constantes y tipos de tiempo real

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** shared
- **Depende de:** HOG-001
- **Spec:** `docs/01-arquitectura.md#paquete-compartido--packagesshared` · `docs/04-api-y-tiempo-real.md` · `docs/specs/03-tiempo-real-actividad.md#3-reglas-de-negocio`

**Descripción**
Crear el paquete `@hogaria/shared` que importan web y API: utilidades puras de dinero y fechas en la zona del grupo, códigos de error con sus mensajes en español, constantes de dominio y los tipos base del sobre de tiempo real.

**Criterios de aceptación**
- [x] `src/money.ts`: `formatMoney(cents)` → `"12,34 €"` / `"1.234,00 €"` (con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })`) y `parseMoney("12,34")` → `1234` (acepta `12`, `12,3`, `12.345,67`; rechaza negativos y más de 2 decimales devolviendo `null`).
- [x] `src/dates.ts` (con `date-fns` + `@date-fns/tz`): `todayInZone(tz)`, `toZonedDay(instant, tz)` → `"YYYY-MM-DD"`, `zonedDayToUtcRange(day, tz)`, `startOfWeekInZone(day, tz)` (lunes), `formatDayShort` → `"mié 11 nov"`, `formatTimeRange` → `"08:00–15:00"`, `formatRelative` → `"hace 5 min"` (nunca negativo). `DEFAULT_TIMEZONE = 'Europe/Madrid'`.
- [x] `src/errors.ts`: `ERROR_CODES` con exactamente los códigos de `docs/04-api-y-tiempo-real.md`, mapa `ERROR_STATUS`, `ERROR_MESSAGES_ES` (un mensaje por código, p. ej. `NOT_FOUND` → "No encontrado", `INTERNAL` → "Algo ha fallado. Inténtalo de nuevo"), tipo `ErrorCode` y `problemDetailsSchema` (zod de RFC 9457 con `code` y `errors[]`).
- [x] `src/constants/`: `LANE_COLOR_ORDER`, `DEFAULT_EXPENSE_CATEGORIES` (las 9 de `docs/02-modelo-datos.md` con emoji), `INVITE_TTL_DAYS = 10`, `MAX_GROUP_MEMBERS = 20`, etiquetas ES de `Aisle`, `MealSlot`, `Allergen`, `Diet` y `UNITS` (valores de los comentarios de `docs/02-modelo-datos.md`), todas `as const`.
- [x] `src/realtime.ts`: `REALTIME_CHANNEL = 'evt'`, `REALTIME_EVENTS` con **todos** los nombres de la tabla de `docs/04`, `RealtimeEventName`, `RealtimeEnvelope<T>` (con `groupId: string | null`, ver `docs/04-api-y-tiempo-real.md`) y un `RealtimeEventDataMap` vacío extensible (lo rellena HOG-151 y cada épica).
- [x] `src/schemas/pagination.ts`: `cursorQuery` y `paginated(itemSchema)` (spec 03 §5).
- [x] El paquete compila a ESM con tipos (`tsup`), con `exports` para `.` y subrutas futuras, y web y api lo importan como `@hogaria/shared`.
- [x] Cobertura de líneas ≥ 80 %.

**Notas técnicas**
- Nada de dependencias de Node ni del DOM: solo funciones puras (se usa en navegador y servidor).
- Las uniones de string sustituyen a los enums de Prisma en la web (`docs/08-convenciones.md#typescript`); cuando exista HOG-004, añade un test que compare `LANE_COLOR_ORDER` con el enum `LaneColor` del cliente de Prisma.
- `normalizeProductName` y demás utilidades de módulos las añade su épica.

**Tests**
- Unit: `money.spec.ts` (redondeo, miles, formatos inválidos), `dates.spec.ts` (cambio de hora de marzo y octubre en `Europe/Madrid`, `Atlantic/Canary`, inicio de semana en lunes), `errors.spec.ts` (todo código tiene mensaje y status), `realtime.spec.ts` (instantánea de `REALTIME_EVENTS`).
- Integración: —
- E2E: —

---

### HOG-003 · Crear el esqueleto de `apps/api` con NestJS, Prisma, Postgres local y `/health`

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-001, HOG-002
- **Spec:** `docs/01-arquitectura.md#backend--appsapi` · `docs/06-despliegue.md#variables-de-entorno`

**Descripción**
Arrancar la API NestJS (adaptador Express) con configuración validada, logs estructurados, conexión Prisma y la base de datos local en Docker, con los dos endpoints de salud.

**Criterios de aceptación**
- [x] `apps/api/src/main.ts` crea la app con prefijo global `/api/v1`, `bodyParser: false` (el parser JSON se añade después de montar Better Auth en HOG-050) y escucha en `PORT`.
- [x] `src/config/env.ts` valida `process.env` con zod (variables de `docs/06-despliegue.md`; las de servicios aún no usados son opcionales) y la app no arranca si falta una obligatoria, indicando cuál.
- [x] `nestjs-pino` con `requestId` por petición y redacción de `authorization`, `cookie` y `set-cookie`.
- [x] `src/prisma/prisma.service.ts` y `PrismaModule` global; `prisma/schema.prisma` con solo `datasource` y `generator` (el esquema llega en HOG-004).
- [x] `docker-compose.yml` raíz con `db` (`postgres:17`, puerto 5432, BBDD `hogaria`, volumen) y `db-test` (`postgres:17`, puerto 5433, BBDD `hogaria_test`, `tmpfs`).
- [x] `GET /api/v1/health` → `200 { status: "ok" }` **sin** tocar la BBDD; `GET /api/v1/health/db` → `200 { status: "ok" }` con `SELECT 1` (o `503` si falla).
- [x] `pnpm dev` levanta `db` y la API en modo watch; `apps/api/.env.example` copiado de `docs/06-despliegue.md` con `DATABASE_URL`/`DIRECT_URL` locales.

**Notas técnicas**
- Usa `@nestjs/config` solo como contenedor; la validación es el esquema zod.
- `GET /health` se marcará `@Public()` cuando exista el `AuthGuard` (HOG-055).

**Tests**
- Unit: `env.spec.ts` (falta `DATABASE_URL` → error legible).
- Integración: `health.int.spec.ts` (`/health` responde sin BBDD configurada; `/health/db` con la BBDD de test).
- E2E: —

---

### HOG-004 · Escribir el esquema Prisma completo y la primera migración

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-003
- **Spec:** `docs/02-modelo-datos.md`

**Descripción**
Trasladar el esquema canónico de `docs/02-modelo-datos.md` a `apps/api/prisma/schema.prisma` con todos los `@map`/`@@map` a `snake_case`, y generar la migración inicial con el índice único parcial de `budgets`.

**Criterios de aceptación**
- [x] Todos los modelos, enums, relaciones, índices y `@@unique` de `docs/02-modelo-datos.md` están en el schema, con columnas en `snake_case` (`@map`) y tablas en plural (`@@map`).
- [x] Los IDs son `@default(uuid(7)) @db.Uuid` y los instantes `@db.Timestamptz(3)`; los días `@db.Date`.
- [x] La migración `0001_init` incluye a mano `CREATE UNIQUE INDEX budgets_group_user_total_key ON budgets("groupId", "userId") WHERE "categoryId" IS NULL;`.
- [x] `pnpm db:migrate` (`prisma migrate deploy`) aplica la migración en la BBDD local y `prisma migrate reset --force` funciona contra `hogaria_test`.
- [x] Un test comprueba que los nombres de modelos y enums del cliente generado coinciden con una lista esperada (detecta divergencias con el documento).

**Notas técnicas**
- Las tablas de Better Auth deben coincidir con lo que espera su adaptador de Prisma; si `npx @better-auth/cli generate` propone diferencias de campos, gana `docs/02-modelo-datos.md` y se ajusta la configuración de Better Auth (`fields` mapping) en HOG-050.
- Si Prisma no soporta `uuid(7)` en la versión fijada, usa `@default(dbgenerated(...))` o genera en la aplicación y anótalo en `docs/02-modelo-datos.md`.

**Tests**
- Unit: —
- Integración: `schema.int.spec.ts` (migración aplicada; insertar dos `Budget` totales del mismo usuario y grupo falla por el índice parcial).
- E2E: —

---

### HOG-005 · Crear el esqueleto de `apps/web` (Vite, React, Router, Query, Tailwind v4 y PWA)

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-001, HOG-002
- **Spec:** `docs/01-arquitectura.md#frontend--appsweb` · `DESIGN.md` §11

**Descripción**
Arrancar la SPA con React 19, React Router en modo *data*, TanStack Query, Tailwind CSS v4 y vite-plugin-pwa en modo `injectManifest`, con manifest e iconos generados desde el logo.

**Criterios de aceptación**
- [x] `apps/web` con Vite + React + TypeScript; estructura de carpetas de `docs/01-arquitectura.md#estructura-del-monorepo` (`app/`, `components/ui/`, `components/pool/`, `features/`, `lib/`, `styles/`).
- [x] `app/router.tsx` con `createBrowserRouter` y rutas placeholder para todas las de `docs/08-convenciones.md#rutas-de-la-pwa-español-fijadas` (cada una renderiza su título).
- [x] `app/providers/QueryProvider.tsx` con `QueryClient` (`staleTime` 30 s, `retry` 1 en queries, `networkMode: 'always'` en mutaciones).
- [x] Tailwind v4 con `@tailwindcss/vite`; `styles/index.css` importa `styles/tokens.css` (vacío hasta HOG-007).
- [x] vite-plugin-pwa (`strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`) con `sw.ts` mínimo que precachea el *shell*; manifest con `name: "Hogaria"`, `short_name: "Hogaria"`, `lang: "es"`, `display: "standalone"`, `start_url: "/"`, `theme_color` y `background_color` de `DESIGN.md` §11.
- [x] Iconos 192, 512, 512 *maskable* y `apple-touch-icon` 180 en `public/`, generados desde `docs/design/logo.svg` (fondo opaco del token indicado en `DESIGN.md` §11).
- [x] Proxy de Vite: `/api` y `/realtime` (con `ws: true`) → `http://localhost:3000`.
- [x] `apps/web/.env.example` según `docs/06-despliegue.md`. `pnpm --filter web build` genera `dist/` sin errores.

**Notas técnicas**
- `lang="es"` en `index.html` y `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- El push del service worker es de E12 (HOG-600); el aviso de nueva versión es HOG-015.

**Tests**
- Unit: `router.spec.tsx` (cada ruta fijada existe).
- Integración: —
- E2E: —

---

### HOG-006 · Implementar el manejo global de errores y el `apiClient` web con `X-Client-Mutation-Id`

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-002, HOG-003, HOG-005
- **Spec:** `docs/04-api-y-tiempo-real.md#formato-de-error-rfc-9457-applicationproblemjson` · `docs/specs/03-tiempo-real-actividad.md` (RN-03-10, RN-03-16)

**Descripción**
Unificar errores y contexto de petición: en la API, `AppError` convertido a `application/problem+json`, `ZodValidationPipe` y un `RequestContext` con el usuario y el `clientMutationId`; en la web, un `apiClient` que envía la cabecera de mutación y traduce los errores a español.

**Criterios de aceptación**
- [x] `apps/api/src/common/errors/app-error.ts`: `new AppError(code: ErrorCode, detail?, errors?)`.
- [x] `common/filters/problem-details.filter.ts` (global) convierte `AppError`, `ZodError`, `HttpException` (incluido `ThrottlerException` → `RATE_LIMITED` con `Retry-After`) y errores desconocidos (`INTERNAL`, sin detalles ni stack) a problem+json con `type`, `title` (de `ERROR_MESSAGES_ES`), `status`, `code`, `detail?`, `errors?`.
- [x] `common/pipes/zod-validation.pipe.ts`: `@Body(new ZodValidationPipe(schema))` y equivalente para `@Query`/`@Param`; fallo → `422 VALIDATION_ERROR` con `errors[{ path, message }]`.
- [x] `common/context/request-context.ts` (AsyncLocalStorage) con `requestId`, `userId`, `userName`, `sessionId` y `clientMutationId` (cabecera `X-Client-Mutation-Id` si es UUID válido; si no, `null`); middleware global que lo inicializa.
- [x] `apps/web/src/lib/apiClient.ts`: `api.get/post/patch/put/delete<T>(path, { body?, schema? })` con `credentials: 'include'`, base `VITE_API_URL + '/api/v1'`, añade `X-Client-Mutation-Id` (`crypto.randomUUID()`) a toda mutación y lo registra en `lib/realtime/mutation-registry.ts` (stub hasta HOG-152) **antes** de enviar; si se pasa `schema`, valida la respuesta en desarrollo.
- [x] Errores: lanza `ApiError { status, code, detail, errors }` y `ApiError.message` sale de `ERROR_MESSAGES_ES`. `401` → limpia la caché y navega a `/entrar?volver=…`. Error de red → `NetworkError` con "No hay conexión con el servidor".

**Notas técnicas**
- El bloqueo de mutaciones sin conexión (`OfflineError`) lo añade HOG-155.
- `GET` nunca lleva `X-Client-Mutation-Id`.

**Tests**
- Unit (api): filtro con cada tipo de error; pipe con un esquema de ejemplo; contexto con cabecera válida, inválida y ausente.
- Unit (web): `apiClient` con MSW (cabecera presente en mutaciones y ausente en GET; mapeo de `code` a mensaje; redirección en 401).
- Integración: endpoint de prueba que lanza `AppError('NOT_FOUND')` devuelve problem+json.
- E2E: —

---

### HOG-007 · Aplicar los tokens de diseño, las fuentes Barlow autoalojadas y el tema claro/oscuro

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-005
- **Spec:** `DESIGN.md` §3–§6 y §11 · ADR-016

**Descripción**
Llevar el sistema "Piscina municipal" a la web: tokens CSS de `docs/design/tokens.css`, tipografías Barlow y Barlow Condensed servidas desde el propio dominio, tema claro/oscuro y logos con el texto convertido a trazados.

**Criterios de aceptación**
- [x] `apps/web/src/styles/tokens.css` contiene los tokens de `docs/design/tokens.css` (colores, `--lane-*`, `--rope-*`, tipografía, radios, `--ease-water`) sin valores inventados; Tailwind v4 los expone con `@theme`.
- [x] `@fontsource/barlow` (pesos 400/500/600 según `DESIGN.md` §4) y `@fontsource/barlow-condensed` (500 y 600) importados localmente; ninguna petición a Google Fonts.
- [x] Modo oscuro por `prefers-color-scheme` y forzable con `data-theme="light|dark"` en `<html>`; `lib/theme.ts` guarda la preferencia (`'system' | 'light' | 'dark'`) en `localStorage` con `try/catch`.
- [x] `<meta name="theme-color">` cambia con el tema.
- [x] `docs/design/logo-horizontal.svg` y `-dark.svg` tienen el texto "HOGARIA" convertido a trazados (`DESIGN.md` §11) y se copian a `apps/web/src/assets/`.
- [x] Página `/dev/tokens` (solo en desarrollo) que muestra colores, calles, tipografía y escala, para revisión visual en 375 px y en oscuro.

**Notas técnicas**
- `font-display: swap`. Inputs a 16 px (evita el zoom de iOS).
- Si `DESIGN.md` y `docs/design/tokens.css` difieren, gana `DESIGN.md` y se corrige `tokens.css`.

**Tests**
- Unit: `theme.spec.ts` (preferencia guardada; `localStorage` que lanza no rompe).
- Integración: —
- E2E: —

---

### HOG-008 · Adaptar los componentes UI base de shadcn al sistema "Piscina municipal"

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-007
- **Spec:** `DESIGN.md` §8 y §9

**Descripción**
Crear los componentes base en `apps/web/src/components/ui/` a partir de shadcn/ui (Radix), con las variantes, tamaños y estados de `DESIGN.md`, accesibles y listos para modo oscuro.

**Criterios de aceptación**
- [x] Componentes: `Button` (`primary`, `secondary`, `ghost`, `danger`; estado `loading`; prop `requiresConnection` preparada, sin efecto hasta HOG-155), `Input`, `Textarea`, `Select`, `Checkbox`, `Chip`, `Sheet`, `Dialog`, `Tabs`/`SegmentedControl`, `Toast` (con acción "Deshacer" de 5 s), `Skeleton`, `EmptyState`, `ErrorState` (con `onRetry` opcional) y `FormField` (label visible + mensaje de error con `aria-describedby`).
- [x] Alturas, radios y tipografía según `DESIGN.md` §5 y §8; objetivos táctiles ≥ 44 px; foco visible con el token de anillo.
- [x] `Skeleton` sin pulso con `prefers-reduced-motion`.
- [x] Página `/dev/ui` (solo desarrollo) con todos los componentes y estados, en claro y oscuro.

**Notas técnicas**
- `AppHeader`, `BottomNav` y `Fab` son de HOG-750; `OfflineBanner` es de HOG-155.
- `Toast` con un *store* simple (Zustand) y `useToast()`; región `aria-live="polite"`.

**Tests**
- Unit: componentes con Testing Library (Button `loading` deshabilita, Dialog atrapa el foco y cierra con Escape, `FormField` enlaza el error, `ErrorState` llama a `onRetry`).
- Integración: —
- E2E: —

---

### HOG-009 · Crear los componentes firma de la piscina y la animación de onda

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-008
- **Spec:** `DESIGN.md` §6 y §7 · `docs/design/mock-inicio.html`

**Descripción**
Crear `Lane`, `LaneRope`, `DepthFigure`, `MemberDot`/`MemberAvatar` y la animación `ripple` en `apps/web/src/components/pool/`, que el resto de módulos reutilizarán.

**Criterios de aceptación**
- [x] `Lane` con props `member`, `children`, `onPress?`, `highlight?: 'ripple'`, borde de 4 px y tinte del color de calle, `role="group"` y `aria-label="Calle de {nombre}"`.
- [x] `LaneRope` (`variant: 'default' | 'limit'`), decorativa con `aria-hidden`.
- [x] `DepthFigure` (`size: 's' | 'l'`, `variant?: 'limit'`, `value`, `label`) con cifras tabulares.
- [x] `MemberDot`/`MemberAvatar` (20, 28 y 36 px) con iniciales o foto, color por `LaneColor` y variante neutra (sin miembro: sistema, ex-miembro o "Usuario eliminado").
- [x] Utilidad de animación `ripple` (clase CSS `.ripple` + `--ripple-color`) según `DESIGN.md` §6: 700 ms con barrido; con `prefers-reduced-motion`, solo cambio de fondo durante 1 s. Hook `useRippleClass(active, laneColor)` que la aplica a cualquier fila.
- [x] `laneColorVar(color: LaneColor)` → `var(--lane-coral)`… en `components/pool/lane-colors.ts`.
- [x] `/dev/ui` muestra una reproducción de `docs/design/mock-inicio.html` con estos componentes, en 375 px y oscuro.

**Notas técnicas**
- Cuándo se dispara la onda lo decide el tiempo real (HOG-152, `ripple-store`); aquí solo la presentación.

**Tests**
- Unit: `MemberDot` (iniciales de "Ana García" → "AG"; variante neutra), `Lane` (aria-label), `useRippleClass` (respeta `matchMedia('(prefers-reduced-motion: reduce)')`).
- Integración: —
- E2E: —

---

### HOG-010 · Montar la infraestructura de tests unitarios y de integración

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** infra
- **Depende de:** HOG-003, HOG-004
- **Spec:** `docs/07-testing.md`

**Descripción**
Configurar Vitest en los tres paquetes, la BBDD de test con reseteo y truncado, *factories* y los *fakes* inyectables de Gemini, Web Push y email (Resend).

**Criterios de aceptación**
- [x] Vitest en `packages/shared`, `apps/api` (unit `*.spec.ts` + integración `test/**/*.int.spec.ts` con `supertest`) y `apps/web` (jsdom + Testing Library + MSW).
- [x] La integración usa `hogaria_test` (puerto 5433): `globalSetup` ejecuta `prisma migrate reset --force --skip-seed` una vez por ejecución y cada test trunca las tablas (`TRUNCATE … RESTART IDENTITY CASCADE` generado desde el esquema).
- [x] `apps/api/test/utils/create-test-app.ts` arranca la app Nest con proveedores sustituibles.
- [x] Factories en `apps/api/test/factories/`: `createUser({ verified?, password?, isPlatformAdmin?, blockedAt? })`, `createGroupWithMembers(n)`, `createInvite(groupId, { status? })`, `loginAs(user)` → agente supertest con cookie (operativo desde HOG-050; hasta entonces lanza "Not implemented").
- [x] Interfaces + *fakes*: `EmailSender` (`FakeEmailSender` guarda los emails en memoria con `to`, `subject`, `text`, `html`, `links`), `PushSender` (`FakeWebPushSender` registra envíos), `GeminiClient` (`FakeGeminiClient` lee `test/fixtures/ai/*.json`). Se registran con *tokens* de Nest para cambiarlos por configuración (`NODE_ENV=test`).
- [x] Umbral de cobertura del 80 % de líneas en `packages/shared/src/**` y `apps/api/src/**/*.service.ts`; `pnpm test` falla si baja.

**Notas técnicas**
- Usa el reloj falso de Vitest (`vi.useFakeTimers`) para caducidades; documenta en `docs/07-testing.md` cualquier helper nuevo.
- Los tests de integración se ejecutan en serie (`pool: 'forks'`, `singleFork`) para no pisarse en la BBDD.

**Tests**
- Unit: test de humo de cada *fake*.
- Integración: test de humo que crea un usuario con la factory y comprueba el truncado entre tests.
- E2E: —

---

### HOG-011 · Configurar Playwright con móviles, helpers de login y doble contexto

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-003, HOG-005, HOG-010
- **Spec:** `docs/07-testing.md#flujos-críticos-e2e-obligatorios`

**Descripción**
Preparar los e2e en `apps/web/e2e/` con los proyectos Mobile Chrome (Pixel 7) y Mobile Safari (iPhone 14), arranque automático de web y API contra la BBDD de test, endpoints de soporte solo para test y helpers reutilizables.

**Criterios de aceptación**
- [ ] `playwright.config.ts` con proyectos `Pixel 7` y `iPhone 14`, `webServer` que levanta API (`NODE_ENV=test`, BBDD `hogaria_test`) y web, trazas `on-first-retry`.
- [ ] `apps/api/src/test-support/` (módulo cargado **solo** si `NODE_ENV=test`): `GET /api/v1/test/emails?to=` (emails del `FakeEmailSender`), `POST /api/v1/test/reset` (trunca tablas), `POST /api/v1/test/users` (crea usuario verificado con contraseña y, opcionalmente, un grupo; devuelve ids). Test de integración que comprueba que no existen con `NODE_ENV=production`.
- [ ] Helpers en `apps/web/e2e/helpers/`: `resetDb()`, `createUser()`, `loginAs(page, user)` (vía UI o cookie de la API), `lastEmailLink(to)`, `twoMembers(browser)` → `{ a: { page, user }, b: { page, user }, groupId }` con dos contextos independientes.
- [ ] `pnpm test:e2e` ejecuta un test de humo que abre `/` en ambos proyectos.

**Notas técnicas**
- `POST /test/users` usa el mismo hash que Better Auth (`hashPassword` de `better-auth/crypto`) para que el login real funcione.
- Viewports de los dispositivos de Playwright; nada de tamaños a mano.

**Tests**
- Unit: —
- Integración: `test-support` deshabilitado fuera de test.
- E2E: humo.

---

### HOG-012 · Configurar CI en GitHub Actions

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-001, HOG-010, HOG-011
- **Spec:** `docs/07-testing.md#ci-github-actions`

**Descripción**
Crear `.github/workflows/ci.yml` con los trabajos `checks` y `e2e` en cada push y pull request, y la auditoría de dependencias.

**Criterios de aceptación**
- [ ] Job `checks`: `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` (con servicio `postgres:17` en el puerto 5433 y `hogaria_test`), con caché de pnpm y Turborepo.
- [ ] Job `e2e` (`needs: checks`): instala navegadores de Playwright, construye web y API y ejecuta `pnpm test:e2e`; si falla, sube `playwright-report` y trazas como artefactos.
- [ ] Paso `pnpm audit --audit-level=high` (no bloqueante al principio: `continue-on-error: true`, anotado).
- [ ] Dependabot (`.github/dependabot.yml`) semanal para npm y GitHub Actions.
- [ ] Ninguna clave real en el workflow: los tests usan los *fakes*.

**Notas técnicas**
- El job `deploy` lo añade HOG-022.
- Límite de 2 000 min/mes en repos privados (`docs/06-despliegue.md`): `concurrency` cancela ejecuciones anteriores de la misma rama.

**Tests**
- Unit: —
- Integración: —
- E2E: el propio workflow en verde en un PR de prueba.

---

### HOG-013 · Crear el seed mínimo de desarrollo (`pnpm db:seed`)

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-004
- **Spec:** `docs/02-modelo-datos.md#datos-semilla-al-crear-un-grupo`

**Descripción**
Crear `apps/api/prisma/seed.ts` con el **seed mínimo** para el desarrollo local: el usuario dueño de la instancia y un hogar con 2 miembros y su semilla, para probar la app sin pasar por invitaciones. Los datos de demo de todos los módulos los añade HOG-865 ampliando este mismo script.

**Criterios de aceptación**
- [ ] Crea el usuario dueño `ana@demo.local` (`ana`, `isPlatformAdmin = true`) y un segundo usuario `oscar@demo.local` (`oscar`), ambos con contraseña `hogaria-demo-1234`, `emailVerified = true` y cuenta `credential`.
- [ ] Crea el hogar "Casa Demo" 🏠 con ambos miembros (CORAL y SEA), la lista "Compra" y las 9 categorías de gasto.
- [ ] Es idempotente (si existen, no duplica) y se niega a ejecutarse con `NODE_ENV=production`.
- [ ] No crea datos de módulos (compra, tareas, recetas…): eso es HOG-865.
- [ ] El script queda estructurado en funciones (`seedUsers()`, `seedGroup()`) para que HOG-865 añada `seedModules()` sin reescribirlo.

**Notas técnicas**
- Hash con `hashPassword` de `better-auth/crypto`. Nada de secretos reales.

**Tests**
- Unit: —
- Integración: ejecutar el seed dos veces deja 2 usuarios y 1 grupo.
- E2E: —

---

### HOG-014 · Aplicar las protecciones base de la API (helmet, CORS, Origin y throttler)

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-003, HOG-006
- **Spec:** `docs/03-seguridad.md#protecciones-web`

**Descripción**
Añadir las cabeceras de seguridad, el CORS estricto con credenciales, la comprobación de `Origin` en métodos no GET y el *rate limiting* general de 120 peticiones por minuto y usuario.

**Criterios de aceptación**
- [ ] `helmet` activo en la API.
- [ ] CORS: solo `APP_URL` (y `http://localhost:5173` si `NODE_ENV=development`), `credentials: true`, cabecera `X-Client-Mutation-Id` permitida.
- [ ] Middleware global: en `POST/PATCH/PUT/DELETE` bajo `/api/v1`, si la cabecera `Origin` existe y no está en la lista permitida → `403` problem+json con `code: "FORBIDDEN_ORIGIN"` (ver nota).
- [ ] `@nestjs/throttler` global: 120 peticiones/min por usuario autenticado (o por IP si no hay sesión) → `429 RATE_LIMITED` con `Retry-After`; decorador para límites específicos por ruta.
- [ ] Límite de tamaño del cuerpo JSON: 1 MB.

**Notas técnicas**
- Ningún código existente describe un origen no permitido: **añade** `FORBIDDEN_ORIGIN` (403, "Origen no permitido") a `packages/shared/src/errors.ts` y a la tabla de códigos de `docs/04-api-y-tiempo-real.md` en el mismo PR (cambio canónico previsto).
- Better Auth hace su propia comprobación con `trustedOrigins` (HOG-050).

**Tests**
- Unit: —
- Integración: `POST` con `Origin: https://evil.example` → 403; preflight CORS desde `APP_URL` → cabeceras correctas; 121.ª petición en un minuto → 429.
- E2E: —

---

### HOG-015 · Configurar el service worker del *shell* y el aviso de nueva versión

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-005, HOG-008
- **Spec:** ADR-015 · `docs/01-arquitectura.md#frontend--appsweb`

**Descripción**
Completar `sw.ts` para que solo precachee el *shell* (arranque rápido, sin modo offline) y avisar al usuario cuando haya una versión nueva.

**Criterios de aceptación**
- [ ] `sw.ts` usa `precacheAndRoute(self.__WB_MANIFEST)` y **no** cachea respuestas de `/api` ni de `/realtime`.
- [ ] Navegaciones a rutas de la SPA sirven `index.html` del precache.
- [ ] Registro con `virtual:pwa-register` (`registerType: 'prompt'`): cuando hay versión nueva, toast persistente "Hay una versión nueva de Hogaria" con acción "Actualizar" (llama a `updateSW(true)`).
- [ ] `sw.js` se sirve con `Cache-Control: no-cache` (regla en `_headers`, HOG-020).

**Notas técnicas**
- Los manejadores `push` y `notificationclick` los añade HOG-600 en el mismo `sw.ts`.

**Tests**
- Unit: componente del aviso (aparece con `needRefresh = true`).
- Integración: —
- E2E: —

---

### HOG-016 · Generar la documentación OpenAPI desde los esquemas zod (solo desarrollo)

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-006
- **Spec:** `docs/04-api-y-tiempo-real.md#convenciones-rest`

**Descripción**
Servir en `/api/docs` (solo con `NODE_ENV=development`) un OpenAPI generado a partir de los esquemas zod que usan los controladores.

**Criterios de aceptación**
- [ ] Decorador `@ApiContract({ body?, query?, params?, response })` que registra los esquemas zod de cada ruta.
- [ ] `/api/docs` muestra Swagger UI con las rutas registradas; en producción y test responde 404.
- [ ] Añadir un endpoint nuevo con el decorador lo hace aparecer sin más pasos.

**Notas técnicas**
- `zod-openapi` (o equivalente compatible con la versión de zod fijada).

**Tests**
- Unit: —
- Integración: `/api/docs` 404 con `NODE_ENV=test`.
- E2E: —

---

### HOG-020 · Desplegar el frontend en Cloudflare Pages con DNS en Netlify y `_headers`/`_redirects`

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** infra
- **Depende de:** HOG-005, HOG-023
- **Spec:** `docs/06-despliegue.md#frontend-cloudflare-pages` · `docs/03-seguridad.md#protecciones-web`

**Descripción**
Publicar `apps/web` en Cloudflare Pages desde GitHub, enlazar `hogaria.obaiges.com` con un CNAME en Netlify DNS y servir las cabeceras de seguridad y la regla de SPA.

**Criterios de aceptación**
- [ ] Proyecto de Pages con build `pnpm install --frozen-lockfile && pnpm --filter web build`, salida `apps/web/dist` y variables `VITE_API_URL` y `VITE_VAPID_PUBLIC_KEY`.
- [ ] `apps/web/public/_headers` con la CSP exacta de `docs/03-seguridad.md`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=()` y `Cache-Control: no-cache` para `/sw.js`.
- [ ] `apps/web/public/_redirects` con `/* /index.html 200`.
- [ ] CNAME `hogaria` → `<proyecto>.pages.dev` en Netlify DNS y dominio personalizado activo con HTTPS.
- [ ] `https://hogaria.obaiges.com/g/x/compra` carga la SPA (no 404) y las cabeceras se ven en la respuesta.
- [ ] `docs/06-despliegue.md` actualizado con la fecha de comprobación de límites.

**Notas técnicas**
- Las vistas previas de rama de Pages no tienen API: no se usan para probar.

**Tests**
- Unit: —
- Integración: —
- E2E: comprobación manual documentada (`curl -I`).

---

### HOG-021 · Aprovisionar la VM de Oracle con Docker y Caddy y desplegar la API a mano

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P1 · **Puntos:** 5
- **Capa:** infra
- **Depende de:** HOG-003, HOG-023
- **Spec:** `docs/06-despliegue.md#api-vm-oracle` · ADR-007

**Descripción**
Crear la imagen Docker de la API, el compose de producción con Caddy y el `deploy/README.md` con el paso a paso de aprovisionamiento, y desplegar la API en `api.hogaria.obaiges.com`.

**Criterios de aceptación**
- [ ] `deploy/Dockerfile.api` multi-stage (build con pnpm → `node:lts-slim`, usuario no root, `HEALTHCHECK` contra `/api/v1/health`), que ejecuta `prisma migrate deploy` (con `DIRECT_URL`) antes de arrancar.
- [ ] `deploy/docker-compose.prod.yml` con servicios `api` (puerto interno 3000, `restart: unless-stopped`, `env_file: .env`) y `caddy` (80/443, volúmenes de datos).
- [ ] `deploy/Caddyfile`: `api.hogaria.obaiges.com { reverse_proxy api:3000 }` (WebSocket incluido).
- [ ] `deploy/README.md` con los pasos 1–6 de `docs/06-despliegue.md` detallados (VCN, `iptables`, Docker, usuario `deploy`, `.env` con permisos 600, `unattended-upgrades`, `fail2ban`, SSH solo con clave) y cómo desplegar una versión a mano.
- [ ] Registro A `api.hogaria` en Netlify DNS; `https://api.hogaria.obaiges.com/api/v1/health` responde 200 con certificado válido.
- [ ] El socket conecta en `wss://api.hogaria.obaiges.com/realtime` (comprobado cuando exista HOG-150).

**Notas técnicas**
- ARM (Ampere A1): construye la imagen para `linux/arm64` (o multi-arch).
- Corrige en `docs/06-despliegue.md` la referencia "ticket HOG-022" → "HOG-021".

**Tests**
- Unit: —
- Integración: —
- E2E: comprobación manual documentada en el README.

---

### HOG-022 · Automatizar el despliegue continuo de la API (GHCR + SSH)

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P2 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-012, HOG-021
- **Spec:** `docs/06-despliegue.md#despliegue-continuo`

**Descripción**
Añadir el job `deploy` a GitHub Actions: en `main`, tras `checks` y `e2e`, construir y publicar la imagen en GHCR y actualizar la VM por SSH.

**Criterios de aceptación**
- [ ] Job `deploy` solo en `main`, `needs: [checks, e2e]`, construye `linux/arm64`, publica `ghcr.io/<owner>/hogaria-api:<sha>` y `:latest`.
- [ ] Se conecta por SSH (clave en secretos de GitHub) como `deploy`, ejecuta `docker compose pull && docker compose up -d` en la VM y comprueba `/api/v1/health` con reintentos.
- [ ] Si la comprobación falla, el job falla y el README explica cómo volver a la imagen anterior (`:<sha>` previo).
- [ ] `deploy/README.md` documenta los secretos necesarios (`VM_HOST`, `VM_SSH_KEY`, `GHCR_TOKEN` si aplica).

**Notas técnicas**
- El frontend se despliega solo con la integración de Cloudflare Pages (HOG-020).

**Tests**
- Unit: —
- Integración: —
- E2E: un despliegue real en verde.

---

### HOG-023 · Configurar los servicios externos: Neon, Google OAuth y Resend

- **Épica:** E00 · **Fase:** 0 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** infra
- **Depende de:** —
- **Spec:** `docs/06-despliegue.md#servicios-y-límites-gratuitos` · `#google-oauth-google-cloud-console` · `#neon`

**Descripción**
Dar de alta los servicios gratuitos externos y dejar una lista de comprobación con lo que se ha hecho, sin secretos en el repositorio.

**Criterios de aceptación**
- [ ] Neon: proyecto "hogaria" en región UE (Frankfurt), BBDD `hogaria`, rama `main`; cadenas *pooled* (`DATABASE_URL`) y *direct* (`DIRECT_URL`) guardadas fuera del repo.
- [ ] Google Cloud: pantalla de consentimiento externa en "Producción", scopes `openid email profile`, cliente OAuth web con los orígenes y URIs de redirección de `docs/06-despliegue.md`.
- [ ] Resend: dominio `hogaria.obaiges.com` verificado con los registros SPF/DKIM en Netlify DNS; `EMAIL_FROM` probado con un envío real.
- [ ] `deploy/CHECKLIST-servicios.md` con cada paso marcado, la fecha y dónde está guardado cada secreto (gestor de contraseñas), **sin** valores.
- [ ] La tabla de límites de `docs/06-despliegue.md` se actualiza con lo comprobado y la fecha.

**Notas técnicas**
- La cuenta de Oracle y las claves VAPID/Gemini se crean en HOG-021, HOG-600 y HOG-650 respectivamente.

**Tests**
- Unit: —
- Integración: —
- E2E: —
