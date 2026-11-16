# E10 · Gastos de ocio y presupuestos

> Spec: `docs/specs/10-gastos.md` · Rango: HOG-500 – HOG-549 · Fase: 5
> Orden recomendado: HOG-500 → HOG-501 → HOG-502 → HOG-504 → HOG-503 → HOG-505 → HOG-506 → HOG-507 → HOG-508 → HOG-509 → HOG-510 → HOG-511 → HOG-512.

### HOG-500 · Esquemas zod y lógica pura de gastos y presupuestos

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/10-gastos.md#5-api`

**Descripción**
Esquemas de gastos, resumen, categorías, presupuestos y resultado de ticket; `budgetStatus` y el cursor opaco de gastos.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/expenses.ts` exporta los esquemas de la spec §5 y sus tipos.
- [ ] `putBudgetsInput` rechaza `categoryId` repetidos (incluido más de un `null`).
- [ ] `budgetStatus(spentCents, amountCents)` → `{ ratio, status }` según RN-10-18 con aritmética entera.
- [ ] `encodeExpenseCursor({ date, id })` / `decodeExpenseCursor(cursor)` (base64url de `date|id`), con error de validación si el cursor está mal formado.
- [ ] `receiptResultDto` en `packages/shared/src/schemas/ai.ts`.

**Tests**
- Unit: `budgetStatus` (79 %, 80 %, 100 %, 100 % + 1 céntimo, 0 gastado); cursor ida y vuelta; refine de presupuestos; `parseMoney` con "12,5", "1.234,56", "0,01", "12,345" (rechazo).

---

### HOG-501 · API de categorías de gasto

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-500, HOG-100, HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/10-gastos.md#3-reglas-de-negocio`

**Descripción**
`GET/POST /groups/:g/expense-categories` y `PATCH/DELETE /groups/:g/expense-categories/:id` con unicidad normalizada, máximo 30, archivar/restaurar, reordenar y borrado de presupuestos asociados.

**Criterios de aceptación**
- [ ] Nombre único sin mayúsculas ni acentos → `409 CONFLICT` "Ya existe una categoría con ese nombre"; emoji de un grafema.
- [ ] Máximo 30 no archivadas (422); reordenar reenumera posiciones.
- [ ] `DELETE` con gastos → `409` "Esta categoría tiene gastos. Archívala en su lugar"; sin gastos → borrado físico.
- [ ] Borrar o archivar borra los `Budget` de esa categoría y emite `budget.changed` por usuario afectado.
- [ ] No se puede archivar ni borrar la última activa (`409`).
- [ ] `expense_category.changed` con la lista completa; actividad de la spec §9 (reordenar no genera).
- [ ] Comprobar que la semilla de 9 categorías de E02 existe; si no, añadirla en el servicio de creación de grupos.

**Notas técnicas**
- `apps/api/src/modules/expenses/expense-categories.controller.ts` + `.service.ts`. `normalizeName` de `packages/shared` (la misma que productos).

**Tests**
- Integración: cada regla; 401; 404 desde otro grupo.

---

### HOG-502 · API de gastos: CRUD, filtros y propiedad

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-501, HOG-106
- **Spec:** `docs/specs/10-gastos.md#5-api`

**Descripción**
`GET /groups/:g/expenses` con filtros y cursor opaco, `POST`, `PATCH /:id` y `DELETE /:id` con comprobación de dueño.

**Criterios de aceptación**
- [ ] `POST` fija `ownerId = user.id`; valida fecha ≤ hoy en la zona del grupo y ≥ hoy − 5 años, categoría no archivada del grupo (422 en `categoryId`).
- [ ] `PATCH`/`DELETE` de un gasto ajeno → `403 FORBIDDEN_NOT_OWNER`; `source` no cambia al editar.
- [ ] Listado ordenado por `date desc, id desc`, `from`/`to` ≤ 366 días, filtros `ownerId` y `categoryId`, paginación estable con varios gastos el mismo día.
- [ ] Eventos `expense.created/updated/deleted` y actividad de la spec §9 con importe formateado en español ("23,40 €").
- [ ] `expenses.member-removed.ts` registra en `MemberRemovedHooks` (HOG-106) un manejador que, con el `tx` recibido, borra los `Expense` del usuario en ese grupo.

