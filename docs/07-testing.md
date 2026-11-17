# 07 · Estrategia de testing

## Pirámide

| Nivel | Herramienta | Dónde | Qué se prueba |
|---|---|---|---|
| Unitario | **Vitest** | `*.spec.ts` junto al código (api, web y shared) | Lógica pura: rotación de tareas, recurrencias, normalización de productos, cálculo de presupuestos, vencimientos de facturas, horarios efectivos, validadores zod, utilidades de dinero y fechas, hooks y componentes con lógica |
| Integración (API) | **Vitest + Supertest** + Postgres en Docker | `apps/api/test/**/*.int.spec.ts` | Endpoints reales con BBDD real: autorización (401/403/404), reglas de negocio, transacciones, emisión de eventos |
| Componentes (web) | **Vitest + Testing Library** + MSW | `apps/web/src/**/*.spec.tsx` | Formularios, estados vacíos y de error, accesibilidad básica |
| End-to-end | **Playwright** | `apps/web/e2e/*.e2e.ts` | Flujos críticos en viewport móvil |

**Gemini nunca se llama en los tests.** `GeminiClient` se inyecta y en los tests se sustituye por un *fake* con respuestas grabadas (`apps/api/test/fixtures/ai/*.json`).
**Web Push** se sustituye por un *fake* que registra los envíos. **Resend** igual: el *fake* guarda los emails en memoria, y en e2e se exponen en `GET /test/emails` (solo con `NODE_ENV=test`).

## Base de datos de test

- `docker-compose.yml` levanta `postgres:17` en el puerto 5433 para tests (`docker compose up -d db-test`).
- **Sin Docker** (Postgres nativo): crea la BBDD `hogaria_test` y pon `TEST_DATABASE_URL=postgresql://…/hogaria_test` en `apps/api/.env.test` (no versionado) o en el entorno. Orden de resolución: `TEST_DATABASE_URL` → `apps/api/.env.test` → `localhost:5433`. Nunca se usa el `DATABASE_URL` de `.env`.
- **Protección:** los tests se niegan a ejecutarse contra una BBDD cuyo nombre no acabe en `_test` (`test/utils/test-db.ts`).
- Una vez por ejecución (`globalSetup`, `test/global-setup.ts`): `prisma migrate reset --force` sobre `hogaria_test` (Prisma 7 ya no ejecuta el seed en el reset, así que `--skip-seed` sobra).
  - Si lo lanza un agente de IA, Prisma lo bloquea y pide el consentimiento explícito del usuario en `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. El agente debe preguntar antes; ejecutado por una persona o en CI no pide nada.
- Cada test crea sus datos con *factories* (`apps/api/test/factories/*.ts`: `createUser()`, `createGroupWithMembers(n)`, …). Nada de depender de un seed global.
- Aislamiento: truncado de tablas entre tests (`TRUNCATE … RESTART IDENTITY CASCADE` de todas las tablas creadas por las migraciones, salvo `_prisma_migrations`), más rápido que las transacciones con Nest. Lo hace `test/setup-int.ts` en un `beforeEach`.
- La suite de integración corre en serie (`pool: 'forks'`, `fileParallelism: false`).

## Helpers de test

### API (`apps/api`)

| Script | Qué ejecuta |
|---|---|
| `pnpm test` | Proyectos `unit` (`src/**/*.spec.ts`) e `integration` (`test/**/*.int.spec.ts`) con cobertura |
| `pnpm test:unit` / `pnpm test:int` | Solo uno de los dos proyectos |

| Helper | Uso |
|---|---|
| `createTestApp({ overrides?, configure? })` (`test/utils/create-test-app.ts`) | Arranca la API real (`AppModule` + `configureApp`, igual que `main.ts`) con `NODE_ENV=test`. Devuelve `{ app, server, moduleRef, emails, push, gemini, close }`; `overrides: [{ provide, useValue }]` sustituye cualquier proveedor |
| `createUser({ verified?, password?, isPlatformAdmin?, blockedAt?, … })` | Usuario único por llamada; con `password`, cuenta `credential` con el hash de `better-auth/crypto` |
| `createGroupWithMembers(n, { name?, members? })` | Hogar con `n` miembros nuevos y colores de calle en el orden de `LANE_COLOR_ORDER` |
| `createInvite(groupId, { status?: 'active' \| 'used' \| 'revoked' \| 'expired' })` | Devuelve `{ invite, token }`; en BBDD solo el SHA-256 (`hashInviteToken`) |
| `loginAs(user)` | Agente supertest con sesión. Lanza "Not implemented" hasta HOG-050 |
| `getTestPrisma()`, `truncateAll()` (`test/utils/prisma.ts`) | Cliente Prisma de los tests y truncado manual |

**Servicios externos.** Las interfaces viven en `src/` con su *token* de Nest y la API elige la implementación con `NODE_ENV` (`src/external-services.module.ts`); por eso los *fakes* están en `src/` y se reexportan en `test/fakes/`.

| Token | Interfaz | Fake (`NODE_ENV=test`) | Real |
|---|---|---|---|
| `EMAIL_SENDER` | `EmailSender.send({ to, subject, text, html })` | `FakeEmailSender`: `sent`, `to(email)`, `last(email?)`, `clear()`; cada email con sus `links` | HOG-054 (hasta entonces `LogEmailSender`, que no envía) |
| `PUSH_SENDER` | `PushSender.send(subscription, payload)`, `sendToUser(userId, payload)` | `FakeWebPushSender` (alias `FakePushSender`): `sent`, `setSubscriptions()`, `failWith(endpoint, 'gone' \| 'error')` | HOG-604 (hasta entonces `DisabledPushSender`) |
| `GEMINI_CLIENT` | `GeminiClient.generateStructured({ feature, prompt, schema, … })` | `FakeGeminiClient`: lee `test/fixtures/ai/<nombre>.json` (`{ data, model?, inputTokens?, outputTokens? }`), por defecto `<feature>.ok` (`FRIDGE_DETECT` → `fridge-detect.ok`); `useFixture()`, `failNext()`, `calls`; valida `data` con el `schema` | HOG-650 (hasta entonces `503 AI_UNAVAILABLE`) |

### E2E (`apps/web/e2e`, Playwright)

- `pnpm test:e2e` (o `pnpm --filter @hogaria/web test:e2e`). Proyectos `Pixel 7` y `iPhone 14` (dispositivos de Playwright, sin tamaños a mano); trazas `on-first-retry`; un worker porque la BBDD de test es compartida.
- Navegadores: `pnpm --filter @hogaria/web exec playwright install chromium webkit` (una vez por máquina).
- `webServer` levanta dos servidores en puertos propios (no chocan con `pnpm dev`):
  - **API** en `:3100` con `apps/api/scripts/e2e-server.ts`: resuelve la BBDD de test como los tests de integración (`TEST_DATABASE_URL` → `apps/api/.env.test` → `:5433`, siempre `*_test`), aplica `prisma migrate deploy` (no borra nada), compila y arranca con `NODE_ENV=test` (fakes + test-support).
  - **Web** en `:4173`: `vite build` + `vite preview` con `VITE_API_URL=http://localhost:3100` (orígenes distintos, como en producción).
