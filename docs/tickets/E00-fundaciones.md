# E00 Ã‚Â· Fundaciones

> Rango: HOG-001 Ã¢â‚¬â€œ HOG-049 Ã‚Â· Fase 0 Ã‚Â· Sin spec propia: se basa en `docs/01-arquitectura.md`, `docs/06-despliegue.md`, `docs/07-testing.md`, `docs/08-convenciones.md`, `docs/03-seguridad.md` y `DESIGN.md`.
> Bloques: HOG-001Ã¢â‚¬â€œ019 repositorio, paquetes y calidad Ã‚Â· HOG-020Ã¢â‚¬â€œ029 infraestructura y despliegue.
> Nota: `docs/06-despliegue.md` cita "HOG-022" para `deploy/README.md`; el aprovisionamiento manual y ese README son **HOG-021**, y HOG-022 es el despliegue continuo.

---

### HOG-001 Ã‚Â· Crear el monorepo con pnpm, Turborepo y configuraciÃƒÂ³n compartida

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** Ã¢â‚¬â€
- **Spec:** `docs/01-arquitectura.md#monorepo` Ã‚Â· `docs/08-convenciones.md`

**DescripciÃƒÂ³n**
Crear la base del repositorio: workspaces de pnpm, Turborepo, TypeScript estricto compartido, ESLint (flat config) y Prettier, para que todos los paquetes compilen y se revisen igual desde el primer dÃƒÂ­a.

**Criterios de aceptaciÃƒÂ³n**
- [x] Existen `package.json` raÃƒÂ­z (con `packageManager` fijado), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` y `.nvmrc` con la Node LTS vigente.
- [x] `packages/config` exporta `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `moduleResolution: "bundler"` o `"nodenext"` segÃƒÂºn paquete), `eslint.config.js` y `prettier.config.js`.
- [x] Reglas de ESLint activas: `@typescript-eslint/no-explicit-any` (error), `react/no-danger` (error), orden de imports y prohibiciÃƒÂ³n de `console.log` (se permite `console.debug` y `console.warn`).
- [x] Scripts raÃƒÂ­z: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm db:migrate`, `pnpm db:seed` delegan en Turborepo o en el filtro correspondiente (pueden fallar con "sin paquetes" hasta que existan las apps).
- [x] `.gitignore` incluye `node_modules`, `dist`, `.turbo`, `coverage`, `playwright-report`, `test-results` y `.env*` salvo `.env.example`. `.editorconfig` presente.
- [x] Las versiones exactas elegidas (Node, pnpm, TypeScript, React, Vite, NestJS, Prisma, Better Auth, Socket.IO, TanStack Query, Tailwind, Playwright, Vitest) se anotan en `docs/01-arquitectura.md#stack-y-versiones-objetivo`.
- [x] `pnpm lint && pnpm typecheck` pasan en el repo vacÃƒÂ­o.

**Notas tÃƒÂ©cnicas**
- Alias de imports `@/` por app y `@hogaria/shared` (workspace `workspace:*`).
- Turborepo: `build` depende de `^build`; `lint`, `typecheck` y `test` cacheables; `dev` persistente sin cachÃƒÂ©.
- No aÃƒÂ±adas Husky todavÃƒÂ­a (opcional en E17).

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

---

### HOG-002 Ã‚Â· Crear `packages/shared` con dinero, fechas, errores, constantes y tipos de tiempo real

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 5
- **Capa:** shared
- **Depende de:** HOG-001
- **Spec:** `docs/01-arquitectura.md#paquete-compartido--packagesshared` Ã‚Â· `docs/04-api-y-tiempo-real.md` Ã‚Â· `docs/specs/03-tiempo-real-actividad.md#3-reglas-de-negocio`

**DescripciÃƒÂ³n**
Crear el paquete `@hogaria/shared` que importan web y API: utilidades puras de dinero y fechas en la zona del grupo, cÃƒÂ³digos de error con sus mensajes en espaÃƒÂ±ol, constantes de dominio y los tipos base del sobre de tiempo real.

