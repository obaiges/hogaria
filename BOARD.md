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

## 🟡 In Progress
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|

## 🟦 To Do
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-023 | Configurar los servicios externos: Neon, Google OAuth y Resend | E00 | P1 | 2 | — |
| HOG-011 | Configurar Playwright con móviles, helpers de login y doble contexto | E00 | P0 | 3 | HOG-003, HOG-005, HOG-010 |

## ✅ Done
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-001 | Crear el monorepo con pnpm, Turborepo y configuración compartida | E00 | P0 | 3 | — |
| HOG-002 | Crear `packages/shared` con dinero, fechas, errores, constantes y tipos de tiempo real | E00 | P0 | 5 | HOG-001 |
| HOG-003 | Crear el esqueleto de `apps/api` con NestJS, Prisma, Postgres local y `/health` | E00 | P0 | 3 | HOG-001, HOG-002 |
| HOG-004 | Escribir el esquema Prisma completo y la primera migración | E00 | P0 | 3 | HOG-003 |
| HOG-005 | Crear el esqueleto de `apps/web` (Vite, React, Router, Query, Tailwind v4 y PWA) | E00 | P0 | 5 | HOG-001, HOG-002 |
| HOG-006 | Implementar el manejo global de errores y el `apiClient` web con `X-Client-Mutation-Id` | E00 | P0 | 3 | HOG-002, HOG-003, HOG-005 |
| HOG-007 | Aplicar los tokens de diseño, las fuentes Barlow autoalojadas y el tema claro/oscuro | E00 | P0 | 3 | HOG-005 |
| HOG-008 | Adaptar los componentes UI base de shadcn al sistema "Piscina municipal" | E00 | P0 | 5 | HOG-007 |
| HOG-009 | Crear los componentes firma de la piscina y la animación de onda | E00 | P0 | 5 | HOG-008 |
| HOG-010 | Montar la infraestructura de tests unitarios y de integración | E00 | P0 | 5 | HOG-003, HOG-004 |
| HOG-014 | Aplicar las protecciones base de la API (helmet, CORS, Origin y throttler) | E00 | P0 | 2 | HOG-003, HOG-006 |
| HOG-015 | Configurar el service worker del *shell* y el aviso de nueva versión | E00 | P1 | 2 | HOG-005, HOG-008 |
| HOG-013 | Crear el seed mínimo de desarrollo (`pnpm db:seed`) | E00 | P2 | 2 | HOG-004 |
| HOG-016 | Generar la documentación OpenAPI desde los esquemas zod (solo desarrollo) | E00 | P2 | 2 | HOG-006 |

---

## 📋 Backlog (ordenado por fase y dependencias)

### Fase 0 · Fundaciones — 20 tickets, 66 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-012 | Configurar CI en GitHub Actions | E00 | P1 | 3 | HOG-001, HOG-010, HOG-011 |
| HOG-020 | Desplegar el frontend en Cloudflare Pages con DNS en Netlify y `_headers`/`_redirects` | E00 | P1 | 2 | HOG-005, HOG-023 |
| HOG-021 | Aprovisionar la VM de Oracle con Docker y Caddy y desplegar la API a mano | E00 | P1 | 5 | HOG-003, HOG-023 |
| HOG-022 | Automatizar el despliegue continuo de la API (GHCR + SSH) | E00 | P2 | 3 | HOG-012, HOG-021 |

### Fase 1 · Núcleo — 36 tickets, 120 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-050 | Configurar Better Auth con email/username + contraseña, UUIDv7 y cookies entre subdominios | E01 | P0 | 5 | HOG-004, HOG-006, HOG-010 |
| HOG-055 | Implementar el `AuthGuard` global, `@CurrentUser`, `@Public` y `GET /me` | E01 | P0 | 3 | HOG-050, HOG-006 |
| HOG-053 | Crear las pantallas web de entrar, registro y recuperar contraseña | E01 | P0 | 5 | HOG-050, HOG-055, HOG-008 |
| HOG-054 | Enviar los emails de verificación y de recuperación de contraseña con Resend | E01 | P0 | 3 | HOG-050, HOG-053 |
| HOG-058 | Añadir rate limiting de auth, `SecurityEvent` y política de contraseñas | E01 | P0 | 5 | HOG-050, HOG-002 |
| HOG-057 | Crear la CLI `create-owner` para el primer usuario administrador | E01 | P0 | 2 | HOG-050, HOG-058 |
| HOG-101 | Implementar el `GroupMemberGuard` con caché de 60 s y 404 | E02 | P0 | 3 | HOG-055, HOG-004 |
| HOG-150 | Crear el `RealtimeGateway` con autenticación en el handshake y salas de usuario y grupo | E03 | P0 | 5 | HOG-055, HOG-014 |
| HOG-151 | Crear el `RealtimePublisher` y el catálogo tipado de eventos en `shared` | E03 | P0 | 3 | HOG-150, HOG-002, HOG-006 |
| HOG-152 | Crear el `RealtimeProvider` web: despacho a la caché de Query, deduplicación, onda y reconexión | E03 | P0 | 5 | HOG-151, HOG-005, HOG-006, HOG-009, HOG-053 |
| HOG-153 | Crear el `ActivityService` con escritura en transacción, *summaries* en español, `MaintenanceCron` y purga de retención | E03 | P0 | 3 | HOG-004, HOG-006, HOG-010, HOG-151 |
| HOG-100 | Crear la API de grupos: crear con semilla, ver, editar y `/me/groups` | E02 | P0 | 5 | HOG-101, HOG-151, HOG-153 |
| HOG-102 | Crear la API de invitaciones: crear, listar, revocar, consultar pública y aceptar | E02 | P0 | 5 | HOG-100, HOG-150, HOG-151, HOG-153 |
| HOG-052 | Exigir invitación al registrarse (hooks de Better Auth y cookie `hogaria_invite`) | E01 | P0 | 3 | HOG-050, HOG-053, HOG-102 |
| HOG-104 | Crear el selector y la creación de hogares (`/grupos`) y la redirección de entrada | E02 | P0 | 3 | HOG-100, HOG-053, HOG-008, HOG-009 |
| HOG-107 | Crear el contexto de grupo activo en la web (`GroupLayout`) y la pantalla "No encontrado" | E02 | P0 | 3 | HOG-100, HOG-101, HOG-053, HOG-008 |
| HOG-103 | Crear el flujo web de invitación `/invite/:token` | E02 | P0 | 3 | HOG-102, HOG-052, HOG-054, HOG-107 |
| HOG-108 | Crear la API de miembros: listar y cambiar el color de calle propio | E02 | P0 | 2 | HOG-100 |
| HOG-105 | Crear los ajustes del grupo: datos del hogar, miembros, color de calle e invitaciones | E02 | P0 | 5 | HOG-102, HOG-107, HOG-108, HOG-009 |
| HOG-106 | Implementar salir del grupo, expulsar a un miembro y borrar el grupo al salir el último | E02 | P0 | 5 | HOG-105, HOG-150, HOG-152 |
| HOG-155 | Mostrar el banner de sin conexión y bloquear la edición | E03 | P0 | 3 | HOG-152, HOG-008, HOG-009 |
| HOG-750 | Crear el AppShell con barra inferior, rutas y selector de hogar | E15 | P0 | 5 | HOG-005, HOG-007, HOG-008, HOG-009, HOG-104 |
| HOG-751 | Crear la hoja "Más" | E15 | P0 | 2 | HOG-750 |
| HOG-752 | Integrar el banner de sin conexión (HOG-155) en el AppShell | E15 | P0 | 1 | HOG-155, HOG-750 |
| HOG-754 | Crear la API del Inicio con secciones registrables | E15 | P0 | 3 | HOG-100, HOG-101, HOG-153 |
| HOG-755 | Construir la pantalla de Inicio básica | E15 | P0 | 3 | HOG-750, HOG-754, HOG-152 |
| HOG-051 | Añadir el login con Google y la vinculación de cuentas por email | E01 | P1 | 2 | HOG-050, HOG-023 |
| HOG-056 | Gestionar sesiones: listar, cerrar una, cerrar las demás y cerrar sesión, con `session.revoked` | E01 | P1 | 5 | HOG-053, HOG-055, HOG-150, HOG-151 |
| HOG-060 | Permitir cambiar la contraseña desde Perfil → Seguridad | E01 | P1 | 2 | HOG-056, HOG-058 |
| HOG-109 | Aplicar en la web los eventos en tiempo real de grupos, miembros e invitaciones | E02 | P1 | 2 | HOG-152, HOG-105 |
| HOG-154 | Crear la pantalla de actividad `/g/:groupId/actividad` y su evento `activity.created` | E03 | P1 | 3 | HOG-153, HOG-152, HOG-107, HOG-101 |
| HOG-156 | Añadir el e2e de tiempo real entre dos dispositivos y sin conexión | E03 | P1 | 2 | HOG-011, HOG-109, HOG-155 |
| HOG-756 | Soportar deep links y la vuelta tras iniciar sesión | E15 | P1 | 2 | HOG-750 |
| HOG-059 | Crear la administración de plataforma: listar, bloquear y desbloquear usuarios | E01 | P2 | 5 | HOG-055, HOG-056, HOG-008 |
| HOG-061 | Permitir vincular una cuenta de Google desde Perfil → Seguridad | E01 | P2 | 2 | HOG-051, HOG-056 |
| HOG-753 | Añadir transiciones de ruta y restauración del scroll | E15 | P2 | 2 | HOG-750 |

