# E00 Â· Fundaciones

> Rango: HOG-001 â€“ HOG-049 Â· Fase 0 Â· Sin spec propia: se basa en `docs/01-arquitectura.md`, `docs/06-despliegue.md`, `docs/07-testing.md`, `docs/08-convenciones.md`, `docs/03-seguridad.md` y `DESIGN.md`.
> Bloques: HOG-001â€“019 repositorio, paquetes y calidad Â· HOG-020â€“029 infraestructura y despliegue.
> Nota: `docs/06-despliegue.md` cita "HOG-022" para `deploy/README.md`; el aprovisionamiento manual y ese README son **HOG-021**, y HOG-022 es el despliegue continuo.

---

### HOG-001 Â· Crear el monorepo con pnpm, Turborepo y configuraciÃ³n compartida

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** â€”
- **Spec:** `docs/01-arquitectura.md#monorepo` Â· `docs/08-convenciones.md`

**DescripciÃ³n**
Crear la base del repositorio: workspaces de pnpm, Turborepo, TypeScript estricto compartido, ESLint (flat config) y Prettier, para que todos los paquetes compilen y se revisen igual desde el primer dÃ­a.

**Criterios de aceptaciÃ³n**
- [x] Existen `package.json` raÃ­z (con `packageManager` fijado), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` y `.nvmrc` con la Node LTS vigente.
- [x] `packages/config` exporta `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `moduleResolution: "bundler"` o `"nodenext"` segÃºn paquete), `eslint.config.js` y `prettier.config.js`.
- [x] Reglas de ESLint activas: `@typescript-eslint/no-explicit-any` (error), `react/no-danger` (error), orden de imports y prohibiciÃ³n de `console.log` (se permite `console.debug` y `console.warn`).
- [x] Scripts raÃ­z: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm db:migrate`, `pnpm db:seed` delegan en Turborepo o en el filtro correspondiente (pueden fallar con "sin paquetes" hasta que existan las apps).
- [x] `.gitignore` incluye `node_modules`, `dist`, `.turbo`, `coverage`, `playwright-report`, `test-results` y `.env*` salvo `.env.example`. `.editorconfig` presente.
- [x] Las versiones exactas elegidas (Node, pnpm, TypeScript, React, Vite, NestJS, Prisma, Better Auth, Socket.IO, TanStack Query, Tailwind, Playwright, Vitest) se anotan en `docs/01-arquitectura.md#stack-y-versiones-objetivo`.
- [x] `pnpm lint && pnpm typecheck` pasan en el repo vacÃ­o.

**Notas tÃ©cnicas**
- Alias de imports `@/` por app y `@hogaria/shared` (workspace `workspace:*`).
- Turborepo: `build` depende de `^build`; `lint`, `typecheck` y `test` cacheables; `dev` persistente sin cachÃ©.
- No aÃ±adas Husky todavÃ­a (opcional en E17).

**Tests**
- Unit: â€”
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-002 Â· Crear `packages/shared` con dinero, fechas, errores, constantes y tipos de tiempo real

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 5
- **Capa:** shared
- **Depende de:** HOG-001
- **Spec:** `docs/01-arquitectura.md#paquete-compartido--packagesshared` Â· `docs/04-api-y-tiempo-real.md` Â· `docs/specs/03-tiempo-real-actividad.md#3-reglas-de-negocio`

**DescripciÃ³n**
Crear el paquete `@hogaria/shared` que importan web y API: utilidades puras de dinero y fechas en la zona del grupo, cÃ³digos de error con sus mensajes en espaÃ±ol, constantes de dominio y los tipos base del sobre de tiempo real.

**Criterios de aceptaciÃ³n**
- [x] `src/money.ts`: `formatMoney(cents)` â†’ `"12,34 â‚¬"` / `"1.234,00 â‚¬"` (con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })`) y `parseMoney("12,34")` â†’ `1234` (acepta `12`, `12,3`, `12.345,67`; rechaza negativos y mÃ¡s de 2 decimales devolviendo `null`).
- [x] `src/dates.ts` (con `date-fns` + `@date-fns/tz`): `todayInZone(tz)`, `toZonedDay(instant, tz)` â†’ `"YYYY-MM-DD"`, `zonedDayToUtcRange(day, tz)`, `startOfWeekInZone(day, tz)` (lunes), `formatDayShort` â†’ `"miÃ© 11 nov"`, `formatTimeRange` â†’ `"08:00â€“15:00"`, `formatRelative` â†’ `"hace 5 min"` (nunca negativo). `DEFAULT_TIMEZONE = 'Europe/Madrid'`.
- [x] `src/errors.ts`: `ERROR_CODES` con exactamente los cÃ³digos de `docs/04-api-y-tiempo-real.md`, mapa `ERROR_STATUS`, `ERROR_MESSAGES_ES` (un mensaje por cÃ³digo, p. ej. `NOT_FOUND` â†’ "No encontrado", `INTERNAL` â†’ "Algo ha fallado. IntÃ©ntalo de nuevo"), tipo `ErrorCode` y `problemDetailsSchema` (zod de RFC 9457 con `code` y `errors[]`).
- [x] `src/constants/`: `LANE_COLOR_ORDER`, `DEFAULT_EXPENSE_CATEGORIES` (las 9 de `docs/02-modelo-datos.md` con emoji), `INVITE_TTL_DAYS = 10`, `MAX_GROUP_MEMBERS = 20`, etiquetas ES de `Aisle`, `MealSlot`, `Allergen`, `Diet` y `UNITS` (valores de los comentarios de `docs/02-modelo-datos.md`), todas `as const`.
- [x] `src/realtime.ts`: `REALTIME_CHANNEL = 'evt'`, `REALTIME_EVENTS` con **todos** los nombres de la tabla de `docs/04`, `RealtimeEventName`, `RealtimeEnvelope<T>` (con `groupId: string | null`, ver `docs/04-api-y-tiempo-real.md`) y un `RealtimeEventDataMap` vacÃ­o extensible (lo rellena HOG-151 y cada Ã©pica).
- [x] `src/schemas/pagination.ts`: `cursorQuery` y `paginated(itemSchema)` (spec 03 Â§5).
- [x] El paquete compila a ESM con tipos (`tsup`), con `exports` para `.` y subrutas futuras, y web y api lo importan como `@hogaria/shared`.
- [x] Cobertura de lÃ­neas â‰¥ 80 %.

**Notas tÃ©cnicas**
- Nada de dependencias de Node ni del DOM: solo funciones puras (se usa en navegador y servidor).
- Las uniones de string sustituyen a los enums de Prisma en la web (`docs/08-convenciones.md#typescript`); cuando exista HOG-004, aÃ±ade un test que compare `LANE_COLOR_ORDER` con el enum `LaneColor` del cliente de Prisma.
- `normalizeProductName` y demÃ¡s utilidades de mÃ³dulos las aÃ±ade su Ã©pica.