**Notas técnicas**
- `apps/api/src/modules/expenses/expenses.controller.ts` + `expenses.service.ts`. Rutas estáticas (`/summary`) antes de `/:id`.

**Tests**
- Integración `apps/api/test/expenses.int.spec.ts`: CRUD, 403, 422 (fecha futura, categoría archivada), cursor, 401/404.

---

### HOG-503 · API de resumen mensual

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-502, HOG-504
- **Spec:** `docs/specs/10-gastos.md#5-api`

**Descripción**
`GET /groups/:g/expenses/summary?month=YYYY-MM` con totales por persona, categoría y ambos, evolución de 6 meses y estado de los presupuestos de todos los miembros.

**Criterios de aceptación**
- [ ] Respuesta `expenseSummaryDto` validada; meses en la zona del grupo.
- [ ] `byOwner` incluye a todos los miembros actuales (0 si no gastaron) y a exmiembros con gastos (`isMember = false`).
- [ ] `evolution` con 6 meses (el más antiguo primero), con ceros.
- [ ] `budgets` con `spentCents`, `ratio` y `status` de `budgetStatus`.
- [ ] Como mucho 4 consultas (agregaciones con `groupBy` / `$queryRaw` con tagged template).

**Tests**
- Integración: datos de 3 miembros en 2 meses; meses vacíos; presupuestos en cada estado; contador de consultas.

---

### HOG-504 · API de presupuestos

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-501, HOG-106
- **Spec:** `docs/specs/10-gastos.md#3-reglas-de-negocio`

**Descripción**
`GET /groups/:g/budgets` (de todos), `PUT` (sustituye los del usuario actual) y `DELETE` (borra los del usuario actual).

**Criterios de aceptación**
- [ ] `PUT` sustituye el conjunto en una transacción; categorías del grupo no archivadas (si no, 422); importes 100–10 000 000.
- [ ] La migración incluye el índice único parcial `budgets(group_id, user_id) WHERE category_id IS NULL` (si HOG-004 no lo creó).
- [ ] `budget.changed` con los presupuestos del usuario; actividad "actualizó su presupuesto mensual".
- [ ] Ninguna ruta permite tocar presupuestos de otro usuario.
- [ ] Registra en `MemberRemovedHooks` (HOG-106) un manejador que, con el `tx` recibido, borra los `Budget` del usuario en ese grupo.

**Notas técnicas**
- `apps/api/src/modules/expenses/budgets.controller.ts` + `budgets.service.ts`.

**Tests**
- Integración: sustitución (crear, actualizar, borrar sobrantes), `DELETE`, evento, 401/404.

---

### HOG-505 · Hooks de datos y tiempo real de gastos (web)

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-503, HOG-504, HOG-006, HOG-152
- **Spec:** `docs/specs/10-gastos.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks TanStack Query de gastos (infinitos), resumen, categorías y presupuestos con mutaciones optimistas, y manejadores de `expense.*`, `expense_category.changed` y `budget.changed`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/expenses/api.ts`: `useExpenses(filters)` (`useInfiniteQuery`, clave `['group', g, 'expenses', filters]`), `useExpenseSummary(month)` (`['group', g, 'expenses', 'summary', month]`), `useExpenseCategories()`, `useBudgets()` y mutaciones con `X-Client-Mutation-Id`.
- [ ] `realtime.ts` aplica las reglas de la spec §6 (setQueryData o invalidación; invalidación del resumen; onda en gastos de otros).

**Tests**
- Unit: manejadores de eventos con un `QueryClient` de prueba.

---

### HOG-506 · Movimientos y formulario de gasto en dos toques

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-505, HOG-009, HOG-750
- **Spec:** `docs/specs/10-gastos.md#73-movimientos`

**Descripción**
Ruta `/g/:groupId/gastos` con cabecera de héroe (selector de mes, `DepthFigure`, chips de persona y categoría), vista "Movimientos" y hoja de añadir/editar gasto; detalle de solo lectura para gastos ajenos.