**Criterios de aceptaciÃƒÂ³n**
- [x] `src/money.ts`: `formatMoney(cents)` Ã¢â€ â€™ `"12,34 Ã¢â€šÂ¬"` / `"1.234,00 Ã¢â€šÂ¬"` (con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })`) y `parseMoney("12,34")` Ã¢â€ â€™ `1234` (acepta `12`, `12,3`, `12.345,67`; rechaza negativos y mÃƒÂ¡s de 2 decimales devolviendo `null`).
- [x] `src/dates.ts` (con `date-fns` + `@date-fns/tz`): `todayInZone(tz)`, `toZonedDay(instant, tz)` Ã¢â€ â€™ `"YYYY-MM-DD"`, `zonedDayToUtcRange(day, tz)`, `startOfWeekInZone(day, tz)` (lunes), `formatDayShort` Ã¢â€ â€™ `"miÃƒÂ© 11 nov"`, `formatTimeRange` Ã¢â€ â€™ `"08:00Ã¢â‚¬â€œ15:00"`, `formatRelative` Ã¢â€ â€™ `"hace 5 min"` (nunca negativo). `DEFAULT_TIMEZONE = 'Europe/Madrid'`.
- [x] `src/errors.ts`: `ERROR_CODES` con exactamente los cÃƒÂ³digos de `docs/04-api-y-tiempo-real.md`, mapa `ERROR_STATUS`, `ERROR_MESSAGES_ES` (un mensaje por cÃƒÂ³digo, p. ej. `NOT_FOUND` Ã¢â€ â€™ "No encontrado", `INTERNAL` Ã¢â€ â€™ "Algo ha fallado. IntÃƒÂ©ntalo de nuevo"), tipo `ErrorCode` y `problemDetailsSchema` (zod de RFC 9457 con `code` y `errors[]`).
- [x] `src/constants/`: `LANE_COLOR_ORDER`, `DEFAULT_EXPENSE_CATEGORIES` (las 9 de `docs/02-modelo-datos.md` con emoji), `INVITE_TTL_DAYS = 10`, `MAX_GROUP_MEMBERS = 20`, etiquetas ES de `Aisle`, `MealSlot`, `Allergen`, `Diet` y `UNITS` (valores de los comentarios de `docs/02-modelo-datos.md`), todas `as const`.
- [x] `src/realtime.ts`: `REALTIME_CHANNEL = 'evt'`, `REALTIME_EVENTS` con **todos** los nombres de la tabla de `docs/04`, `RealtimeEventName`, `RealtimeEnvelope<T>` (con `groupId: string | null`, ver `docs/04-api-y-tiempo-real.md`) y un `RealtimeEventDataMap` vacÃƒÂ­o extensible (lo rellena HOG-151 y cada ÃƒÂ©pica).
- [x] `src/schemas/pagination.ts`: `cursorQuery` y `paginated(itemSchema)` (spec 03 Ã‚Â§5).
- [x] El paquete compila a ESM con tipos (`tsup`), con `exports` para `.` y subrutas futuras, y web y api lo importan como `@hogaria/shared`.
- [x] Cobertura de lÃƒÂ­neas Ã¢â€°Â¥ 80 %.

**Notas tÃƒÂ©cnicas**
- Nada de dependencias de Node ni del DOM: solo funciones puras (se usa en navegador y servidor).
- Las uniones de string sustituyen a los enums de Prisma en la web (`docs/08-convenciones.md#typescript`); cuando exista HOG-004, aÃƒÂ±ade un test que compare `LANE_COLOR_ORDER` con el enum `LaneColor` del cliente de Prisma.
- `normalizeProductName` y demÃƒÂ¡s utilidades de mÃƒÂ³dulos las aÃƒÂ±ade su ÃƒÂ©pica.

**Tests**
- Unit: `money.spec.ts` (redondeo, miles, formatos invÃƒÂ¡lidos), `dates.spec.ts` (cambio de hora de marzo y octubre en `Europe/Madrid`, `Atlantic/Canary`, inicio de semana en lunes), `errors.spec.ts` (todo cÃƒÂ³digo tiene mensaje y status), `realtime.spec.ts` (instantÃƒÂ¡nea de `REALTIME_EVENTS`).
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

---

### HOG-003 Ã‚Â· Crear el esqueleto de `apps/api` con NestJS, Prisma, Postgres local y `/health`

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-001, HOG-002
- **Spec:** `docs/01-arquitectura.md#backend--appsapi` Ã‚Â· `docs/06-despliegue.md#variables-de-entorno`

**DescripciÃƒÂ³n**
Arrancar la API NestJS (adaptador Express) con configuraciÃƒÂ³n validada, logs estructurados, conexiÃƒÂ³n Prisma y la base de datos local en Docker, con los dos endpoints de salud.

**Criterios de aceptaciÃƒÂ³n**
- [x] `apps/api/src/main.ts` crea la app con prefijo global `/api/v1`, `bodyParser: false` (el parser JSON se aÃƒÂ±ade despuÃƒÂ©s de montar Better Auth en HOG-050) y escucha en `PORT`.
- [x] `src/config/env.ts` valida `process.env` con zod (variables de `docs/06-despliegue.md`; las de servicios aÃƒÂºn no usados son opcionales) y la app no arranca si falta una obligatoria, indicando cuÃƒÂ¡l.
- [x] `nestjs-pino` con `requestId` por peticiÃƒÂ³n y redacciÃƒÂ³n de `authorization`, `cookie` y `set-cookie`.
- [x] `src/prisma/prisma.service.ts` y `PrismaModule` global; `prisma/schema.prisma` con solo `datasource` y `generator` (el esquema llega en HOG-004).
- [x] `docker-compose.yml` raÃƒÂ­z con `db` (`postgres:17`, puerto 5432, BBDD `hogaria`, volumen) y `db-test` (`postgres:17`, puerto 5433, BBDD `hogaria_test`, `tmpfs`).
- [x] `GET /api/v1/health` Ã¢â€ â€™ `200 { status: "ok" }` **sin** tocar la BBDD; `GET /api/v1/health/db` Ã¢â€ â€™ `200 { status: "ok" }` con `SELECT 1` (o `503` si falla).
- [x] `pnpm dev` levanta `db` y la API en modo watch; `apps/api/.env.example` copiado de `docs/06-despliegue.md` con `DATABASE_URL`/`DIRECT_URL` locales.

**Notas tÃƒÂ©cnicas**
- Usa `@nestjs/config` solo como contenedor; la validaciÃƒÂ³n es el esquema zod.
- `GET /health` se marcarÃƒÂ¡ `@Public()` cuando exista el `AuthGuard` (HOG-055).