**Tests**
- Unit: `money.spec.ts` (redondeo, miles, formatos invÃ¡lidos), `dates.spec.ts` (cambio de hora de marzo y octubre en `Europe/Madrid`, `Atlantic/Canary`, inicio de semana en lunes), `errors.spec.ts` (todo cÃ³digo tiene mensaje y status), `realtime.spec.ts` (instantÃ¡nea de `REALTIME_EVENTS`).
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-003 Â· Crear el esqueleto de `apps/api` con NestJS, Prisma, Postgres local y `/health`

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-001, HOG-002
- **Spec:** `docs/01-arquitectura.md#backend--appsapi` Â· `docs/06-despliegue.md#variables-de-entorno`

**DescripciÃ³n**
Arrancar la API NestJS (adaptador Express) con configuraciÃ³n validada, logs estructurados, conexiÃ³n Prisma y la base de datos local en Docker, con los dos endpoints de salud.

**Criterios de aceptaciÃ³n**
- [x] `apps/api/src/main.ts` crea la app con prefijo global `/api/v1`, `bodyParser: false` (el parser JSON se aÃ±ade despuÃ©s de montar Better Auth en HOG-050) y escucha en `PORT`.
- [x] `src/config/env.ts` valida `process.env` con zod (variables de `docs/06-despliegue.md`; las de servicios aÃºn no usados son opcionales) y la app no arranca si falta una obligatoria, indicando cuÃ¡l.
- [x] `nestjs-pino` con `requestId` por peticiÃ³n y redacciÃ³n de `authorization`, `cookie` y `set-cookie`.
- [x] `src/prisma/prisma.service.ts` y `PrismaModule` global; `prisma/schema.prisma` con solo `datasource` y `generator` (el esquema llega en HOG-004).
- [x] `docker-compose.yml` raÃ­z con `db` (`postgres:17`, puerto 5432, BBDD `hogaria`, volumen) y `db-test` (`postgres:17`, puerto 5433, BBDD `hogaria_test`, `tmpfs`).
- [x] `GET /api/v1/health` â†’ `200 { status: "ok" }` **sin** tocar la BBDD; `GET /api/v1/health/db` â†’ `200 { status: "ok" }` con `SELECT 1` (o `503` si falla).
- [x] `pnpm dev` levanta `db` y la API en modo watch; `apps/api/.env.example` copiado de `docs/06-despliegue.md` con `DATABASE_URL`/`DIRECT_URL` locales.

**Notas tÃ©cnicas**
- Usa `@nestjs/config` solo como contenedor; la validaciÃ³n es el esquema zod.
- `GET /health` se marcarÃ¡ `@Public()` cuando exista el `AuthGuard` (HOG-055).

**Tests**
- Unit: `env.spec.ts` (falta `DATABASE_URL` â†’ error legible).
- IntegraciÃ³n: `health.int.spec.ts` (`/health` responde sin BBDD configurada; `/health/db` con la BBDD de test).
- E2E: â€”

---

### HOG-004 Â· Escribir el esquema Prisma completo y la primera migraciÃ³n

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-003
- **Spec:** `docs/02-modelo-datos.md`

**DescripciÃ³n**
Trasladar el esquema canÃ³nico de `docs/02-modelo-datos.md` a `apps/api/prisma/schema.prisma` con todos los `@map`/`@@map` a `snake_case`, y generar la migraciÃ³n inicial con el Ã­ndice Ãºnico parcial de `budgets`.

**Criterios de aceptaciÃ³n**
- [x] Todos los modelos, enums, relaciones, Ã­ndices y `@@unique` de `docs/02-modelo-datos.md` estÃ¡n en el schema, con columnas en `snake_case` (`@map`) y tablas en plural (`@@map`).
- [x] Los IDs son `@default(uuid(7)) @db.Uuid` y los instantes `@db.Timestamptz(3)`; los dÃ­as `@db.Date`.
- [x] La migración `0001_init` incluye a mano `CREATE UNIQUE INDEX budgets_group_user_total_key ON budgets("groupId", "userId") WHERE "categoryId" IS NULL;`.
- [x] `pnpm db:migrate` (`prisma migrate deploy`) aplica la migración en la BBDD local y `prisma migrate reset --force` funciona contra `hogaria_test`.
- [x] Un test comprueba que los nombres de modelos y enums del cliente generado coinciden con una lista esperada (detecta divergencias con el documento).

