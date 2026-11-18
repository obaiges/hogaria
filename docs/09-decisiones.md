# 09 · Registro de decisiones (ADR)

> Formato: contexto → decisión → consecuencias. Los ADR no se editan. Si una decisión cambia, se añade un ADR nuevo y el antiguo se marca como "Sustituido por ADR-0XX".

### ADR-001 · PWA en lugar de app nativa — Aceptado (2026-11-11)
**Contexto:** se quiere instalar en Android e iOS sin publicar en tiendas y sin coste. iOS no permite instalar apps nativas fuera de la App Store sin una cuenta de pago.
**Decisión:** Progressive Web App instalable desde `hogaria.obaiges.com`.
**Consecuencias:** en iOS el push solo funciona con la app añadida a la pantalla de inicio (iOS ≥ 16.4), así que la app debe guiar la instalación. Más adelante se puede empaquetar con Capacitor si hiciera falta.

### ADR-002 · React + Vite (SPA) para el frontend — Aceptado
**Contexto:** la app es privada y no necesita SEO. Se busca una tecnología demandada en el mercado y alojamiento estático gratuito.
**Decisión:** React + Vite + TypeScript + vite-plugin-pwa. Se descartan Next.js (el SSR no aporta nada aquí) y Expo/React Native (sería peor como PWA).
**Consecuencias:** se despliega como estático en Cloudflare Pages. El routing es cliente.

### ADR-003 · NestJS + Prisma para el backend — Aceptado
**Contexto:** son muchos módulos, se necesita estructura clara para que distintas IAs mantengan la coherencia y es un stack demandado.
**Decisión:** NestJS (Express) + Prisma + zod compartido.
**Consecuencias:** hace falta un servidor Node siempre encendido (ver ADR-007).

### ADR-004 · PostgreSQL en Neon y nada de polling — Aceptado
**Contexto:** el plan gratuito de Neon limita las horas de cómputo y suspende la base de datos cuando está inactiva.
**Decisión:** Neon como BBDD. Ningún proceso consulta la BBDD con una frecuencia mayor que cada 6 h sin que haya tráfico de usuarios.
**Consecuencias:** los recordatorios se programan en memoria (ver `docs/01-arquitectura.md`). La primera consulta tras un rato de inactividad puede tardar unos 0,5–1 s (cold start de Neon).

### ADR-005 · Better Auth con registro solo por invitación — Aceptado
**Contexto:** se pide un login muy seguro, propio (email/username + contraseña) más Google, sin pagar un SaaS.
**Decisión:** Better Auth autoalojado con los datos en nuestra BBDD, plugin `username` y Google OAuth. Hooks para exigir invitación al crear el usuario. Sesiones de 365 días deslizantes. Sin 2FA por ahora.
**Consecuencias:** las cookies se comparten entre `hogaria.obaiges.com` y `api.hogaria.obaiges.com` gracias a `Domain=.hogaria.obaiges.com`.

### ADR-006 · Socket.IO solo para difundir eventos — Aceptado
**Decisión:** las mutaciones por REST y los eventos por Socket.IO con una sala por grupo. Sincronización por invalidación o `setQueryData` en TanStack Query.
**Consecuencias:** no hay CRDT. Last-write-wins, salvo en la lista de la compra (versión por elemento).

### ADR-007 · Oracle Cloud Always Free para la API — Aceptado
**Contexto:** hace falta un proceso siempre encendido (WebSockets y temporizadores) y 0 €.
**Decisión:** VM Always Free de Oracle + Docker + Caddy. Plan B: Render Free + ping externo (degradado).
**Consecuencias:** Oracle pide tarjeta solo para verificar. Hay que mantener la VM (actualizaciones automáticas).

### ADR-008 · Cloudflare Pages para el frontend y DNS en Netlify — Aceptado
**Decisión:** el estático en Cloudflare Pages, enlazado con un CNAME desde el DNS de Netlify, donde ya está `obaiges.com`.

### ADR-009 · Gemini en el backend con límites por grupo — Aceptado
**Decisión:** `@google/genai`, modelo configurable, salida JSON validada con zod, límites diarios por grupo y fotos no persistidas. Aviso de privacidad del plan gratuito.

### ADR-010 · Web Push con VAPID — Aceptado
**Decisión:** web-push nativo (sin Firebase SDK en el cliente), con un service worker propio usando vite-plugin-pwa `injectManifest`.

### ADR-011 · Monorepo pnpm + Turborepo con `@hogaria/shared` — Aceptado
**Decisión:** un repo con `apps/web`, `apps/api` y `packages/shared` (zod, constantes, eventos, errores).

### ADR-012 · Código en inglés e interfaz en español — Aceptado
**Decisión:** identificadores en inglés y textos de la interfaz en español. Glosario obligatorio para evitar sinónimos entre agentes.

### ADR-013 · Representación de tiempo y dinero — Aceptado
**Decisión:** `timestamptz` UTC para los instantes, `date` para los días, `"HH:mm"` para las horas locales y zona horaria por grupo (`Europe/Madrid`). Dinero en céntimos `Int`. Recurrencias con RRULE (librería `rrule`).

### ADR-014 · Sin roles; reglas de propiedad — Aceptado (ampliado por ADR-019)
**Decisión:** todos los miembros pueden hacerlo todo, salvo los recursos con dueño (eventos, horarios, gastos de ocio, presupuestos, dieta y conversaciones del asistente). Un grupo se borra cuando sale su último miembro.