**Tests**
- Unit: `env.spec.ts` (falta `DATABASE_URL` Ã¢â€ â€™ error legible).
- IntegraciÃƒÂ³n: `health.int.spec.ts` (`/health` responde sin BBDD configurada; `/health/db` con la BBDD de test).
- E2E: Ã¢â‚¬â€

---

### HOG-004 Ã‚Â· Escribir el esquema Prisma completo y la primera migraciÃƒÂ³n

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-003
- **Spec:** `docs/02-modelo-datos.md`

**DescripciÃƒÂ³n**
Trasladar el esquema canÃƒÂ³nico de `docs/02-modelo-datos.md` a `apps/api/prisma/schema.prisma` con todos los `@map`/`@@map` a `snake_case`, y generar la migraciÃƒÂ³n inicial con el ÃƒÂ­ndice ÃƒÂºnico parcial de `budgets`.

**Criterios de aceptaciÃƒÂ³n**
- [x] Todos los modelos, enums, relaciones, ÃƒÂ­ndices y `@@unique` de `docs/02-modelo-datos.md` estÃƒÂ¡n en el schema, con columnas en `snake_case` (`@map`) y tablas en plural (`@@map`).
- [x] Los IDs son `@default(uuid(7)) @db.Uuid` y los instantes `@db.Timestamptz(3)`; los dÃƒÂ­as `@db.Date`.
- [x] La migraciÃ³n `0001_init` incluye a mano `CREATE UNIQUE INDEX budgets_group_user_total_key ON budgets("groupId", "userId") WHERE "categoryId" IS NULL;`.
- [x] `pnpm db:migrate` (`prisma migrate deploy`) aplica la migraciÃ³n en la BBDD local y `prisma migrate reset --force` funciona contra `hogaria_test`.
- [x] Un test comprueba que los nombres de modelos y enums del cliente generado coinciden con una lista esperada (detecta divergencias con el documento).

**Notas tÃƒÂ©cnicas**
- Las tablas de Better Auth deben coincidir con lo que espera su adaptador de Prisma; si `npx @better-auth/cli generate` propone diferencias de campos, gana `docs/02-modelo-datos.md` y se ajusta la configuraciÃƒÂ³n de Better Auth (`fields` mapping) en HOG-050.
- Si Prisma no soporta `uuid(7)` en la versiÃƒÂ³n fijada, usa `@default(dbgenerated(...))` o genera en la aplicaciÃƒÂ³n y anÃƒÂ³talo en `docs/02-modelo-datos.md`.

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: `schema.int.spec.ts` (migraciÃƒÂ³n aplicada; insertar dos `Budget` totales del mismo usuario y grupo falla por el ÃƒÂ­ndice parcial).
- E2E: Ã¢â‚¬â€

---

### HOG-005 Ã‚Â· Crear el esqueleto de `apps/web` (Vite, React, Router, Query, Tailwind v4 y PWA)

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-001, HOG-002
- **Spec:** `docs/01-arquitectura.md#frontend--appsweb` Ã‚Â· `DESIGN.md` Ã‚Â§11

**DescripciÃƒÂ³n**
Arrancar la SPA con React 19, React Router en modo *data*, TanStack Query, Tailwind CSS v4 y vite-plugin-pwa en modo `injectManifest`, con manifest e iconos generados desde el logo.

**Criterios de aceptaciÃƒÂ³n**
- [x] `apps/web` con Vite + React + TypeScript; estructura de carpetas de `docs/01-arquitectura.md#estructura-del-monorepo` (`app/`, `components/ui/`, `components/pool/`, `features/`, `lib/`, `styles/`).
- [x] `app/router.tsx` con `createBrowserRouter` y rutas placeholder para todas las de `docs/08-convenciones.md#rutas-de-la-pwa-espaÃƒÂ±ol-fijadas` (cada una renderiza su tÃƒÂ­tulo).
- [x] `app/providers/QueryProvider.tsx` con `QueryClient` (`staleTime` 30 s, `retry` 1 en queries, `networkMode: 'always'` en mutaciones).
- [x] Tailwind v4 con `@tailwindcss/vite`; `styles/index.css` importa `styles/tokens.css` (vacÃƒÂ­o hasta HOG-007).
- [x] vite-plugin-pwa (`strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`) con `sw.ts` mÃƒÂ­nimo que precachea el *shell*; manifest con `name: "Hogaria"`, `short_name: "Hogaria"`, `lang: "es"`, `display: "standalone"`, `start_url: "/"`, `theme_color` y `background_color` de `DESIGN.md` Ã‚Â§11.
- [x] Iconos 192, 512, 512 *maskable* y `apple-touch-icon` 180 en `public/`, generados desde `docs/design/logo.svg` (fondo opaco del token indicado en `DESIGN.md` Ã‚Â§11).
- [x] Proxy de Vite: `/api` y `/realtime` (con `ws: true`) Ã¢â€ â€™ `http://localhost:3000`.
- [x] `apps/web/.env.example` segÃƒÂºn `docs/06-despliegue.md`. `pnpm --filter web build` genera `dist/` sin errores.

