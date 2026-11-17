# 04 · API REST y tiempo real

## Convenciones REST

- **Base:** `https://api.hogaria.obaiges.com/api/v1` (en local `/api/v1` mediante el proxy de Vite).
- **Auth:** `/api/auth/*` lo gestiona Better Auth (no lleva versión).
- **Rutas de grupo:** `/api/v1/groups/:groupId/<recurso>`. Rutas personales: `/api/v1/me/<recurso>`.
- **Recursos** en `kebab-case` plural: `shopping-lists`, `shopping-items`, `meal-plan`, `work-schedules`.
- **JSON en camelCase.** Fechas: los instantes en ISO 8601 UTC (`2026-11-11T08:00:00.000Z`) y los días como `YYYY-MM-DD`. Decimales como `string` (`"1.5"`). Dinero siempre en `amountCents` (entero).
- **Métodos:** `GET` (listar u obtener), `POST` (crear o acción), `PATCH` (actualización parcial), `DELETE`. Las acciones que no son CRUD usan `POST /recurso/:id/<accion>` (por ejemplo `POST /tasks/:id/complete`).
- **Respuestas:** el recurso directamente, sin envoltorio. Las listas paginadas devuelven `{ items: T[], nextCursor: string | null }`, con paginación por cursor (`?cursor=&limit=`, límite por defecto 50 y máximo 100). El cursor es **opaco** para el cliente (base64url): por defecto codifica el `id` UUIDv7; si el listado se ordena por otra clave, codifica la tupla de orden (p. ej. `GET /groups/:g/expenses` ordena por `date desc, id desc` y el cursor codifica `(date, id)`).
- **Cabecera `X-Client-Mutation-Id`** (UUID) en toda mutación desde la web. Se devuelve en el evento de tiempo real para que el autor lo ignore.
- **Validación:** cada endpoint declara sus esquemas zod en `packages/shared/src/schemas/<modulo>.ts` (`createShoppingItemInput`, `shoppingItemDto`, …).
- **Documentación:** se genera OpenAPI 3.1 desde los esquemas zod y se sirve en `/api/docs` (Swagger UI; el JSON en `/api/docs/openapi.json`) **solo en desarrollo**; en test y producción responde 404. Cada ruta declara sus esquemas con `@ApiContract({ body?, query?, params?, response, summary? })` (`apps/api/src/openapi/`) y aparece sin más pasos. Se usa `z.toJSONSchema()` de zod 4 (JSON Schema 2020-12, el de OpenAPI 3.1), sin `zod-openapi`. El decorador solo documenta: la validación sigue en `ZodValidationPipe` (HOG-016).

## Formato de error (RFC 9457 `application/problem+json`)

```json
{
  "type": "https://hogaria.obaiges.com/errors/validation-error",
  "title": "Datos no válidos",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "La cantidad debe ser mayor que 0",
  "errors": [{ "path": "quantity", "message": "Debe ser mayor que 0" }]
}
```

### Códigos de error (`packages/shared/src/errors.ts`)

| code | status | Uso |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Sin sesión o sesión caducada |
| `FORBIDDEN_NOT_OWNER` | 403 | Recurso con propiedad, no eres el dueño |
| `ACCOUNT_BLOCKED` | 403 | Usuario bloqueado |
| `FORBIDDEN_ORIGIN` | 403 | Mutación (`POST/PATCH/PUT/DELETE`) con cabecera `Origin` fuera de la lista permitida (protección CSRF, HOG-014) |
| `NOT_FOUND` | 404 | No existe **o no tienes acceso** |
| `CONFLICT` | 409 | Choque de unicidad (nombre duplicado, color ocupado…) |
| `STALE_VERSION` | 409 | `ShoppingItem.version` desactualizada (ver resolución de conflictos) |
| `VALIDATION_ERROR` | 422 | Fallo del esquema zod |
| `INVITE_INVALID` | 410 | Invitación caducada, usada o revocada |
| `INVITE_REQUIRED` | 403 | Registro sin invitación |
| `AI_LIMIT_REACHED` | 429 | Límite diario de IA del grupo |
| `AI_UNAVAILABLE` | 503 | Gemini falla o agota su cuota |
| `AI_NOTICE_REQUIRED` | 403 | El usuario no ha aceptado el aviso de privacidad de IA |
| `RATE_LIMITED` | 429 | Throttler |
| `IMAGE_INVALID` | 422 | Tipo o tamaño de imagen no permitido |
| `HEALTH_CONSENT_REQUIRED` | 422 | Se guardan alergias u otras restricciones en el perfil de dieta sin consentimiento explícito (spec 06) |
| `INTERNAL` | 500 | Error inesperado (sin detalles internos) |

