# 10 · Gastos de ocio y presupuestos

> Épica: E10 · Tickets: `docs/tickets/E10-gastos.md` · Modelo: `docs/02-modelo-datos.md` (sección "Gastos de ocio": `ExpenseCategory`, `Expense`, `Budget`) · IA: `docs/05-ia.md` (Flujo 2: ticket → gasto)

## 1. Objetivo

Que cada miembro apunte en dos toques lo que gasta en ocio (restaurantes, caprichos, viajes…), se marque un presupuesto mensual y vea cuánto lleva. Los gastos son **individuales**: todos los del hogar los ven, pero solo su dueño los edita. No hay reparto de deudas. Un ticket se puede escanear con IA para rellenar el formulario.

## 2. Historias de usuario

- **US-10-01** Como miembro, quiero apuntar un gasto con importe, categoría y descripción en dos toques.
- **US-10-02** Como miembro, quiero hacer una foto a un ticket y que se rellene el gasto, para revisarlo y guardarlo.
- **US-10-03** Como miembro, quiero ver el total del mes del hogar y de cada persona, por categoría, y su evolución en los últimos 6 meses.
- **US-10-04** Como miembro, quiero filtrar los gastos por persona, categoría y mes.
- **US-10-05** Como miembro, quiero fijar mi presupuesto mensual total y por categoría, y que la app me avise al llegar al 80 % y al superarlo.
- **US-10-06** Como miembro, quiero ver los gastos de los demás sin poder modificarlos.
- **US-10-07** Como miembro, quiero gestionar las categorías del hogar (crear, renombrar, ordenar, archivar).

## 3. Reglas de negocio

**Gastos**

- **RN-10-01** Todo gasto tiene `ownerId` = quien lo crea. Solo el dueño lo edita o borra → si no, `403 FORBIDDEN_NOT_OWNER`. Todos los miembros lo ven.
- **RN-10-02** `amountCents` entero entre 1 y 10 000 000 (100 000,00 €). La web convierte con `parseMoney` ("12,34" → 1234); nunca `float`.
- **RN-10-03** `date` (`YYYY-MM-DD`) no puede ser posterior a **hoy** en la zona del grupo ni anterior a hoy − 5 años → `422` ("La fecha no puede ser futura").
- **RN-10-04** `description` 1–120 caracteres; `merchant` ≤ 80 o `null`.
- **RN-10-05** `categoryId` debe ser una categoría **no archivada** del mismo grupo → si no, `422` (`path: "categoryId"`, "Elige una categoría válida"). Un gasto ya existente cuya categoría se archiva conserva su categoría.
- **RN-10-06** `source` = `AI_RECEIPT` solo si el formulario viene de un escaneo de ticket; en otro caso `MANUAL`. Se fija al crear y no cambia al editar.
- **RN-10-07** Los gastos **no** se reparten entre miembros (no hay "quién debe a quién").

**Categorías**

- **RN-10-08** Cada grupo nace con las 9 categorías semilla de `docs/02` (Restaurantes 🍽️, Ocio 🎟️, Viajes ✈️, Ropa 👕, Suscripciones 📺, Deporte 🏃, Regalos 🎁, Caprichos 🍫, Otros 📦), creadas por E02 al crear el grupo.
- **RN-10-09** `name` 1–40 caracteres, único en el grupo sin distinguir mayúsculas ni acentos (se compara con `normalizeName`) → `409 CONFLICT` ("Ya existe una categoría con ese nombre"). `emoji`: un único grafema (validado con `Intl.Segmenter`).
- **RN-10-10** Máximo 30 categorías no archivadas por grupo → `422`.
- **RN-10-11** Cualquier miembro gestiona las categorías (son del grupo, no personales).
- **RN-10-12** Borrar una categoría con gastos → `409 CONFLICT` ("Esta categoría tiene gastos. Archívala en su lugar"). Sin gastos → borrado físico. Al borrar **o archivar** una categoría, se borran los `Budget` de esa categoría de todos los usuarios del grupo (en la misma transacción) y se emite `budget.changed` por cada usuario afectado.
- **RN-10-13** No se puede archivar ni borrar la última categoría no archivada → `409 CONFLICT` ("El hogar necesita al menos una categoría").
- **RN-10-14** `position` define el orden; las nuevas van al final. Reordenar = `PATCH` de `position` (el servidor reenumera 0..n-1 en la transacción).

