# E04 · Lista de la compra

> Spec: `docs/specs/04-lista-compra.md` · Rango: HOG-200 – HOG-249 · Fase: 2
> HOG-203 (`ShoppingItemsService.bulkCreate`) es el punto de entrada que usan E05, E06, E13 y E14 para añadir productos a una lista.

---

### HOG-200 · Añadir las utilidades de compra a shared (normalización, unidades, cantidades y añadido rápido)

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/04-lista-compra.md#normalización-y-utilidades-packagesshared` (RN-04-28 a RN-04-33)

**Descripción**
Funciones puras que comparten web y API para que "Tomates" y "tomate" sean el mismo producto, que las unidades se escriban de una sola forma, que las cantidades se sumen sin `float` y que la barra de añadido rápido entienda "2 kg tomates".

**Criterios de aceptación**
- [ ] `packages/shared/src/shopping/normalize.ts` exporta `normalizeProductName(s)` que cumple **todas** las filas de la tabla de RN-04-28 (incluida la conservación de la `ñ`).
- [ ] `normalizeUnit(s)` mapea los sinónimos de RN-04-30 y devuelve el texto normalizado tal cual si no lo reconoce.
- [ ] `decimalString` (zod) acepta `"1"`, `"1.5"`, `"12345678.99"` y rechaza `"0"`, `"-1"`, `"1.234"`, `"1,5"` y `"abc"`.
- [ ] `mergeQuantities(a, b)` cumple RN-04-31 operando en centésimas enteras (`"0.1"` + `"0.2"` = `"0.3"`).
- [ ] `parseQuickAdd(text)` cumple todas las filas de la tabla de RN-04-32.
- [ ] `formatQuantity(quantity, unit)` cumple RN-04-33.
- [ ] Se reutilizan `UNITS` y las etiquetas de `Aisle` de HOG-002; si sus valores o textos difieren de RN-04-29/RN-04-30, se corrigen en este ticket.

**Notas técnicas**
- Archivos: `packages/shared/src/shopping/{normalize.ts, quantity.ts, quick-add.ts, index.ts}` y reexportación desde `packages/shared/src/index.ts`.
- Quitar diacríticos: `s.normalize('NFD')` y eliminar `\p{M}`, pero proteger antes la `ñ` (sustituir por un marcador y restaurarla).
- Sin dependencias nuevas: aritmética decimal con enteros (`BigInt` no es necesario: 8 cifras + 2 decimales caben en `Number.MAX_SAFE_INTEGER`).

**Tests**
- Unit: `normalize.spec.ts`, `quantity.spec.ts`, `quick-add.spec.ts` con las tablas de la spec y casos extra (espacios dobles, mayúsculas, `"x12"`, `"×3"`, `"7up"`).
- Integración: —
- E2E: —

---

### HOG-201 · Definir los esquemas zod y los eventos de la compra en shared

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-200
- **Spec:** `docs/specs/04-lista-compra.md#5-api` · `#6-eventos-en-tiempo-real`

**Descripción**
Esquemas de entrada y salida de todos los endpoints de compra y tipos de los eventos `shopping.*` y `product.*`, para que web y API compartan contrato.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/shopping.ts` exporta exactamente los esquemas de §5: `shoppingListDto`, `shoppingItemDto`, `productDto`, `essentialProductDto`, `purchaseDto`, `createShoppingListInput`, `updateShoppingListInput`, `createShoppingItemInput`, `bulkCreateShoppingItemsInput`, `updateShoppingItemInput`, `productSearchQuery`, `frequentProductsQuery`, `essentialsQuery`, `createProductInput`, `updateProductInput` y `purchasesQuery`, con sus tipos `z.infer`.
- [ ] `unitInput` normaliza con `normalizeUnit` y valida contra `UNITS`.
- [ ] `updateShoppingItemInput` rechaza un cuerpo con solo `expectedVersion`.
- [ ] `staleVersionProblem` = `problemDetailsSchema` + `current: shoppingItemDto`.
- [ ] `RealtimeEventDataMap` (HOG-002/HOG-151) incluye los tipos de `shopping.list.*`, `shopping.item.*`, `shopping.items.bulk_created`, `shopping.items.bulk_deleted`, `product.updated` y `product.deleted` de §6.
- [ ] Mensajes de validación en español ("La cantidad debe ser mayor que 0", "El nombre es obligatorio").

**Notas técnicas**
- `product.deleted` está en el catálogo de `docs/04-api-y-tiempo-real.md`: añadirlo a `REALTIME_EVENTS` si HOG-002 no lo incluyó.

**Tests**
- Unit: `schemas/shopping.spec.ts` (casos válidos e inválidos de cada esquema de entrada).
- Integración: —
- E2E: —

---

### HOG-202 · Implementar la API de listas de la compra

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-201, HOG-004, HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/04-lista-compra.md#listas` (RN-04-01 a RN-04-05)