El campo `type` es `https://hogaria.obaiges.com/errors/<code-en-kebab-case>` (`problemTypeFor(code)` en `packages/shared/src/errors.ts`); `title` sale de `ERROR_TITLES_ES`.

En la web, cada `code` tiene un mensaje en español en `packages/shared/src/errors.ts` (`ERROR_MESSAGES_ES`).

**Miembros de extensión del problem+json** (además de `errors`):
- `current`: el recurso vigente en el servidor. Lo llevan `409 STALE_VERSION` (el `ShoppingItemDto` actual) y el `409 CONFLICT` de `POST /tasks/:id/complete` y `POST /tasks/:id/skip` cuando `expectedDueAt` no coincide (el `TaskDto` actual).
- `feature`, `limit` y `resetsAt`: los lleva `429 AI_LIMIT_REACHED`.
- Todos los `429` llevan además la cabecera `Retry-After` (segundos).

**Códigos de Better Auth:** las rutas `/api/auth/*` devuelven los códigos propios de Better Auth (`INVALID_EMAIL_OR_PASSWORD`, `EMAIL_NOT_VERIFIED`, `USER_ALREADY_EXISTS`, `INVALID_TOKEN`, `INVALID_PASSWORD`, …) además de `ACCOUNT_BLOCKED`, `INVITE_REQUIRED` y `RATE_LIMITED`. `ERROR_MESSAGES_ES` incluye también sus textos (spec 01).

## Catálogo de endpoints (resumen)

> El detalle de cada uno (entrada y salida) está en la spec del módulo. Esta tabla es el índice. Cualquier endpoint nuevo se añade aquí.