- Endpoints de apoyo (`apps/api/src/test-support/`, el módulo solo existe con `NODE_ENV=test`; en desarrollo y producción dan 404): `GET /api/v1/test/emails?to=`, `POST /api/v1/test/reset` (trunca y vacía los emails), `POST /api/v1/test/users` (`{ name?, email?, username?, password?, isPlatformAdmin?, group?: { name? }, joinGroupId? }` → `{ userId, email, username, password, groupId, laneColor }`). Sin rate limit.
- Helpers (`apps/web/e2e/helpers`): `resetDb()`, `createUser(opts)`, `lastEmailLink(to)`, `loginAs(page, user)` (lanza "Not implemented" hasta HOG-050) y `twoMembers(browser, { login? })` → `{ a: { page, context, user }, b: …, groupId, close }`, dos contextos independientes del mismo hogar con el dispositivo del proyecto. Hasta HOG-050, `twoMembers` solo funciona con `login: false`.

### Web (`apps/web`)

- `src/test/msw.ts`: servidor MSW compartido, arrancado en `src/test/setup.ts` con `onUnhandledFrame: 'error'` (una petición sin respuesta definida hace fallar el test). Cada test añade las suyas con `server.use(http.get(apiUrl('/x'), () => HttpResponse.json(…)))`; se limpian después de cada test.
- En los tests `VITE_API_URL` vale `http://api.test` (el `fetch` de Node no acepta rutas relativas); `apiUrl(path)` construye la URL completa.

## Flujos críticos (e2e obligatorios)

Proyectos de Playwright: **Mobile Chrome (Pixel 7)** y **Mobile Safari (iPhone 14)**.