**Presupuestos**

- **RN-10-15** Un presupuesto es **personal** (`userId`) dentro de un grupo, mensual y se repite cada mes hasta que se cambia. `categoryId = null` = presupuesto **total** mensual. Como mucho uno total y uno por categoría por usuario y grupo.
- **RN-10-16** `PUT /groups/:g/budgets` **sustituye todos** los presupuestos del usuario actual en ese grupo por la lista enviada (borrar los que faltan, crear o actualizar el resto) en una transacción. `DELETE /groups/:g/budgets` borra todos los del usuario actual. Nadie puede tocar los presupuestos de otro (las rutas solo actúan sobre `user.id`).
- **RN-10-17** `amountCents` de 100 (1 €) a 10 000 000. La suma de los presupuestos por categoría **puede** superar el total (no se valida; son límites independientes).
- **RN-10-18** **Estado de un presupuesto** en un mes (función pura `budgetStatus(spentCents, amountCents)`), siendo `spent` la suma de gastos del dueño en ese mes (y esa categoría si aplica):
  - `EXCEEDED` si `spent > amount`.
  - `WARNING` si `spent * 100 >= amount * 80` y `spent <= amount`.
  - `OK` en otro caso.
  `ratio = spent / amount` (número, para la barra; puede ser > 1).
- **RN-10-19** Los avisos de presupuesto son **solo dentro de la app** (banner y toast), no push (las preferencias de notificación no incluyen presupuestos):
  - Al guardar un gasto propio que hace pasar un presupuesto de `OK` a `WARNING`: toast "Llevas el 85 % de tu presupuesto de Restaurantes".
  - De `WARNING`/`OK` a `EXCEEDED`: toast "Has superado tu presupuesto de Restaurantes en 23,40 €" (el porcentaje y el exceso se calculan con la respuesta del resumen).
  - Mientras dure, el resumen muestra la barra con la `LaneRope` variante `limit` en el 100 % y la `DepthFigure` del exceso en variante `limit`.

**Resumen mensual**

- **RN-10-20** El mes es el natural en la zona del grupo (`YYYY-MM`). Se suman `amountCents` de los gastos con `date` dentro del mes. Todos los totales son enteros en céntimos.
- **RN-10-21** `evolution` contiene **6 meses** consecutivos terminando en el mes pedido (el más antiguo primero), con meses a 0 si no hay gastos.
- **RN-10-22** En `byOwner` aparecen todos los miembros actuales (con 0 si no gastaron) y, además, cualquier `ownerId` con gastos en el mes que ya no sea miembro (la UI lo muestra como "Exmiembro"). Ver §10.

**Escanear ticket (IA)**

- **RN-10-23** `POST /groups/:g/ai/receipt` sigue `docs/05-ia.md`: una imagen (campo multipart `image`), ≤ 5 MB, JPEG/PNG/WebP validada por magic bytes, cuota `AI_LIMIT_RECEIPT` por grupo y día, exige `aiNoticeAcceptedAt`. La imagen no se guarda.
- **RN-10-24** La respuesta **no crea ningún gasto**. La web abre el formulario de gasto prellenado: `amountCents ← totalCents`, `date ← date` (si es futura o `null`, hoy), `merchant ← merchant`, `description ← description` (o `merchant` si viene vacía), `categoryId ←` la categoría no archivada cuyo nombre normalizado coincide con `suggestedCategoryName` (si no hay, la última usada por el usuario). Los campos que la IA no pudo leer se resaltan con "Revisa este dato". Se guarda con `source = AI_RECEIPT` solo cuando el usuario pulsa "Guardar".
- **RN-10-25** Prompt `receipt.v1` (en `apps/api/src/modules/ai/prompts/receipt.v1.ts`): español de España; `totalCents` es el **total pagado** con IVA en céntimos (entero); `date` del ticket en `YYYY-MM-DD` o `null`; `suggestedCategoryName` debe ser **exactamente** uno de los nombres de categoría no archivados que se pasan en el prompt, o `null`; `description` ≤ 120 caracteres (p. ej. "Cena en La Tasca"). Salida validada con zod; si falla, un reintento y luego `AI_UNAVAILABLE`.