### Fase 2 · Compra + Tareas + Push — 38 tickets, 124 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-200 | Añadir las utilidades de compra a shared (normalización, unidades, cantidades y añadido rápido) | E04 | P0 | 3 | HOG-002 |
| HOG-201 | Definir los esquemas zod y los eventos de la compra en shared | E04 | P0 | 2 | HOG-200 |
| HOG-202 | Implementar la API de listas de la compra | E04 | P0 | 3 | HOG-201, HOG-004, HOG-101, HOG-151, HOG-153 |
| HOG-203 | Añadir productos a una lista con catálogo, fusión de duplicados y alta en bloque | E04 | P0 | 5 | HOG-202 |
| HOG-204 | Editar, marcar, mover y quitar productos, y vaciar comprados | E04 | P0 | 5 | HOG-203 |
| HOG-209 | Crear los hooks de datos y el tiempo real de la compra en la web | E04 | P0 | 5 | HOG-201, HOG-006, HOG-152 |
| HOG-210 | Construir la pantalla de listas de la compra | E04 | P0 | 3 | HOG-209, HOG-750, HOG-008, HOG-009 |
| HOG-211 | Construir la pantalla de una lista agrupada por pasillos con marcar de un toque | E04 | P0 | 5 | HOG-210 |
| HOG-213 | Crear la hoja de edición de producto con el aviso de conflicto | E04 | P0 | 3 | HOG-211 |
| HOG-350 | Implementar las utilidades de recurrencia, vencimiento y rotación en shared | E07 | P0 | 5 | HOG-002 |
| HOG-351 | Definir los esquemas zod y los eventos de tareas en shared | E07 | P0 | 2 | HOG-350 |
| HOG-352 | Implementar la API de tareas (listar, crear, ver, editar y borrar) | E07 | P0 | 5 | HOG-351, HOG-004, HOG-101, HOG-151, HOG-153 |
| HOG-353 | Completar y saltar tareas con rotación automática | E07 | P0 | 5 | HOG-352 |
| HOG-357 | Crear los hooks de datos y el tiempo real de tareas en la web | E07 | P0 | 3 | HOG-351, HOG-006, HOG-152 |
| HOG-358 | Construir la lista de tareas con "Mis tareas" y "Todas", agrupada y con completar de un toque | E07 | P0 | 5 | HOG-357, HOG-750, HOG-009 |
| HOG-600 | Suscripción push: VAPID, service worker y API de suscripciones | E12 | P0 | 5 | HOG-002, HOG-003, HOG-004, HOG-005, HOG-015, HOG-055 |
| HOG-360 | Crear el formulario de tarea con selector de repetición y turnos | E07 | P0 | 5 | HOG-357, HOG-008, HOG-600 |
| HOG-362 | Escribir el e2e de tarea por turnos (E2E-07) | E07 | P0 | 2 | HOG-358, HOG-360, HOG-011 |
| HOG-604 | PushSender: envío Web Push y limpieza de suscripciones muertas | E12 | P0 | 2 | HOG-600 |
| HOG-601 | ReminderScheduler y API pública de recordatorios | E12 | P0 | 5 | HOG-004, HOG-106, HOG-153, HOG-604 |
| HOG-606 | Reconciliación en el tick de 6 h, recuperación al arrancar y limpieza | E12 | P0 | 3 | HOG-601 |
| HOG-205 | Registrar el historial de compras al marcar y deshacerlo al desmarcar | E04 | P1 | 3 | HOG-204 |
| HOG-206 | Implementar la API del catálogo: autocompletado, frecuentes, indispensables y edición | E04 | P0 | 3 | HOG-205 |
| HOG-212 | Crear la barra de añadido rápido con autocompletado y "Sueles comprar" | E04 | P0 | 3 | HOG-211, HOG-206 |
| HOG-207 | Añadir los indispensables que faltan a una lista | E04 | P1 | 2 | HOG-206 |
| HOG-214 | Construir la pantalla de indispensables y el botón "Añadir indispensables que faltan" | E04 | P1 | 3 | HOG-212, HOG-207 |
| HOG-216 | Escribir los e2e de la compra (E2E-05 y E2E-06) | E04 | P0 | 3 | HOG-211, HOG-212, HOG-213, HOG-214, HOG-011 |
| HOG-354 | Exponer el historial de una tarea y deshacer la última completación | E07 | P1 | 3 | HOG-353 |
| HOG-355 | Integrar los recordatorios de tareas con el ReminderScheduler | E07 | P1 | 3 | HOG-353, HOG-601 |
| HOG-356 | Reajustar asignaciones y turnos cuando un miembro sale del hogar | E07 | P1 | 2 | HOG-352, HOG-106 |
| HOG-359 | Construir la vista de tareas por calles | E07 | P1 | 3 | HOG-358 |
| HOG-361 | Crear la hoja de detalle de tarea con historial | E07 | P1 | 3 | HOG-358, HOG-354, HOG-756 |
| HOG-602 | Preferencias de notificación (API + UI) y su aplicación al disparar | E12 | P1 | 3 | HOG-601, HOG-600, HOG-750, HOG-008 |
| HOG-603 | Guía de instalación PWA / iOS y petición de permiso en contexto | E12 | P1 | 3 | HOG-600, HOG-602, HOG-750 |
| HOG-605 | Deep links al tocar la notificación | E12 | P1 | 2 | HOG-600, HOG-750 |
| HOG-208 | Exponer el historial de compras paginado | E04 | P2 | 1 | HOG-205 |
| HOG-215 | Construir la pantalla del historial de compras | E04 | P2 | 2 | HOG-208, HOG-210 |
| HOG-607 | Aviso de prueba | E12 | P2 | 1 | HOG-604, HOG-602 |

### Fase 3 · Recetas + Comidas + IA nevera — 37 tickets, 110 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-250 | Añadir constantes, utilidades y esquemas zod de recetas a shared | E05 | P0 | 3 | HOG-200 |
| HOG-251 | Crear y consultar recetas en la API | E05 | P0 | 3 | HOG-250, HOG-004, HOG-101, HOG-151, HOG-153 |
| HOG-252 | Editar, marcar como favorita y borrar recetas en la API | E05 | P0 | 3 | HOG-251 |
| HOG-253 | Buscar y filtrar recetas con paginación por cursor | E05 | P0 | 3 | HOG-251 |
| HOG-254 | Añadir los ingredientes de una receta a la lista de la compra (API) | E05 | P0 | 2 | HOG-251, HOG-203 |
| HOG-255 | Crear los hooks de datos y el tiempo real de recetas en la web | E05 | P0 | 3 | HOG-250, HOG-006, HOG-152 |
| HOG-256 | Construir el recetario con búsqueda, filtros y favoritas | E05 | P0 | 5 | HOG-255, HOG-750, HOG-008, HOG-009 |
| HOG-257 | Construir el detalle de receta con raciones escalables | E05 | P0 | 3 | HOG-255, HOG-009 |
| HOG-258 | Construir el formulario de crear y editar receta | E05 | P0 | 5 | HOG-255 |
| HOG-300 | Añadir esquemas del menú y la dieta y la lógica de avisos y agregación a shared | E06 | P0 | 3 | HOG-250 |
| HOG-301 | Implementar la API del perfil de dieta | E06 | P0 | 3 | HOG-300, HOG-004, HOG-055, HOG-101, HOG-151 |
| HOG-302 | Implementar la API del menú (consultar, crear, editar y quitar comidas) | E06 | P0 | 5 | HOG-300, HOG-251, HOG-101, HOG-151, HOG-153 |
| HOG-304 | Enviar los ingredientes del menú a la lista de la compra (API) | E06 | P0 | 3 | HOG-302, HOG-203 |
| HOG-306 | Crear los hooks de datos y el tiempo real del menú y la dieta en la web | E06 | P0 | 3 | HOG-300, HOG-006, HOG-152 |
| HOG-307 | Construir el planificador semanal | E06 | P0 | 5 | HOG-306, HOG-750, HOG-009 |
| HOG-308 | Crear la hoja de añadir y editar comida | E06 | P0 | 3 | HOG-307, HOG-255 |
| HOG-311 | Crear la hoja de enviar ingredientes del menú a la lista | E06 | P0 | 3 | HOG-307, HOG-304, HOG-209 |
| HOG-312 | Crear la sección "Mi dieta" del perfil y la hoja "Dietas del hogar" | E06 | P0 | 3 | HOG-306, HOG-258, HOG-750 |
| HOG-313 | Escribir el e2e de receta → menú → lista (E2E-08) | E06 | P0 | 3 | HOG-258, HOG-308, HOG-311, HOG-011 |
| HOG-650 | Crear el núcleo de IA (cliente Gemini, cuota, aviso e imágenes) | E13 | P0 | 5 | HOG-003, HOG-004, HOG-006, HOG-010, HOG-055, HOG-101, HOG-151 |
| HOG-651 | Añadir esquemas y utilidades de la nevera en shared | E13 | P0 | 2 | HOG-002, HOG-650 |
| HOG-652 | Implementar la detección de ingredientes (fridge/detect) | E13 | P0 | 3 | HOG-650, HOG-651 |
| HOG-653 | Implementar la generación de recetas (fridge/recipes) con restricciones de dieta | E13 | P0 | 3 | HOG-650, HOG-651 |
| HOG-654 | Validar alérgenos, dieta y "tienes/te falta" en el servidor | E13 | P0 | 2 | HOG-653 |
| HOG-655 | Crear la base web de IA (aviso, cuota, errores y tiempo real) | E13 | P0 | 3 | HOG-650, HOG-008, HOG-009, HOG-152, HOG-750 |
| HOG-656 | Reducir fotos en el cliente antes de subirlas | E13 | P0 | 2 | HOG-005 |
| HOG-657 | Construir la pantalla "¿Qué cocino?": fotos e ingredientes | E13 | P0 | 3 | HOG-652, HOG-655, HOG-656 |
| HOG-658 | Añadir preferencias y comensales a "¿Qué cocino?" | E13 | P0 | 3 | HOG-657, HOG-653 |
| HOG-659 | Mostrar las recetas propuestas con "tienes / te falta" y avisos | E13 | P0 | 3 | HOG-658, HOG-654 |
| HOG-660 | Guardar una receta propuesta en el recetario | E13 | P0 | 2 | HOG-659, HOG-251 |
| HOG-661 | Mandar los ingredientes que faltan a una lista de la compra | E13 | P0 | 2 | HOG-659, HOG-203 |
| HOG-259 | Crear la hoja "Añadir a la lista" desde una receta | E05 | P1 | 2 | HOG-257, HOG-254, HOG-209 |
| HOG-303 | Copiar el menú de una semana a otra (API) | E06 | P1 | 3 | HOG-302 |
| HOG-305 | Limpiar los comensales del menú cuando un miembro sale del hogar | E06 | P1 | 1 | HOG-302, HOG-106 |
| HOG-309 | Mostrar los avisos de dieta y alérgenos en el menú | E06 | P1 | 2 | HOG-308 |
| HOG-310 | Crear la hoja de copiar semana | E06 | P1 | 2 | HOG-307, HOG-303 |
| HOG-662 | Escribir el e2e de la nevera (E2E-09) | E13 | P1 | 3 | HOG-660, HOG-661, HOG-011 |