**Notas tÃ©cnicas**
- Las tablas de Better Auth deben coincidir con lo que espera su adaptador de Prisma; si `npx @better-auth/cli generate` propone diferencias de campos, gana `docs/02-modelo-datos.md` y se ajusta la configuraciÃ³n de Better Auth (`fields` mapping) en HOG-050.
- Si Prisma no soporta `uuid(7)` en la versiÃ³n fijada, usa `@default(dbgenerated(...))` o genera en la aplicaciÃ³n y anÃ³talo en `docs/02-modelo-datos.md`.

**Tests**
- Unit: â€”
- IntegraciÃ³n: `schema.int.spec.ts` (migraciÃ³n aplicada; insertar dos `Budget` totales del mismo usuario y grupo falla por el Ã­ndice parcial).
- E2E: â€”

---

### HOG-005 Â· Crear el esqueleto de `apps/web` (Vite, React, Router, Query, Tailwind v4 y PWA)

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-001, HOG-002
- **Spec:** `docs/01-arquitectura.md#frontend--appsweb` Â· `DESIGN.md` Â§11

**DescripciÃ³n**
Arrancar la SPA con React 19, React Router en modo *data*, TanStack Query, Tailwind CSS v4 y vite-plugin-pwa en modo `injectManifest`, con manifest e iconos generados desde el logo.

**Criterios de aceptaciÃ³n**
- [ ] `apps/web` con Vite + React + TypeScript; estructura de carpetas de `docs/01-arquitectura.md#estructura-del-monorepo` (`app/`, `components/ui/`, `components/pool/`, `features/`, `lib/`, `styles/`).
- [ ] `app/router.tsx` con `createBrowserRouter` y rutas placeholder para todas las de `docs/08-convenciones.md#rutas-de-la-pwa-espaÃ±ol-fijadas` (cada una renderiza su tÃ­tulo).
- [ ] `app/providers/QueryProvider.tsx` con `QueryClient` (`staleTime` 30 s, `retry` 1 en queries, `networkMode: 'always'` en mutaciones).
- [ ] Tailwind v4 con `@tailwindcss/vite`; `styles/index.css` importa `styles/tokens.css` (vacÃ­o hasta HOG-007).
- [ ] vite-plugin-pwa (`strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`) con `sw.ts` mÃ­nimo que precachea el *shell*; manifest con `name: "Hogaria"`, `short_name: "Hogaria"`, `lang: "es"`, `display: "standalone"`, `start_url: "/"`, `theme_color` y `background_color` de `DESIGN.md` Â§11.
- [ ] Iconos 192, 512, 512 *maskable* y `apple-touch-icon` 180 en `public/`, generados desde `docs/design/logo.svg` (fondo opaco del token indicado en `DESIGN.md` Â§11).
- [ ] Proxy de Vite: `/api` y `/realtime` (con `ws: true`) â†’ `http://localhost:3000`.
- [ ] `apps/web/.env.example` segÃºn `docs/06-despliegue.md`. `pnpm --filter web build` genera `dist/` sin errores.

**Notas tÃ©cnicas**
- `lang="es"` en `index.html` y `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- El push del service worker es de E12 (HOG-600); el aviso de nueva versiÃ³n es HOG-015.

**Tests**
- Unit: `router.spec.tsx` (cada ruta fijada existe).
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-006 Â· Implementar el manejo global de errores y el `apiClient` web con `X-Client-Mutation-Id`

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-002, HOG-003, HOG-005
- **Spec:** `docs/04-api-y-tiempo-real.md#formato-de-error-rfc-9457-applicationproblemjson` Â· `docs/specs/03-tiempo-real-actividad.md` (RN-03-10, RN-03-16)

**DescripciÃ³n**
Unificar errores y contexto de peticiÃ³n: en la API, `AppError` convertido a `application/problem+json`, `ZodValidationPipe` y un `RequestContext` con el usuario y el `clientMutationId`; en la web, un `apiClient` que envÃ­a la cabecera de mutaciÃ³n y traduce los errores a espaÃ±ol.

**Criterios de aceptaciÃ³n**
- [ ] `apps/api/src/common/errors/app-error.ts`: `new AppError(code: ErrorCode, detail?, errors?)`.
- [ ] `common/filters/problem-details.filter.ts` (global) convierte `AppError`, `ZodError`, `HttpException` (incluido `ThrottlerException` â†’ `RATE_LIMITED` con `Retry-After`) y errores desconocidos (`INTERNAL`, sin detalles ni stack) a problem+json con `type`, `title` (de `ERROR_MESSAGES_ES`), `status`, `code`, `detail?`, `errors?`.
- [ ] `common/pipes/zod-validation.pipe.ts`: `@Body(new ZodValidationPipe(schema))` y equivalente para `@Query`/`@Param`; fallo â†’ `422 VALIDATION_ERROR` con `errors[{ path, message }]`.
- [ ] `common/context/request-context.ts` (AsyncLocalStorage) con `requestId`, `userId`, `userName`, `sessionId` y `clientMutationId` (cabecera `X-Client-Mutation-Id` si es UUID vÃ¡lido; si no, `null`); middleware global que lo inicializa.
- [ ] `apps/web/src/lib/apiClient.ts`: `api.get/post/patch/put/delete<T>(path, { body?, schema? })` con `credentials: 'include'`, base `VITE_API_URL + '/api/v1'`, aÃ±ade `X-Client-Mutation-Id` (`crypto.randomUUID()`) a toda mutaciÃ³n y lo registra en `lib/realtime/mutation-registry.ts` (stub hasta HOG-152) **antes** de enviar; si se pasa `schema`, valida la respuesta en desarrollo.
- [ ] Errores: lanza `ApiError { status, code, detail, errors }` y `ApiError.message` sale de `ERROR_MESSAGES_ES`. `401` â†’ limpia la cachÃ© y navega a `/entrar?volver=â€¦`. Error de red â†’ `NetworkError` con "No hay conexiÃ³n con el servidor".