**Notas tÃƒÂ©cnicas**
- `lang="es"` en `index.html` y `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- El push del service worker es de E12 (HOG-600); el aviso de nueva versiÃƒÂ³n es HOG-015.

**Tests**
- Unit: `router.spec.tsx` (cada ruta fijada existe).
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

---


### HOG-007 — Aplicar los tokens de diseño, las fuentes Barlow autoalojadas y el tema claro/oscuro

- **Épica:** E00 — **Fase:** 0 — **Prioridad:** P0 — **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-005
- **Spec:** `DESIGN.md` §3–§6 y §11 — ADR-016

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
- Unit: `apps/web/src/lib/theme.spec.ts` (preferencia guardada; `localStorage` que lanza no rompe).
- Integración: —
- E2E: —

---
### HOG-008 Ã‚Â· Adaptar los componentes UI base de shadcn al sistema "Piscina municipal"

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-007
- **Spec:** `DESIGN.md` Ã‚Â§8 y Ã‚Â§9

**DescripciÃƒÂ³n**
Crear los componentes base en `apps/web/src/components/ui/` a partir de shadcn/ui (Radix), con las variantes, tamaÃƒÂ±os y estados de `DESIGN.md`, accesibles y listos para modo oscuro.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Componentes: `Button` (`primary`, `secondary`, `ghost`, `danger`; estado `loading`; prop `requiresConnection` preparada, sin efecto hasta HOG-155), `Input`, `Textarea`, `Select`, `Checkbox`, `Chip`, `Sheet`, `Dialog`, `Tabs`/`SegmentedControl`, `Toast` (con acciÃƒÂ³n "Deshacer" de 5 s), `Skeleton`, `EmptyState`, `ErrorState` (con `onRetry` opcional) y `FormField` (label visible + mensaje de error con `aria-describedby`).
- [ ] Alturas, radios y tipografÃƒÂ­a segÃƒÂºn `DESIGN.md` Ã‚Â§5 y Ã‚Â§8; objetivos tÃƒÂ¡ctiles Ã¢â€°Â¥ 44 px; foco visible con el token de anillo.
- [ ] `Skeleton` sin pulso con `prefers-reduced-motion`.
- [ ] PÃƒÂ¡gina `/dev/ui` (solo desarrollo) con todos los componentes y estados, en claro y oscuro.

**Notas tÃƒÂ©cnicas**
- `AppHeader`, `BottomNav` y `Fab` son de HOG-750; `OfflineBanner` es de HOG-155.
- `Toast` con un *store* simple (Zustand) y `useToast()`; regiÃƒÂ³n `aria-live="polite"`.

**Tests**
- Unit: componentes con Testing Library (Button `loading` deshabilita, Dialog atrapa el foco y cierra con Escape, `FormField` enlaza el error, `ErrorState` llama a `onRetry`).
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

---

### HOG-009 Ã‚Â· Crear los componentes firma de la piscina y la animaciÃƒÂ³n de onda

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-008
- **Spec:** `DESIGN.md` Ã‚Â§6 y Ã‚Â§7 Ã‚Â· `docs/design/mock-inicio.html`

**DescripciÃƒÂ³n**
Crear `Lane`, `LaneRope`, `DepthFigure`, `MemberDot`/`MemberAvatar` y la animaciÃƒÂ³n `ripple` en `apps/web/src/components/pool/`, que el resto de mÃƒÂ³dulos reutilizarÃƒÂ¡n.

**Criterios de aceptaciÃƒÂ³n**
- [ ] `Lane` con props `member`, `children`, `onPress?`, `highlight?: 'ripple'`, borde de 4 px y tinte del color de calle, `role="group"` y `aria-label="Calle de {nombre}"`.
- [ ] `LaneRope` (`variant: 'default' | 'limit'`), decorativa con `aria-hidden`.
- [ ] `DepthFigure` (`size: 's' | 'l'`, `variant?: 'limit'`, `value`, `label`) con cifras tabulares.
- [ ] `MemberDot`/`MemberAvatar` (20, 28 y 36 px) con iniciales o foto, color por `LaneColor` y variante neutra (sin miembro: sistema, ex-miembro o "Usuario eliminado").
- [ ] Utilidad de animaciÃƒÂ³n `ripple` (clase CSS `.ripple` + `--ripple-color`) segÃƒÂºn `DESIGN.md` Ã‚Â§6: 700 ms con barrido; con `prefers-reduced-motion`, solo cambio de fondo durante 1 s. Hook `useRippleClass(active, laneColor)` que la aplica a cualquier fila.
- [ ] `laneColorVar(color: LaneColor)` Ã¢â€ â€™ `var(--lane-coral)`Ã¢â‚¬Â¦ en `components/pool/lane-colors.ts`.
- [ ] `/dev/ui` muestra una reproducciÃƒÂ³n de `docs/design/mock-inicio.html` con estos componentes, en 375 px y oscuro.

**Notas tÃƒÂ©cnicas**
- CuÃƒÂ¡ndo se dispara la onda lo decide el tiempo real (HOG-152, `ripple-store`); aquÃƒÂ­ solo la presentaciÃƒÂ³n.

**Tests**
- Unit: `MemberDot` (iniciales de "Ana GarcÃƒÂ­a" Ã¢â€ â€™ "AG"; variante neutra), `Lane` (aria-label), `useRippleClass` (respeta `matchMedia('(prefers-reduced-motion: reduce)')`).
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

---

### HOG-010 Ã‚Â· Montar la infraestructura de tests unitarios y de integraciÃƒÂ³n

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 5
- **Capa:** infra
- **Depende de:** HOG-003, HOG-004
- **Spec:** `docs/07-testing.md`

**DescripciÃƒÂ³n**
Configurar Vitest en los tres paquetes, la BBDD de test con reseteo y truncado, *factories* y los *fakes* inyectables de Gemini, Web Push y email (Resend).

**Criterios de aceptaciÃƒÂ³n**
- [ ] Vitest en `packages/shared`, `apps/api` (unit `*.spec.ts` + integraciÃƒÂ³n `test/**/*.int.spec.ts` con `supertest`) y `apps/web` (jsdom + Testing Library + MSW).
- [ ] La integraciÃƒÂ³n usa `hogaria_test` (puerto 5433): `globalSetup` ejecuta `prisma migrate reset --force --skip-seed` una vez por ejecuciÃƒÂ³n y cada test trunca las tablas (`TRUNCATE Ã¢â‚¬Â¦ RESTART IDENTITY CASCADE` generado desde el esquema).
- [ ] `apps/api/test/utils/create-test-app.ts` arranca la app Nest con proveedores sustituibles.
- [ ] Factories en `apps/api/test/factories/`: `createUser({ verified?, password?, isPlatformAdmin?, blockedAt? })`, `createGroupWithMembers(n)`, `createInvite(groupId, { status? })`, `loginAs(user)` Ã¢â€ â€™ agente supertest con cookie (operativo desde HOG-050; hasta entonces lanza "Not implemented").
- [ ] Interfaces + *fakes*: `EmailSender` (`FakeEmailSender` guarda los emails en memoria con `to`, `subject`, `text`, `html`, `links`), `PushSender` (`FakeWebPushSender` registra envÃƒÂ­os), `GeminiClient` (`FakeGeminiClient` lee `test/fixtures/ai/*.json`). Se registran con *tokens* de Nest para cambiarlos por configuraciÃƒÂ³n (`NODE_ENV=test`).
- [ ] Umbral de cobertura del 80 % de lÃƒÂ­neas en `packages/shared/src/**` y `apps/api/src/**/*.service.ts`; `pnpm test` falla si baja.

**Notas tÃƒÂ©cnicas**
- Usa el reloj falso de Vitest (`vi.useFakeTimers`) para caducidades; documenta en `docs/07-testing.md` cualquier helper nuevo.
- Los tests de integraciÃƒÂ³n se ejecutan en serie (`pool: 'forks'`, `singleFork`) para no pisarse en la BBDD.

**Tests**
- Unit: test de humo de cada *fake*.
- IntegraciÃƒÂ³n: test de humo que crea un usuario con la factory y comprueba el truncado entre tests.
- E2E: Ã¢â‚¬â€

---

### HOG-011 Ã‚Â· Configurar Playwright con mÃƒÂ³viles, helpers de login y doble contexto

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-003, HOG-005, HOG-010
- **Spec:** `docs/07-testing.md#flujos-crÃƒÂ­ticos-e2e-obligatorios`

