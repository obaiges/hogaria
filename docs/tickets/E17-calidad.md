# E17 · Calidad, seguridad y producción

> Spec: `docs/specs/17-calidad-produccion.md` · Rango: HOG-850 – HOG-899 · Fase: 6
> Cada ticket se cierra con las casillas `CHK-…` que cubre marcadas y su evidencia (test, salida de comando o nota en el PR).

---

### HOG-850 · Revisar la seguridad contra la checklist de docs/03

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-851, HOG-852, HOG-853, HOG-854, HOG-866
- **Spec:** `docs/specs/17-calidad-produccion.md#21-revisión-de-seguridad-contra-docs03-seguridadmd`

**Descripción**
Recorrer CHK-SEC-01 … CHK-SEC-26, marcar cada una con su evidencia y abrir un ticket nuevo (rango de la épica afectada) por cada hallazgo que no se pueda corregir en menos de 1 h.

**Criterios de aceptación**
- [ ] Las 26 casillas revisadas, con evidencia enlazada en la descripción del PR.
- [ ] Reglas ESLint de CHK-SEC-04, 14 y 15 activas en `packages/config` (`no-restricted-syntax`/`no-restricted-properties`, `react/no-danger`).
- [ ] Test de CHK-SEC-19 (sin secretos en `apps/web/dist`) en el job `checks`.
- [ ] Cada hallazgo pendiente tiene ticket en `BOARD.md` (Backlog).

**Notas técnicas**
- Lista blanca de `findUnique({ where: { id` comentada con el motivo (p. ej. tablas sin `groupId` como `User`).

**Tests**
- Los indicados en cada casilla.

---

### HOG-851 · Configurar la CSP y las cabeceras de seguridad de la web

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-005, HOG-020, HOG-021
- **Spec:** `docs/specs/17-calidad-produccion.md#cabeceras-y-csp-web-appswebpublic_headers` (RN-17-01..03)

**Descripción**
`apps/web/public/_headers` con la CSP ampliada, HSTS, Permissions-Policy y cachés de RN-17-01/02, más un test que lo verifica.

**Criterios de aceptación**
- [ ] `_headers` exactamente con RN-17-01/02.
- [ ] `apps/web/test/headers.spec.ts` verifica cabeceras y directivas.
- [ ] La app funciona en producción sin errores de CSP en consola (login con Google, avatares, socket, SW, push).
- [ ] La CSP y la `Permissions-Policy` coinciden exactamente con `docs/03-seguridad.md`.
- [ ] CHK-SEC-12 marcada.

**Notas técnicas**
- Comprobar con `curl -I https://hogaria.obaiges.com/` y anotar el comando en el runbook (HOG-867).

**Tests**
- Unit: `headers.spec.ts`.

---

### HOG-852 · Endurecer la configuración de la API y del socket

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-003, HOG-150
- **Spec:** `docs/specs/17-calidad-produccion.md#endurecimiento-de-la-api` (RN-17-04..06)

**Descripción**
`trust proxy`, `x-powered-by`, helmet, límite de cuerpo, timeouts, middleware de `Origin`, límites de Socket.IO y desconexión forzada; además, garantizar que `/test/*` y `/api/docs` no existen fuera de su entorno.

**Criterios de aceptación**
- [ ] RN-17-04, RN-17-05 y RN-17-06 implementadas en `main.ts`/`app.module.ts`/`realtime/`.
- [ ] Test: `POST` con `Origin` ajeno y cookie válida → 403 (CHK-SEC-11).
- [ ] Test de cabeceras de la API (CHK-SEC-13).
- [ ] Test con `NODE_ENV=production`: `/test/emails` y `/api/docs` → 404 (CHK-SEC-21/22).
- [ ] `GET /health/db` limitado a 6/min por IP.

**Notas técnicas**
- `apps/api/src/common/middleware/origin-check.middleware.ts`.

**Tests**
- Integración: `apps/api/test/security/hardening.int.spec.ts`.

---

### HOG-853 · Comprobar por introspección que todas las rutas tienen sus guards

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-055, HOG-101
- **Spec:** `docs/specs/17-calidad-produccion.md#autorización-sistemática` (RN-17-07)

**Descripción**
Test que recorre las rutas registradas en Nest y falla si alguna no está protegida como corresponde, más el script `routes:list`.

