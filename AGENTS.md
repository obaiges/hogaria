# AGENTS.md — Guía para agentes de IA (Claude Code, OpenCode, Cursor, etc.)

> Este archivo es la **fuente de verdad** de cómo se trabaja en Hogaria. Cualquier IA que trabaje en el repo lo lee primero.
> `CLAUDE.md` solo redirige aquí. Si hay conflicto entre documentos, se aplica el **orden de autoridad** de abajo.

## 1. Qué es Hogaria (resumen de 30 segundos)

Hogaria es una **PWA mobile-first en español** para gestionar un hogar compartido: listas de la compra, recetas, planificador de comidas, tareas con rotación, horarios de trabajo, calendario, gastos de ocio, gastos fijos y facturas, todo con **IA** (Gemini). Por ejemplo, haces una foto a la nevera y te propone recetas, o le preguntas al asistente. Los usuarios se agrupan en **grupos (hogares)** y ven los cambios de los demás **en tiempo real**. El acceso es **solo por invitación**. El coste de infraestructura es **0 €**.

## 2. Orden de autoridad de la documentación

Cuando dos documentos se contradicen, gana el que está más arriba. Corrige después el de abajo en el mismo PR.

1. `docs/09-decisiones.md` (ADRs aceptados)
2. `docs/02-modelo-datos.md` (modelo de datos canónico)
3. `docs/04-api-y-tiempo-real.md` (contratos de API y eventos)
4. `docs/specs/*.md` (comportamiento de cada módulo)
5. `docs/tickets/*.md` (unidades de trabajo)
6. `DESIGN.md` (sistema visual) y `PRODUCT.md` (contexto de producto)
7. Resto de `docs/`

## 3. Mapa de la documentación

| Archivo | Contenido |
|---|---|
| `PRODUCT.md` | Usuarios, propósito y principios de producto |
| `DESIGN.md` | Sistema de diseño "Piscina municipal": tokens, tipografía, componentes, logo |
| `BOARD.md` | **Única fuente del estado de los tickets** (kanban + diagrama de dependencias) |
| `docs/00-vision-alcance.md` | Alcance completo, módulos, fases, fuera de alcance |
| `docs/01-arquitectura.md` | Stack, estructura del monorepo, librerías, flujos |
| `docs/02-modelo-datos.md` | Esquema Prisma canónico y reglas de datos |
| `docs/03-seguridad.md` | Login, sesiones, invitaciones, autorización, RGPD |
| `docs/04-api-y-tiempo-real.md` | Convenciones REST, errores, eventos Socket.IO |
| `docs/05-ia.md` | Gemini: nevera, asistente, tickets, límites, prompts |
| `docs/06-despliegue.md` | Infraestructura gratuita, DNS, variables de entorno |
| `docs/07-testing.md` | Estrategia de tests unitarios, de integración y e2e |
| `docs/08-convenciones.md` | Código, git, nombres, estilo |
| `docs/09-decisiones.md` | Registro de decisiones (ADR) |
| `docs/10-glosario.md` | Términos en español ↔ identificadores en código |
| `docs/specs/` | Una spec por módulo |
| `docs/tickets/` | Tickets agrupados por épica |
| `docs/templates/` | Plantillas de spec y de ticket |

## 4. Flujo de trabajo obligatorio para cada ticket

1. Abre `BOARD.md` y elige el **primer ticket de "To Do"** cuyas dependencias estén todas en "Done". Si "To Do" está vacío, toma el siguiente de "Backlog" respetando el orden de fases.
2. Lee el ticket (`docs/tickets/EXX-*.md`), su spec (`docs/specs/*.md`) y las secciones del modelo de datos y de la API que menciona.
3. Mueve el ticket a **"In Progress"** en `BOARD.md`. Nunca trabajes en más de un ticket a la vez.
4. Implementa **solo** lo que pide el ticket. Si descubres trabajo extra, crea un ticket nuevo (ver §6) en lugar de ampliar el alcance.
5. Escribe los tests que pide el ticket (ver `docs/07-testing.md`). `pnpm lint && pnpm typecheck && pnpm test` deben pasar.
6. Si cambias el modelo de datos, la API o una decisión, **actualiza el documento canónico en el mismo commit**. Si cambia una decisión, añade un ADR.
7. Marca los criterios de aceptación del ticket como `[x]`, mueve el ticket a **"Done"** en `BOARD.md` y ejecuta `pnpm board:progress`. El script pinta de verde en los diagramas de `BOARD.md` los tickets cerrados, y de verde claro o verde las épicas y fases empezadas o terminadas. Los cambios van en el mismo commit que el ticket, así el progreso se ve en GitHub en cuanto se sube.
8. Haz commit siguiendo `docs/08-convenciones.md` (por ejemplo `feat(shopping): HOG-204 marcar producto como comprado`).