**Criterios de aceptación**
- [ ] Parámetros `?mes`, `?persona`, `?categoria`, `?vista`.
- [ ] `DepthFigure` con el total del mes (o de la persona filtrada) y su etiqueta.
- [ ] Lista agrupada por día con total diario, scroll infinito y filtros.
- [ ] Formulario de la spec §7.4: importe con autofocus e `inputmode="decimal"`, categoría preseleccionada (última usada, en `localStorage`), descripción por defecto = nombre de la categoría, fecha "Hoy · Ayer · Otra", comercio.
- [ ] Gasto ajeno → hoja de solo lectura "Solo Ana puede cambiar este gasto".
- [ ] Borrar propio deslizando, con "Deshacer" (5 s).
- [ ] Estados obligatorios; entrada "Gastos" en "Más".

**Notas técnicas**
- `apps/web/src/features/expenses/pages/ExpensesPage.tsx`, `components/ExpenseHero.tsx`, `ExpenseList.tsx`, `ExpenseFormSheet.tsx`. Dinero con `formatMoney`/`parseMoney`.

**Tests**
- Componentes: guardar con solo importe; validaciones; hoja de solo lectura; deshacer.

---

### HOG-507 · Resumen mensual con gráficas

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-506
- **Spec:** `docs/specs/10-gastos.md#72-resumen`

**Descripción**
Vista "Resumen": donut por categoría, barras por persona, barras apiladas de 6 meses (Recharts) y tabla alternativa accesible.

**Criterios de aceptación**
- [ ] Donut con la paleta de categorías de `DESIGN.md` §3 (sin colores de persona), agrupando en "Resto" más allá de 6; leyenda con importe y porcentaje; tocar filtra por categoría.
- [ ] Barras por persona con colores de calle y nombre visible (solo con "Todos").
- [ ] Barras de 6 meses apiladas por persona; mes seleccionado resaltado; con filtro de persona, barras simples.
- [ ] `aria-label` con resumen textual y botón "Ver como tabla" en cada gráfica.
- [ ] Vacío "Aún no hay gastos en noviembre" + "Añadir gasto".
- [ ] Modo oscuro y 375 px.

**Notas técnicas**
- `apps/web/src/features/expenses/components/CategoryDonut.tsx`, `OwnerBars.tsx`, `EvolutionChart.tsx`, `ChartTable.tsx`. Colores desde variables CSS de tokens (sin hex en el código).

**Tests**
- Componentes: agrupación "Resto"; tabla alternativa con los mismos datos.

---

### HOG-508 · Presupuestos: edición y avisos del 80 % y superado

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-507
- **Spec:** `docs/specs/10-gastos.md#76-presupuestos-hoja-mi-presupuesto`

**Descripción**
Tarjeta "Mi presupuesto" en el resumen con barras y `LaneRope` `limit`, hoja "Mi presupuesto" y toasts de aviso al guardar un gasto.

**Criterios de aceptación**
- [ ] Barra del total y de cada categoría con la marca del 100 % como `LaneRope` variante `limit`; textos "320,00 € de 400,00 € · quedan 80,00 €".
- [ ] `WARNING` con `--lifeguard` y "Llevas el 85 %"; `EXCEEDED` con `DepthFigure` `limit` "+23,40 €" / "POR ENCIMA" y "Has superado tu presupuesto".
- [ ] Persona filtrada sin presupuesto: "Ana no tiene presupuesto"; yo sin presupuesto: "Ponte un presupuesto mensual" + "Crear presupuesto".
- [ ] Hoja con total y por categoría → `PUT`; "Quitar todos los presupuestos" → `DELETE` con `Dialog`.
- [ ] Al guardar un gasto propio que cambia el estado (OK→WARNING, *→EXCEEDED), toast de RN-10-19 (el más grave si hay dos).

**Notas técnicas**
- `apps/web/src/features/expenses/components/BudgetCard.tsx`, `BudgetSheet.tsx`, `useBudgetTransitionToast.ts` (compara el resumen antes y después).

**Tests**
- Componentes: barra en los 3 estados; toast en la transición.

---

### HOG-509 · Gestión de categorías del hogar (web)

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-506
- **Spec:** `docs/specs/10-gastos.md#77-categorías-hoja-categorías-del-hogar`

**Descripción**
Hoja "Categorías del hogar": crear, renombrar, cambiar emoji, reordenar (arrastre y botones), archivar/restaurar y borrar.