### ADR-015 · Sin modo offline — Aceptado
**Decisión:** el service worker solo precachea el *shell* para que la app arranque rápido. Sin conexión se muestra un aviso y se bloquea la edición.

### ADR-016 · Tipografía Barlow autoalojada y sistema "Piscina municipal" — Aceptado
**Decisión:** dirección visual "Piscina municipal" (ver `DESIGN.md`), con Barlow y Barlow Condensed servidas desde el propio dominio (sin Google Fonts CDN: privacidad y CSP).

### ADR-017 · Logs en journald con retención de 14 días — Aceptado (2026-11-11)
**Contexto:** hacen falta logs para diagnosticar incidencias sin pagar un servicio externo, y la política de privacidad debe declarar cuánto se conservan (pueden incluir `userId`, `groupId` e IP).
**Decisión:** la API escribe JSON con `nestjs-pino` a stdout; Docker usa el driver `journald` en la VM, con `MaxRetentionSec=14day` y `SystemMaxUse=500M`. Se registra la plantilla de ruta (nunca la URL real) y se redactan cookies, cabeceras de autorización, contraseñas y tokens (spec 17, RN-17-16/17).
**Consecuencias:** 0 € y sin servicios de terceros. Los logs se pierden a los 14 días, así que el procedimiento tras restaurar una copia se apoya primero en `SecurityEvent ACCOUNT_DELETED`. La consulta es con `journalctl` por SSH.

### ADR-018 · Instalabilidad PWA verificada con Playwright en lugar de la categoría PWA de Lighthouse — Aceptado (2026-11-11)
**Contexto:** la categoría "PWA" desapareció de Lighthouse (≥ v12), así que el objetivo "Lighthouse PWA ≥ 90" ya no se puede medir.
**Decisión:** la instalabilidad se comprueba con `apps/web/e2e/pwa.e2e.ts` (manifest completo con `lang: "es"` e iconos 192/512 con uno `maskable`, metadatos de iOS, service worker que controla la página y arranque sin red con el aviso "Sin conexión"). Lighthouse CI se mantiene para Rendimiento ≥ 90, Accesibilidad ≥ 95 y Buenas prácticas ≥ 95.
**Consecuencias:** cualquier referencia a "Lighthouse PWA ≥ 90" queda sustituida por este test. El test corre en el job `e2e` de CI.

### ADR-019 · Salir de un grupo borra el contenido personal de ese grupo — Aceptado (2026-11-11)
**Contexto:** ADR-014 define recursos con dueño (eventos, gastos, presupuestos, conversaciones del asistente…). Si un miembro sale o es expulsado, sus recursos quedarían en el grupo sin nadie que pueda editarlos o borrarlos, y seguiría habiendo datos personales suyos en un grupo al que ya no pertenece.
**Decisión:** al salir o ser expulsado de un grupo (y al borrar la cuenta, que reutiliza la misma lógica con `removeMember(tx, groupId, userId, { reason })`), dentro de la misma transacción se ejecutan los `MemberRemovedHooks` de cada módulo (spec 02, RN-02-22):
- E06: se quita al usuario de `MealPlanEntry.forUserIds` y se **borran** las entradas que eran solo para él.
- E07: se quita de `Task.rotationUserIds` y, si era `currentAssigneeId`, la tarea pasa al siguiente de la rotación (o `null`).
- E09: se borran sus `CalendarEvent` de ese grupo.
- E10: se borran sus `Expense` y `Budget` de ese grupo.
- E11: `Bill.responsibleUserId = null` en las facturas de las que era responsable.
- E12: tras el commit, `scheduler.cancelForUserInGroup(userId, groupId)` y `scheduler.rebuildGroup(groupId)`.
- E14: se borran sus `AiConversation` de ese grupo (`AssistantConversationsService.deleteAllForMember`).
El contenido compartido (listas, recetas, tareas creadas, facturas, actividad) se queda en el grupo. Los datos personales que no son de un grupo (horarios, dieta) siguen siendo del usuario.
**Consecuencias:** salir de un grupo es destructivo para el contenido personal y la interfaz lo avisa antes de confirmar. No hay transferencia de contenido entre miembros. Cada módulo nuevo con datos personales o referencias a miembros debe registrar su manejador.

### ADR-020 · CI solo bajo demanda — Aceptado (2026-11-18)
**Contexto:** el workflow `CI` se ejecutaba en cada push y pull request. Con varios commits al día (incluidos los de agentes de IA) y las PR semanales de Dependabot, los 2000 min/mes de GitHub Free se agotarían sin aportar nada: lint, typecheck y tests ya se pasan en local antes de cada commit (AGENTS.md §4).
**Decisión:** `.github/workflows/ci.yml` solo tiene el disparador `workflow_dispatch`. Se lanza a mano cuando el propietario lo pide (Actions → CI → *Run workflow* o `gh workflow run ci.yml --ref main`), con un input `e2e` (por defecto `true`) para incluir o no los e2e. Ni push ni pull request (tampoco las de Dependabot) lo ejecutan.
**Consecuencias:** sustituye la regla de disparadores de spec 17 RN-17-10. Un agente de IA no lanza el CI por su cuenta: verifica en local y solo ejecuta `gh workflow run` cuando el usuario se lo pide. Las PR de Dependabot llegan sin CI; antes de fusionarlas se lanza el workflow sobre su rama. Cuando lleguen `lhci`, `gitleaks` y `deploy` (E17, HOG-022) se decidirá su disparador sin romper este ADR.