### Fase 4 · Calendario + Horarios — 21 tickets, 62 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-400 | Esquemas zod y constantes de horarios | E08 | P0 | 2 | HOG-002 |
| HOG-401 | Cálculo puro del horario efectivo (DST y turnos nocturnos) | E08 | P0 | 3 | HOG-400 |
| HOG-402 | API de mis horarios (`/me/work-schedules`) | E08 | P0 | 3 | HOG-400, HOG-003, HOG-004, HOG-055, HOG-151, HOG-153 |
| HOG-403 | API de excepciones (`/me/work-shift-overrides`) | E08 | P0 | 3 | HOG-402 |
| HOG-404 | Vista calculada `GET /groups/:g/work-schedules` | E08 | P0 | 2 | HOG-401, HOG-403, HOG-101 |
| HOG-405 | Hooks de datos y tiempo real de horarios (web) | E08 | P0 | 2 | HOG-404, HOG-006, HOG-152 |
| HOG-406 | Pantalla "Horarios": semana por calles | E08 | P0 | 5 | HOG-405, HOG-009, HOG-750 |
| HOG-407 | Editor "Mi horario": plantillas, franjas y copiar día | E08 | P0 | 5 | HOG-405, HOG-008, HOG-406 |
| HOG-450 | Esquemas zod y constantes del calendario | E09 | P0 | 2 | HOG-002 |
| HOG-451 | Expansión de recurrencias en la zona del grupo | E09 | P0 | 3 | HOG-450 |
| HOG-452 | API: crear, listar (con expansión) y obtener eventos | E09 | P0 | 3 | HOG-451, HOG-003, HOG-004, HOG-101, HOG-151, HOG-153 |
| HOG-453 | API: editar y borrar con alcance (solo este / toda la serie) y propiedad | E09 | P0 | 3 | HOG-452, HOG-106 |
| HOG-455 | Hooks de datos y tiempo real del calendario (web) | E09 | P0 | 2 | HOG-452, HOG-006, HOG-152 |
| HOG-456 | Pantalla Calendario: estructura, agenda y detalle | E09 | P0 | 3 | HOG-455, HOG-009, HOG-750, HOG-756 |
| HOG-457 | Formulario de evento: recurrencia, avisos y diálogo de alcance | E09 | P0 | 5 | HOG-456, HOG-603 |
| HOG-408 | Excepciones de día: libre, vacaciones, baja y horario especial | E08 | P1 | 3 | HOG-406 |
| HOG-454 | Proveedor de recordatorios de eventos (`EVENT`) | E09 | P1 | 2 | HOG-601, HOG-452 |
| HOG-458 | Vista semana por calles | E09 | P1 | 3 | HOG-456 |
| HOG-459 | Vista mes | E09 | P1 | 3 | HOG-456 |
| HOG-461 | E2E-10: propiedad de eventos | E09 | P1 | 2 | HOG-457, HOG-011 |
| HOG-460 | Capas de solo lectura: tareas y horarios | E09 | P2 | 3 | HOG-458, HOG-459, HOG-405, HOG-352 |

### Fase 5 · Gastos + Facturas — 25 tickets, 70 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-500 | Esquemas zod y lógica pura de gastos y presupuestos | E10 | P0 | 2 | HOG-002 |
| HOG-501 | API de categorías de gasto | E10 | P0 | 2 | HOG-500, HOG-100, HOG-101, HOG-151, HOG-153 |
| HOG-502 | API de gastos: CRUD, filtros y propiedad | E10 | P0 | 3 | HOG-501, HOG-106 |
| HOG-504 | API de presupuestos | E10 | P0 | 2 | HOG-501, HOG-106 |
| HOG-503 | API de resumen mensual | E10 | P0 | 3 | HOG-502, HOG-504 |
| HOG-505 | Hooks de datos y tiempo real de gastos (web) | E10 | P0 | 2 | HOG-503, HOG-504, HOG-006, HOG-152 |
| HOG-506 | Movimientos y formulario de gasto en dos toques | E10 | P0 | 5 | HOG-505, HOG-009, HOG-750 |
| HOG-550 | Esquemas zod, constantes y cálculo puro de vencimientos | E11 | P0 | 3 | HOG-002 |
| HOG-551 | API de facturas: CRUD, archivar y restaurar | E11 | P0 | 3 | HOG-550, HOG-003, HOG-004, HOG-101, HOG-106, HOG-151, HOG-153 |
| HOG-552 | Materialización de recibos (al crear/editar y en el tick de 6 h) | E11 | P0 | 3 | HOG-551, HOG-153 |
| HOG-553 | API de recibos: listar, pagar y deshacer | E11 | P0 | 3 | HOG-552 |
| HOG-555 | Hooks de datos y tiempo real de facturas (web) | E11 | P0 | 2 | HOG-553, HOG-006, HOG-152 |
| HOG-556 | Pantalla Facturas: héroe, próximos vencimientos y lista | E11 | P0 | 5 | HOG-555, HOG-009, HOG-750, HOG-756 |
| HOG-557 | Formulario de factura con vista previa de vencimientos | E11 | P0 | 3 | HOG-556, HOG-603 |
| HOG-558 | Pagar y deshacer pago (web) | E11 | P0 | 2 | HOG-556 |
| HOG-507 | Resumen mensual con gráficas | E10 | P1 | 5 | HOG-506 |
| HOG-508 | Presupuestos: edición y avisos del 80 % y superado | E10 | P1 | 3 | HOG-507 |
| HOG-510 | API: escanear ticket con IA (`POST /ai/receipt`) | E10 | P1 | 3 | HOG-650, HOG-501 |
| HOG-511 | Web: escanear ticket y formulario prellenado | E10 | P1 | 3 | HOG-510, HOG-506 |
| HOG-512 | E2E-11: gastos, presupuesto superado y propiedad | E10 | P1 | 2 | HOG-508, HOG-011 |
| HOG-554 | Proveedor de recordatorios de facturas (`BILL`) | E11 | P1 | 2 | HOG-601, HOG-553 |
| HOG-559 | Historial y total mensual de gastos fijos | E11 | P1 | 3 | HOG-556 |
| HOG-560 | E2E-12: factura mensual pagada | E11 | P1 | 2 | HOG-558, HOG-559, HOG-011 |
| HOG-509 | Gestión de categorías del hogar (web) | E10 | P2 | 2 | HOG-506 |
| HOG-561 | Capa "Facturas" en el calendario | E11 | P2 | 2 | HOG-460, HOG-555 |