| Módulo | Endpoints |
|---|---|
| Salud | `GET /health` → `{ status: "ok", version, uptimeSeconds }` (no toca la BBDD) · `GET /health/db` → `{ status: "ok", latencyMs }` o `503` (6 peticiones/min por IP). Ambos públicos (spec 17) |
| Yo | `GET /me` (`meDto`, specs 01 y 16: incluye `aiNoticeAcceptedAt`, `hasPassword`, `linkedProviders`, `googleImage` y `preferInitialsAvatar`) · `PATCH /me` · `GET /me/groups` · `POST /me/ai-notice` (acepta el aviso de IA; idempotente; devuelve `{ aiNoticeAcceptedAt }`) · `GET /me/deletion-preview` · `DELETE /me` (cuerpo `{ "confirmation": "BORRAR" }`, responde `204`) · `GET /me/export` (descarga con `Content-Disposition: attachment`) · `GET/PUT /me/diet-profile` · `GET/PUT /me/notification-preferences` · `GET/POST /me/push-subscriptions` · `DELETE /me/push-subscriptions/:id` · `POST /me/push-subscriptions/test` · Sesiones (Better Auth; **no** existe `/me/sessions`): `GET /api/auth/list-sessions` · `POST /api/auth/revoke-session` · `POST /api/auth/revoke-other-sessions` |
| Horarios (personales) | `GET/POST /me/work-schedules` · `PATCH/DELETE /me/work-schedules/:id` · `GET /me/work-shift-overrides?from&to` · `POST /me/work-shift-overrides/bulk` · `DELETE /me/work-shift-overrides?from&to` · `GET/PUT/DELETE /me/work-shift-overrides/:date` · `GET /groups/:g/work-schedules?from&to` (vista calculada de todos los miembros) |
| Grupos | `POST /groups` · `GET/PATCH /groups/:g` · `GET /groups/:g/members` · `PATCH /groups/:g/members/me` (laneColor) · `DELETE /groups/:g/members/:userId` · `POST /groups/:g/leave` |
| Invitaciones | `POST /groups/:g/invites` · `GET /groups/:g/invites` · `DELETE /groups/:g/invites/:id` (devuelve el `GroupInviteDto` revocado) · `GET /invites/:token` (público, 30 peticiones/min por IP: nombre del grupo, validez y `alreadyMember`; pone la cookie `hogaria_invite`) · `POST /invites/:token/accept` |
| Actividad | `GET /groups/:g/activity?cursor` |
| Compra | `GET/POST /groups/:g/shopping-lists` · `PATCH/DELETE /groups/:g/shopping-lists/:id` · `POST /groups/:g/shopping-lists/:id/clear-checked` · `GET/POST /groups/:g/shopping-lists/:id/items` · `POST /groups/:g/shopping-lists/:id/items/bulk` · `PATCH/DELETE /groups/:g/shopping-items/:id` · `GET /groups/:g/products?q=` · `POST /groups/:g/products` · `PATCH/DELETE /groups/:g/products/:id` · `GET /groups/:g/products/frequent` · `GET /groups/:g/products/essentials` · `POST /groups/:g/shopping-lists/:id/add-missing-essentials` · `GET /groups/:g/purchases?cursor` |
| Recetas | `GET/POST /groups/:g/recipes` · `GET/PATCH/DELETE /groups/:g/recipes/:id` · `POST /groups/:g/recipes/:id/add-to-shopping-list` |
| Comidas | `GET /groups/:g/meal-plan?from&to` · `POST /groups/:g/meal-plan` · `PATCH/DELETE /groups/:g/meal-plan/:id` · `POST /groups/:g/meal-plan/add-to-shopping-list` (rango) · `POST /groups/:g/meal-plan/copy-week` · `GET /groups/:g/diet-profiles` |
| Tareas | `GET/POST /groups/:g/tasks` · `GET/PATCH/DELETE /groups/:g/tasks/:id` · `POST /groups/:g/tasks/:id/complete` · `POST /groups/:g/tasks/:id/skip` · `DELETE /groups/:g/tasks/:id/completions/:completionId` (deshace la última completación o salto; devuelve `TaskDto` y emite `task.updated`) · `GET /groups/:g/tasks/:id/history` |
| Calendario | `GET /groups/:g/events?from&to` (expande recurrencias) · `GET /groups/:g/events/:id?occurrence=` · `POST /groups/:g/events` · `PATCH/DELETE /groups/:g/events/:id` (`?scope=this\|all&occurrence=`) |
| Gastos | `GET /groups/:g/expenses?from&to&ownerId&categoryId` · `POST` · `PATCH/DELETE /:id` · `GET /groups/:g/expenses/summary?month=YYYY-MM` · `GET /groups/:g/expense-categories?includeArchived` · `POST /groups/:g/expense-categories` · `PATCH/DELETE /groups/:g/expense-categories/:id` · `GET/PUT/DELETE /groups/:g/budgets` |
| Facturas | `GET /groups/:g/bills?includeArchived` · `POST /groups/:g/bills` · `GET/PATCH/DELETE /groups/:g/bills/:id` · `GET /groups/:g/bill-payments?from&to&status&billId` · `POST /groups/:g/bill-payments/:id/pay` · `POST /groups/:g/bill-payments/:id/unpay` |
| Inicio | `GET /groups/:g/dashboard?date=YYYY-MM-DD` (las secciones opcionales `meals`, `bills`, `shopping` y, dentro de `lanes`, `shift`/`tasks`/`events` se omiten si su módulo no está registrado; spec 15) |
| IA | `GET /groups/:g/ai/quota` (siempre las 4 features, en el orden de `AI_FEATURES`) · `POST /groups/:g/ai/fridge/detect` (multipart `images[]`) · `POST /groups/:g/ai/fridge/recipes` · `POST /groups/:g/ai/receipt` (multipart `image`, una sola imagen) |
| Asistente | `GET/POST /groups/:g/assistant/conversations` · `GET/DELETE /groups/:g/assistant/conversations/:id` · `POST /groups/:g/assistant/conversations/:id/messages` (respuesta en streaming SSE; protocolo en `docs/05-ia.md`) · `POST /groups/:g/assistant/conversations/:id/actions/:messageId/confirm` · `.../reject` |
| Admin plataforma | `GET /admin/users` · `POST /admin/users/:id/block` · `POST /admin/users/:id/unblock` |

## Tiempo real (Socket.IO)

### Conexión
- URL: `wss://api.hogaria.obaiges.com`, `path: "/realtime"`, `withCredentials: true`, transporte `websocket` (con fallback a polling).
- Handshake: se valida la cookie de sesión de Better Auth. Si falla, `connect_error` con `UNAUTHENTICATED`.
- Al conectar, el servidor une el socket a `user:<userId>` y a `group:<id>` **por cada grupo del usuario**.
- Si el usuario se une a un grupo nuevo o sale de uno, el servidor ajusta las salas de todos sus sockets.

### Sobre (envelope) de los eventos

```ts
// packages/shared/src/realtime.ts
export interface RealtimeEnvelope<T> {
  event: RealtimeEventName;      // "shopping.item.updated"
  groupId: string | null;        // null solo en eventos de la sala user:<id> que no son de un grupo (session.revoked)
  actorId: string | null;        // null = sistema (scheduler)
  clientMutationId: string | null;
  at: string;                    // ISO
  data: T;                       // DTO completo del recurso (o { id } en deleted)
}
```

Todos los eventos se emiten con el nombre de canal único `"evt"` y el sobre de arriba (un solo listener en el cliente que despacha por `event`). Los eventos que van a "todos los grupos del usuario" (`schedule.updated`, `diet.updated`) se emiten como **un sobre por grupo**, cada uno en la sala `group:<id>` y con su `groupId` (spec 03, RN-03-09).