**Descripción**
CRUD de `ShoppingList` con reordenado, límite de 20, nombre único y protección de la última lista, siguiendo el patrón de mutación (transacción + actividad + evento tras el commit).

**Criterios de aceptación**
- [ ] `GET /groups/:g/shopping-lists` devuelve las listas no archivadas por `position`, con `pendingCount` calculado en una sola consulta (`_count` con `where: { checked: false }`).
- [ ] `POST` crea al final; nombre repetido (normalizado) → `409 CONFLICT`; la lista 21 → `422`.
- [ ] `PATCH` cambia `name`/`emoji`; con `position` reordena todas las listas sin huecos y emite `shopping.list.updated` por cada lista movida (RN-04-03).
- [ ] `DELETE` borra en cascada; si es la última → `409 CONFLICT` "Debe quedar al menos una lista".
- [ ] Actividad según §9 (crear, renombrar, borrar; reordenar sin actividad) con `ActivityService.record(tx, …)`.
- [ ] Todo `findFirst` usa `{ id, groupId }`.
- [ ] `ShoppingListsService.findAll(groupId)` es público (lo usa E14).

**Notas técnicas**
- Archivos: `apps/api/src/modules/shopping/{shopping.module.ts, shopping-lists.controller.ts, shopping-lists.service.ts}`.
- El grupo nuevo ya trae la lista "Compra" sembrada por E02; no duplicar esa lógica.

**Tests**
- Unit: `shopping-lists.service.spec.ts` (reordenado: mover de 0 a 2, de 2 a 0, a una posición fuera de rango se acota al final).
- Integración: `apps/api/test/shopping/lists.int.spec.ts` (401, 404 de otro grupo en GET/PATCH/DELETE, 409 última lista, 409 nombre, eventos y actividad).
- E2E: —

---

### HOG-203 · Añadir productos a una lista con catálogo, fusión de duplicados y alta en bloque

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-202
- **Spec:** `docs/specs/04-lista-compra.md#productos-en-la-lista-shoppingitem` (RN-04-06 a RN-04-10, RN-04-17)

**Descripción**
El corazón de la compra: crear productos en una lista vinculándolos al catálogo `Product`, fusionar duplicados sumando cantidades, serializar las altas por lista y exponer `ShoppingItemsService.bulkCreate`, que reutilizan recetas, menú, IA y asistente.

**Criterios de aceptación**
- [ ] `GET /groups/:g/shopping-lists/:id/items` devuelve todos los productos de la lista (`ShoppingItemsService.findByList(groupId, listId)`, público para E14).
- [ ] `POST …/items` hace *upsert* del `Product` por `normalizedName` (RN-04-07) y responde `201` al crear o `200` al fusionar (RN-04-08), con el evento correspondiente (`shopping.item.created` o `shopping.item.updated`).
- [ ] Fusión solo con productos **sin marcar** y misma unidad; nota según RN-04-08; si nada cambia, `200` sin evento ni actividad.
- [ ] Bloqueo `SELECT … FOR UPDATE` de la fila de la lista en toda alta (RN-04-09).
- [ ] Límite de 300 productos por lista → `422` (RN-04-06).
- [ ] `POST …/items/bulk` (1–100 líneas) agrupa la propia entrada, fusiona contra la lista, devuelve `{ items }` con creados y fusionados y emite **un** `shopping.items.bulk_created` y **una** actividad.
- [ ] `bulkCreate(ctx, lines, activity)` está exportado desde `ShoppingModule` con la firma de §5 y acepta un `summary` de actividad del llamante.
- [ ] `aisle` del item = `input.aisle ?? product.aisle`; un `aisle` explícito distinto actualiza `Product.aisle`.