## 4. Modelo de datos

`ExpenseCategory`, `Expense` (enum `ExpenseSource`), `Budget` de `docs/02-modelo-datos.md`, más `AiUsage` (`feature = RECEIPT`). Recordatorio de `docs/02`: el índice único parcial `budgets(group_id, user_id) WHERE category_id IS NULL` debe existir en la migración. Sin cambios de esquema.

## 5. API

Rutas bajo `/api/v1/groups/:groupId`, con `AuthGuard` + `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/expenses.ts` y `.../ai.ts` (ticket).

```ts
export const createExpenseInput = z.object({
  categoryId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(10_000_000),
  date: isoDate,                                        // refine en servidor: ≤ hoy (zona del grupo)
  description: z.string().trim().min(1).max(120),
  merchant: z.string().trim().max(80).nullable().default(null),
  source: z.enum(['MANUAL', 'AI_RECEIPT']).default('MANUAL'),
});
export const updateExpenseInput = createExpenseInput.omit({ source: true }).partial();

export const expenseDto = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(), ownerId: z.string().uuid(),
  categoryId: z.string().uuid(), amountCents: z.number().int(), date: isoDate,
  description: z.string(), merchant: z.string().nullable(),
  source: z.enum(['MANUAL', 'AI_RECEIPT']),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const listExpensesQuery = z.object({
  from: isoDate, to: isoDate,                           // inclusive, máximo 366 días
  ownerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
});
// Orden: date desc, id desc. Cursor opaco (base64url de "<date>|<id>"), docs/04.

export const expenseSummaryQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
export const expenseSummaryDto = z.object({
  month: z.string(),
  totalCents: z.number().int(),
  byOwner: z.array(z.object({ userId: z.string().uuid(), totalCents: z.number().int(), count: z.number().int(), isMember: z.boolean() })),
  byCategory: z.array(z.object({ categoryId: z.string().uuid(), totalCents: z.number().int(), count: z.number().int() })), // desc por total
  byOwnerCategory: z.array(z.object({ userId: z.string().uuid(), categoryId: z.string().uuid(), totalCents: z.number().int() })),
  evolution: z.array(z.object({ month: z.string(), totalCents: z.number().int(),
    byOwner: z.array(z.object({ userId: z.string().uuid(), totalCents: z.number().int() })) })).length(6),
  budgets: z.array(z.object({                            // de TODOS los miembros (visibles para todos)
    userId: z.string().uuid(), categoryId: z.string().uuid().nullable(),
    amountCents: z.number().int(), spentCents: z.number().int(),
    ratio: z.number(), status: z.enum(['OK', 'WARNING', 'EXCEEDED']),
  })),
});

export const createExpenseCategoryInput = z.object({ name: z.string().trim().min(1).max(40), emoji: z.string().min(1).max(16) });
export const updateExpenseCategoryInput = z.object({
  name: z.string().trim().min(1).max(40).optional(), emoji: z.string().min(1).max(16).optional(),
  position: z.number().int().min(0).optional(), archived: z.boolean().optional(),
});
export const expenseCategoryDto = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(), name: z.string(), emoji: z.string(),
  position: z.number().int(), archivedAt: z.string().datetime().nullable(),
});

export const putBudgetsInput = z.object({
  budgets: z.array(z.object({
    categoryId: z.string().uuid().nullable(),           // null = total
    amountCents: z.number().int().min(100).max(10_000_000),
  })).max(31),                                           // refine: categoryId únicos (incluido un solo null)
});
export const budgetDto = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(), userId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(), amountCents: z.number().int(),
});

// docs/05-ia.md
export const receiptResultDto = z.object({
  merchant: z.string().nullable(), date: isoDate.nullable(), totalCents: z.number().int().nullable(),
  suggestedCategoryName: z.string().nullable(), description: z.string(),
});
```