## 5. Reglas que nunca se rompen

- **Identificadores de código en inglés; textos de la interfaz en español.** El glosario (`docs/10-glosario.md`) fija las traducciones. No inventes sinónimos.
- **Todo dato de un grupo se consulta filtrando por `groupId`** y pasando el `GroupMemberGuard`. Nunca hay endpoints de grupo sin guard.
- **Dinero en céntimos enteros** (`amountCents: Int`). Nunca `float`.
- **Fechas y horas:** los instantes se guardan como `timestamptz` en UTC y los días como `@db.Date`. La zona horaria del grupo es `Europe/Madrid` por defecto.
- **Validación con zod** en `packages/shared`. Front y back importan el mismo esquema.
- **Secretos solo en variables de entorno.** Nunca en el código ni en los `.md`. `.env*` está en `.gitignore`, salvo `.env.example`.
- **Nada de polling a la base de datos cada minuto.** Neon cobra por horas de cómputo despierto (ver ADR-004).
- **La clave de Gemini solo vive en el backend.**
- **No se guardan fotos.** Las imágenes de la nevera y de los tickets se procesan en memoria y se descartan.
- **Las mutaciones van por REST y los eventos en tiempo real por Socket.IO.** El socket nunca se usa para escribir datos.
- **Coste 0 €.** No añadas servicios de pago. Si un servicio gratuito tiene límites, documéntalos en `docs/06-despliegue.md`.

## 6. Crear o modificar tickets

- IDs con formato `HOG-NNN`. Cada épica tiene un rango reservado (ver la tabla en `docs/tickets/README.md`). Usa el siguiente número libre del rango.
- Usa la plantilla `docs/templates/ticket.md`.
- Añade el ticket nuevo a la columna "Backlog" de `BOARD.md` y, si tiene dependencias, al diagrama.
- **El estado de un ticket solo existe en `BOARD.md`.** Los archivos de tickets no llevan campo de estado.

## 7. Comandos (cuando exista el código)

```bash
pnpm install              # instala todo el monorepo
pnpm dev                  # web (5173) + api (3000) + postgres local (docker)
pnpm lint                 # ESLint en todo el repo
pnpm typecheck            # tsc --noEmit en todos los paquetes
pnpm test                 # Vitest (unitarios + integración)
pnpm test:e2e             # Playwright (requiere pnpm dev o lo levanta solo)
pnpm db:migrate           # prisma migrate dev
pnpm board:progress       # colorea en BOARD.md los tickets en Done (y épicas/fases), idempotente
pnpm db:seed              # seed: mínimo (owner + grupo + 2 miembros, HOG-013) ampliado con datos de todos los módulos (HOG-865)
pnpm --filter api cli create-owner --email x --username y   # primer usuario (administrador de la plataforma)
pnpm --filter api cli delete-user --id <uuid>               # borra una cuenta (p. ej. tras restaurar una copia)
pnpm --filter api routes:list                               # imprime las rutas descubiertas (contrastar con docs/04)
pnpm --filter web analyze                                   # informe del bundle (rollup-plugin-visualizer)
```

## 8. Definition of Done

- [ ] Se cumplen los criterios de aceptación del ticket
- [ ] Hay tests unitarios de la lógica nueva y un e2e si el ticket toca un flujo crítico (ver `docs/07-testing.md`)
- [ ] Pasan lint, typecheck y tests
- [ ] Textos de la interfaz en español, accesibles (labels, foco, contraste) y siguiendo `DESIGN.md`
- [ ] Funciona en un viewport de 375 px y en modo oscuro
- [ ] Documentación canónica actualizada si cambió algo
- [ ] `BOARD.md` actualizado