**Criterios de aceptación**
- [ ] `route-guards.int.spec.ts` con las 3 condiciones de RN-17-07 y la lista blanca `PUBLIC_ROUTES`.
- [ ] Introducir una ruta de grupo sin guard en un test de ejemplo hace fallar el test (prueba negativa).
- [ ] `pnpm --filter api routes:list` imprime método y ruta de todas las rutas.
- [ ] CHK-SEC-01 y CHK-SEC-02 marcadas.

**Notas técnicas**
- `DiscoveryService` + `MetadataScanner` + `Reflector` (`GUARDS_METADATA`, metadato de `@Public()`). `apps/api/src/cli/routes-list.ts` reutiliza el mismo recorrido.

**Tests**
- Integración: el propio test.

---

### HOG-854 · Crear la matriz de autorización de todos los módulos

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-853, HOG-010
- **Spec:** `docs/specs/17-calidad-produccion.md#autorización-sistemática` (RN-17-08)

**Descripción**
Helper `runAuthorizationCases()` y un archivo de casos por módulo que generan los tests 401/404/403 de `docs/03`, con verificación de que ninguna ruta queda fuera.

**Criterios de aceptación**
- [ ] Helper en `apps/api/test/security/authorization-matrix.ts` con los tipos `group`, `owned`, `private`, `personal`.
- [ ] Archivos de casos para grupos, invitaciones, actividad, compra, recetas, comidas, dietas, tareas, horarios, calendario, gastos, facturas, notificaciones, IA, asistente, inicio, perfil/exportación y admin.
- [ ] El test falla si una ruta de `routes:list` no tiene caso (salvo públicas y `/api/auth/*`).
- [ ] Los tests de autorización que ya existan en cada módulo pueden quedarse; no se duplican casos nuevos con distinto resultado.
- [ ] CHK-SEC-03 y CHK-QA-02 marcadas.

**Notas técnicas**
- Factories `createGroupWithMembers(2)` + `createUser()` ajeno; cada caso declara `create(ctx)` y `body`.

**Tests**
- Integración: `authorization-matrix.int.spec.ts`.

---

### HOG-855 · Ejecutar la suite e2e completa en CI

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-011, HOG-012, HOG-662, HOG-714, HOG-766, HOG-812
- **Spec:** `docs/specs/17-calidad-produccion.md#e2e-en-ci` (RN-17-09/10)

**Descripción**
Job `e2e` con Postgres de servicio, API en modo test, web servida, 2 shards, reintento, trazas y artefactos, y disparadores ajustados al presupuesto de minutos.

**Criterios de aceptación**
- [ ] E2E-01 … E2E-16 pasan en Pixel 7 y iPhone 14 (CHK-QA-01).
- [ ] 2 shards, `retries: 1`, `trace: 'on-first-retry'`, artefactos solo en fallo.
- [ ] Disparadores de RN-17-10; cachés de pnpm y navegadores.
- [ ] Duración ≤ 12 min (anotar la medida en el PR).
- [ ] El workflow coincide con la sección CI de `docs/07-testing.md`.

**Notas técnicas**
- `.github/workflows/ci.yml`, `apps/web/playwright.config.ts` (`webServer` para API y `vite preview`).

**Tests**
- E2E: toda la suite.

---

### HOG-856 · Añadir comprobaciones de accesibilidad con axe en Playwright

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-855
- **Spec:** `docs/specs/17-calidad-produccion.md#accesibilidad` (RN-17-11)

**Descripción**
`a11y.e2e.ts` que analiza con axe todas las pantallas de RN-17-11 en claro y oscuro, corrigiendo las violaciones encontradas.

**Criterios de aceptación**
- [ ] Pantallas y etiquetas WCAG de RN-17-11; 0 violaciones (CHK-QA-04).
- [ ] Excepciones solo en `a11y.exceptions.ts`, por regla y selector, con justificación.
- [ ] Corregidas las violaciones (si una corrección es grande, ticket aparte y excepción temporal con el ID del ticket).

**Notas técnicas**
- `@axe-core/playwright`; usar el seed de e2e y fakes para llegar a los estados (paso 4 de la nevera, propuesta del asistente).

**Tests**
- E2E: `apps/web/e2e/a11y.e2e.ts`.