**Notas técnicas**
- Archivos: `apps/api/src/modules/shopping/{shopping-items.controller.ts, shopping-items.service.ts, products.service.ts (upsertByName)}`.
- `$queryRaw` con *tagged template* para el `FOR UPDATE` (docs/03).
- La comparación de duplicados se hace en memoria con `normalizeProductName(item.name)` sobre los items sin marcar de la lista (≤ 300).
- `Decimal` de Prisma ↔ `string`: convertir en un único *mapper* `toShoppingItemDto`.

**Tests**
- Unit: `shopping-items.service.spec.ts` (decisión crear/fusionar, agrupado de la entrada del bulk).
- Integración: `apps/api/test/shopping/items-create.int.spec.ts`: 201 vs 200; unidades distintas; producto marcado no fusiona; dos `POST` concurrentes de "leche" con `Promise.all` → una sola línea con la suma; bulk con "Tomate" y "tomates" en la misma entrada → una línea; 300 → 422; 404 de lista ajena.
- E2E: —

---

### HOG-204 · Editar, marcar, mover y quitar productos, y vaciar comprados

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-203
- **Spec:** `docs/specs/04-lista-compra.md#productos-en-la-lista-shoppingitem` (RN-04-11 a RN-04-16)

**Descripción**
`PATCH` y `DELETE` de `ShoppingItem` con la resolución de conflictos por elemento de docs/04 (marcar idempotente, `STALE_VERSION` al editar contenido) y `clear-checked`.

**Criterios de aceptación**
- [ ] Marcar/desmarcar no exige versión, rellena o limpia `checkedAt`/`checkedById` y suma 1 a `version`; enviar el mismo valor sin más campos → `200` sin evento, actividad ni cambios (RN-04-11).
- [ ] Editar contenido con `expectedVersion` distinta → `409 STALE_VERSION` con `current` en el problem+json (RN-04-12); sin `expectedVersion` → gana la última escritura.
- [ ] Cambiar `name` revincula el `Product` (RN-04-13) sin fusionar; cambiar `aisle` actualiza el catálogo.
- [ ] `listId` mueve el producto a otra lista del grupo (404 si no existe) con `position` al final y un único `shopping.item.updated` (RN-04-14).
- [ ] `DELETE` → `204` y `shopping.item.deleted { id, listId }`; si no existe → `404`.
- [ ] `POST …/clear-checked` borra los marcados en una transacción, emite un `shopping.items.bulk_deleted`, una actividad con `action = 'cleared'` y devuelve `{ deletedIds }`; sin marcados → `{ deletedIds: [] }` sin evento.
- [ ] Actividad de §9 (marcar sí, desmarcar no; editar, mover y quitar).
- [ ] El filtro global de errores serializa la extensión `current` (si HOG-006 no admite extensiones, se añade aquí `AppError(code, detail, extensions)`).

**Notas técnicas**
- La actualización de versión debe ser atómica: `updateMany({ where: { id, groupId, version: expectedVersion }, data: { …, version: { increment: 1 } } })` y, si `count = 0`, releer y lanzar `STALE_VERSION`.
- El registro de `Purchase` al marcar es de HOG-205; deja un punto de extensión (`onChecked`/`onUnchecked`) en el servicio.