| Método | Ruta | Entrada | Salida | Errores |
|---|---|---|---|---|
| GET | `/groups/:g/expenses?from&to&ownerId&categoryId&cursor&limit` | `listExpensesQuery` | `{ items: expenseDto[], nextCursor }` | 401, 404, 422 |
| POST | `/groups/:g/expenses` | `createExpenseInput` | 201 `expenseDto` | 401, 404, 422 |
| PATCH | `/groups/:g/expenses/:id` | `updateExpenseInput` | `expenseDto` | 401, 403 `FORBIDDEN_NOT_OWNER`, 404, 422 |
| DELETE | `/groups/:g/expenses/:id` | — | 204 | 401, 403, 404 |
| GET | `/groups/:g/expenses/summary?month=YYYY-MM` | `expenseSummaryQuery` | `expenseSummaryDto` | 401, 404, 422 |
| GET | `/groups/:g/expense-categories[?includeArchived=true]` | — | `expenseCategoryDto[]` por `position` | 401, 404 |
| POST | `/groups/:g/expense-categories` | `createExpenseCategoryInput` | 201 `expenseCategoryDto` | 401, 404, 409, 422 |
| PATCH | `/groups/:g/expense-categories/:id` | `updateExpenseCategoryInput` | `expenseCategoryDto` | 401, 404, 409, 422 |
| DELETE | `/groups/:g/expense-categories/:id` | — | 204 | 401, 404, 409 |
| GET | `/groups/:g/budgets` | — | `budgetDto[]` de **todos** los miembros | 401, 404 |
| PUT | `/groups/:g/budgets` | `putBudgetsInput` | `budgetDto[]` del usuario actual | 401, 404, 422 |
| DELETE | `/groups/:g/budgets` | — | 204 (borra todos los del usuario actual) | 401, 404 |
| POST | `/groups/:g/ai/receipt` | multipart `image` | `receiptResultDto` | 401, 403 `AI_NOTICE_REQUIRED`, 404, 422 `IMAGE_INVALID`, 429 `AI_LIMIT_REACHED`/`RATE_LIMITED`, 503 `AI_UNAVAILABLE` |

El resumen se calcula con agregaciones (`groupBy`) acotadas: una para el mes por `ownerId, categoryId`, una para los 6 meses por mes y `ownerId` (con `date_trunc` en `$queryRaw` con tagged template) y una para los presupuestos. Nada de cargar todos los gastos en memoria.

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `expense.created` / `expense.updated` | `POST` / `PATCH` de un gasto | `ExpenseDto` |
| `expense.deleted` | `DELETE` | `{ id }` |
| `expense_category.changed` | Crear, editar, reordenar, archivar o borrar una categoría | `ExpenseCategoryDto[]` (lista completa, incluidas archivadas) |
| `budget.changed` | `PUT`/`DELETE` de presupuestos, o borrado de presupuestos por RN-10-12 | `BudgetDto[]` del usuario afectado (vacío si no le quedan) |
| `ai.quota.updated` | Tras un escaneo de ticket con éxito | `AiQuotaDto` |

Cliente: `expense.*` actualiza las listas en caché (`setQueryData` si el gasto cae en el rango, si no `invalidate`) e invalida `['group', g, 'expenses', 'summary']`. `expense_category.changed` → `setQueryData(['group', g, 'expense-categories'])`. `budget.changed` → sustituye los presupuestos de ese usuario en `['group', g, 'budgets']` e invalida el resumen. La fila de un gasto de otro miembro hace la **onda**.

## 7. Pantallas y UX

Ruta: `/g/:groupId/gastos` (desde "Más" → "Gastos"). Patrón "Héroe de agua" + "Lista + FAB + Sheet" de `DESIGN.md`. Parámetros: `?mes=YYYY-MM` (por defecto el actual), `?persona=<userId>` y `?categoria=<id>` (filtros), `?vista=resumen|movimientos` (por defecto `resumen`).

### 7.1 Cabecera (héroe de agua)

