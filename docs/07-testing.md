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

- `docker-compose.yml` levanta `postgres:17` en el puerto 5433 para tests.
- Antes de cada suite de integración: `prisma migrate reset --force --skip-seed` sobre `hogaria_test`.
- Cada test crea sus datos con *factories* (`apps/api/test/factories/*.ts`: `createUser()`, `createGroupWithMembers(n)`, …). Nada de depender de un seed global.
- Aislamiento: truncado de tablas entre tests (`TRUNCATE … CASCADE`), más rápido que las transacciones con Nest.

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