### Fase 6 · Asistente + Inicio completo + RGPD + Producción — 58 tickets, 151 pts
| ID | Título | Épica | Prio | Pts | Depende de |
|---|---|---|---|---|---|
| HOG-700 | Definir los esquemas compartidos del asistente | E14 | P0 | 2 | HOG-002, HOG-650 |
| HOG-701 | Implementar la API de conversaciones del asistente | E14 | P0 | 3 | HOG-700, HOG-101 |
| HOG-702 | Crear el registro de herramientas y las de lectura de compra, recetas y menú | E14 | P0 | 5 | HOG-700, HOG-251, HOG-203, HOG-302 |
| HOG-703 | Añadir las herramientas de lectura de tareas, calendario y horarios | E14 | P0 | 3 | HOG-702, HOG-352, HOG-404, HOG-452 |
| HOG-705 | Orquestar el turno del asistente con streaming SSE | E14 | P0 | 5 | HOG-701, HOG-702 |
| HOG-706 | Implementar las herramientas de escritura como propuestas (pendingAction) | E14 | P0 | 3 | HOG-705, HOG-351, HOG-450 |
| HOG-707 | Confirmar y descartar acciones propuestas | E14 | P0 | 3 | HOG-706 |
| HOG-709 | Crear el cliente SSE y los hooks del asistente en la web | E14 | P0 | 3 | HOG-700, HOG-006 |
| HOG-710 | Construir la pantalla del asistente con streaming e historial | E14 | P0 | 5 | HOG-709, HOG-705, HOG-655, HOG-750 |
| HOG-711 | Mostrar la tarjeta de acción con confirmar y descartar | E14 | P0 | 2 | HOG-710, HOG-707 |
| HOG-800 | Ampliar los esquemas compartidos de perfil, exportación y borrado | E16 | P0 | 2 | HOG-002 |
| HOG-801 | Editar nombre, nombre de usuario y foto desde la API | E16 | P0 | 3 | HOG-800, HOG-004, HOG-055, HOG-151 |
| HOG-802 | Construir la página de perfil y la sección "Tu cuenta" | E16 | P0 | 3 | HOG-801, HOG-750 |
| HOG-806 | Exportar los datos del usuario en JSON | E16 | P0 | 5 | HOG-800, HOG-055 |
| HOG-807 | Añadir "Descargar mis datos" en el perfil | E16 | P0 | 1 | HOG-806, HOG-802 |
| HOG-808 | Borrar la cuenta del usuario (API) | E16 | P0 | 5 | HOG-800, HOG-106, HOG-150, HOG-151, HOG-601 |
| HOG-809 | Añadir el diálogo "Borrar mi cuenta" en el perfil | E16 | P0 | 2 | HOG-808, HOG-802 |
| HOG-810 | Publicar las páginas de privacidad y términos | E16 | P0 | 3 | HOG-005, HOG-008 |
| HOG-811 | Probar la matriz completa del borrado de cuenta | E16 | P0 | 3 | HOG-808 |
| HOG-851 | Configurar la CSP y las cabeceras de seguridad de la web | E17 | P0 | 2 | HOG-005, HOG-020, HOG-021 |
| HOG-852 | Endurecer la configuración de la API y del socket | E17 | P0 | 3 | HOG-003, HOG-150 |
| HOG-853 | Comprobar por introspección que todas las rutas tienen sus guards | E17 | P0 | 2 | HOG-055, HOG-101 |
| HOG-854 | Crear la matriz de autorización de todos los módulos | E17 | P0 | 5 | HOG-853, HOG-010 |
| HOG-861 | Configurar logs de producción con redacción y retención de 14 días | E17 | P0 | 2 | HOG-003, HOG-022 |
| HOG-863 | Programar copias de seguridad semanales cifradas | E17 | P0 | 3 | HOG-022 |
| HOG-864 | Documentar y probar la restauración de una copia | E17 | P0 | 2 | HOG-863, HOG-808 |
| HOG-704 | Añadir las herramientas de lectura de gastos, facturas y dietas | E14 | P1 | 2 | HOG-702, HOG-301, HOG-503, HOG-553 |
| HOG-708 | Aplicar retención y borrado de conversaciones | E14 | P1 | 2 | HOG-701, HOG-106, HOG-153 |
| HOG-712 | Añadir el botón flotante del asistente en Inicio | E14 | P1 | 1 | HOG-710, HOG-755 |
| HOG-713 | Montar la evaluación del asistente con respuestas fake | E14 | P1 | 3 | HOG-707, HOG-703, HOG-704 |
| HOG-714 | Escribir el e2e del asistente (E2E-13) | E14 | P1 | 2 | HOG-711, HOG-712, HOG-011 |
| HOG-757 | Añadir la sección de turnos de trabajo al Inicio | E15 | P1 | 2 | HOG-754, HOG-404 |
| HOG-758 | Añadir la sección de tareas de hoy al Inicio | E15 | P1 | 2 | HOG-754, HOG-352 |
| HOG-759 | Añadir la sección de eventos de hoy al Inicio | E15 | P1 | 2 | HOG-754, HOG-452 |
| HOG-760 | Añadir la sección de comidas de hoy al Inicio | E15 | P1 | 1 | HOG-754, HOG-302 |
| HOG-761 | Añadir la sección de facturas próximas al Inicio | E15 | P1 | 2 | HOG-754, HOG-553 |
| HOG-762 | Añadir la sección de listas de la compra al Inicio | E15 | P1 | 1 | HOG-754, HOG-202 |
| HOG-763 | Pintar turnos, tareas y eventos en las calles del Inicio | E15 | P1 | 3 | HOG-755, HOG-757, HOG-758, HOG-759 |
| HOG-764 | Pintar comidas, listas, facturas y "¿Qué cocino?" en el Inicio | E15 | P1 | 3 | HOG-755, HOG-760, HOG-761, HOG-762, HOG-655 |
| HOG-765 | Actualizar el Inicio en tiempo real con los eventos de los módulos | E15 | P1 | 2 | HOG-763, HOG-764 |
| HOG-766 | Escribir el e2e de Inicio y navegación (E2E-16) | E15 | P1 | 3 | HOG-751, HOG-752, HOG-756, HOG-765, HOG-011 |
| HOG-803 | Integrar la sección de seguridad (contraseña, Google y sesiones) en el perfil | E16 | P1 | 2 | HOG-802, HOG-056, HOG-060, HOG-061 |
| HOG-804 | Integrar dieta, notificaciones, administración y cerrar sesión en el perfil | E16 | P1 | 2 | HOG-802, HOG-602, HOG-059, HOG-312 |
| HOG-805 | Permitir elegir tema claro, oscuro o del sistema | E16 | P1 | 2 | HOG-007, HOG-802 |
| HOG-812 | Escribir el e2e de exportar y borrar cuenta (E2E-14) | E16 | P1 | 2 | HOG-807, HOG-809, HOG-810, HOG-011 |
| HOG-855 | Ejecutar la suite e2e completa en CI | E17 | P0 | 3 | HOG-011, HOG-012, HOG-662, HOG-714, HOG-766, HOG-812 |
| HOG-856 | Añadir comprobaciones de accesibilidad con axe en Playwright | E17 | P1 | 3 | HOG-855 |
| HOG-859 | Verificar la instalabilidad de la PWA con Playwright | E17 | P1 | 2 | HOG-855 |
| HOG-860 | Dividir el bundle por rutas y fijar presupuestos de tamaño | E17 | P1 | 3 | HOG-750 |
| HOG-865 | Ampliar el seed con datos de demo de todos los módulos | E17 | P1 | 3 | HOG-013, HOG-050 |
| HOG-858 | Medir el rendimiento con Lighthouse CI en móvil | E17 | P1 | 3 | HOG-855, HOG-865 |
| HOG-866 | Activar Dependabot, pnpm audit y gitleaks | E17 | P1 | 2 | HOG-012 |
| HOG-850 | Revisar la seguridad contra la checklist de docs/03 | E17 | P0 | 3 | HOG-851, HOG-852, HOG-853, HOG-854, HOG-866 |
| HOG-867 | Escribir el runbook de incidencias | E17 | P1 | 3 | HOG-022, HOG-861, HOG-863 |
| HOG-868 | Actualizar la documentación final | E17 | P1 | 2 | HOG-850, HOG-855, HOG-863, HOG-865, HOG-867 |
| HOG-857 | Hacer la revisión manual de accesibilidad con lectores de pantalla | E17 | P2 | 2 | HOG-856 |
| HOG-862 | Añadir healthcheck de Docker y monitor externo opcional | E17 | P2 | 1 | HOG-003, HOG-022 |
| HOG-715 | Crear un script de evaluación manual contra Gemini real | E14 | P3 | 2 | HOG-713 |