- Franja `--shell` con selector de mes "‹ noviembre 2026 ›" y `DepthFigure` grande con el total del mes del hogar ("1.234,56 €", etiqueta "GASTADO EN NOVIEMBRE"); con filtro de persona, el total de esa persona ("GASTADO POR ANA").
- Chips de persona: "Todos" + un chip por miembro con su `MemberDot`. Chips de categoría en una segunda fila desplazable (los chips sí pueden desplazarse; las calles no).
- `SegmentedControl` "Resumen · Movimientos".

### 7.2 Resumen

- **Mi presupuesto** (o el de la persona filtrada; si no tiene: "Ana no tiene presupuesto"; si soy yo: "Ponte un presupuesto mensual" + "Crear presupuesto"): barra de progreso del total con la marca del 100 % dibujada con `LaneRope` variante `limit`; texto "320,00 € de 400,00 € · quedan 80,00 €". En `WARNING`, texto y barra en `--lifeguard` con "Llevas el 85 %"; en `EXCEEDED`, `DepthFigure` variante `limit` con el exceso ("+23,40 €", etiqueta "POR ENCIMA") y texto "Has superado tu presupuesto". Debajo, una barra igual por cada presupuesto de categoría.
- **Por categoría:** donut (Recharts `PieChart` con `innerRadius`) con la paleta de categorías de `DESIGN.md` §3 (rampa de agua + `--lifeguard` + `--lane-slate`) y leyenda en lista "🍽️ Restaurantes · 420,00 € · 34 %". Si hay más de 6 categorías con gasto, las menores se agrupan en "Resto". Tocar una porción o fila filtra por esa categoría.
- **Por persona** (solo con "Todos"): barras horizontales con el color de calle de cada miembro y su nombre siempre visible.
- **Últimos 6 meses:** barras verticales apiladas por persona (colores de calle) con el total encima de cada barra; el mes seleccionado resaltado. Con filtro de persona, barras simples.
- Accesibilidad: cada gráfica tiene `aria-label` con el resumen en texto y un botón "Ver como tabla" que muestra los mismos datos en una tabla.
- Vacío (sin gastos ese mes): `EmptyState` "Aún no hay gastos en noviembre" + "Añadir gasto".

### 7.3 Movimientos

- Lista agrupada por día ("Hoy", "Ayer", "sábado 7 de noviembre") con total del día a la derecha. Fila: emoji de categoría, descripción, comercio en `--ink-muted`, `MemberDot` del dueño, importe con `formatMoney` y cifras tabulares. Icono `ScanLine` pequeño si `source = AI_RECEIPT`.
- Scroll infinito con el cursor. Respeta filtros de persona y categoría.
- Tocar un gasto **propio** → hoja de edición. Tocar uno **ajeno** → hoja de detalle en solo lectura con el aviso "Solo Ana puede cambiar este gasto".
- Deslizar a la izquierda un gasto propio → "Borrar" con toast "Gasto borrado" + "Deshacer" (5 s; el deshacer vuelve a crear el gasto con los mismos datos).

### 7.4 Añadir o editar gasto (hoja)

- `Fab` "+" con menú corto: "Añadir gasto" y "Escanear ticket".
- Campos en este orden: **Importe** (autofocus, `inputmode="decimal"`, acepta "12,5" y "12.50"), **Categoría** (rejilla de chips con emoji; preseleccionada la última que usó el usuario, guardada en `localStorage`), **Descripción** (por defecto el nombre de la categoría si se deja vacía al guardar), **Fecha** ("Hoy" por defecto, chips "Hoy · Ayer · Otra"), **Comercio** (opcional).
- Flujo de dos toques: abrir, escribir importe, "Guardar" (categoría y fecha por defecto).
- Validaciones: "Introduce un importe mayor que 0", "La fecha no puede ser futura".
- Toast "Gasto guardado" y, si aplica, el aviso de presupuesto de RN-10-19.

### 7.5 Escanear ticket