| ID | Flujo | Ticket |
|---|---|---|
| E2E-01 | Registro con invitación (email + contraseña) → verificar email → entrar al grupo | E01/E02 |
| E2E-02 | Login con username, cerrar sesión, volver a entrar; login fallido muestra el error genérico | E01 |
| E2E-03 | Registro sin invitación rechazado | E01 |
| E2E-04 | Crear grupo → generar enlace → otro usuario lo acepta → ambos se ven como miembros | E02 |
| E2E-05 | **Tiempo real:** dos contextos de navegador en el mismo grupo; A añade y marca un producto → B lo ve sin recargar | E03/E04 |
| E2E-06 | Lista de la compra: añadir, editar cantidad, marcar, vaciar comprados, añadir indispensables | E04 |
| E2E-07 | Tarea con rotación semanal entre 2 miembros: completar → pasa al siguiente | E07 |
| E2E-08 | Crear receta → planificarla en la comida del martes → enviar ingredientes a la lista | E05/E06 |
| E2E-09 | Nevera: subir foto (fixture) → editar ingredientes → recetas (fake) → guardar receta → faltantes a la lista | E13 |
| E2E-10 | Evento propio editable; evento de otro miembro en solo lectura | E09 |
| E2E-11 | Gasto propio: crear, ver en el resumen, superar el presupuesto muestra aviso; gasto ajeno no editable | E10 |
| E2E-12 | Factura mensual: aparece pendiente → marcar pagada → se ve en el historial | E11 |
| E2E-13 | Asistente: pregunta → respuesta (fake) → acción propuesta → confirmar → producto añadido | E14 |
| E2E-14 | Exportar datos y borrar cuenta | E16 |
| E2E-15 | Autorización: la URL de un grupo ajeno muestra "No encontrado" | E02 |
| E2E-16 | Inicio y navegación: calles de los miembros, 5 pestañas, hoja "Más", cambio de hogar, deep link sin sesión con `?volver=` hasta `?destacar=` y actualización en tiempo real del Inicio | E15 |

Además de los flujos, la suite incluye `a11y.e2e.ts` (axe con WCAG 2.2 AA en tema claro y oscuro, 0 violaciones; spec 17, RN-17-11) y `pwa.e2e.ts` (instalabilidad: manifest, iconos, service worker y arranque sin red; ADR-018).

Las notificaciones push no se prueban de punta a punta (Playwright no las soporta bien). Se prueba la suscripción (registro en la API) y el `ReminderScheduler` con temporizadores falsos en integración.

## Rendimiento

- **Lighthouse CI** (`@lhci/cli`, preset móvil, mediana de 3 ejecuciones) sobre `/entrar`, Inicio y una lista: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95. La categoría "PWA" de Lighthouse ya no existe: la instalabilidad la verifica `pwa.e2e.ts` (ADR-018).
- **`size-limit`** (gzip): JS inicial ≤ 200 KB, cada chunk de ruta ≤ 100 KB, CSS total ≤ 50 KB.

## Cobertura

- Objetivo: **≥ 80 % de líneas** en `packages/shared` y en los `*.service.ts` de la API. No se exige cobertura global de la web.
- CI falla si la cobertura de esos paths baja del umbral.

## CI (GitHub Actions)

```
on: [push, pull_request]
jobs:
  checks:   pnpm install → lint → typecheck → test (unit + integración con service postgres)
            → size-limit → pnpm audit --audit-level high → gitleaks
  e2e:      solo en pull_request a main y push a main; needs checks → build web + api
            → playwright (Pixel 7 + iPhone 14, 2 shards, retries 1) → subir informe y trazas si falla
  lhci:     solo en pull_request a main y push a main; needs checks → Lighthouse CI móvil (informes como artefacto)
  deploy:   solo push a main, needs [checks, e2e, lhci] → ver docs/06-despliegue.md
```
El job `e2e` **no** corre en cada push a ramas de trabajo para no agotar los 2000 min/mes de GitHub Free (spec 17, RN-17-10); `checks` sí.

**Estado actual (`.github/workflows/ci.yml`, HOG-012):** `checks` (install `--frozen-lockfile` → lint → typecheck → test con el servicio `postgres:17` en `:5433` → `pnpm audit --prod --audit-level=high` **no bloqueante** por ahora) y `e2e` (`needs: checks`; navegadores de Playwright en caché por versión; el `webServer` compila API y web; sube `playwright-report` y `test-results` si falla). `concurrency` cancela la ejecución anterior de la misma rama. Caché de pnpm (`setup-node`) y de `.turbo`. Pendientes de sus tickets: `gitleaks`, `size-limit`, shards de e2e, `lhci` (E17) y `deploy` (HOG-022). Dependabot (`.github/dependabot.yml`): `npm` y `github-actions` semanal, grupos `minor-and-patch`, máximo 5 PR; `docker` llega con HOG-021.

**Turborepo y variables de entorno:** Turbo 2 filtra las variables de entorno de las tareas (modo estricto). `turbo.json` declara `passThroughEnv` para `test` (`TEST_DATABASE_URL`, `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) y `test:e2e` (`CI`, `TEST_DATABASE_URL`, `PLAYWRIGHT_*`, `E2E_*`…). Si una tarea necesita otra variable, añádela ahí.