---

## 🗺️ Flujo de fases

```mermaid
flowchart LR
  F0["Fase 0<br/>Fundaciones<br/><small>E00</small>"]
  F1["Fase 1<br/>Núcleo<br/><small>E01 E02 E03 E15</small>"]
  F2["Fase 2<br/>Compra + Tareas + Push<br/><small>E04 E07 E12</small>"]
  F3["Fase 3<br/>Recetas + Comidas + IA nevera<br/><small>E05 E06 E13</small>"]
  F4["Fase 4<br/>Calendario + Horarios<br/><small>E08 E09</small>"]
  F5["Fase 5<br/>Gastos + Facturas<br/><small>E10 E11</small>"]
  F6["Fase 6<br/>Asistente + Inicio completo + RGPD + Producción<br/><small>E14 E15 E16 E17</small>"]
  F0 --> F1 --> F2 --> F3 --> F4 --> F5 --> F6
```

## 🧩 Dependencias entre épicas

```mermaid
flowchart TD
  E00["E00 · Fundaciones"]
  E01["E01 · Autenticación y cuentas"]
  E02["E02 · Grupos e invitaciones"]
  E03["E03 · Tiempo real y actividad"]
  E04["E04 · Lista de la compra"]
  E05["E05 · Recetas"]
  E06["E06 · Comidas y dietas"]
  E07["E07 · Tareas"]
  E08["E08 · Horarios de trabajo"]
  E09["E09 · Calendario y eventos"]
  E10["E10 · Gastos de ocio y presupuestos"]
  E11["E11 · Gastos fijos y facturas"]
  E12["E12 · Notificaciones y recordatorios"]
  E13["E13 · IA: núcleo + nevera → recetas"]
  E14["E14 · IA: asistente por chat"]
  E15["E15 · Inicio (dashboard) y navegación"]
  E16["E16 · Perfil, ajustes y RGPD"]
  E17["E17 · Calidad, seguridad y producción"]
  E06 --> E15
  E10 --> E14
  E11 --> E15
  E13 --> E15
  E14 --> E17
  E16 --> E17
```

## 🔀 Flujo de tickets por fase

> Flechas = "es requisito de". Solo se dibujan dependencias dentro de la misma fase; las de fases anteriores están en la columna "Depende de".

### Fase 0 · Fundaciones

```mermaid
flowchart LR
  subgraph E00_0["E00 · Fundaciones"]
    HOG001["HOG-001<br/>Crear el monorepo con pnpm, Turborepo y config…"]
    HOG002["HOG-002<br/>Crear 'packages/shared' con dinero, fechas, er…"]
    HOG003["HOG-003<br/>Crear el esqueleto de 'apps/api' con NestJS, P…"]
    HOG004["HOG-004<br/>Escribir el esquema Prisma completo y la prime…"]
    HOG005["HOG-005<br/>Crear el esqueleto de 'apps/web' (Vite, React,…"]
    HOG006["HOG-006<br/>Implementar el manejo global de errores y el '…"]
    HOG007["HOG-007<br/>Aplicar los tokens de diseño, las fuentes Barl…"]
    HOG008["HOG-008<br/>Adaptar los componentes UI base de shadcn al s…"]
    HOG009["HOG-009<br/>Crear los componentes firma de la piscina y la…"]
    HOG010["HOG-010<br/>Montar la infraestructura de tests unitarios y…"]
    HOG011["HOG-011<br/>Configurar Playwright con móviles, helpers de …"]
    HOG014["HOG-014<br/>Aplicar las protecciones base de la API (helme…"]
    HOG012["HOG-012<br/>Configurar CI en GitHub Actions"]
    HOG015["HOG-015<br/>Configurar el service worker del *shell* y el …"]
    HOG023["HOG-023<br/>Configurar los servicios externos: Neon, Googl…"]
    HOG020["HOG-020<br/>Desplegar el frontend en Cloudflare Pages con …"]
    HOG021["HOG-021<br/>Aprovisionar la VM de Oracle con Docker y Cadd…"]
    HOG013["HOG-013<br/>Crear el seed mínimo de desarrollo ('pnpm db:s…"]
    HOG016["HOG-016<br/>Generar la documentación OpenAPI desde los esq…"]
    HOG022["HOG-022<br/>Automatizar el despliegue continuo de la API (…"]
  end
  HOG001 --> HOG002
  HOG001 --> HOG003
  HOG002 --> HOG003
  HOG003 --> HOG004
  HOG001 --> HOG005
  HOG002 --> HOG005
  HOG002 --> HOG006
  HOG003 --> HOG006
  HOG005 --> HOG006
  HOG005 --> HOG007
  HOG007 --> HOG008
  HOG008 --> HOG009
  HOG003 --> HOG010
  HOG004 --> HOG010
  HOG003 --> HOG011
  HOG005 --> HOG011
  HOG010 --> HOG011
  HOG003 --> HOG014
  HOG006 --> HOG014
  HOG001 --> HOG012
  HOG010 --> HOG012
  HOG011 --> HOG012
  HOG005 --> HOG015
  HOG008 --> HOG015
  HOG005 --> HOG020
  HOG023 --> HOG020
  HOG003 --> HOG021
  HOG023 --> HOG021
  HOG004 --> HOG013
  HOG006 --> HOG016
  HOG012 --> HOG022
  HOG021 --> HOG022
```

### Fase 1 · Núcleo

```mermaid
flowchart LR
  subgraph E01_1["E01 · Autenticación y cuentas"]
    HOG050["HOG-050<br/>Configurar Better Auth con email/username + co…"]
    HOG055["HOG-055<br/>Implementar el 'AuthGuard' global, '@CurrentUs…"]
    HOG053["HOG-053<br/>Crear las pantallas web de entrar, registro y …"]
    HOG054["HOG-054<br/>Enviar los emails de verificación y de recuper…"]
    HOG058["HOG-058<br/>Añadir rate limiting de auth, 'SecurityEvent' …"]
    HOG057["HOG-057<br/>Crear la CLI 'create-owner' para el primer usu…"]
    HOG052["HOG-052<br/>Exigir invitación al registrarse (hooks de Bet…"]
    HOG051["HOG-051<br/>Añadir el login con Google y la vinculación de…"]
    HOG056["HOG-056<br/>Gestionar sesiones: listar, cerrar una, cerrar…"]
    HOG060["HOG-060<br/>Permitir cambiar la contraseña desde Perfil → …"]
    HOG059["HOG-059<br/>Crear la administración de plataforma: listar,…"]
    HOG061["HOG-061<br/>Permitir vincular una cuenta de Google desde P…"]
  end
  subgraph E02_1["E02 · Grupos e invitaciones"]
    HOG101["HOG-101<br/>Implementar el 'GroupMemberGuard' con caché de…"]
    HOG100["HOG-100<br/>Crear la API de grupos: crear con semilla, ver…"]
    HOG102["HOG-102<br/>Crear la API de invitaciones: crear, listar, r…"]
    HOG104["HOG-104<br/>Crear el selector y la creación de hogares ('/…"]
    HOG107["HOG-107<br/>Crear el contexto de grupo activo en la web ('…"]
    HOG103["HOG-103<br/>Crear el flujo web de invitación '/invite/:tok…"]
    HOG108["HOG-108<br/>Crear la API de miembros: listar y cambiar el …"]
    HOG105["HOG-105<br/>Crear los ajustes del grupo: datos del hogar, …"]
    HOG106["HOG-106<br/>Implementar salir del grupo, expulsar a un mie…"]
    HOG109["HOG-109<br/>Aplicar en la web los eventos en tiempo real d…"]
  end
  subgraph E03_1["E03 · Tiempo real y actividad"]
    HOG150["HOG-150<br/>Crear el 'RealtimeGateway' con autenticación e…"]
    HOG151["HOG-151<br/>Crear el 'RealtimePublisher' y el catálogo tip…"]
    HOG152["HOG-152<br/>Crear el 'RealtimeProvider' web: despacho a la…"]
    HOG153["HOG-153<br/>Crear el 'ActivityService' con escritura en tr…"]
    HOG155["HOG-155<br/>Mostrar el banner de sin conexión y bloquear l…"]
    HOG154["HOG-154<br/>Crear la pantalla de actividad '/g/:groupId/ac…"]
    HOG156["HOG-156<br/>Añadir el e2e de tiempo real entre dos disposi…"]
  end
  subgraph E15_1["E15 · Inicio (dashboard) y navegación"]
    HOG750["HOG-750<br/>Crear el AppShell con barra inferior, rutas y …"]
    HOG751["HOG-751<br/>Crear la hoja 'Más'"]
    HOG752["HOG-752<br/>Integrar el banner de sin conexión (HOG-155) e…"]
    HOG754["HOG-754<br/>Crear la API del Inicio con secciones registra…"]
    HOG755["HOG-755<br/>Construir la pantalla de Inicio básica"]
    HOG756["HOG-756<br/>Soportar deep links y la vuelta tras iniciar s…"]
    HOG753["HOG-753<br/>Añadir transiciones de ruta y restauración del…"]
  end
  HOG050 --> HOG055
  HOG050 --> HOG053
  HOG055 --> HOG053
  HOG050 --> HOG054
  HOG053 --> HOG054
  HOG050 --> HOG058
  HOG050 --> HOG057
  HOG058 --> HOG057
  HOG055 --> HOG101
  HOG055 --> HOG150
  HOG150 --> HOG151
  HOG151 --> HOG152
  HOG053 --> HOG152
  HOG151 --> HOG153
  HOG101 --> HOG100
  HOG151 --> HOG100
  HOG153 --> HOG100
  HOG100 --> HOG102
  HOG150 --> HOG102
  HOG151 --> HOG102
  HOG153 --> HOG102
  HOG050 --> HOG052
  HOG053 --> HOG052
  HOG102 --> HOG052
  HOG100 --> HOG104
  HOG053 --> HOG104
  HOG100 --> HOG107
  HOG101 --> HOG107
  HOG053 --> HOG107
  HOG102 --> HOG103
  HOG052 --> HOG103
  HOG054 --> HOG103
  HOG107 --> HOG103
  HOG100 --> HOG108
  HOG102 --> HOG105
  HOG107 --> HOG105
  HOG108 --> HOG105
  HOG105 --> HOG106
  HOG150 --> HOG106
  HOG152 --> HOG106
  HOG152 --> HOG155
  HOG104 --> HOG750
  HOG750 --> HOG751
  HOG155 --> HOG752
  HOG750 --> HOG752
  HOG100 --> HOG754
  HOG101 --> HOG754
  HOG153 --> HOG754
  HOG750 --> HOG755
  HOG754 --> HOG755
  HOG152 --> HOG755
  HOG050 --> HOG051
  HOG053 --> HOG056
  HOG055 --> HOG056
  HOG150 --> HOG056
  HOG151 --> HOG056
  HOG056 --> HOG060
  HOG058 --> HOG060
  HOG152 --> HOG109
  HOG105 --> HOG109
  HOG153 --> HOG154
  HOG152 --> HOG154
  HOG107 --> HOG154
  HOG101 --> HOG154
  HOG109 --> HOG156
  HOG155 --> HOG156
  HOG750 --> HOG756
  HOG055 --> HOG059
  HOG056 --> HOG059
  HOG051 --> HOG061
  HOG056 --> HOG061
  HOG750 --> HOG753
```