**Tests**
- Unit: decisión de "sin cambios" del `PATCH`.
- Integración: `apps/api/test/shopping/items-update.int.spec.ts`: marcar dos veces (idempotente), `STALE_VERSION` con `current`, edición sin versión, mover a lista ajena → 404, borrar dos veces → 204 y 404, `clear-checked` con y sin marcados, eventos y actividad.
- E2E: —

---

### HOG-205 · Registrar el historial de compras al marcar y deshacerlo al desmarcar

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-204
- **Spec:** `docs/specs/04-lista-compra.md#historial-y-catálogo` (RN-04-18, RN-04-19) · `docs/02-modelo-datos.md#purchase`

**Descripción**
Al marcar un producto se crea una `Purchase` y se actualizan `purchaseCount` y `lastPurchasedAt` del catálogo; al desmarcar se deshace exactamente esa compra. Usa el campo `Purchase.shoppingItemId`.

**Criterios de aceptación**
- [ ] `Purchase.shoppingItemId String? @db.Uuid` (sin FK) con `@@index([shoppingItemId])` ya está en `docs/02-modelo-datos.md` y en el esquema inicial (HOG-004); si la BBDD se creó antes de ese cambio, este ticket añade la migración.
- [ ] Marcar (`false → true`) con `productId` crea la `Purchase` y actualiza el `Product` en la misma transacción.
- [ ] Desmarcar (`true → false`) borra la `Purchase` más reciente de ese `shoppingItemId`, resta 1 a `purchaseCount` (mínimo 0) y recalcula `lastPurchasedAt`.
- [ ] Items con `productId = null` no generan `Purchase`.
- [ ] Vaciar comprados y quitar un producto marcado conservan sus `Purchase`.

**Notas técnicas**
- Engancha en los puntos de extensión de HOG-204 dentro de la misma transacción.

**Tests**
- Unit: —
- Integración: `apps/api/test/shopping/purchases.int.spec.ts`: marcar → 1 compra y `purchaseCount = 1`; desmarcar → 0 y `lastPurchasedAt` anterior; marcar, vaciar y comprobar que la compra sigue.
- E2E: —

---

### HOG-206 · Implementar la API del catálogo: autocompletado, frecuentes, indispensables y edición

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-205
- **Spec:** `docs/specs/04-lista-compra.md#historial-y-catálogo` (RN-04-20, RN-04-21, RN-04-23 a RN-04-26) · `docs/04-api-y-tiempo-real.md`

**Descripción**
Endpoints de `Product` que alimentan el autocompletado, la fila "Sueles comprar" y la pantalla de indispensables, más crear y borrar productos del catálogo.

**Criterios de aceptación**
- [ ] `GET /products?q=&limit=` ordena primero por prefijo y luego por contenido, y dentro por `purchaseCount` desc y `name` (RN-04-23).
- [ ] `GET /products/frequent?listId=&limit=` cumple RN-04-20 (excluye los que ya están en la lista).
- [ ] `GET /products/essentials?listId=` devuelve `essentialProductDto[]` con `pendingListIds`.
- [ ] `POST /products` crea (409 si ya existe por `normalizedName`) y emite `product.updated`.
- [ ] `PATCH /products/:id` (409 por nombre duplicado) emite `product.updated`; cambiar `isEssential` registra la actividad de §9.
- [ ] `DELETE /products/:id` borra el producto y sus compras, deja los items con `productId = null` y emite `product.deleted { id }`.
- [ ] Los endpoints y el evento coinciden con el catálogo de `docs/04-api-y-tiempo-real.md` (`POST`/`DELETE /products`, `product.deleted`).

**Notas técnicas**
- Archivos: `apps/api/src/modules/shopping/{products.controller.ts, products.service.ts}`.
- Búsqueda: `normalizedName startsWith q` y `contains q` en dos consultas (`take: limit`) unidas sin duplicados; no hace falta índice de trigramas con estos volúmenes.