**DescripciÃƒÂ³n**
Preparar los e2e en `apps/web/e2e/` con los proyectos Mobile Chrome (Pixel 7) y Mobile Safari (iPhone 14), arranque automÃƒÂ¡tico de web y API contra la BBDD de test, endpoints de soporte solo para test y helpers reutilizables.

**Criterios de aceptaciÃƒÂ³n**
- [ ] `playwright.config.ts` con proyectos `Pixel 7` y `iPhone 14`, `webServer` que levanta API (`NODE_ENV=test`, BBDD `hogaria_test`) y web, trazas `on-first-retry`.
- [ ] `apps/api/src/test-support/` (mÃƒÂ³dulo cargado **solo** si `NODE_ENV=test`): `GET /api/v1/test/emails?to=` (emails del `FakeEmailSender`), `POST /api/v1/test/reset` (trunca tablas), `POST /api/v1/test/users` (crea usuario verificado con contraseÃƒÂ±a y, opcionalmente, un grupo; devuelve ids). Test de integraciÃƒÂ³n que comprueba que no existen con `NODE_ENV=production`.
- [ ] Helpers en `apps/web/e2e/helpers/`: `resetDb()`, `createUser()`, `loginAs(page, user)` (vÃƒÂ­a UI o cookie de la API), `lastEmailLink(to)`, `twoMembers(browser)` Ã¢â€ â€™ `{ a: { page, user }, b: { page, user }, groupId }` con dos contextos independientes.
- [ ] `pnpm test:e2e` ejecuta un test de humo que abre `/` en ambos proyectos.

**Notas tÃƒÂ©cnicas**
- `POST /test/users` usa el mismo hash que Better Auth (`hashPassword` de `better-auth/crypto`) para que el login real funcione.
- Viewports de los dispositivos de Playwright; nada de tamaÃƒÂ±os a mano.

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: `test-support` deshabilitado fuera de test.
- E2E: humo.

---

### HOG-012 Ã‚Â· Configurar CI en GitHub Actions

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P1 Ã‚Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-001, HOG-010, HOG-011
- **Spec:** `docs/07-testing.md#ci-github-actions`