### Fase 2 · Compra + Tareas + Push

```mermaid
flowchart LR
  subgraph E04_2["E04 · Lista de la compra"]
    HOG200["HOG-200<br/>Añadir las utilidades de compra a shared (norm…"]
    HOG201["HOG-201<br/>Definir los esquemas zod y los eventos de la c…"]
    HOG202["HOG-202<br/>Implementar la API de listas de la compra"]
    HOG203["HOG-203<br/>Añadir productos a una lista con catálogo, fus…"]
    HOG204["HOG-204<br/>Editar, marcar, mover y quitar productos, y va…"]
    HOG209["HOG-209<br/>Crear los hooks de datos y el tiempo real de l…"]
    HOG210["HOG-210<br/>Construir la pantalla de listas de la compra"]
    HOG211["HOG-211<br/>Construir la pantalla de una lista agrupada po…"]
    HOG213["HOG-213<br/>Crear la hoja de edición de producto con el av…"]
    HOG205["HOG-205<br/>Registrar el historial de compras al marcar y …"]
    HOG206["HOG-206<br/>Implementar la API del catálogo: autocompletad…"]
    HOG212["HOG-212<br/>Crear la barra de añadido rápido con autocompl…"]
    HOG207["HOG-207<br/>Añadir los indispensables que faltan a una lista"]
    HOG214["HOG-214<br/>Construir la pantalla de indispensables y el b…"]
    HOG216["HOG-216<br/>Escribir los e2e de la compra (E2E-05 y E2E-06)"]
    HOG208["HOG-208<br/>Exponer el historial de compras paginado"]
    HOG215["HOG-215<br/>Construir la pantalla del historial de compras"]
  end
  subgraph E07_2["E07 · Tareas"]
    HOG350["HOG-350<br/>Implementar las utilidades de recurrencia, ven…"]
    HOG351["HOG-351<br/>Definir los esquemas zod y los eventos de tare…"]
    HOG352["HOG-352<br/>Implementar la API de tareas (listar, crear, v…"]
    HOG353["HOG-353<br/>Completar y saltar tareas con rotación automát…"]
    HOG357["HOG-357<br/>Crear los hooks de datos y el tiempo real de t…"]
    HOG358["HOG-358<br/>Construir la lista de tareas con 'Mis tareas' …"]
    HOG360["HOG-360<br/>Crear el formulario de tarea con selector de r…"]
    HOG362["HOG-362<br/>Escribir el e2e de tarea por turnos (E2E-07)"]
    HOG354["HOG-354<br/>Exponer el historial de una tarea y deshacer l…"]
    HOG355["HOG-355<br/>Integrar los recordatorios de tareas con el Re…"]
    HOG356["HOG-356<br/>Reajustar asignaciones y turnos cuando un miem…"]
    HOG359["HOG-359<br/>Construir la vista de tareas por calles"]
    HOG361["HOG-361<br/>Crear la hoja de detalle de tarea con historial"]
  end
  subgraph E12_2["E12 · Notificaciones y recordatorios"]
    HOG600["HOG-600<br/>Suscripción push: VAPID, service worker y API …"]
    HOG604["HOG-604<br/>PushSender: envío Web Push y limpieza de suscr…"]
    HOG601["HOG-601<br/>ReminderScheduler y API pública de recordatorios"]
    HOG606["HOG-606<br/>Reconciliación en el tick de 6 h, recuperación…"]
    HOG602["HOG-602<br/>Preferencias de notificación (API + UI) y su a…"]
    HOG603["HOG-603<br/>Guía de instalación PWA / iOS y petición de pe…"]
    HOG605["HOG-605<br/>Deep links al tocar la notificación"]
    HOG607["HOG-607<br/>Aviso de prueba"]
  end
  HOG200 --> HOG201
  HOG201 --> HOG202
  HOG202 --> HOG203
  HOG203 --> HOG204
  HOG201 --> HOG209
  HOG209 --> HOG210
  HOG210 --> HOG211
  HOG211 --> HOG213
  HOG350 --> HOG351
  HOG351 --> HOG352
  HOG352 --> HOG353
  HOG351 --> HOG357
  HOG357 --> HOG358
  HOG357 --> HOG360
  HOG600 --> HOG360
  HOG358 --> HOG362
  HOG360 --> HOG362
  HOG600 --> HOG604
  HOG604 --> HOG601
  HOG601 --> HOG606
  HOG204 --> HOG205
  HOG205 --> HOG206
  HOG211 --> HOG212
  HOG206 --> HOG212
  HOG206 --> HOG207
  HOG212 --> HOG214
  HOG207 --> HOG214
  HOG211 --> HOG216
  HOG212 --> HOG216
  HOG213 --> HOG216
  HOG214 --> HOG216
  HOG353 --> HOG354
  HOG353 --> HOG355
  HOG601 --> HOG355
  HOG352 --> HOG356
  HOG358 --> HOG359
  HOG358 --> HOG361
  HOG354 --> HOG361
  HOG601 --> HOG602
  HOG600 --> HOG602
  HOG600 --> HOG603
  HOG602 --> HOG603
  HOG600 --> HOG605
  HOG205 --> HOG208
  HOG208 --> HOG215
  HOG210 --> HOG215
  HOG604 --> HOG607
  HOG602 --> HOG607
```

### Fase 3 · Recetas + Comidas + IA nevera