**Tests**
- Unit: orden del autocompletado.
- Integración: `apps/api/test/shopping/products.int.spec.ts` (orden, frecuentes con `purchaseCount >= 2`, indispensables con `pendingListIds`, 409 al crear y renombrar, borrar deja items sin `productId`, 404 de otro grupo).
- E2E: —

---

### HOG-207 · Añadir los indispensables que faltan a una lista

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-206
- **Spec:** `docs/specs/04-lista-compra.md#historial-y-catálogo` (RN-04-21, RN-04-22)

**Descripción**
`POST /shopping-lists/:id/add-missing-essentials` crea, con `bulkCreate`, una línea por cada indispensable que no está en la lista.

**Criterios de aceptación**
- [ ] Solo añade los indispensables sin ningún item (marcado o no) en esa lista, con `defaultQuantity`, `defaultUnit` y `aisle` del producto.
- [ ] Devuelve `{ items }`, emite un `shopping.items.bulk_created` y la actividad "añadió 3 indispensables a Mercadona".
- [ ] Sin indispensables que falten → `200 { items: [] }` sin evento ni actividad.
- [ ] Respeta el límite de 300 productos (`422`).

**Notas técnicas**
- Método en `shopping-items.service.ts` que reutiliza `bulkCreate`.

**Tests**
- Integración: `apps/api/test/shopping/essentials.int.spec.ts` (añade solo los que faltan; segunda llamada vacía; indispensable marcado en la lista cuenta como presente).
- E2E: cubierto en E2E-06 (HOG-216).

---

### HOG-208 · Exponer el historial de compras paginado

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P2 · **Puntos:** 1
- **Capa:** api
- **Depende de:** HOG-205
- **Spec:** `docs/specs/04-lista-compra.md#historial-y-catálogo` (RN-04-27)

**Descripción**
`GET /groups/:g/purchases?cursor&limit&productId` con el nombre actual del producto y de la lista.

**Criterios de aceptación**
- [ ] Paginación por cursor sobre `id` desc con `{ items, nextCursor }` (utilidad `paginated` de HOG-002).
- [ ] `listName = null` si la lista ya no existe; filtro `productId` opcional.
- [ ] 2 consultas como mucho por página (compras con `product` y nombres de listas).

**Notas técnicas**
- Archivos: `apps/api/src/modules/shopping/{purchases.controller.ts, purchases.service.ts}`.

**Tests**
- Integración: `apps/api/test/shopping/purchases-list.int.spec.ts` (paginación con 120 compras, lista borrada, 404 de otro grupo).
- E2E: —

---

### HOG-209 · Crear los hooks de datos y el tiempo real de la compra en la web

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-201, HOG-006, HOG-152
- **Spec:** `docs/specs/04-lista-compra.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks de TanStack Query con actualizaciones optimistas y los manejadores de los eventos `shopping.*` y `product.*`, con la onda para los cambios de otros.

**Criterios de aceptación**
- [ ] `apps/web/src/features/shopping/api.ts` con `useShoppingLists`, `useShoppingItems(listId)`, `useCreateList`, `useUpdateList`, `useDeleteList`, `useAddItem`, `useBulkAddItems`, `useUpdateItem`, `useToggleItem`, `useDeleteItem`, `useClearChecked`, `useProductSearch(q)`, `useFrequentProducts(listId)`, `useEssentials(listId)`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useAddMissingEssentials` y `usePurchases()` (infinita), con las claves de docs/04.
- [ ] Toda mutación es optimista con *rollback* y envía `X-Client-Mutation-Id` (HOG-006); `useToggleItem` nunca envía `expectedVersion` y `useUpdateItem` siempre lo envía.
- [ ] `useAddItem` reconoce la respuesta `200` (fusión) y sustituye la fila optimista por la fusionada.
- [ ] `apps/web/src/features/shopping/realtime.ts` registra los manejadores de §6 (incluido quitar el item de otras listas al moverlo e invalidar las listas con *debounce* de 500 ms) y guarda `itemId → actorId` del último evento para el aviso de conflicto.
- [ ] La onda se marca con `markRipple('shopping_item:<id>', laneColor)` según la spec 03 (RN-03-19).
- [ ] `useUpdateItem` expone el error `STALE_VERSION` con `current` tipado para la hoja de edición.