**Notas tÃ©cnicas**
- El bloqueo de mutaciones sin conexiÃ³n (`OfflineError`) lo aÃ±ade HOG-155.
- `GET` nunca lleva `X-Client-Mutation-Id`.

**Tests**
- Unit (api): filtro con cada tipo de error; pipe con un esquema de ejemplo; contexto con cabecera vÃ¡lida, invÃ¡lida y ausente.
- Unit (web): `apiClient` con MSW (cabecera presente en mutaciones y ausente en GET; mapeo de `code` a mensaje; redirecciÃ³n en 401).
- IntegraciÃ³n: endpoint de prueba que lanza `AppError('NOT_FOUND')` devuelve problem+json.
- E2E: â€”

---

### HOG-007 Â· Aplicar los tokens de diseÃ±o, las fuentes Barlow autoalojadas y el tema claro/oscuro

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-005
- **Spec:** `DESIGN.md` Â§3â€“Â§6 y Â§11 Â· ADR-016

**DescripciÃ³n**
Llevar el sistema "Piscina municipal" a la web: tokens CSS de `docs/design/tokens.css`, tipografÃ­as Barlow y Barlow Condensed servidas desde el propio dominio, tema claro/oscuro y logos con el texto convertido a trazados.

**Criterios de aceptaciÃ³n**
- [ ] `apps/web/src/styles/tokens.css` contiene los tokens de `docs/design/tokens.css` (colores, `--lane-*`, `--rope-*`, tipografÃ­a, radios, `--ease-water`) sin valores inventados; Tailwind v4 los expone con `@theme`.
- [ ] `@fontsource/barlow` (pesos que indique `DESIGN.md` Â§4) y `@fontsource/barlow-condensed` (500 y 600) importados localmente; ninguna peticiÃ³n a Google Fonts.
- [ ] Modo oscuro por `prefers-color-scheme` y forzable con `data-theme="light|dark"` en `<html>`; `lib/theme.ts` guarda la preferencia (`'system' | 'light' | 'dark'`) en `localStorage` con `try/catch`.
- [ ] `<meta name="theme-color">` cambia con el tema.
- [ ] `docs/design/logo-horizontal.svg` y `-dark.svg` tienen el texto "HOGARIA" convertido a trazados (`DESIGN.md` Â§11) y se copian a `apps/web/src/assets/`.
- [ ] PÃ¡gina `/dev/tokens` (solo en desarrollo) que muestra colores, calles, tipografÃ­a y escala, para revisiÃ³n visual en 375 px y en oscuro.

**Notas tÃ©cnicas**
- `font-display: swap`. Inputs a 16 px (evita el zoom de iOS).
- Si `DESIGN.md` y `docs/design/tokens.css` difieren, gana `DESIGN.md` y se corrige `tokens.css`.

**Tests**
- Unit: `theme.spec.ts` (preferencia guardada; `localStorage` que lanza no rompe).
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-008 Â· Adaptar los componentes UI base de shadcn al sistema "Piscina municipal"

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-007
- **Spec:** `DESIGN.md` Â§8 y Â§9

**DescripciÃ³n**
Crear los componentes base en `apps/web/src/components/ui/` a partir de shadcn/ui (Radix), con las variantes, tamaÃ±os y estados de `DESIGN.md`, accesibles y listos para modo oscuro.

**Criterios de aceptaciÃ³n**
- [ ] Componentes: `Button` (`primary`, `secondary`, `ghost`, `danger`; estado `loading`; prop `requiresConnection` preparada, sin efecto hasta HOG-155), `Input`, `Textarea`, `Select`, `Checkbox`, `Chip`, `Sheet`, `Dialog`, `Tabs`/`SegmentedControl`, `Toast` (con acciÃ³n "Deshacer" de 5 s), `Skeleton`, `EmptyState`, `ErrorState` (con `onRetry` opcional) y `FormField` (label visible + mensaje de error con `aria-describedby`).
- [ ] Alturas, radios y tipografÃ­a segÃºn `DESIGN.md` Â§5 y Â§8; objetivos tÃ¡ctiles â‰¥ 44 px; foco visible con el token de anillo.
- [ ] `Skeleton` sin pulso con `prefers-reduced-motion`.
- [ ] PÃ¡gina `/dev/ui` (solo desarrollo) con todos los componentes y estados, en claro y oscuro.

**Notas tÃ©cnicas**
- `AppHeader`, `BottomNav` y `Fab` son de HOG-750; `OfflineBanner` es de HOG-155.
- `Toast` con un *store* simple (Zustand) y `useToast()`; regiÃ³n `aria-live="polite"`.

**Tests**
- Unit: componentes con Testing Library (Button `loading` deshabilita, Dialog atrapa el foco y cierra con Escape, `FormField` enlaza el error, `ErrorState` llama a `onRetry`).
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-009 Â· Crear los componentes firma de la piscina y la animaciÃ³n de onda

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-008
- **Spec:** `DESIGN.md` Â§6 y Â§7 Â· `docs/design/mock-inicio.html`