**DescripciÃƒÂ³n**
Crear `.github/workflows/ci.yml` con los trabajos `checks` y `e2e` en cada push y pull request, y la auditorÃƒÂ­a de dependencias.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Job `checks`: `pnpm install --frozen-lockfile` Ã¢â€ â€™ `lint` Ã¢â€ â€™ `typecheck` Ã¢â€ â€™ `test` (con servicio `postgres:17` en el puerto 5433 y `hogaria_test`), con cachÃƒÂ© de pnpm y Turborepo.
- [ ] Job `e2e` (`needs: checks`): instala navegadores de Playwright, construye web y API y ejecuta `pnpm test:e2e`; si falla, sube `playwright-report` y trazas como artefactos.
- [ ] Paso `pnpm audit --audit-level=high` (no bloqueante al principio: `continue-on-error: true`, anotado).
- [ ] Dependabot (`.github/dependabot.yml`) semanal para npm y GitHub Actions.
- [ ] Ninguna clave real en el workflow: los tests usan los *fakes*.

**Notas tÃƒÂ©cnicas**
- El job `deploy` lo aÃƒÂ±ade HOG-022.
- LÃƒÂ­mite de 2 000 min/mes en repos privados (`docs/06-despliegue.md`): `concurrency` cancela ejecuciones anteriores de la misma rama.

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: el propio workflow en verde en un PR de prueba.

---

### HOG-013 Ã‚Â· Crear el seed mÃƒÂ­nimo de desarrollo (`pnpm db:seed`)

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P2 Ã‚Â· **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-004
- **Spec:** `docs/02-modelo-datos.md#datos-semilla-al-crear-un-grupo`

**DescripciÃƒÂ³n**
Crear `apps/api/prisma/seed.ts` con el **seed mÃƒÂ­nimo** para el desarrollo local: el usuario dueÃƒÂ±o de la instancia y un hogar con 2 miembros y su semilla, para probar la app sin pasar por invitaciones. Los datos de demo de todos los mÃƒÂ³dulos los aÃƒÂ±ade HOG-865 ampliando este mismo script.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Crea el usuario dueÃƒÂ±o `ana@demo.local` (`ana`, `isPlatformAdmin = true`) y un segundo usuario `oscar@demo.local` (`oscar`), ambos con contraseÃƒÂ±a `hogaria-demo-1234`, `emailVerified = true` y cuenta `credential`.
- [ ] Crea el hogar "Casa Demo" Ã°Å¸ÂÂ  con ambos miembros (CORAL y SEA), la lista "Compra" y las 9 categorÃƒÂ­as de gasto.
- [ ] Es idempotente (si existen, no duplica) y se niega a ejecutarse con `NODE_ENV=production`.
- [ ] No crea datos de mÃƒÂ³dulos (compra, tareas, recetasÃ¢â‚¬Â¦): eso es HOG-865.
- [ ] El script queda estructurado en funciones (`seedUsers()`, `seedGroup()`) para que HOG-865 aÃƒÂ±ada `seedModules()` sin reescribirlo.

**Notas tÃƒÂ©cnicas**
- Hash con `hashPassword` de `better-auth/crypto`. Nada de secretos reales.

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: ejecutar el seed dos veces deja 2 usuarios y 1 grupo.
- E2E: Ã¢â‚¬â€

---

### HOG-014 Ã‚Â· Aplicar las protecciones base de la API (helmet, CORS, Origin y throttler)

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P0 Ã‚Â· **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-003, HOG-006
- **Spec:** `docs/03-seguridad.md#protecciones-web`

**DescripciÃƒÂ³n**
AÃƒÂ±adir las cabeceras de seguridad, el CORS estricto con credenciales, la comprobaciÃƒÂ³n de `Origin` en mÃƒÂ©todos no GET y el *rate limiting* general de 120 peticiones por minuto y usuario.

**Criterios de aceptaciÃƒÂ³n**
- [ ] `helmet` activo en la API.
- [ ] CORS: solo `APP_URL` (y `http://localhost:5173` si `NODE_ENV=development`), `credentials: true`, cabecera `X-Client-Mutation-Id` permitida.
- [ ] Middleware global: en `POST/PATCH/PUT/DELETE` bajo `/api/v1`, si la cabecera `Origin` existe y no estÃƒÂ¡ en la lista permitida Ã¢â€ â€™ `403` problem+json con `code: "FORBIDDEN_ORIGIN"` (ver nota).
- [ ] `@nestjs/throttler` global: 120 peticiones/min por usuario autenticado (o por IP si no hay sesiÃƒÂ³n) Ã¢â€ â€™ `429 RATE_LIMITED` con `Retry-After`; decorador para lÃƒÂ­mites especÃƒÂ­ficos por ruta.
- [ ] LÃƒÂ­mite de tamaÃƒÂ±o del cuerpo JSON: 1 MB.

**Notas tÃƒÂ©cnicas**
- NingÃƒÂºn cÃƒÂ³digo existente describe un origen no permitido: **aÃƒÂ±ade** `FORBIDDEN_ORIGIN` (403, "Origen no permitido") a `packages/shared/src/errors.ts` y a la tabla de cÃƒÂ³digos de `docs/04-api-y-tiempo-real.md` en el mismo PR (cambio canÃƒÂ³nico previsto).
- Better Auth hace su propia comprobaciÃƒÂ³n con `trustedOrigins` (HOG-050).

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: `POST` con `Origin: https://evil.example` Ã¢â€ â€™ 403; preflight CORS desde `APP_URL` Ã¢â€ â€™ cabeceras correctas; 121.Ã‚Âª peticiÃƒÂ³n en un minuto Ã¢â€ â€™ 429.
- E2E: Ã¢â‚¬â€