**Notas técnicas**
- Registrar los manejadores en `apps/web/src/lib/realtime/handlers.ts` (spec 03).
- Las mutaciones usan `networkMode: 'always'` (spec 03, RN-03-23).

**Tests**
- Unit: manejadores de `realtime.ts` sobre un `QueryClient` real (created, updated con cambio de lista, bulk_created con fusionados, bulk_deleted, deleted) y *rollback* optimista con MSW devolviendo 500.
- Integración: —
- E2E: —

---

### HOG-210 · Construir la pantalla de listas de la compra

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-209, HOG-750, HOG-008, HOG-009
- **Spec:** `docs/specs/04-lista-compra.md#71-listas--gcompra-shoppinglistspage`

**Descripción**
`/g/:groupId/compra` con las tarjetas de listas, contador de pendientes y gestión (crear, renombrar, subir, bajar y borrar).

**Criterios de aceptación**
- [ ] Tarjeta por lista con emoji, nombre y `DepthFigure` de pendientes ("por comprar") o "Todo comprado".
- [ ] Diálogo "Nueva lista" con validación en español y error `409` mostrado en el campo.
- [ ] Menú con "Renombrar", "Subir", "Bajar" y "Borrar" (confirmación con el número de productos; deshabilitado en la última lista).
- [ ] Enlaces a "Indispensables" y "Historial de compras".
- [ ] Estados de §7.1: cargando, vacío, error con "Reintentar" y sin conexión (controles deshabilitados con el hook de conexión de HOG-152/HOG-752).
- [ ] 375 px, modo oscuro y objetivos táctiles ≥ 44 px.

**Notas técnicas**
- `apps/web/src/features/shopping/pages/ShoppingListsPage.tsx` y `components/ShoppingListCard.tsx`, `components/ShoppingListDialog.tsx`.
- Sustituye el `ComingSoonPage` de la pestaña Compra de HOG-750.

**Tests**
- Unit: `ShoppingListsPage.spec.tsx` con MSW (lista, vacío, error, última lista sin "Borrar").
- E2E: —

---

### HOG-211 · Construir la pantalla de una lista agrupada por pasillos con marcar de un toque

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-210
- **Spec:** `docs/specs/04-lista-compra.md#72-lista--gcompralistid-shoppinglistpage`

**Descripción**
`/g/:groupId/compra/:listId` con los pendientes agrupados por pasillo, la sección "Comprados", marcar con un toque con toast de deshacer, vaciar comprados y los estados de la spec.

**Criterios de aceptación**
- [ ] Pendientes agrupados en el orden de `Aisle` con rótulo y `LaneRope`; dentro, por `position`.
- [ ] Un toque en la fila marca (optimista) y muestra "Leche comprado · Deshacer" 5 s; "Deshacer" desmarca.
- [ ] Sección "Comprados (N)" plegable, por `checkedAt` desc, tachada con `MemberDot`; un toque desmarca.
- [ ] Cada fila muestra `formatQuantity`, nota y `MemberDot` de quien la añadió, y el botón "Editar" con `aria-label` (la hoja es HOG-213).
- [ ] Menú de cabecera con "Renombrar", "Vaciar comprados" (confirmación de §7.2), "Indispensables", "Historial de compras" y "Borrar lista".
- [ ] Las filas cambiadas por otro miembro hacen la onda (`useRipple`).
- [ ] Estados: cargando, vacío, todo comprado, error, lista inexistente (también al recibir `shopping.list.deleted`) y sin conexión.

**Notas técnicas**
- `apps/web/src/features/shopping/pages/ShoppingListPage.tsx`, `components/{AisleSection.tsx, ShoppingItemRow.tsx, CheckedSection.tsx}`.
- La fila entera es un `button` con `aria-pressed`; el botón "Editar" detiene la propagación.