---

### HOG-857 · Hacer la revisión manual de accesibilidad con lectores de pantalla

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-856
- **Spec:** `docs/specs/17-calidad-produccion.md#accesibilidad` (RN-17-12)

**Descripción**
Revisión manual con teclado, VoiceOver (iOS), TalkBack (Android), zoom 200 % y movimiento reducido en los flujos indicados.

**Criterios de aceptación**
- [ ] Resultados por flujo (E2E-05, 06, 07, 09) anotados en el PR.
- [ ] Problemas encontrados corregidos o con ticket propio.

**Tests**
- Manual.

---

### HOG-858 · Medir el rendimiento con Lighthouse CI en móvil

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-855, HOG-865
- **Spec:** `docs/specs/17-calidad-produccion.md#rendimiento-y-pwa` (RN-17-13)

**Descripción**
Job de LHCI con preset móvil sobre `/entrar`, Inicio y una lista, con sesión iniciada mediante script y umbrales de RN-17-13.

**Criterios de aceptación**
- [ ] `lighthouserc.cjs` con URLs, 3 ejecuciones, `assertions` (Rendimiento ≥ 0,9, Accesibilidad ≥ 0,95, Buenas prácticas ≥ 0,95).
- [ ] Informes guardados como artefacto (no en almacenamiento público).
- [ ] Umbrales alcanzados (CHK-QA-05); las mejoras necesarias, hechas o en tickets.

**Notas técnicas**
- `puppeteerScript` que inicia sesión con un usuario del seed contra la API de test.

**Tests**
- CI: job `lhci`.

---

### HOG-859 · Verificar la instalabilidad de la PWA con Playwright

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-855
- **Spec:** `docs/specs/17-calidad-produccion.md#rendimiento-y-pwa` (RN-17-14)

**Descripción**
`pwa.e2e.ts` que comprueba manifest, iconos, metas de iOS, service worker y arranque sin red con el aviso de conexión.

**Criterios de aceptación**
- [ ] Todas las comprobaciones de RN-17-14 (CHK-QA-06).
- [ ] Cumple ADR-018 (instalabilidad verificada con Playwright; no se usa la categoría PWA de Lighthouse).

**Tests**
- E2E: `apps/web/e2e/pwa.e2e.ts` (solo proyecto Pixel 7; el SW de WebKit en Playwright es limitado).

---

### HOG-860 · Dividir el bundle por rutas y fijar presupuestos de tamaño

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-750
- **Spec:** `docs/specs/17-calidad-produccion.md#rendimiento-y-pwa` (RN-17-15)

**Descripción**
Revisar que cada ruta es un chunk, configurar `manualChunks`, subconjuntos de fuentes y `size-limit` en CI, y añadir el informe de análisis bajo demanda.

**Criterios de aceptación**
- [ ] Ninguna página de feature en el chunk de entrada (comprobado en el informe).
- [ ] Recharts solo en el chunk de gastos.
- [ ] Fuentes `woff2` `latin` + `latin-ext` únicamente.
- [ ] `.size-limit.json` con los 3 presupuestos de RN-17-15 y paso en el job `checks` (CHK-QA-07).
- [ ] `pnpm --filter web analyze` funciona.

**Notas técnicas**
- `apps/web/vite.config.ts` (`build.rollupOptions.output.manualChunks`), `rollup-plugin-visualizer` como devDependency.

**Tests**
- CI: `size-limit`.

---

### HOG-861 · Configurar logs de producción con redacción y retención de 14 días

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** infra
- **Depende de:** HOG-003, HOG-022
- **Spec:** `docs/specs/17-calidad-produccion.md#observabilidad-0-` (RN-17-16..18)

**Descripción**
`nestjs-pino` con plantilla de ruta, `requestId`, redacción y eventos de negocio; Docker con driver `journald` y retención de 14 días en la VM.

**Criterios de aceptación**
- [ ] Campos y redacción de RN-17-17; nunca URL real, cuerpos ni query strings.
- [ ] Eventos de RN-17-18 registrados (`account.deleted`, `data.exported`, `ai.call`, `reminder.*`).
- [ ] `docker-compose.prod.yml` con `logging.driver: journald` y `deploy/journald/hogaria.conf` (`MaxRetentionSec=14day`, `SystemMaxUse=500M`), instalado según el runbook.
- [ ] Cumple ADR-017 y lo descrito en `docs/03-seguridad.md` (Logs) y `docs/06-despliegue.md`.
- [ ] CHK-SEC-17 y CHK-QA-08 marcadas.