**DescripciÃ³n**
Crear `Lane`, `LaneRope`, `DepthFigure`, `MemberDot`/`MemberAvatar` y la animaciÃ³n `ripple` en `apps/web/src/components/pool/`, que el resto de mÃ³dulos reutilizarÃ¡n.

**Criterios de aceptaciÃ³n**
- [ ] `Lane` con props `member`, `children`, `onPress?`, `highlight?: 'ripple'`, borde de 4 px y tinte del color de calle, `role="group"` y `aria-label="Calle de {nombre}"`.
- [ ] `LaneRope` (`variant: 'default' | 'limit'`), decorativa con `aria-hidden`.
- [ ] `DepthFigure` (`size: 's' | 'l'`, `variant?: 'limit'`, `value`, `label`) con cifras tabulares.
- [ ] `MemberDot`/`MemberAvatar` (20, 28 y 36 px) con iniciales o foto, color por `LaneColor` y variante neutra (sin miembro: sistema, ex-miembro o "Usuario eliminado").
- [ ] Utilidad de animaciÃ³n `ripple` (clase CSS `.ripple` + `--ripple-color`) segÃºn `DESIGN.md` Â§6: 700 ms con barrido; con `prefers-reduced-motion`, solo cambio de fondo durante 1 s. Hook `useRippleClass(active, laneColor)` que la aplica a cualquier fila.
- [ ] `laneColorVar(color: LaneColor)` â†’ `var(--lane-coral)`â€¦ en `components/pool/lane-colors.ts`.
- [ ] `/dev/ui` muestra una reproducciÃ³n de `docs/design/mock-inicio.html` con estos componentes, en 375 px y oscuro.

**Notas tÃ©cnicas**
- CuÃ¡ndo se dispara la onda lo decide el tiempo real (HOG-152, `ripple-store`); aquÃ­ solo la presentaciÃ³n.

**Tests**
- Unit: `MemberDot` (iniciales de "Ana GarcÃ­a" â†’ "AG"; variante neutra), `Lane` (aria-label), `useRippleClass` (respeta `matchMedia('(prefers-reduced-motion: reduce)')`).
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-010 Â· Montar la infraestructura de tests unitarios y de integraciÃ³n

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 5
- **Capa:** infra
- **Depende de:** HOG-003, HOG-004
- **Spec:** `docs/07-testing.md`

**DescripciÃ³n**
Configurar Vitest en los tres paquetes, la BBDD de test con reseteo y truncado, *factories* y los *fakes* inyectables de Gemini, Web Push y email (Resend).

**Criterios de aceptaciÃ³n**
- [ ] Vitest en `packages/shared`, `apps/api` (unit `*.spec.ts` + integraciÃ³n `test/**/*.int.spec.ts` con `supertest`) y `apps/web` (jsdom + Testing Library + MSW).
- [ ] La integraciÃ³n usa `hogaria_test` (puerto 5433): `globalSetup` ejecuta `prisma migrate reset --force --skip-seed` una vez por ejecuciÃ³n y cada test trunca las tablas (`TRUNCATE â€¦ RESTART IDENTITY CASCADE` generado desde el esquema).
- [ ] `apps/api/test/utils/create-test-app.ts` arranca la app Nest con proveedores sustituibles.
- [ ] Factories en `apps/api/test/factories/`: `createUser({ verified?, password?, isPlatformAdmin?, blockedAt? })`, `createGroupWithMembers(n)`, `createInvite(groupId, { status? })`, `loginAs(user)` â†’ agente supertest con cookie (operativo desde HOG-050; hasta entonces lanza "Not implemented").
- [ ] Interfaces + *fakes*: `EmailSender` (`FakeEmailSender` guarda los emails en memoria con `to`, `subject`, `text`, `html`, `links`), `PushSender` (`FakeWebPushSender` registra envÃ­os), `GeminiClient` (`FakeGeminiClient` lee `test/fixtures/ai/*.json`). Se registran con *tokens* de Nest para cambiarlos por configuraciÃ³n (`NODE_ENV=test`).
- [ ] Umbral de cobertura del 80 % de lÃ­neas en `packages/shared/src/**` y `apps/api/src/**/*.service.ts`; `pnpm test` falla si baja.

**Notas tÃ©cnicas**
- Usa el reloj falso de Vitest (`vi.useFakeTimers`) para caducidades; documenta en `docs/07-testing.md` cualquier helper nuevo.
- Los tests de integraciÃ³n se ejecutan en serie (`pool: 'forks'`, `singleFork`) para no pisarse en la BBDD.

**Tests**
- Unit: test de humo de cada *fake*.
- IntegraciÃ³n: test de humo que crea un usuario con la factory y comprueba el truncado entre tests.
- E2E: â€”

---

### HOG-011 Â· Configurar Playwright con mÃ³viles, helpers de login y doble contexto

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-003, HOG-005, HOG-010
- **Spec:** `docs/07-testing.md#flujos-crÃ­ticos-e2e-obligatorios`

**DescripciÃ³n**
Preparar los e2e en `apps/web/e2e/` con los proyectos Mobile Chrome (Pixel 7) y Mobile Safari (iPhone 14), arranque automÃ¡tico de web y API contra la BBDD de test, endpoints de soporte solo para test y helpers reutilizables.