- "Escanear ticket" → si no se ha aceptado el aviso de IA, primero el aviso de E13. Después `<input type="file" accept="image/*" capture="environment">`; la web reduce la imagen a ≤ 1600 px JPEG q=0,8 antes de subirla.
- Pantalla de espera "Leyendo el ticket…" con cancelación. Cuota visible: "Te quedan 17 escaneos hoy".
- Resultado: abre la hoja de §7.4 prellenada (RN-10-24) con el banner "Revisa los datos antes de guardar". "Guardar" crea el gasto; cerrar la hoja lo descarta sin guardar nada.
- Errores: `AI_LIMIT_REACHED` → "Habéis usado los 20 escaneos de hoy. Se renuevan a las 00:00"; `AI_UNAVAILABLE` → "La IA está saturada, prueba en unos minutos" + "Apuntarlo a mano"; `IMAGE_INVALID` → "La imagen no es válida (JPG, PNG o WebP de hasta 5 MB)"; si no se lee el total → formulario prellenado con el importe vacío resaltado.

### 7.6 Presupuestos (hoja "Mi presupuesto")

- Desde el resumen ("Editar presupuesto"). Campo "Presupuesto mensual total" (opcional) y lista de categorías con su importe opcional. "Guardar" envía `PUT` con todos los no vacíos. "Quitar todos los presupuestos" → `Dialog` → `DELETE`.
- Texto de ayuda: "Tu presupuesto lo ven los miembros del hogar, pero solo tú puedes cambiarlo".

### 7.7 Categorías (hoja "Categorías del hogar")

- Desde el menú "⋯" de la pantalla. Lista ordenable (asa de arrastre y, para accesibilidad, botones "Subir"/"Bajar"), editar nombre y emoji, "Archivar" / "Restaurar", "Borrar" (solo si no tiene gastos; si la API responde `409`, se ofrece "Archivar"). "+ Nueva categoría".
- Archivar avisa: "Los presupuestos de esta categoría se borrarán. Los gastos antiguos la conservan".

### 7.8 Estados

- Cargando: skeleton del héroe y de 6 filas.
- Error: `ErrorState` "No hemos podido cargar los gastos" + "Reintentar".
- Sin conexión: `OfflineBanner`; `Fab`, editar, borrar y escanear deshabilitados.

## 8. Permisos

| Acción | Quién |
|---|---|
| Ver gastos, resumen y presupuestos de todos | Cualquier miembro |
| Crear gasto | Cualquier miembro (queda como dueño) |
| Editar o borrar gasto | Solo el dueño (`403 FORBIDDEN_NOT_OWNER`) |
| Crear, cambiar o borrar presupuestos | Solo para uno mismo (las rutas actúan sobre `user.id`) |
| Gestionar categorías | Cualquier miembro |
| Escanear ticket | Cualquier miembro con el aviso de IA aceptado y cuota disponible |

## 9. Actividad

| Acción | `entityType` / `action` | `summary` |
|---|---|---|
| Crear gasto | `expense` / `created` | "apuntó un gasto de 23,40 € en Restaurantes" |
| Editar gasto | `expense` / `updated` | "editó un gasto de Restaurantes" |
| Borrar gasto | `expense` / `deleted` | "borró un gasto de 23,40 € en Restaurantes" |
| Cambiar presupuestos | `budget` / `updated` | "actualizó su presupuesto mensual" (`entityId` = id del primer presupuesto, o el del usuario si se borran todos) |
| Crear categoría | `expense_category` / `created` | "creó la categoría 🎳 Bolos" |
| Renombrar o cambiar emoji | `expense_category` / `updated` | "renombró la categoría Ocio a Planes" / "cambió el emoji de Ocio" |
| Archivar / restaurar | `expense_category` / `archived` · `restored` | "archivó la categoría Ropa" / "restauró la categoría Ropa" |
| Borrar categoría | `expense_category` / `deleted` | "borró la categoría Bolos" |

Reordenar categorías no genera actividad. El escaneo de un ticket no genera actividad (solo el gasto que se guarde).

## 10. Casos límite