**Notas técnicas**
- `apps/api/src/common/logging/logger.config.ts`. La plantilla sale de `req.route?.path` con el prefijo global.

**Tests**
- Unit: un log con cookie, `password` y `/invites/abc` sale redactado y con `/invites/:token`.

---

### HOG-862 · Añadir healthcheck de Docker y monitor externo opcional

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P2 · **Puntos:** 1
- **Capa:** infra
- **Depende de:** HOG-003, HOG-022
- **Spec:** `docs/specs/17-calidad-produccion.md#observabilidad-0-` (RN-17-19/20)

**Descripción**
`GET /health` con versión y uptime, `HEALTHCHECK` en el `Dockerfile.api` y, opcionalmente, monitores gratuitos de UptimeRobot documentados.

**Criterios de aceptación**
- [ ] Respuesta de `/health` de RN-17-19 sin tocar la BBDD (test con espía de Prisma).
- [ ] `HEALTHCHECK` en `deploy/Dockerfile.api`; `docker inspect` muestra `healthy`.
- [ ] Sección "Monitor externo (opcional)" en `deploy/README.md` con los pasos de UptimeRobot.
- [ ] CHK-QA-09 marcada.

**Notas técnicas**
- `version` desde la variable `GIT_SHA` inyectada en el build de la imagen.

**Tests**
- Integración: `/health` no ejecuta consultas.

---

### HOG-863 · Programar copias de seguridad semanales cifradas

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-022
- **Spec:** `docs/specs/17-calidad-produccion.md#copias-de-seguridad` (RN-17-21..24)

**Descripción**
`deploy/backup.sh` con `pg_dump` → `age` → `rclone` a Oracle Object Storage, retención de 8 copias, *timer* de systemd semanal, rol de solo lectura en Neon y heartbeat opcional.

**Criterios de aceptación**
- [ ] Script según RN-17-21 (volcado en claro nunca a disco; `trap` de limpieza; recuentos de tablas registrados en el log).
- [ ] `deploy/systemd/hogaria-backup.{service,timer}` y pasos de instalación en `deploy/README.md`.
- [ ] `backup.env` documentado (RN-17-22) y añadido a `.gitignore`; ejemplo `deploy/backup.env.example` sin valores.
- [ ] Bucket privado en región UE con regla de ciclo de vida de 70 días (RN-17-24).
- [ ] Clave privada de `age` fuera de la VM (RN-17-23), documentado.
- [ ] Una ejecución real deja el objeto en el bucket (CHK-QA-10).
- [ ] `shellcheck deploy/*.sh` en CI.

**Notas técnicas**
- Comprobar la versión de Postgres de Neon y fijar la etiqueta de la imagen `postgres` coherente.

**Tests**
- CI: `shellcheck`. Manual: ejecución real con evidencia.

---

### HOG-864 · Documentar y probar la restauración de una copia

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** infra
- **Depende de:** HOG-863, HOG-808
- **Spec:** `docs/specs/17-calidad-produccion.md#restauración` (RN-17-25/26)

**Descripción**
Procedimiento de restauración en `deploy/README.md`, `deploy/verify-restore.sql`, CLI `delete-user` y una prueba real registrada.

**Criterios de aceptación**
- [ ] Sección "Restaurar una copia" con los 4 pasos de RN-17-25.
- [ ] `deploy/verify-restore.sql` con los recuentos indicados.
- [ ] `pnpm --filter api cli delete-user --id <uuid>` reutilizando `UserDeletionService` (E16).
- [ ] Prueba real en Postgres local registrada en "Registro de pruebas de restauración" (CHK-QA-11).

**Tests**
- Unit: CLI `delete-user` con id inexistente → mensaje y código de salida 1.
- Manual: restauración.

---

### HOG-865 · Ampliar el seed con datos de demo de todos los módulos

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-013, HOG-050
- **Spec:** `docs/specs/17-calidad-produccion.md#runbook-dependencias-seed-y-documentación` (RN-17-29)