**Criterios de aceptaciÃ³n**
- [ ] `playwright.config.ts` con proyectos `Pixel 7` y `iPhone 14`, `webServer` que levanta API (`NODE_ENV=test`, BBDD `hogaria_test`) y web, trazas `on-first-retry`.
- [ ] `apps/api/src/test-support/` (mÃ³dulo cargado **solo** si `NODE_ENV=test`): `GET /api/v1/test/emails?to=` (emails del `FakeEmailSender`), `POST /api/v1/test/reset` (trunca tablas), `POST /api/v1/test/users` (crea usuario verificado con contraseÃ±a y, opcionalmente, un grupo; devuelve ids). Test de integraciÃ³n que comprueba que no existen con `NODE_ENV=production`.
- [ ] Helpers en `apps/web/e2e/helpers/`: `resetDb()`, `createUser()`, `loginAs(page, user)` (vÃ­a UI o cookie de la API), `lastEmailLink(to)`, `twoMembers(browser)` â†’ `{ a: { page, user }, b: { page, user }, groupId }` con dos contextos independientes.
- [ ] `pnpm test:e2e` ejecuta un test de humo que abre `/` en ambos proyectos.

**Notas tÃ©cnicas**
- `POST /test/users` usa el mismo hash que Better Auth (`hashPassword` de `better-auth/crypto`) para que el login real funcione.
- Viewports de los dispositivos de Playwright; nada de tamaÃ±os a mano.

**Tests**
- Unit: â€”
- IntegraciÃ³n: `test-support` deshabilitado fuera de test.
- E2E: humo.

---

### HOG-012 Â· Configurar CI en GitHub Actions

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P1 Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-001, HOG-010, HOG-011
- **Spec:** `docs/07-testing.md#ci-github-actions`

**DescripciÃ³n**
Crear `.github/workflows/ci.yml` con los trabajos `checks` y `e2e` en cada push y pull request, y la auditorÃ­a de dependencias.

**Criterios de aceptaciÃ³n**
- [ ] Job `checks`: `pnpm install --frozen-lockfile` â†’ `lint` â†’ `typecheck` â†’ `test` (con servicio `postgres:17` en el puerto 5433 y `hogaria_test`), con cachÃ© de pnpm y Turborepo.
- [ ] Job `e2e` (`needs: checks`): instala navegadores de Playwright, construye web y API y ejecuta `pnpm test:e2e`; si falla, sube `playwright-report` y trazas como artefactos.
- [ ] Paso `pnpm audit --audit-level=high` (no bloqueante al principio: `continue-on-error: true`, anotado).
- [ ] Dependabot (`.github/dependabot.yml`) semanal para npm y GitHub Actions.
- [ ] Ninguna clave real en el workflow: los tests usan los *fakes*.

**Notas tÃ©cnicas**
- El job `deploy` lo aÃ±ade HOG-022.
- LÃ­mite de 2 000 min/mes en repos privados (`docs/06-despliegue.md`): `concurrency` cancela ejecuciones anteriores de la misma rama.

**Tests**
- Unit: â€”
- IntegraciÃ³n: â€”
- E2E: el propio workflow en verde en un PR de prueba.

---

### HOG-013 Â· Crear el seed mÃ­nimo de desarrollo (`pnpm db:seed`)

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P2 Â· **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-004
- **Spec:** `docs/02-modelo-datos.md#datos-semilla-al-crear-un-grupo`

**DescripciÃ³n**
Crear `apps/api/prisma/seed.ts` con el **seed mÃ­nimo** para el desarrollo local: el usuario dueÃ±o de la instancia y un hogar con 2 miembros y su semilla, para probar la app sin pasar por invitaciones. Los datos de demo de todos los mÃ³dulos los aÃ±ade HOG-865 ampliando este mismo script.

**Criterios de aceptaciÃ³n**
- [ ] Crea el usuario dueÃ±o `ana@demo.local` (`ana`, `isPlatformAdmin = true`) y un segundo usuario `oscar@demo.local` (`oscar`), ambos con contraseÃ±a `hogaria-demo-1234`, `emailVerified = true` y cuenta `credential`.
- [ ] Crea el hogar "Casa Demo" ðŸ  con ambos miembros (CORAL y SEA), la lista "Compra" y las 9 categorÃ­as de gasto.
- [ ] Es idempotente (si existen, no duplica) y se niega a ejecutarse con `NODE_ENV=production`.
- [ ] No crea datos de mÃ³dulos (compra, tareas, recetasâ€¦): eso es HOG-865.
- [ ] El script queda estructurado en funciones (`seedUsers()`, `seedGroup()`) para que HOG-865 aÃ±ada `seedModules()` sin reescribirlo.

**Notas tÃ©cnicas**
- Hash con `hashPassword` de `better-auth/crypto`. Nada de secretos reales.

**Tests**
- Unit: â€”
- IntegraciÃ³n: ejecutar el seed dos veces deja 2 usuarios y 1 grupo.
- E2E: â€”

---

### HOG-014 Â· Aplicar las protecciones base de la API (helmet, CORS, Origin y throttler)

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P0 Â· **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-003, HOG-006
- **Spec:** `docs/03-seguridad.md#protecciones-web`

**DescripciÃ³n**
AÃ±adir las cabeceras de seguridad, el CORS estricto con credenciales, la comprobaciÃ³n de `Origin` en mÃ©todos no GET y el *rate limiting* general de 120 peticiones por minuto y usuario.

**Criterios de aceptaciÃ³n**
- [ ] `helmet` activo en la API.
- [ ] CORS: solo `APP_URL` (y `http://localhost:5173` si `NODE_ENV=development`), `credentials: true`, cabecera `X-Client-Mutation-Id` permitida.
- [ ] Middleware global: en `POST/PATCH/PUT/DELETE` bajo `/api/v1`, si la cabecera `Origin` existe y no estÃ¡ en la lista permitida â†’ `403` problem+json con `code: "FORBIDDEN_ORIGIN"` (ver nota).
- [ ] `@nestjs/throttler` global: 120 peticiones/min por usuario autenticado (o por IP si no hay sesiÃ³n) â†’ `429 RATE_LIMITED` con `Retry-After`; decorador para lÃ­mites especÃ­ficos por ruta.
- [ ] LÃ­mite de tamaÃ±o del cuerpo JSON: 1 MB.