---

### HOG-015 Ã‚Â· Configurar el service worker del *shell* y el aviso de nueva versiÃƒÂ³n

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P1 Ã‚Â· **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-005, HOG-008
- **Spec:** ADR-015 Ã‚Â· `docs/01-arquitectura.md#frontend--appsweb`

**DescripciÃƒÂ³n**
Completar `sw.ts` para que solo precachee el *shell* (arranque rÃƒÂ¡pido, sin modo offline) y avisar al usuario cuando haya una versiÃƒÂ³n nueva.

**Criterios de aceptaciÃƒÂ³n**
- [ ] `sw.ts` usa `precacheAndRoute(self.__WB_MANIFEST)` y **no** cachea respuestas de `/api` ni de `/realtime`.
- [ ] Navegaciones a rutas de la SPA sirven `index.html` del precache.
- [ ] Registro con `virtual:pwa-register` (`registerType: 'prompt'`): cuando hay versiÃƒÂ³n nueva, toast persistente "Hay una versiÃƒÂ³n nueva de Hogaria" con acciÃƒÂ³n "Actualizar" (llama a `updateSW(true)`).
- [ ] `sw.js` se sirve con `Cache-Control: no-cache` (regla en `_headers`, HOG-020).

**Notas tÃƒÂ©cnicas**
- Los manejadores `push` y `notificationclick` los aÃƒÂ±ade HOG-600 en el mismo `sw.ts`.

**Tests**
- Unit: componente del aviso (aparece con `needRefresh = true`).
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

---

### HOG-016 Ã‚Â· Generar la documentaciÃƒÂ³n OpenAPI desde los esquemas zod (solo desarrollo)

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P2 Ã‚Â· **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-006
- **Spec:** `docs/04-api-y-tiempo-real.md#convenciones-rest`

**DescripciÃƒÂ³n**
Servir en `/api/docs` (solo con `NODE_ENV=development`) un OpenAPI generado a partir de los esquemas zod que usan los controladores.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Decorador `@ApiContract({ body?, query?, params?, response })` que registra los esquemas zod de cada ruta.
- [ ] `/api/docs` muestra Swagger UI con las rutas registradas; en producciÃƒÂ³n y test responde 404.
- [ ] AÃƒÂ±adir un endpoint nuevo con el decorador lo hace aparecer sin mÃƒÂ¡s pasos.

**Notas tÃƒÂ©cnicas**
- `zod-openapi` (o equivalente compatible con la versiÃƒÂ³n de zod fijada).

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: `/api/docs` 404 con `NODE_ENV=test`.
- E2E: Ã¢â‚¬â€

---

### HOG-020 Ã‚Â· Desplegar el frontend en Cloudflare Pages con DNS en Netlify y `_headers`/`_redirects`

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P1 Ã‚Â· **Puntos:** 2
- **Capa:** infra
- **Depende de:** HOG-005, HOG-023
- **Spec:** `docs/06-despliegue.md#frontend-cloudflare-pages` Ã‚Â· `docs/03-seguridad.md#protecciones-web`