### Catálogo de eventos

| Evento | data | Sala |
|---|---|---|
| `group.updated` | `GroupDto` | group |
| `group.member.joined` / `group.member.updated` / `group.member.left` | `GroupMemberDto` / `{ userId }` | group |
| `invite.created` / `invite.revoked` / `invite.used` | `GroupInviteDto` | group |
| `activity.created` | `ActivityDto` | group |
| `shopping.list.created` / `.updated` / `.deleted` | `ShoppingListDto` / `{ id }` | group |
| `shopping.item.created` / `.updated` / `.deleted` | `ShoppingItemDto` / `{ id, listId }` | group |
| `shopping.items.bulk_created` / `.bulk_deleted` | `{ listId, items }` / `{ listId, ids }` | group |
| `product.updated` / `product.deleted` | `ProductDto` (también al crear con `POST /products`) / `{ id }` | group |
| `recipe.created` / `.updated` / `.deleted` | `RecipeDto` / `{ id }` | group |
| `meal.created` / `.updated` / `.deleted` | `MealPlanEntryDto` / `{ id, date }` | group |
| `task.created` / `.updated` / `.deleted` / `.completed` / `.skipped` | `TaskDto` (+ `completion` en completed/skipped) | group |
| `event.created` / `.updated` / `.deleted` | `CalendarEventDto` / `{ id }` | group |
| `schedule.updated` | `{ userId }` (el cliente recarga la vista de horarios) | cada grupo del usuario (un sobre por grupo) |
| `diet.updated` | `DietProfileDto` | cada grupo del usuario (un sobre por grupo) |
| `expense.created` / `.updated` / `.deleted` | `ExpenseDto` / `{ id }` | group |
| `expense_category.changed` | `ExpenseCategoryDto[]` | group |
| `budget.changed` | `BudgetDto[]` del usuario | group |
| `bill.created` / `.updated` / `.deleted` | `BillDto` / `{ id }` | group |
| `bill_payment.updated` | `BillPaymentDto` | group |
| `ai.quota.updated` | `AiQuotaDto` | group |
| `session.revoked` | `{}` | user, con `groupId: null` (el cliente cierra la sesión local) |

### Reglas del cliente
1. Un único `RealtimeProvider` que, por cada evento, aplica `setQueryData` sobre las claves afectadas o, si es complejo, `invalidateQueries`.
2. Si `clientMutationId` está en el registro de mutaciones propias (`Set` de los últimos 200), el evento se ignora. **Excepción** (`NON_DEDUPED_EVENTS` en `shared`): `activity.created` y `ai.quota.updated` se aplican siempre, porque el autor no los ha aplicado de forma optimista.
3. Las filas cambiadas por **otro** miembro reproducen la animación **"onda"** (ver `DESIGN.md`).
4. En `reconnect`, se invalidan todas las queries del grupo activo.
5. Sin conexión (`navigator.onLine === false` **o** socket desconectado 5 s o más; spec 03, RN-03-22): banner "Sin conexión. Los cambios no se guardarán" y controles de edición deshabilitados (no hay modo offline). Las mutaciones **nunca** se encolan (`networkMode: 'always'` en TanStack Query).

### Claves de TanStack Query (convención)
```ts
['group', groupId, 'shopping-lists']
['group', groupId, 'shopping-list', listId, 'items']
['group', groupId, 'tasks']
['group', groupId, 'events', { from, to }]
['me', 'groups']
```
Todo lo de un grupo empieza por `['group', groupId]` para poder invalidarlo de golpe.

## Resolución de conflictos

- **General (last-write-wins):** `PATCH` sobrescribe los campos enviados. El evento difunde el estado final y todos los clientes convergen.
- **Lista de la compra (por elemento):**
  - Cada `ShoppingItem` tiene `version`. El `PATCH` puede incluir `expectedVersion`.
  - **Marcar o desmarcar** (`checked`) **no** exige versión: es idempotente y gana el último.
  - **Editar texto o cantidad** con `expectedVersion` desactualizada → `409 STALE_VERSION` con el item actual en el miembro de extensión `current`. El cliente muestra "Ana acaba de cambiar este producto", aplica la versión del servidor y conserva el texto del usuario en el campo por si quiere reintentar.
  - **Borrar** un item ya borrado → 404, que el cliente trata como éxito.
  - **Añadir** un producto que ya existe sin marcar en la misma lista (mismo `normalizedName`): no se duplica, se **suma la cantidad** si las unidades coinciden (la respuesta es `200` en vez de `201` y se emite `shopping.item.updated`); si no coinciden, se crea otra línea.
