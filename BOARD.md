# BOARD — Hogaria

> **Única fuente de verdad del estado de los tickets.** Los archivos de `docs/tickets/` no llevan estado.
> Flujo (ver `AGENTS.md` §4): coge el **primer** ticket de *To Do* → muévelo a *In Progress* → al terminar, a *Done* → rellena *To Do* con los siguientes de *Backlog* cuyas dependencias estén todas en *Done* (respetando el orden de la tabla, que ya está ordenada topológicamente).
> Para mover un ticket, **corta su fila** de una sección y **pégala** en la otra. No cambies la columna "Depende de".

**Resumen:** 235 tickets · 703 puntos · 18 épicas · 7 fases
_Generado el 2026-11-11 a partir de docs/tickets/. Si añades tickets, añádelos a mano en Backlog en el sitio que respete sus dependencias._

## Leyenda
- **Prioridad:** P0 bloqueante de la fase · P1 necesario en la fase · P2 mejora · P3 opcional
- **Puntos:** 1 ≈ <1 h · 2 ≈ medio día · 3 ≈ 1 día · 5 ≈ 2–3 días · 8 ≈ dividir

---

## In Progress
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|

## To Do
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-008 | Adaptar los componentes UI base de shadcn al sistema "Piscina municipal" | E00 | P0 | 5 | HOG-007 |
| HOG-023 | Configurar los servicios externos: Neon, Google OAuth y Resend | E00 | P1 | 2 | — |

## Done
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-001 | Crear el monorepo con pnpm, Turborepo y configuración compartida | E00 | P0 | 3 | — |
| HOG-002 | Crear `packages/shared` con dinero, fechas, errores, constantes y tipos de tiempo real | E00 | P0 | 5 | HOG-001 |
| HOG-003 | Crear el esqueleto de `apps/api` con NestJS, Prisma, PostgreSQL y salud | E00 | P0 | 5 | HOG-002 |
| HOG-004 | Definir el esquema Prisma completo y la migración inicial | E00 | P0 | 5 | HOG-003 |
| HOG-005 | Crear el esqueleto de `apps/web` con Vite, React, Router, Query, Tailwind y PWA | E00 | P0 | 5 | HOG-002 |
| HOG-006 | Implementar el manejo global de errores y el `apiClient` web con `X-Client-Mutation-Id` | E00 | P0 | 3 | HOG-002, HOG-003, HOG-005 |
| HOG-007 | Aplicar los tokens de diseño, las fuentes Barlow autoalojadas y el tema claro/oscuro | E00 | P0 | 3 | HOG-005 |

## Backlog (235)