**Descripción**
Ampliar el seed mínimo de HOG-013 (`apps/api/prisma/seed.ts`) con datos de demo de todos los módulos, de forma idempotente y determinista. Reutiliza los usuarios y el hogar de HOG-013; no los vuelve a crear.

**Criterios de aceptación**
- [ ] Añade `seedModules()` con el contenido de RN-17-29 para todos los módulos (y los usuarios o grupos extra que pida RN-17-29) sobre el hogar de HOG-013.
- [ ] Amplía la protección de HOG-013: además de `NODE_ENV=production`, se niega con host `*.neon.tech` (mensaje claro y salida 1).
- [ ] Idempotente: dos ejecuciones seguidas sin error ni duplicados (CHK-QA-14).
- [ ] Los usuarios extra usan el mismo `hashPassword` de Better Auth que HOG-013 (mismo hash que el registro).
- [ ] `README.md` raíz explica cómo entrar con los usuarios de demo.

**Notas técnicas**
- `apps/api/prisma/seed.ts`; fechas con `lib/dates` de shared en `Europe/Madrid`.

**Tests**
- Integración: el seed se ejecuta sobre `hogaria_test` y comprueba recuentos.

---

### HOG-866 · Activar Dependabot, pnpm audit y gitleaks

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** infra
- **Depende de:** HOG-012
- **Spec:** `docs/specs/17-calidad-produccion.md#runbook-dependencias-seed-y-documentación` (RN-17-28)

**Descripción**
Mantenimiento automático de dependencias y detección de vulnerabilidades y secretos en CI.

**Criterios de aceptación**
- [ ] `.github/dependabot.yml` con `npm`, `github-actions` y `docker`, semanal, grupos `minor-and-patch` y máximo 5 PR (CHK-QA-12).
- [ ] `pnpm audit --prod --audit-level=high` en `checks` (CHK-SEC-23).
- [ ] `gitleaks` en `checks` sin hallazgos (CHK-SEC-24).

**Tests**
- CI verde con los pasos nuevos.

---

### HOG-867 · Escribir el runbook de incidencias

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** infra
- **Depende de:** HOG-022, HOG-861, HOG-863
- **Spec:** `docs/specs/17-calidad-produccion.md#runbook-dependencias-seed-y-documentación` (RN-17-27)

**Descripción**
Sección "Incidencias" de `deploy/README.md` con síntoma, diagnóstico y solución para cada caso de RN-17-27, incluida la rotación de secretos y las comprobaciones de seguridad.

**Criterios de aceptación**
- [ ] Todos los casos de RN-17-27 con comandos reales (`docker compose ps/logs`, `journalctl`, `curl -I`, `df -h`, `fail2ban-client status`, etc.).
- [ ] Rotación de cada secreto con sus consecuencias (sesiones cerradas, re-suscripción push).
- [ ] Comprobaciones de CHK-SEC-07, 12 y 20 con su comando.
- [ ] CHK-QA-13 marcada.

**Tests**
- Manual: un simulacro (parar el contenedor de la API y recuperarlo siguiendo el runbook) anotado en el PR.

---

### HOG-868 · Actualizar la documentación final

- **Épica:** E17 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** full-stack
- **Depende de:** HOG-850, HOG-855, HOG-863, HOG-865, HOG-867
- **Spec:** `docs/specs/17-calidad-produccion.md#runbook-dependencias-seed-y-documentación` (RN-17-30)

**Descripción**
Dejar los documentos canónicos coherentes con lo construido. Las secciones 12 de las specs ya se aplicaron a los canónicos el 2026-11-11; este ticket revisa que lo implementado no se haya desviado de ellos.

**Criterios de aceptación**
- [ ] Todos los puntos de RN-17-30 revisados y marcados en el PR.
- [ ] Toda divergencia entre el código y los canónicos (`docs/02`, `docs/04`, `docs/05`, `docs/06`) se corrige en el documento o tiene ticket.
- [ ] Los comandos de `AGENTS.md` §7 existen y funcionan.
- [ ] CHK-QA-15 marcada.

**Tests**
- `pnpm lint && pnpm typecheck && pnpm test` verdes; enlaces internos de `docs/` sin rotos (script `pnpm docs:links` con `markdown-link-check` en local).
