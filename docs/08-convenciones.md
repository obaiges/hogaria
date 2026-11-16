# 08 · Convenciones

## Idioma
- **Código, identificadores, nombres de archivo, commits y ramas:** inglés (el *scope* del commit también).
- **Textos de la interfaz, mensajes de error al usuario, documentación y descripciones de commit:** español.
- Las traducciones de dominio están **fijadas en `docs/10-glosario.md`**. Si un concepto no está, añádelo al glosario antes de usarlo.

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`. Prohibido `any` (usa `unknown` y estrecha el tipo).
- Tipos derivados de zod: `type CreateTaskInput = z.infer<typeof createTaskInput>`.
- Sin `enum` de TS en el frontend: usa los enums que exporta Prisma, reexportados en `shared` como uniones de string (`const MEAL_SLOTS = [...] as const`).
- Importaciones absolutas con alias: `@/` (en web y api) y `@hogaria/shared`.

## Nombres
| Cosa | Convención | Ejemplo |
|---|---|---|
| Archivos React | PascalCase | `ShoppingListPage.tsx` |
| Otros archivos | kebab-case | `shopping-items.service.ts` |
| Hooks | `useXxx` | `useShoppingItems(listId)` |
| Esquemas zod | camelCase + sufijo | `createTaskInput`, `taskDto` |
| Eventos en tiempo real | `entity.action` en minúsculas | `task.completed` |
| Rutas web | kebab-case en español | `/g/:groupId/compra/:listId` (ver glosario) |
| Rutas API | kebab-case en inglés | `/groups/:groupId/shopping-lists` |
| Tablas BBDD | snake_case plural | `shopping_items` |

## Rutas de la PWA (español, fijadas)
```
/entrar                     login (?volver=<ruta>, ?cuenta=borrada)
/registro                   registro (requiere invitación)
/recuperar                  recuperar contraseña
/invite/:token              aceptar invitación
/grupos                     selector y creación de grupo
/g/:groupId                 inicio (dashboard)
/g/:groupId/compra          listas
/g/:groupId/compra/indispensables   indispensables (se declara antes de :listId)
/g/:groupId/compra/historial        historial de compras (se declara antes de :listId)
/g/:groupId/compra/:listId  lista
/g/:groupId/comidas         planificador semanal (?fecha=)
/g/:groupId/recetas         recetario
/g/:groupId/recetas/nueva   (se declara antes de :id)
/g/:groupId/recetas/:id
/g/:groupId/recetas/:id/editar
/g/:groupId/nevera          IA nevera
/g/:groupId/tareas          ?vista=mias|todas|calles · ?destacar=<taskId> (abre la hoja de detalle)
/g/:groupId/calendario      ?vista=agenda|semana|mes · ?fecha= · ?destacar=<eventId>[&ocurrencia=<ISO>] (abre el detalle)
/g/:groupId/horarios        ?fecha=
/g/:groupId/gastos          ?mes=YYYY-MM · ?persona=<userId> · ?categoria=<id> · ?vista=resumen|movimientos
/g/:groupId/facturas        ?vista=proximos|facturas|historial · ?destacar=<billPaymentId> (abre el recibo) · ?factura=<billId> (abre la ficha)
/g/:groupId/asistente
/g/:groupId/actividad
/g/:groupId/ajustes         ajustes del grupo (miembros, invitaciones)
/perfil                     perfil, seguridad, dieta, notificaciones, RGPD
/admin                      solo isPlatformAdmin
/legal/privacidad · /legal/terminos
```

"Más" es una **hoja** (sheet) sobre la pantalla actual: no tiene ruta.

### Parámetros de *deep link* (comunes a toda la PWA; spec 15, RN-15-13)
- Nombres de parámetro **en español**: `?fecha=YYYY-MM-DD` (la pantalla abre ese día o semana), `?destacar=<id>` (scroll hasta el elemento, foco y **una** onda; en tareas, calendario y facturas abre además su hoja de detalle; si el id no existe, se ignora sin error) y `?volver=<ruta>` (solo en `/entrar`; se acepta únicamente si empieza por `/` y no por `//` ni contiene `://`).
- **URLs canónicas de los recordatorios** (`Reminder.url`) y de los enlaces del asistente:
  - Tarea: `/g/<groupId>/tareas?destacar=<taskId>`
  - Evento: `/g/<groupId>/calendario?fecha=<YYYY-MM-DD>&destacar=<eventId>` (más `&ocurrencia=<ISO de inicio de la ocurrencia>` si es recurrente)
  - Recibo de factura: `/g/<groupId>/facturas?destacar=<billPaymentId>`
- No se usan parámetros en inglés (`?task=`, `?event=`, `?payment=`, `?bill=`, `?occurrence=`).

## Git
- Rama principal `main`. Ramas `feat/HOG-123-short-name`, `fix/HOG-123-…`, `chore/…`.
- **Conventional Commits:** `type(scope): HOG-123 descripción en español`
  - `type`: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `style`
  - `scope`: `web`, `api`, `shared`, `shopping`, `tasks`, … o `docs`
  - Ejemplo: `feat(tasks): HOG-354 rotación automática al completar`
- Un ticket por PR siempre que sea posible.

## Frontend
- Componentes de presentación sin fetch. Los datos llegan por hooks de `features/<x>/api.ts`.
- Toda mutación usa una actualización optimista + rollback y añade `X-Client-Mutation-Id`.
- Fechas: siempre con utilidades de `lib/dates.ts` en la zona del grupo. Nunca `new Date().getDay()` a pelo.
- Dinero: `formatMoney(cents)` → `"12,34 €"` (`Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })`). `parseMoney("12,34")` → `1234`.
- Accesibilidad: todo control con label, foco visible y objetivos táctiles ≥ 44 px. Las animaciones respetan `prefers-reduced-motion`.
- Estados obligatorios en cada pantalla de datos: **cargando (skeleton), vacío (con acción), error (con reintentar), sin conexión**.

## Backend
- Los controllers no tienen lógica: validan y llaman al servicio.
- Las escrituras siguen el **patrón de mutación** de `docs/01-arquitectura.md`.
- Los servicios lanzan `AppError(code, detail?)`, que un filtro global convierte en problem+json.
- Logs estructurados con contexto (`groupId`, `userId`, `requestId`). Sin datos personales.

## Documentación
- Cambiar el comportamiento implica actualizar la spec en el mismo PR.
- Cambiar una decisión implica un ADR nuevo en `docs/09-decisiones.md` (los anteriores no se borran; se marcan como "Sustituido por ADR-0XX").
- Diagramas en Mermaid dentro de los `.md`.