**Notas tÃ©cnicas**
- NingÃºn cÃ³digo existente describe un origen no permitido: **aÃ±ade** `FORBIDDEN_ORIGIN` (403, "Origen no permitido") a `packages/shared/src/errors.ts` y a la tabla de cÃ³digos de `docs/04-api-y-tiempo-real.md` en el mismo PR (cambio canÃ³nico previsto).
- Better Auth hace su propia comprobaciÃ³n con `trustedOrigins` (HOG-050).

**Tests**
- Unit: â€”
- IntegraciÃ³n: `POST` con `Origin: https://evil.example` â†’ 403; preflight CORS desde `APP_URL` â†’ cabeceras correctas; 121.Âª peticiÃ³n en un minuto â†’ 429.
- E2E: â€”

---

### HOG-015 Â· Configurar el service worker del *shell* y el aviso de nueva versiÃ³n

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P1 Â· **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-005, HOG-008
- **Spec:** ADR-015 Â· `docs/01-arquitectura.md#frontend--appsweb`

**DescripciÃ³n**
Completar `sw.ts` para que solo precachee el *shell* (arranque rÃ¡pido, sin modo offline) y avisar al usuario cuando haya una versiÃ³n nueva.

**Criterios de aceptaciÃ³n**
- [ ] `sw.ts` usa `precacheAndRoute(self.__WB_MANIFEST)` y **no** cachea respuestas de `/api` ni de `/realtime`.
- [ ] Navegaciones a rutas de la SPA sirven `index.html` del precache.
- [ ] Registro con `virtual:pwa-register` (`registerType: 'prompt'`): cuando hay versiÃ³n nueva, toast persistente "Hay una versiÃ³n nueva de Hogaria" con acciÃ³n "Actualizar" (llama a `updateSW(true)`).
- [ ] `sw.js` se sirve con `Cache-Control: no-cache` (regla en `_headers`, HOG-020).

**Notas tÃ©cnicas**
- Los manejadores `push` y `notificationclick` los aÃ±ade HOG-600 en el mismo `sw.ts`.

**Tests**
- Unit: componente del aviso (aparece con `needRefresh = true`).
- IntegraciÃ³n: â€”
- E2E: â€”

---

### HOG-016 Â· Generar la documentaciÃ³n OpenAPI desde los esquemas zod (solo desarrollo)

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P2 Â· **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-006
- **Spec:** `docs/04-api-y-tiempo-real.md#convenciones-rest`

**DescripciÃ³n**
Servir en `/api/docs` (solo con `NODE_ENV=development`) un OpenAPI generado a partir de los esquemas zod que usan los controladores.

**Criterios de aceptaciÃ³n**
- [ ] Decorador `@ApiContract({ body?, query?, params?, response })` que registra los esquemas zod de cada ruta.
- [ ] `/api/docs` muestra Swagger UI con las rutas registradas; en producciÃ³n y test responde 404.
- [ ] AÃ±adir un endpoint nuevo con el decorador lo hace aparecer sin mÃ¡s pasos.

**Notas tÃ©cnicas**
- `zod-openapi` (o equivalente compatible con la versiÃ³n de zod fijada).

**Tests**
- Unit: â€”
- IntegraciÃ³n: `/api/docs` 404 con `NODE_ENV=test`.
- E2E: â€”

---

### HOG-020 Â· Desplegar el frontend en Cloudflare Pages con DNS en Netlify y `_headers`/`_redirects`

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P1 Â· **Puntos:** 2
- **Capa:** infra
- **Depende de:** HOG-005, HOG-023
- **Spec:** `docs/06-despliegue.md#frontend-cloudflare-pages` Â· `docs/03-seguridad.md#protecciones-web`

**DescripciÃ³n**
Publicar `apps/web` en Cloudflare Pages desde GitHub, enlazar `hogaria.obaiges.com` con un CNAME en Netlify DNS y servir las cabeceras de seguridad y la regla de SPA.