```mermaid
flowchart LR
  subgraph E05_3["E05 · Recetas"]
    HOG250["HOG-250<br/>Añadir constantes, utilidades y esquemas zod d…"]
    HOG251["HOG-251<br/>Crear y consultar recetas en la API"]
    HOG252["HOG-252<br/>Editar, marcar como favorita y borrar recetas …"]
    HOG253["HOG-253<br/>Buscar y filtrar recetas con paginación por cu…"]
    HOG254["HOG-254<br/>Añadir los ingredientes de una receta a la lis…"]
    HOG255["HOG-255<br/>Crear los hooks de datos y el tiempo real de r…"]
    HOG256["HOG-256<br/>Construir el recetario con búsqueda, filtros y…"]
    HOG257["HOG-257<br/>Construir el detalle de receta con raciones es…"]
    HOG258["HOG-258<br/>Construir el formulario de crear y editar receta"]
    HOG259["HOG-259<br/>Crear la hoja 'Añadir a la lista' desde una re…"]
  end
  subgraph E06_3["E06 · Comidas y dietas"]
    HOG300["HOG-300<br/>Añadir esquemas del menú y la dieta y la lógic…"]
    HOG301["HOG-301<br/>Implementar la API del perfil de dieta"]
    HOG302["HOG-302<br/>Implementar la API del menú (consultar, crear,…"]
    HOG304["HOG-304<br/>Enviar los ingredientes del menú a la lista de…"]
    HOG306["HOG-306<br/>Crear los hooks de datos y el tiempo real del …"]
    HOG307["HOG-307<br/>Construir el planificador semanal"]
    HOG308["HOG-308<br/>Crear la hoja de añadir y editar comida"]
    HOG311["HOG-311<br/>Crear la hoja de enviar ingredientes del menú …"]
    HOG312["HOG-312<br/>Crear la sección 'Mi dieta' del perfil y la ho…"]
    HOG313["HOG-313<br/>Escribir el e2e de receta → menú → lista (E2E-…"]
    HOG303["HOG-303<br/>Copiar el menú de una semana a otra (API)"]
    HOG305["HOG-305<br/>Limpiar los comensales del menú cuando un miem…"]
    HOG309["HOG-309<br/>Mostrar los avisos de dieta y alérgenos en el …"]
    HOG310["HOG-310<br/>Crear la hoja de copiar semana"]
  end
  subgraph E13_3["E13 · IA: núcleo + nevera → recetas"]
    HOG650["HOG-650<br/>Crear el núcleo de IA (cliente Gemini, cuota, …"]
    HOG651["HOG-651<br/>Añadir esquemas y utilidades de la nevera en s…"]
    HOG652["HOG-652<br/>Implementar la detección de ingredientes (frid…"]
    HOG653["HOG-653<br/>Implementar la generación de recetas (fridge/r…"]
    HOG654["HOG-654<br/>Validar alérgenos, dieta y 'tienes/te falta' e…"]
    HOG655["HOG-655<br/>Crear la base web de IA (aviso, cuota, errores…"]
    HOG656["HOG-656<br/>Reducir fotos en el cliente antes de subirlas"]
    HOG657["HOG-657<br/>Construir la pantalla '¿Qué cocino?': fotos e …"]
    HOG658["HOG-658<br/>Añadir preferencias y comensales a '¿Qué cocin…"]
    HOG659["HOG-659<br/>Mostrar las recetas propuestas con 'tienes / t…"]
    HOG660["HOG-660<br/>Guardar una receta propuesta en el recetario"]
    HOG661["HOG-661<br/>Mandar los ingredientes que faltan a una lista…"]
    HOG662["HOG-662<br/>Escribir el e2e de la nevera (E2E-09)"]
  end
  HOG250 --> HOG251
  HOG251 --> HOG252
  HOG251 --> HOG253
  HOG251 --> HOG254
  HOG250 --> HOG255
  HOG255 --> HOG256
  HOG255 --> HOG257
  HOG255 --> HOG258
  HOG250 --> HOG300
  HOG300 --> HOG301
  HOG300 --> HOG302
  HOG251 --> HOG302
  HOG302 --> HOG304
  HOG300 --> HOG306
  HOG306 --> HOG307
  HOG307 --> HOG308
  HOG255 --> HOG308
  HOG307 --> HOG311
  HOG304 --> HOG311
  HOG306 --> HOG312
  HOG258 --> HOG312
  HOG258 --> HOG313
  HOG308 --> HOG313
  HOG311 --> HOG313
  HOG650 --> HOG651
  HOG650 --> HOG652
  HOG651 --> HOG652
  HOG650 --> HOG653
  HOG651 --> HOG653
  HOG653 --> HOG654
  HOG650 --> HOG655
  HOG652 --> HOG657
  HOG655 --> HOG657
  HOG656 --> HOG657
  HOG657 --> HOG658
  HOG653 --> HOG658
  HOG658 --> HOG659
  HOG654 --> HOG659
  HOG659 --> HOG660
  HOG251 --> HOG660
  HOG659 --> HOG661
  HOG257 --> HOG259
  HOG254 --> HOG259
  HOG302 --> HOG303
  HOG302 --> HOG305
  HOG308 --> HOG309
  HOG307 --> HOG310
  HOG303 --> HOG310
  HOG660 --> HOG662
  HOG661 --> HOG662
```

### Fase 4 · Calendario + Horarios

```mermaid
flowchart LR
  subgraph E08_4["E08 · Horarios de trabajo"]
    HOG400["HOG-400<br/>Esquemas zod y constantes de horarios"]
    HOG401["HOG-401<br/>Cálculo puro del horario efectivo (DST y turno…"]
    HOG402["HOG-402<br/>API de mis horarios ('/me/work-schedules')"]
    HOG403["HOG-403<br/>API de excepciones ('/me/work-shift-overrides')"]
    HOG404["HOG-404<br/>Vista calculada 'GET /groups/:g/work-schedules'"]
    HOG405["HOG-405<br/>Hooks de datos y tiempo real de horarios (web)"]
    HOG406["HOG-406<br/>Pantalla 'Horarios': semana por calles"]
    HOG407["HOG-407<br/>Editor 'Mi horario': plantillas, franjas y cop…"]
    HOG408["HOG-408<br/>Excepciones de día: libre, vacaciones, baja y …"]
  end
  subgraph E09_4["E09 · Calendario y eventos"]
    HOG450["HOG-450<br/>Esquemas zod y constantes del calendario"]
    HOG451["HOG-451<br/>Expansión de recurrencias en la zona del grupo"]
    HOG452["HOG-452<br/>API: crear, listar (con expansión) y obtener e…"]
    HOG453["HOG-453<br/>API: editar y borrar con alcance (solo este / …"]
    HOG455["HOG-455<br/>Hooks de datos y tiempo real del calendario (w…"]
    HOG456["HOG-456<br/>Pantalla Calendario: estructura, agenda y deta…"]
    HOG457["HOG-457<br/>Formulario de evento: recurrencia, avisos y di…"]
    HOG454["HOG-454<br/>Proveedor de recordatorios de eventos ('EVENT')"]
    HOG458["HOG-458<br/>Vista semana por calles"]
    HOG459["HOG-459<br/>Vista mes"]
    HOG461["HOG-461<br/>E2E-10: propiedad de eventos"]
    HOG460["HOG-460<br/>Capas de solo lectura: tareas y horarios"]
  end
  HOG400 --> HOG401
  HOG400 --> HOG402
  HOG402 --> HOG403
  HOG401 --> HOG404
  HOG403 --> HOG404
  HOG404 --> HOG405
  HOG405 --> HOG406
  HOG405 --> HOG407
  HOG406 --> HOG407
  HOG450 --> HOG451
  HOG451 --> HOG452
  HOG452 --> HOG453
  HOG452 --> HOG455
  HOG455 --> HOG456
  HOG456 --> HOG457
  HOG406 --> HOG408
  HOG452 --> HOG454
  HOG456 --> HOG458
  HOG456 --> HOG459
  HOG457 --> HOG461
  HOG458 --> HOG460
  HOG459 --> HOG460
  HOG405 --> HOG460
```

### Fase 5 · Gastos + Facturas

```mermaid
flowchart LR
  subgraph E10_5["E10 · Gastos de ocio y presupuestos"]
    HOG500["HOG-500<br/>Esquemas zod y lógica pura de gastos y presupu…"]
    HOG501["HOG-501<br/>API de categorías de gasto"]
    HOG502["HOG-502<br/>API de gastos: CRUD, filtros y propiedad"]
    HOG504["HOG-504<br/>API de presupuestos"]
    HOG503["HOG-503<br/>API de resumen mensual"]
    HOG505["HOG-505<br/>Hooks de datos y tiempo real de gastos (web)"]
    HOG506["HOG-506<br/>Movimientos y formulario de gasto en dos toques"]
    HOG507["HOG-507<br/>Resumen mensual con gráficas"]
    HOG508["HOG-508<br/>Presupuestos: edición y avisos del 80 % y supe…"]
    HOG510["HOG-510<br/>API: escanear ticket con IA ('POST /ai/receipt')"]
    HOG511["HOG-511<br/>Web: escanear ticket y formulario prellenado"]
    HOG512["HOG-512<br/>E2E-11: gastos, presupuesto superado y propiedad"]
    HOG509["HOG-509<br/>Gestión de categorías del hogar (web)"]
  end
  subgraph E11_5["E11 · Gastos fijos y facturas"]
    HOG550["HOG-550<br/>Esquemas zod, constantes y cálculo puro de ven…"]
    HOG551["HOG-551<br/>API de facturas: CRUD, archivar y restaurar"]
    HOG552["HOG-552<br/>Materialización de recibos (al crear/editar y …"]
    HOG553["HOG-553<br/>API de recibos: listar, pagar y deshacer"]
    HOG555["HOG-555<br/>Hooks de datos y tiempo real de facturas (web)"]
    HOG556["HOG-556<br/>Pantalla Facturas: héroe, próximos vencimiento…"]
    HOG557["HOG-557<br/>Formulario de factura con vista previa de venc…"]
    HOG558["HOG-558<br/>Pagar y deshacer pago (web)"]
    HOG554["HOG-554<br/>Proveedor de recordatorios de facturas ('BILL')"]
    HOG559["HOG-559<br/>Historial y total mensual de gastos fijos"]
    HOG560["HOG-560<br/>E2E-12: factura mensual pagada"]
    HOG561["HOG-561<br/>Capa 'Facturas' en el calendario"]
  end
  HOG500 --> HOG501
  HOG501 --> HOG502
  HOG501 --> HOG504
  HOG502 --> HOG503
  HOG504 --> HOG503
  HOG503 --> HOG505
  HOG504 --> HOG505
  HOG505 --> HOG506
  HOG550 --> HOG551
  HOG551 --> HOG552
  HOG552 --> HOG553
  HOG553 --> HOG555
  HOG555 --> HOG556
  HOG556 --> HOG557
  HOG556 --> HOG558
  HOG506 --> HOG507
  HOG507 --> HOG508
  HOG501 --> HOG510
  HOG510 --> HOG511
  HOG506 --> HOG511
  HOG508 --> HOG512
  HOG553 --> HOG554
  HOG556 --> HOG559
  HOG558 --> HOG560
  HOG559 --> HOG560
  HOG506 --> HOG509
  HOG555 --> HOG561
```