- **Mes en curso vs. zona horaria:** un gasto apuntado a las 00:30 del 1 de diciembre en Madrid tiene `date = 2026-12-01` aunque en UTC aún sea 30 de noviembre. La web calcula "hoy" con `lib/dates.ts` en la zona del grupo.
- **Fecha futura por desfase del reloj del móvil:** el servidor valida con su reloj y la zona del grupo; el mensaje es "La fecha no puede ser futura".
- **Categoría archivada** con gastos: los gastos la conservan y se muestran con su emoji y el sufijo "(archivada)"; no aparece en el selector del formulario. Editar un gasto así sin cambiar la categoría es válido; elegir otra archivada → `422`.
- **Miembro que sale del grupo:** sus gastos y presupuestos de ese grupo se borran (manejador de E10 en `MemberRemovedHooks`, spec 02 RN-02-22, ADR-019). `isMember = false` ("Exmiembro") solo puede aparecer de forma transitoria, entre la salida y la recarga del resumen.
- **Usuario borrado:** gastos y presupuestos en cascada (RGPD).
- **Importe con más de 2 decimales** ("12,345") → la web lo rechaza ("Máximo 2 decimales").
- **Redondeo de porcentajes** en la leyenda: entero con `Math.round`; la suma puede no dar 100 % (no se corrige).
- **Presupuesto total y de categoría a la vez:** se evalúan por separado; un gasto puede disparar dos avisos (se muestra solo el más grave en el toast y ambos en el resumen).
- **Ticket con varios totales o ilegible:** la IA devuelve `totalCents = null`; el formulario pide el importe.
- **Ticket de fecha futura** (error de lectura): se usa hoy y se resalta la fecha.
- **Concurrencia:** dos miembros crean la categoría "Bolos" a la vez → uno recibe `409`.

## 11. Tests

- **Unit (`packages/shared`):** `budgetStatus` (79 %, 80 %, 100 %, 100 % + 1 céntimo), `parseMoney`/`formatMoney` con casos "12,5", "1.234,56", "0,01"; refine de presupuestos (un único `null`); cursor opaco de gastos (codificar/decodificar).
- **Integración (`apps/api/test/expenses.int.spec.ts`):** CRUD de gastos con `403 FORBIDDEN_NOT_OWNER` para no dueños; `422` con fecha futura y categoría archivada; paginación por cursor estable con varios gastos el mismo día; resumen (totales, `byOwnerCategory`, 6 meses con ceros, estados de presupuesto); `PUT /budgets` sustituye el conjunto; categorías (`409` duplicada sin acentos, `409` al borrar con gastos, archivar borra presupuestos y emite `budget.changed`, `409` al archivar la última); eventos realtime; autorización 401/404.
- **Integración IA (`apps/api/test/ai-receipt.int.spec.ts`):** con el `GeminiClient` falso y fixtures (`apps/api/test/fixtures/ai/receipt-*.json`): éxito, salida no válida → reintento → `503`, `IMAGE_INVALID`, cuota agotada `429`, sin aviso `403`; `AiUsage` registrado; ningún `Expense` creado.
- **Componentes:** formulario (dos toques con valores por defecto, validaciones, prellenado de ticket con campos resaltados), barra de presupuesto en cada estado, tabla alternativa de gráficas.
- **E2E-11** (`apps/web/e2e/expenses.e2e.ts`): Ana pone un presupuesto total de 50 € → apunta un gasto de 30 € → lo ve en el resumen → apunta otro de 25 € → ve "Has superado tu presupuesto" con la corchera roja; Óscar abre el gasto de Ana → solo lectura ("Solo Ana puede cambiar este gasto").

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- Cursor opaco `(date, id)` → `docs/04` (convenciones de paginación).
- `GET /expense-categories?includeArchived` y `PATCH/DELETE /expense-categories/:id` → `docs/04` (fila "Gastos").
- `Budget.categoryId` sin FK → `docs/02`.
- Borrar `Expense` y `Budget` del miembro que sale → spec 02 (RN-02-22) y ADR-019.
- Multipart `image`, `suggestedCategoryName` exacto y prompt `receipt.v1` → `docs/05` (Flujo 2) y `docs/04` (fila "IA").
- Glosario "Resumen mensual", "Movimientos", "Exmiembro" y estados de presupuesto → `docs/10`.

## 13. Fuera de alcance

- Reparto de gastos entre miembros (Splitwise) y gastos compartidos.
- Ingresos, cuentas bancarias, importación de extractos o conexión con bancos.
- Push al superar el presupuesto.
- Guardar la foto del ticket.
- Presupuestos de grupo (solo personales).
- Monedas distintas del euro.