**Criterios de aceptaciÃ³n**
- [ ] Proyecto de Pages con build `pnpm install --frozen-lockfile && pnpm --filter web build`, salida `apps/web/dist` y variables `VITE_API_URL` y `VITE_VAPID_PUBLIC_KEY`.
- [ ] `apps/web/public/_headers` con la CSP exacta de `docs/03-seguridad.md`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=()` y `Cache-Control: no-cache` para `/sw.js`.
- [ ] `apps/web/public/_redirects` con `/* /index.html 200`.
- [ ] CNAME `hogaria` â†’ `<proyecto>.pages.dev` en Netlify DNS y dominio personalizado activo con HTTPS.
- [ ] `https://hogaria.obaiges.com/g/x/compra` carga la SPA (no 404) y las cabeceras se ven en la respuesta.
- [ ] `docs/06-despliegue.md` actualizado con la fecha de comprobaciÃ³n de lÃ­mites.

**Notas tÃ©cnicas**
- Las vistas previas de rama de Pages no tienen API: no se usan para probar.

**Tests**
- Unit: â€”
- IntegraciÃ³n: â€”
- E2E: comprobaciÃ³n manual documentada (`curl -I`).

---

### HOG-021 Â· Aprovisionar la VM de Oracle con Docker y Caddy y desplegar la API a mano

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P1 Â· **Puntos:** 5
- **Capa:** infra
- **Depende de:** HOG-003, HOG-023
- **Spec:** `docs/06-despliegue.md#api-vm-oracle` Â· ADR-007

**DescripciÃ³n**
Crear la imagen Docker de la API, el compose de producciÃ³n con Caddy y el `deploy/README.md` con el paso a paso de aprovisionamiento, y desplegar la API en `api.hogaria.obaiges.com`.

**Criterios de aceptaciÃ³n**
- [ ] `deploy/Dockerfile.api` multi-stage (build con pnpm â†’ `node:lts-slim`, usuario no root, `HEALTHCHECK` contra `/api/v1/health`), que ejecuta `prisma migrate deploy` (con `DIRECT_URL`) antes de arrancar.
- [ ] `deploy/docker-compose.prod.yml` con servicios `api` (puerto interno 3000, `restart: unless-stopped`, `env_file: .env`) y `caddy` (80/443, volÃºmenes de datos).
- [ ] `deploy/Caddyfile`: `api.hogaria.obaiges.com { reverse_proxy api:3000 }` (WebSocket incluido).
- [ ] `deploy/README.md` con los pasos 1â€“6 de `docs/06-despliegue.md` detallados (VCN, `iptables`, Docker, usuario `deploy`, `.env` con permisos 600, `unattended-upgrades`, `fail2ban`, SSH solo con clave) y cÃ³mo desplegar una versiÃ³n a mano.
- [ ] Registro A `api.hogaria` en Netlify DNS; `https://api.hogaria.obaiges.com/api/v1/health` responde 200 con certificado vÃ¡lido.
- [ ] El socket conecta en `wss://api.hogaria.obaiges.com/realtime` (comprobado cuando exista HOG-150).

**Notas tÃ©cnicas**
- ARM (Ampere A1): construye la imagen para `linux/arm64` (o multi-arch).
- Corrige en `docs/06-despliegue.md` la referencia "ticket HOG-022" â†’ "HOG-021".

**Tests**
- Unit: â€”
- IntegraciÃ³n: â€”
- E2E: comprobaciÃ³n manual documentada en el README.

---

### HOG-022 Â· Automatizar el despliegue continuo de la API (GHCR + SSH)

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P2 Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-012, HOG-021
- **Spec:** `docs/06-despliegue.md#despliegue-continuo`

**DescripciÃ³n**
AÃ±adir el job `deploy` a GitHub Actions: en `main`, tras `checks` y `e2e`, construir y publicar la imagen en GHCR y actualizar la VM por SSH.

**Criterios de aceptaciÃ³n**
- [ ] Job `deploy` solo en `main`, `needs: [checks, e2e]`, construye `linux/arm64`, publica `ghcr.io/<owner>/hogaria-api:<sha>` y `:latest`.
- [ ] Se conecta por SSH (clave en secretos de GitHub) como `deploy`, ejecuta `docker compose pull && docker compose up -d` en la VM y comprueba `/api/v1/health` con reintentos.
- [ ] Si la comprobaciÃ³n falla, el job falla y el README explica cÃ³mo volver a la imagen anterior (`:<sha>` previo).
- [ ] `deploy/README.md` documenta los secretos necesarios (`VM_HOST`, `VM_SSH_KEY`, `GHCR_TOKEN` si aplica).

**Notas tÃ©cnicas**
- El frontend se despliega solo con la integraciÃ³n de Cloudflare Pages (HOG-020).

**Tests**
- Unit: â€”
- IntegraciÃ³n: â€”
- E2E: un despliegue real en verde.

---

### HOG-023 Â· Configurar los servicios externos: Neon, Google OAuth y Resend

- **Ã‰pica:** E00 Â· **Fase:** 0 Â· **Prioridad:** P1 Â· **Puntos:** 2
- **Capa:** infra
- **Depende de:** â€”
- **Spec:** `docs/06-despliegue.md#servicios-y-lÃ­mites-gratuitos` Â· `#google-oauth-google-cloud-console` Â· `#neon`

**DescripciÃ³n**
Dar de alta los servicios gratuitos externos y dejar una lista de comprobaciÃ³n con lo que se ha hecho, sin secretos en el repositorio.

**Criterios de aceptaciÃ³n**
- [ ] Neon: proyecto "hogaria" en regiÃ³n UE (Frankfurt), BBDD `hogaria`, rama `main`; cadenas *pooled* (`DATABASE_URL`) y *direct* (`DIRECT_URL`) guardadas fuera del repo.
- [ ] Google Cloud: pantalla de consentimiento externa en "ProducciÃ³n", scopes `openid email profile`, cliente OAuth web con los orÃ­genes y URIs de redirecciÃ³n de `docs/06-despliegue.md`.
- [ ] Resend: dominio `hogaria.obaiges.com` verificado con los registros SPF/DKIM en Netlify DNS; `EMAIL_FROM` probado con un envÃ­o real.
- [ ] `deploy/CHECKLIST-servicios.md` con cada paso marcado, la fecha y dÃ³nde estÃ¡ guardado cada secreto (gestor de contraseÃ±as), **sin** valores.
- [ ] La tabla de lÃ­mites de `docs/06-despliegue.md` se actualiza con lo comprobado y la fecha.

**Notas tÃ©cnicas**
- La cuenta de Oracle y las claves VAPID/Gemini se crean en HOG-021, HOG-600 y HOG-650 respectivamente.

**Tests**
- Unit: â€”
- IntegraciÃ³n: â€”
- E2E: â€”