### Fase 6 · Asistente + Inicio completo + RGPD + Producción

```mermaid
flowchart LR
  subgraph E14_6["E14 · IA: asistente por chat"]
    HOG700["HOG-700<br/>Definir los esquemas compartidos del asistente"]
    HOG701["HOG-701<br/>Implementar la API de conversaciones del asist…"]
    HOG702["HOG-702<br/>Crear el registro de herramientas y las de lec…"]
    HOG703["HOG-703<br/>Añadir las herramientas de lectura de tareas, …"]
    HOG705["HOG-705<br/>Orquestar el turno del asistente con streaming…"]
    HOG706["HOG-706<br/>Implementar las herramientas de escritura como…"]
    HOG707["HOG-707<br/>Confirmar y descartar acciones propuestas"]
    HOG709["HOG-709<br/>Crear el cliente SSE y los hooks del asistente…"]
    HOG710["HOG-710<br/>Construir la pantalla del asistente con stream…"]
    HOG711["HOG-711<br/>Mostrar la tarjeta de acción con confirmar y d…"]
    HOG704["HOG-704<br/>Añadir las herramientas de lectura de gastos, …"]
    HOG708["HOG-708<br/>Aplicar retención y borrado de conversaciones"]
    HOG712["HOG-712<br/>Añadir el botón flotante del asistente en Inicio"]
    HOG713["HOG-713<br/>Montar la evaluación del asistente con respues…"]
    HOG714["HOG-714<br/>Escribir el e2e del asistente (E2E-13)"]
    HOG715["HOG-715<br/>Crear un script de evaluación manual contra Ge…"]
  end
  subgraph E15_6["E15 · Inicio (dashboard) y navegación"]
    HOG757["HOG-757<br/>Añadir la sección de turnos de trabajo al Inicio"]
    HOG758["HOG-758<br/>Añadir la sección de tareas de hoy al Inicio"]
    HOG759["HOG-759<br/>Añadir la sección de eventos de hoy al Inicio"]
    HOG760["HOG-760<br/>Añadir la sección de comidas de hoy al Inicio"]
    HOG761["HOG-761<br/>Añadir la sección de facturas próximas al Inicio"]
    HOG762["HOG-762<br/>Añadir la sección de listas de la compra al In…"]
    HOG763["HOG-763<br/>Pintar turnos, tareas y eventos en las calles …"]
    HOG764["HOG-764<br/>Pintar comidas, listas, facturas y '¿Qué cocin…"]
    HOG765["HOG-765<br/>Actualizar el Inicio en tiempo real con los ev…"]
    HOG766["HOG-766<br/>Escribir el e2e de Inicio y navegación (E2E-16)"]
  end
  subgraph E16_6["E16 · Perfil, ajustes y RGPD"]
    HOG800["HOG-800<br/>Ampliar los esquemas compartidos de perfil, ex…"]
    HOG801["HOG-801<br/>Editar nombre, nombre de usuario y foto desde …"]
    HOG802["HOG-802<br/>Construir la página de perfil y la sección 'Tu…"]
    HOG806["HOG-806<br/>Exportar los datos del usuario en JSON"]
    HOG807["HOG-807<br/>Añadir 'Descargar mis datos' en el perfil"]
    HOG808["HOG-808<br/>Borrar la cuenta del usuario (API)"]
    HOG809["HOG-809<br/>Añadir el diálogo 'Borrar mi cuenta' en el per…"]
    HOG810["HOG-810<br/>Publicar las páginas de privacidad y términos"]
    HOG811["HOG-811<br/>Probar la matriz completa del borrado de cuenta"]
    HOG803["HOG-803<br/>Integrar la sección de seguridad (contraseña, …"]
    HOG804["HOG-804<br/>Integrar dieta, notificaciones, administración…"]
    HOG805["HOG-805<br/>Permitir elegir tema claro, oscuro o del sistema"]
    HOG812["HOG-812<br/>Escribir el e2e de exportar y borrar cuenta (E…"]
  end
  subgraph E17_6["E17 · Calidad, seguridad y producción"]
    HOG851["HOG-851<br/>Configurar la CSP y las cabeceras de seguridad…"]
    HOG852["HOG-852<br/>Endurecer la configuración de la API y del soc…"]
    HOG853["HOG-853<br/>Comprobar por introspección que todas las ruta…"]
    HOG854["HOG-854<br/>Crear la matriz de autorización de todos los m…"]
    HOG861["HOG-861<br/>Configurar logs de producción con redacción y …"]
    HOG863["HOG-863<br/>Programar copias de seguridad semanales cifradas"]
    HOG864["HOG-864<br/>Documentar y probar la restauración de una copia"]
    HOG855["HOG-855<br/>Ejecutar la suite e2e completa en CI"]
    HOG856["HOG-856<br/>Añadir comprobaciones de accesibilidad con axe…"]
    HOG859["HOG-859<br/>Verificar la instalabilidad de la PWA con Play…"]
    HOG860["HOG-860<br/>Dividir el bundle por rutas y fijar presupuest…"]
    HOG865["HOG-865<br/>Ampliar el seed con datos de demo de todos los…"]
    HOG858["HOG-858<br/>Medir el rendimiento con Lighthouse CI en móvil"]
    HOG866["HOG-866<br/>Activar Dependabot, pnpm audit y gitleaks"]
    HOG850["HOG-850<br/>Revisar la seguridad contra la checklist de do…"]
    HOG867["HOG-867<br/>Escribir el runbook de incidencias"]
    HOG868["HOG-868<br/>Actualizar la documentación final"]
    HOG857["HOG-857<br/>Hacer la revisión manual de accesibilidad con …"]
    HOG862["HOG-862<br/>Añadir healthcheck de Docker y monitor externo…"]
  end
  HOG700 --> HOG701
  HOG700 --> HOG702
  HOG702 --> HOG703
  HOG701 --> HOG705
  HOG702 --> HOG705
  HOG705 --> HOG706
  HOG706 --> HOG707
  HOG700 --> HOG709
  HOG709 --> HOG710
  HOG705 --> HOG710
  HOG710 --> HOG711
  HOG707 --> HOG711
  HOG800 --> HOG801
  HOG801 --> HOG802
  HOG800 --> HOG806
  HOG806 --> HOG807
  HOG802 --> HOG807
  HOG800 --> HOG808
  HOG808 --> HOG809
  HOG802 --> HOG809
  HOG808 --> HOG811
  HOG853 --> HOG854
  HOG863 --> HOG864
  HOG808 --> HOG864
  HOG702 --> HOG704
  HOG701 --> HOG708
  HOG710 --> HOG712
  HOG707 --> HOG713
  HOG703 --> HOG713
  HOG704 --> HOG713
  HOG711 --> HOG714
  HOG712 --> HOG714
  HOG757 --> HOG763
  HOG758 --> HOG763
  HOG759 --> HOG763
  HOG760 --> HOG764
  HOG761 --> HOG764
  HOG762 --> HOG764
  HOG763 --> HOG765
  HOG764 --> HOG765
  HOG765 --> HOG766
  HOG802 --> HOG803
  HOG802 --> HOG804
  HOG802 --> HOG805
  HOG807 --> HOG812
  HOG809 --> HOG812
  HOG810 --> HOG812
  HOG714 --> HOG855
  HOG766 --> HOG855
  HOG812 --> HOG855
  HOG855 --> HOG856
  HOG855 --> HOG859
  HOG855 --> HOG858
  HOG865 --> HOG858
  HOG851 --> HOG850
  HOG852 --> HOG850
  HOG853 --> HOG850
  HOG854 --> HOG850
  HOG866 --> HOG850
  HOG861 --> HOG867
  HOG863 --> HOG867
  HOG850 --> HOG868
  HOG855 --> HOG868
  HOG863 --> HOG868
  HOG865 --> HOG868
  HOG867 --> HOG868
  HOG856 --> HOG857
  HOG713 --> HOG715
```