**Tests**
- Unit: `ShoppingItemRow.spec.tsx` (un toque llama a la mutación; deshacer), `ShoppingListPage.spec.tsx` (agrupación por pasillo, estados).
- E2E: cubierto en HOG-216.

---

### HOG-212 · Crear la barra de añadido rápido con autocompletado y "Sueles comprar"

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-211, HOG-206
- **Spec:** `docs/specs/04-lista-compra.md#72-lista--gcompralistid-shoppinglistpage` (barra de añadido rápido)

**Descripción**
Barra fija sobre el teclado que añade con Intro sin perder el foco, interpreta "2 kg tomates", sugiere productos del catálogo y muestra los frecuentes cuando está vacía.

**Criterios de aceptación**
- [ ] Placeholder "Añadir producto… (p. ej. 2 kg tomates)" y botón "Añadir" con `aria-label`.
- [ ] Intro o el botón añaden con `parseQuickAdd`, vacían el campo y **mantienen el foco** (el teclado no se cierra).
- [ ] Con ≥ 1 carácter: hasta 8 sugerencias de `useProductSearch` (con *debounce* de 150 ms); tocar una añade con su cantidad/unidad por defecto salvo que el texto traiga cantidad.
- [ ] Con el campo vacío y enfocado: chips "Sueles comprar" (hasta 12, `useFrequentProducts(listId)`); un toque añade.
- [ ] Respuesta `200` (fusión) → toast "Sumado a Leche (3 l)".
- [ ] La barra sigue al teclado con `visualViewport` en iOS y Android.
- [ ] Sin conexión: deshabilitada con el placeholder "Sin conexión".
- [ ] Error `422` (por ejemplo, 300 productos) se muestra en línea bajo la barra.

**Notas técnicas**
- `apps/web/src/features/shopping/components/{QuickAddBar.tsx, ProductSuggestions.tsx, FrequentChips.tsx}`.
- Combobox accesible (`role="combobox"`, `aria-expanded`, `aria-activedescendant`).

**Tests**
- Unit: `QuickAddBar.spec.tsx` (Intro conserva el foco, parseo, sugerencias, chips, fusión → toast).
- E2E: cubierto en HOG-216.

---

### HOG-213 · Crear la hoja de edición de producto con el aviso de conflicto

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-211
- **Spec:** `docs/specs/04-lista-compra.md#72-lista--gcompralistid-shoppinglistpage` (hoja de edición y conflicto)

**Descripción**
`ShoppingItemSheet` para cambiar nombre, cantidad, unidad, pasillo, nota y lista, marcar como indispensable y quitar el producto con deshacer, gestionando `STALE_VERSION`.

**Criterios de aceptación**
- [ ] Campos y botones de §7.2 con validación en español; la cantidad admite coma y se envía con punto.
- [ ] "Guardar" envía `expectedVersion`; con `409 STALE_VERSION` la hoja sigue abierta, muestra "{Nombre} acaba de cambiar este producto" (u "Otro miembro…"), aplica `current` a la caché y conserva lo escrito por el usuario.
- [ ] El interruptor "Indispensable" llama a `useUpdateProduct` (si `productId` es `null`, no se muestra).
- [ ] "Quitar de la lista" borra y muestra "Leche quitado · Deshacer" (5 s), que lo vuelve a crear con `POST`.
- [ ] `404` al guardar o quitar → la hoja se cierra con "Este producto ya no está en la lista" (al quitar se trata como éxito).
- [ ] Si llega `shopping.item.deleted` del producto abierto, la hoja se cierra con el mismo aviso.

**Notas técnicas**
- `apps/web/src/features/shopping/components/ShoppingItemSheet.tsx` con React Hook Form + `updateShoppingItemInput`.

**Tests**
- Unit: `ShoppingItemSheet.spec.tsx` (guardar, conflicto con MSW devolviendo 409 + `current`, quitar y deshacer, 404).
- E2E: cubierto en HOG-216 (editar cantidad).