**DescripciÃƒÂ³n**
Publicar `apps/web` en Cloudflare Pages desde GitHub, enlazar `hogaria.obaiges.com` con un CNAME en Netlify DNS y servir las cabeceras de seguridad y la regla de SPA.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Proyecto de Pages con build `pnpm install --frozen-lockfile && pnpm --filter web build`, salida `apps/web/dist` y variables `VITE_API_URL` y `VITE_VAPID_PUBLIC_KEY`.
- [ ] `apps/web/public/_headers` con la CSP exacta de `docs/03-seguridad.md`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=()` y `Cache-Control: no-cache` para `/sw.js`.
- [ ] `apps/web/public/_redirects` con `/* /index.html 200`.
- [ ] CNAME `hogaria` Ã¢â€ â€™ `<proyecto>.pages.dev` en Netlify DNS y dominio personalizado activo con HTTPS.
- [ ] `https://hogaria.obaiges.com/g/x/compra` carga la SPA (no 404) y las cabeceras se ven en la respuesta.
- [ ] `docs/06-despliegue.md` actualizado con la fecha de comprobaciÃƒÂ³n de lÃƒÂ­mites.

**Notas tÃƒÂ©cnicas**
- Las vistas previas de rama de Pages no tienen API: no se usan para probar.

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: comprobaciÃƒÂ³n manual documentada (`curl -I`).

---

### HOG-021 Ã‚Â· Aprovisionar la VM de Oracle con Docker y Caddy y desplegar la API a mano

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P1 Ã‚Â· **Puntos:** 5
- **Capa:** infra
- **Depende de:** HOG-003, HOG-023
- **Spec:** `docs/06-despliegue.md#api-vm-oracle` Ã‚Â· ADR-007

**DescripciÃƒÂ³n**
Crear la imagen Docker de la API, el compose de producciÃƒÂ³n con Caddy y el `deploy/README.md` con el paso a paso de aprovisionamiento, y desplegar la API en `api.hogaria.obaiges.com`.

**Criterios de aceptaciÃƒÂ³n**
- [ ] `deploy/Dockerfile.api` multi-stage (build con pnpm Ã¢â€ â€™ `node:lts-slim`, usuario no root, `HEALTHCHECK` contra `/api/v1/health`), que ejecuta `prisma migrate deploy` (con `DIRECT_URL`) antes de arrancar.
- [ ] `deploy/docker-compose.prod.yml` con servicios `api` (puerto interno 3000, `restart: unless-stopped`, `env_file: .env`) y `caddy` (80/443, volÃƒÂºmenes de datos).
- [ ] `deploy/Caddyfile`: `api.hogaria.obaiges.com { reverse_proxy api:3000 }` (WebSocket incluido).
- [ ] `deploy/README.md` con los pasos 1Ã¢â‚¬â€œ6 de `docs/06-despliegue.md` detallados (VCN, `iptables`, Docker, usuario `deploy`, `.env` con permisos 600, `unattended-upgrades`, `fail2ban`, SSH solo con clave) y cÃƒÂ³mo desplegar una versiÃƒÂ³n a mano.
- [ ] Registro A `api.hogaria` en Netlify DNS; `https://api.hogaria.obaiges.com/api/v1/health` responde 200 con certificado vÃƒÂ¡lido.
- [ ] El socket conecta en `wss://api.hogaria.obaiges.com/realtime` (comprobado cuando exista HOG-150).

**Notas tÃƒÂ©cnicas**
- ARM (Ampere A1): construye la imagen para `linux/arm64` (o multi-arch).
- Corrige en `docs/06-despliegue.md` la referencia "ticket HOG-022" Ã¢â€ â€™ "HOG-021".

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: comprobaciÃƒÂ³n manual documentada en el README.

---

### HOG-022 Ã‚Â· Automatizar el despliegue continuo de la API (GHCR + SSH)

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P2 Ã‚Â· **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-012, HOG-021
- **Spec:** `docs/06-despliegue.md#despliegue-continuo`

**DescripciÃƒÂ³n**
AÃƒÂ±adir el job `deploy` a GitHub Actions: en `main`, tras `checks` y `e2e`, construir y publicar la imagen en GHCR y actualizar la VM por SSH.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Job `deploy` solo en `main`, `needs: [checks, e2e]`, construye `linux/arm64`, publica `ghcr.io/<owner>/hogaria-api:<sha>` y `:latest`.
- [ ] Se conecta por SSH (clave en secretos de GitHub) como `deploy`, ejecuta `docker compose pull && docker compose up -d` en la VM y comprueba `/api/v1/health` con reintentos.
- [ ] Si la comprobaciÃƒÂ³n falla, el job falla y el README explica cÃƒÂ³mo volver a la imagen anterior (`:<sha>` previo).
- [ ] `deploy/README.md` documenta los secretos necesarios (`VM_HOST`, `VM_SSH_KEY`, `GHCR_TOKEN` si aplica).

**Notas tÃƒÂ©cnicas**
- El frontend se despliega solo con la integraciÃƒÂ³n de Cloudflare Pages (HOG-020).

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: un despliegue real en verde.

---

### HOG-023 Ã‚Â· Configurar los servicios externos: Neon, Google OAuth y Resend

- **Ãƒâ€°pica:** E00 Ã‚Â· **Fase:** 0 Ã‚Â· **Prioridad:** P1 Ã‚Â· **Puntos:** 2
- **Capa:** infra
- **Depende de:** Ã¢â‚¬â€
- **Spec:** `docs/06-despliegue.md#servicios-y-lÃƒÂ­mites-gratuitos` Ã‚Â· `#google-oauth-google-cloud-console` Ã‚Â· `#neon`

**DescripciÃƒÂ³n**
Dar de alta los servicios gratuitos externos y dejar una lista de comprobaciÃƒÂ³n con lo que se ha hecho, sin secretos en el repositorio.

**Criterios de aceptaciÃƒÂ³n**
- [ ] Neon: proyecto "hogaria" en regiÃƒÂ³n UE (Frankfurt), BBDD `hogaria`, rama `main`; cadenas *pooled* (`DATABASE_URL`) y *direct* (`DIRECT_URL`) guardadas fuera del repo.
- [ ] Google Cloud: pantalla de consentimiento externa en "ProducciÃƒÂ³n", scopes `openid email profile`, cliente OAuth web con los orÃƒÂ­genes y URIs de redirecciÃƒÂ³n de `docs/06-despliegue.md`.
- [ ] Resend: dominio `hogaria.obaiges.com` verificado con los registros SPF/DKIM en Netlify DNS; `EMAIL_FROM` probado con un envÃƒÂ­o real.
- [ ] `deploy/CHECKLIST-servicios.md` con cada paso marcado, la fecha y dÃƒÂ³nde estÃƒÂ¡ guardado cada secreto (gestor de contraseÃƒÂ±as), **sin** valores.
- [ ] La tabla de lÃƒÂ­mites de `docs/06-despliegue.md` se actualiza con lo comprobado y la fecha.

**Notas tÃƒÂ©cnicas**
- La cuenta de Oracle y las claves VAPID/Gemini se crean en HOG-021, HOG-600 y HOG-650 respectivamente.

**Tests**
- Unit: Ã¢â‚¬â€
- IntegraciÃƒÂ³n: Ã¢â‚¬â€
- E2E: Ã¢â‚¬â€