**Criterios de aceptación**
- [ ] Botones "Subir"/"Bajar" accesibles además del arrastre.
- [ ] `409` al borrar → ofrece "Archivar"; aviso al archivar sobre presupuestos.
- [ ] Categorías archivadas: sección plegada "Archivadas" con "Restaurar"; gastos antiguos muestran "(archivada)".

**Tests**
- Componentes: flujo `409` → archivar; reordenar con botones.

---

### HOG-510 · API: escanear ticket con IA (`POST /ai/receipt`)

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-650, HOG-501
- **Spec:** `docs/specs/10-gastos.md#3-reglas-de-negocio`

**Descripción**
`receipt.service.ts` y prompt `receipt.v1` sobre el núcleo de IA: una imagen → `receiptResultDto`, con cuota `RECEIPT`, aviso de IA y validación de imagen. No crea gastos.

**Criterios de aceptación**
- [ ] Multipart `image` (una), JPEG/PNG/WebP por magic bytes, ≤ 5 MB → si no, `422 IMAGE_INVALID`; la imagen nunca se escribe a disco.
- [ ] Exige `aiNoticeAcceptedAt` (`403 AI_NOTICE_REQUIRED`) y cuota `AI_LIMIT_RECEIPT` (`429 AI_LIMIT_REACHED` con `resetsAt`).
- [ ] Prompt con las categorías no archivadas del grupo; salida con `responseSchema` y validada con zod; `suggestedCategoryName` fuera de la lista → `null`; un reintento y luego `503 AI_UNAVAILABLE`.
- [ ] `AiUsage` con `feature = RECEIPT`; `ai.quota.updated` tras éxito.
- [ ] Ningún `Expense` creado.

**Notas técnicas**
- `apps/api/src/modules/ai/receipt.service.ts`, `prompts/receipt.v1.ts`, ruta en el controlador de IA. Fixtures en `apps/api/test/fixtures/ai/receipt-*.json`.

**Tests**
- Unit: snapshot del prompt.
- Integración `apps/api/test/ai-receipt.int.spec.ts` con `GeminiClient` falso: éxito, salida inválida → 503, imagen inválida, cuota, sin aviso.

---

### HOG-511 · Web: escanear ticket y formulario prellenado

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-510, HOG-506
- **Spec:** `docs/specs/10-gastos.md#75-escanear-ticket`

**Descripción**
Opción "Escanear ticket" del `Fab`: aviso de IA si hace falta, cámara, reducción de imagen, espera cancelable, formulario prellenado (RN-10-24) y errores.

**Criterios de aceptación**
- [ ] Reduce a ≤ 1600 px JPEG q=0,8 antes de subir; "Leyendo el ticket…" con "Cancelar" (aborta la petición).
- [ ] Muestra la cuota restante ("Te quedan 17 escaneos hoy").
- [ ] Prellenado según RN-10-24 con banner "Revisa los datos antes de guardar" y campos no leídos marcados "Revisa este dato"; se guarda con `source: 'AI_RECEIPT'` solo al pulsar "Guardar".
- [ ] Mensajes de error de la spec §7.5 con "Apuntarlo a mano" en `AI_UNAVAILABLE`.

**Notas técnicas**
- `apps/web/src/features/expenses/components/ReceiptScanFlow.tsx`; reutiliza la utilidad de reducción de imágenes de E13 y su aviso de IA.

**Tests**
- Componentes con MSW: éxito prellena; categoría sugerida inexistente → última usada; cada error.

---

### HOG-512 · E2E-11: gastos, presupuesto superado y propiedad

- **Épica:** E10 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-508, HOG-011
- **Spec:** `docs/specs/10-gastos.md#11-tests`

**Descripción**
Flujo crítico E2E-11 de `docs/07-testing.md`.

**Criterios de aceptación**
- [ ] `apps/web/e2e/expenses.e2e.ts`: Ana pone 50 € de presupuesto total → gasto de 30 € → lo ve en el resumen → gasto de 25 € → ve "Has superado tu presupuesto"; Óscar abre el gasto de Ana → solo lectura.
- [ ] Pasa en Pixel 7 y iPhone 14.

**Tests**
- E2E: E2E-11.