---

### HOG-214 · Construir la pantalla de indispensables y el botón "Añadir indispensables que faltan"

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-212, HOG-207
- **Spec:** `docs/specs/04-lista-compra.md#73-indispensables--gcompraindispensables-essentialspage` · §7.2

**Descripción**
Ruta `/g/:groupId/compra/indispensables` para gestionar los indispensables y botón en la lista para añadir los que faltan.

**Criterios de aceptación**
- [ ] Ruta añadida al router antes de `/compra/:listId` (ya fijada en `docs/08-convenciones.md`).
- [ ] Lista por pasillo con interruptor para quitar y el texto "En Mercadona" si `pendingListIds` no está vacío.
- [ ] "Añadir indispensable" con autocompletado: producto existente → `PATCH { isEssential: true }`; nuevo → `POST /products`.
- [ ] En `ShoppingListPage`, el botón "Añadir indispensables que faltan (N)" aparece solo con N > 0 y muestra "Añadidos N indispensables".
- [ ] Estado vacío de §7.3, error y sin conexión.

**Notas técnicas**
- `apps/web/src/features/shopping/pages/EssentialsPage.tsx`, `components/AddMissingEssentialsButton.tsx`.

**Tests**
- Unit: `EssentialsPage.spec.tsx`, `AddMissingEssentialsButton.spec.tsx` (oculto con 0).
- E2E: cubierto en HOG-216.

---

### HOG-215 · Construir la pantalla del historial de compras

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-208, HOG-210
- **Spec:** `docs/specs/04-lista-compra.md#74-historial--gcomprahistorial-purchasespage`

**Descripción**
Ruta `/g/:groupId/compra/historial` con las compras agrupadas por día y scroll infinito.

**Criterios de aceptación**
- [ ] Ruta añadida antes de `/compra/:listId` (ya fijada en `docs/08-convenciones.md`).
- [ ] Agrupado por día ("Hoy", "Ayer", "lunes 9 nov") en la zona del grupo.
- [ ] Fila con producto, cantidad, lista (o "Lista eliminada") y `MemberDot` + nombre (o "Usuario eliminado").
- [ ] Scroll infinito con `nextCursor`; estados vacío ("Todavía no habéis comprado nada con Hogaria"), cargando y error.

**Notas técnicas**
- `apps/web/src/features/shopping/pages/PurchasesPage.tsx`; fechas con `lib/dates.ts`.

**Tests**
- Unit: `PurchasesPage.spec.tsx` (agrupado por día con fechas fijas, lista eliminada).
- E2E: —

---

### HOG-216 · Escribir los e2e de la compra (E2E-05 y E2E-06)

- **Épica:** E04 · **Fase:** 2 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-211, HOG-212, HOG-213, HOG-214, HOG-011
- **Spec:** `docs/specs/04-lista-compra.md#11-tests` · `docs/07-testing.md`

**Descripción**
Los dos flujos críticos de la compra en Playwright, en los proyectos Pixel 7 e iPhone 14.

**Criterios de aceptación**
- [ ] `apps/web/e2e/shopping-realtime.e2e.ts` (**E2E-05**): dos contextos en el mismo grupo; A añade "Leche" con la barra rápida y la marca; B, sin recargar, ve la fila aparecer y pasar a "Comprados".
- [ ] `apps/web/e2e/shopping-list.e2e.ts` (**E2E-06**): añadir "2 kg tomates" → editar la cantidad a 3 en la hoja → marcar → "Vaciar comprados" → marcar "Leche" como indispensable → volver a la lista → "Añadir indispensables que faltan" → aparece "Leche".
- [ ] Los dos pasan en local y en CI sin `waitForTimeout` (solo esperas por selectores o eventos).

**Notas técnicas**
- Usar los helpers de login y doble contexto de HOG-011 y las *factories* para crear el grupo con dos miembros.

**Tests**
- E2E: E2E-05, E2E-06.
