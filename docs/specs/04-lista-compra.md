# 04 · Lista de la compra

> Épica: E04 · Tickets: `docs/tickets/E04-compra.md` (HOG-200 – HOG-249) · Modelo: `docs/02-modelo-datos.md` § COMPRA (`ShoppingList`, `ShoppingItem`, `Product`, `Purchase`, enum `Aisle`) · API: `docs/04-api-y-tiempo-real.md` (fila "Compra" y § Resolución de conflictos) · Fase 2

## 1. Objetivo

Que todo el hogar comparta una o varias listas de la compra que se actualizan al instante en el móvil de cada miembro. Añadir un producto o marcarlo como comprado debe costar como mucho dos toques, incluso de pie en el pasillo del súper. El grupo va construyendo un catálogo propio (`Product`) que alimenta el autocompletado, los frecuentes, los indispensables y el historial de compras.

## 2. Historias de usuario

- **US-04-01** Como miembro, quiero tener varias listas (por ejemplo "Mercadona" y "Farmacia") para separar dónde compro cada cosa.
- **US-04-02** Como miembro, quiero añadir un producto escribiendo "2 kg tomates" y pulsando Intro, sin cerrar el teclado, para apuntar varios seguidos.
- **US-04-03** Como miembro, quiero que el autocompletado me proponga productos que el hogar ya ha comprado, con su pasillo y unidad, para escribir menos.
- **US-04-04** Como miembro, quiero marcar un producto como comprado con un toque y poder deshacerlo desde un aviso, para no perder el ritmo si me equivoco.
- **US-04-05** Como miembro, quiero ver la lista agrupada por pasillos para recorrer el súper en orden.
- **US-04-06** Como miembro, quiero que si añado "leche" y ya estaba pendiente se sume la cantidad en lugar de duplicarse.
- **US-04-07** Como miembro, quiero editar la cantidad, la unidad, la nota y el pasillo de un producto, y moverlo a otra lista.
- **US-04-08** Como miembro, quiero ver en tiempo real lo que añaden y marcan los demás, con una animación que me lo señale.
- **US-04-09** Como miembro, quiero marcar productos como **indispensables** y añadir de un toque los que faltan en la lista.
- **US-04-10** Como miembro, quiero ver sugerencias de lo que solemos comprar (frecuentes).
- **US-04-11** Como miembro, quiero vaciar los comprados al salir del súper y consultar después un historial de compras.
- **US-04-12** Como miembro, quiero que otras partes de la app (recetas, menú, IA, asistente) puedan enviar ingredientes a una lista. *(Los endpoints de origen viven en E05, E06, E13 y E14; esta épica expone el servicio `bulkCreate`.)*

## 3. Reglas de negocio

### Listas
- **RN-04-01** Un grupo tiene entre 1 y 20 listas. Al crear el grupo se siembra la lista "Compra" 🛒 en la posición 0 (E02). No se puede borrar la última lista: `409 CONFLICT` con el detalle "Debe quedar al menos una lista".
- **RN-04-02** El nombre de la lista se recorta (`trim`), mide entre 1 y 40 caracteres y es único en el grupo sin distinguir mayúsculas ni acentos (comparación con `normalizeProductName`). Si se repite: `409 CONFLICT` "Ya existe una lista con ese nombre".
- **RN-04-03** `position` es un entero 0..n-1 sin huecos. Al crear, la lista va al final. Al cambiar `position` con `PATCH`, el servicio reordena todas las listas del grupo en la misma transacción (mueve la lista a ese índice y desplaza las demás) y emite `shopping.list.updated` por cada lista cuya posición haya cambiado.
- **RN-04-04** Borrar una lista borra en cascada sus `ShoppingItem`. Las `Purchase` se conservan (su `listId` queda apuntando a una lista inexistente y el historial muestra "Lista eliminada").
- **RN-04-05** `ShoppingList.archivedAt` no se usa en esta épica. `GET /shopping-lists` devuelve solo las listas con `archivedAt = null`.

### Productos en la lista (`ShoppingItem`)
- **RN-04-06** Nombre: `trim`, 1–80 caracteres. Cantidad: decimal positivo con como mucho 2 decimales y como mucho 8 cifras enteras, serializado como `string` con punto (`"1.5"`); `null` = sin cantidad. Unidad: uno de los valores de `UNITS` (ver RN-04-30) o `null`. Nota: como mucho 200 caracteres. Una lista admite como mucho 300 productos (pendientes + comprados): al superarlo, `422 VALIDATION_ERROR` "La lista no puede tener más de 300 productos".
- **RN-04-07** **Vinculación al catálogo:** al crear un producto en la lista, el servicio calcula `normalizeProductName(name)` y hace *upsert* del `Product` del grupo con ese `normalizedName`:
  - Si no existe, lo crea con `name` (tal como lo escribió el usuario), `aisle = input.aisle ?? OTHER`, `defaultUnit = unit` y `defaultQuantity = quantity`.
  - Si existe y la entrada trae `aisle` distinto del del producto, actualiza `Product.aisle` (el catálogo aprende el pasillo).
  - El `ShoppingItem` guarda `productId`, y su `aisle` es `input.aisle ?? product.aisle`.
- **RN-04-08** **Fusión de duplicados** (`docs/04` § Resolución de conflictos): si en la misma lista hay un producto **sin marcar** con el mismo `normalizeProductName(name)` y la misma unidad (`null` coincide con `null`), no se crea otra línea:
  - la cantidad nueva es `mergeQuantities(existente, entrada)` (RN-04-31);
  - si la nota existente es `null` y la entrada trae nota, se guarda la nueva; si no, se conserva la existente;
  - se incrementa `version`;
  - la respuesta es **`200`** con el producto existente actualizado (en vez de `201`) y se emite `shopping.item.updated`;
  - si nada cambia (las dos cantidades son `null` y no hay nota nueva), la respuesta es `200` con el producto tal cual, sin evento ni actividad.
  Si las unidades no coinciden, se crea una línea nueva (`201`). Un producto ya **marcado** con el mismo nombre no se fusiona: se crea una línea nueva sin marcar.
- **RN-04-09** **Serialización por lista:** toda creación (individual, `bulk`, indispensables) bloquea la fila de la lista (`SELECT id FROM shopping_lists WHERE id = $1 FOR UPDATE`) dentro de la transacción, para que dos altas simultáneas de "leche" no generen dos líneas.
- **RN-04-10** `position` de un producto nuevo = `max(position) + 1` en la lista (0 si está vacía). No hay reordenación manual de productos: se muestran agrupados por pasillo en el orden del enum `Aisle` (`FRUITS_VEGETABLES` primero, `OTHER` último) y, dentro de cada pasillo, por `position` ascendente.
- **RN-04-11** **Marcar y desmarcar** (`checked`) es idempotente y **no** exige `expectedVersion`: gana el último.
  - Al pasar de `false` a `true`: `checkedAt = now`, `checkedById = usuario`, `version + 1`, y se registra la compra (RN-04-18).
  - Al pasar de `true` a `false`: `checkedAt = null`, `checkedById = null`, `version + 1`, y se deshace la compra (RN-04-19).
  - Si el valor enviado ya es el actual y no se envía ningún otro campo: `200` con el producto, sin cambios, sin evento, sin actividad y sin `Purchase`.
- **RN-04-12** **Editar contenido** (`name`, `quantity`, `unit`, `note`, `aisle`, `listId`): si la petición trae `expectedVersion` y no coincide con `version`, responde `409 STALE_VERSION` con el producto actual en el campo `current` del problem+json. Si no trae `expectedVersion`, gana la última escritura. La web **siempre** envía `expectedVersion` al editar contenido y **nunca** al marcar o desmarcar. Toda actualización que cambie algo incrementa `version` en 1.
- **RN-04-13** Al cambiar `name`, se recalcula el producto de catálogo (RN-04-07) y se actualiza `productId`. Al cambiar `aisle`, también se actualiza `Product.aisle`. **Editar no fusiona** aunque el nombre nuevo coincida con otra línea pendiente.
- **RN-04-14** **Mover de lista:** `PATCH` con `listId` de otra lista del mismo grupo (si no existe o es de otro grupo: `404 NOT_FOUND`). El producto conserva su estado, recibe `position = max + 1` en la lista destino y no se fusiona. Se emite un único `shopping.item.updated` con el `listId` nuevo.
- **RN-04-15** **Borrar** un producto ya borrado responde `404`, y la web lo trata como éxito. Borrar un producto marcado no toca su `Purchase`.
- **RN-04-16** **Vaciar comprados** (`clear-checked`) borra todos los productos marcados de la lista en una sola transacción, emite un único `shopping.items.bulk_deleted` y deja una sola entrada de actividad. Si no hay marcados: `200 { deletedIds: [] }`, sin evento ni actividad. Las `Purchase` se conservan.
- **RN-04-17** **Alta en bloque** (`bulkCreate`, usado por `items/bulk`, indispensables, recetas, menú, IA y asistente): recibe de 1 a 100 líneas. Primero agrupa las líneas de la propia entrada con la misma clave (`normalizeProductName(name)` + unidad) sumando cantidades, y después aplica RN-04-07 y RN-04-08 contra la lista. Devuelve **todos** los productos afectados (creados o fusionados) y emite **un único** `shopping.items.bulk_created` con ellos (el cliente hace *upsert* por `id`). Una sola entrada de actividad con el texto que indique quien llama (§9).

### Historial y catálogo
- **RN-04-18** **Registrar compra:** al marcar un producto con `productId != null` se crea una `Purchase { productId, listId, quantity, unit, purchasedById, purchasedAt = now, shoppingItemId }` y se actualiza el `Product`: `purchaseCount + 1` y `lastPurchasedAt = now`. Si `productId` es `null` (producto de catálogo borrado), no se registra nada.
- **RN-04-19** **Deshacer compra:** al desmarcar, se borra la `Purchase` más reciente con ese `shoppingItemId`, se resta 1 a `purchaseCount` (sin bajar de 0) y `lastPurchasedAt` pasa a ser el `max(purchasedAt)` de las compras que queden de ese producto (o `null`).
- **RN-04-20** **Frecuentes:** productos con `purchaseCount >= 2`, ordenados por `purchaseCount` desc y después por `lastPurchasedAt` desc. Si se pasa `listId`, se excluyen los que ya están en esa lista (marcados o no). `limit` por defecto 12, máximo 30.
- **RN-04-21** **Indispensables:** productos con `isEssential = true`, ordenados por `aisle` y `name`. Un indispensable **falta** en una lista cuando no hay ningún `ShoppingItem` de esa lista (marcado o no) con su `productId`.
- **RN-04-22** **Añadir indispensables que faltan** (`add-missing-essentials`): crea, vía `bulkCreate`, una línea por cada indispensable que falta en esa lista, con `name = product.name`, `quantity = defaultQuantity`, `unit = defaultUnit` y `aisle = product.aisle`. Si no falta ninguno: `200 { items: [] }`, sin evento ni actividad.
- **RN-04-23** **Autocompletado:** `q` se normaliza con `normalizeProductName`. Primero salen los productos cuyo `normalizedName` empieza por `q` y después los que lo contienen; dentro de cada bloque, por `purchaseCount` desc y `name` asc. `limit` por defecto 8, máximo 20. `q` es obligatorio (1–80 caracteres).
- **RN-04-24** **Editar producto de catálogo** (`PATCH /products/:id`): `name`, `aisle`, `defaultUnit`, `defaultQuantity` e `isEssential`. Si el nombre normalizado nuevo ya existe en el grupo: `409 CONFLICT` "Ya existe un producto con ese nombre". Editar el catálogo **no** modifica los `ShoppingItem` existentes.
- **RN-04-25** **Crear producto de catálogo** (`POST /products`): sirve para declarar un indispensable que aún no se ha comprado nunca. Si ya existe con el mismo `normalizedName`: `409 CONFLICT`.
- **RN-04-26** **Borrar producto de catálogo** (`DELETE /products/:id`): borra el `Product` y en cascada sus `Purchase`. Los `ShoppingItem` que lo usaban conservan su texto con `productId = null`.
- **RN-04-27** **Historial** (`GET /purchases`): paginado por cursor sobre `id` (UUIDv7), del más reciente al más antiguo. Filtro opcional `productId`. Cada fila lleva el nombre actual del producto y el de la lista (o `null` si se borró).

### Normalización y utilidades (`packages/shared`)
- **RN-04-28** `normalizeProductName(s)`: `trim` → minúsculas → quita diacríticos (NFD y elimina `\p{M}`, **excepto** que la `ñ` se conserva) → colapsa espacios → singular simple **por palabra**:
  1. palabras de 3 caracteres o menos: sin cambios;
  2. termina en `ces` → cambia `ces` por `z` (`nueces` → `nuez`);
  3. termina en `es` y la letra anterior es una de `l n r d j` → quita `es` (`limones` → `limon`, `panes` → `pan`);
  4. termina en `s` y la letra anterior es vocal → quita `s` (`tomates` → `tomate`, `huevos` → `huevo`);
  5. en otro caso, sin cambios.

  | Entrada | Salida |
  |---|---|
  | `"  Tomates "` | `"tomate"` |
  | `"Limones"` | `"limon"` |
  | `"Pan de molde"` | `"pan de molde"` |
  | `"Huevos camperos"` | `"huevo campero"` |
  | `"Nueces"` | `"nuez"` |
  | `"Plátanos"` | `"platano"` |
  | `"Piñas"` | `"piña"` |
  | `"Gas"` | `"gas"` |
- **RN-04-29** `AISLE_LABELS` (orden de visualización = orden del enum): Fruta y verdura · Carne · Pescado · Lácteos y huevos · Panadería · Despensa · Congelados · Bebidas · Picoteo · Limpieza · Higiene · Bebé · Mascotas · Otros.
- **RN-04-30** `UNITS = ['ud','kg','g','l','ml','paquete','lata','botella','docena','bolsa']`. `normalizeUnit(s)` pasa a minúsculas, quita el punto final y mapea sinónimos: `unidad, unidades, u, uds` → `ud`; `kilo, kilos, kgs` → `kg`; `gr, grs, gramo, gramos` → `g`; `litro, litros, lt` → `l`; `mililitro, mililitros` → `ml`; plurales `paquetes, latas, botellas, docenas, bolsas` → singular. Lo que no reconoce lo devuelve normalizado tal cual (E05 lo usa con `RECIPE_UNITS`). En la compra, una unidad que tras normalizarse no esté en `UNITS` da `422`.
- **RN-04-31** `mergeQuantities(a, b)` (cadenas decimales o `null`): `null + null = null`; `null + x = x`; `x + y = x + y` redondeado a 2 decimales. Se opera con aritmética decimal exacta (enteros en centésimas), nunca con `float`.
- **RN-04-32** `parseQuickAdd(text)` interpreta la barra de añadido rápido. Patrón: `^(cantidad)?\s*(unidad)?\s+(nombre)$`, donde la cantidad acepta coma o punto decimal (`1,5`) y la unidad se reconoce con `normalizeUnit` contra `UNITS`. Si no hay unidad pero sí número, la unidad es `null`. Si el texto no empieza por número, todo es el nombre. También se admite el sufijo `x3` o `×3` (cantidad 3, unidad `ud`).

  | Texto | Resultado |
  |---|---|
  | `"leche"` | `{ name: "leche", quantity: null, unit: null }` |
  | `"2 kg tomates"` | `{ name: "tomates", quantity: "2", unit: "kg" }` |
  | `"1,5 l leche"` | `{ name: "leche", quantity: "1.5", unit: "l" }` |
  | `"3 yogures"` | `{ name: "yogures", quantity: "3", unit: null }` |
  | `"huevos x12"` | `{ name: "huevos", quantity: "12", unit: "ud" }` |
  | `"7up"` | `{ name: "7up", quantity: null, unit: null }` (un número pegado a letras forma parte del nombre) |
- **RN-04-33** `formatQuantity(quantity, unit)` para la interfaz: coma decimal, sin ceros finales y unidad separada por un espacio (`"1.50"` + `"kg"` → `"1,5 kg"`; `"3"` + `null` → `"3"`; `null` → `""`).

## 4. Modelo de datos

- `ShoppingList`, `ShoppingItem`, `Product`, `Purchase` y el enum `Aisle` de `docs/02-modelo-datos.md` § COMPRA. No se redefinen aquí.
- `ShoppingItem.version` controla los conflictos por elemento (RN-04-11, RN-04-12).
- `Product.isEssential` = indispensable; `purchaseCount` y `lastPurchasedAt` alimentan los frecuentes.
- `Purchase.shoppingItemId` (sin FK) enlaza la compra con el item marcado para poder deshacerla (RN-04-19).

## 5. API

Todas las rutas cuelgan de `/api/v1/groups/:groupId` y pasan por `AuthGuard` + `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/shopping.ts`. Todas las mutaciones aceptan la cabecera `X-Client-Mutation-Id`.

### DTO de salida

```ts
shoppingListDto = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(),
  name: z.string(), emoji: z.string().nullable(), position: z.number().int(),
  pendingCount: z.number().int(),          // productos sin marcar (calculado)
  createdById: z.string().uuid().nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
})
shoppingItemDto = z.object({
  id, groupId, listId: uuid, productId: uuid.nullable(),
  name: z.string(), quantity: decimalString.nullable(), unit: z.enum(UNITS).nullable(),
  note: z.string().nullable(), aisle: AisleEnum,
  checked: z.boolean(), checkedAt: datetime.nullable(), checkedById: uuid.nullable(),
  addedById: uuid.nullable(), position: z.number().int(), version: z.number().int(),
  createdAt: datetime, updatedAt: datetime,
})
productDto = z.object({
  id, name: z.string(), aisle: AisleEnum, defaultUnit: z.enum(UNITS).nullable(),
  defaultQuantity: decimalString.nullable(), isEssential: z.boolean(),
  purchaseCount: z.number().int(), lastPurchasedAt: datetime.nullable(),
})
essentialProductDto = productDto.extend({ pendingListIds: z.array(uuid) }) // listas donde está sin marcar
purchaseDto = z.object({
  id, productId: uuid, productName: z.string(),
  listId: uuid.nullable(), listName: z.string().nullable(),   // null si la lista ya no existe
  quantity: decimalString.nullable(), unit: z.string().nullable(),
  purchasedById: uuid.nullable(), purchasedAt: datetime,
})
// decimalString = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).refine(v => Number(v) > 0)
```

### Esquemas de entrada

```ts
createShoppingListInput = z.object({ name: z.string().trim().min(1).max(40), emoji: z.string().max(8).nullable().optional() })
updateShoppingListInput = z.object({ name: …opcional, emoji: …opcional, position: z.number().int().min(0).optional() })
  .refine(alguno presente)
createShoppingItemInput = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: decimalString.nullable().optional(),
  unit: unitInput.nullable().optional(),        // unitInput = z.string().transform(normalizeUnit).pipe(z.enum(UNITS))
  note: z.string().trim().max(200).nullable().optional(),
  aisle: AisleEnum.optional(),
})
bulkCreateShoppingItemsInput = z.object({ items: z.array(createShoppingItemInput).min(1).max(100) })
updateShoppingItemInput = z.object({
  name, quantity, unit, note, aisle,            // mismos tipos, todos opcionales
  checked: z.boolean().optional(),
  listId: z.string().uuid().optional(),
  expectedVersion: z.number().int().min(1).optional(),
}).refine(al menos un campo distinto de expectedVersion)
productSearchQuery = z.object({ q: z.string().trim().min(1).max(80), limit: z.coerce.number().int().min(1).max(20).default(8) })
frequentProductsQuery = z.object({ listId: uuid.optional(), limit: z.coerce.number().int().min(1).max(30).default(12) })
essentialsQuery = z.object({ listId: uuid.optional() })
createProductInput = z.object({ name: z.string().trim().min(1).max(80), aisle: AisleEnum.default('OTHER'),
  defaultUnit: unitInput.nullable().optional(), defaultQuantity: decimalString.nullable().optional(),
  isEssential: z.boolean().default(false) })
updateProductInput = createProductInput.partial().refine(alguno presente)
purchasesQuery = z.object({ cursor: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(50), productId: uuid.optional() })
```

### Endpoints

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/shopping-lists` | — | `shoppingListDto[]` ordenadas por `position` | 401, 404 |
| POST | `/shopping-lists` | `createShoppingListInput` | `201 shoppingListDto` | 409 nombre repetido, 422 (también si ya hay 20 listas) |
| PATCH | `/shopping-lists/:id` | `updateShoppingListInput` | `shoppingListDto` | 404, 409, 422 |
| DELETE | `/shopping-lists/:id` | — | `204` | 404, 409 última lista |
| POST | `/shopping-lists/:id/clear-checked` | — | `{ deletedIds: uuid[] }` | 404 |
| GET | `/shopping-lists/:id/items` | — | `shoppingItemDto[]` (todos, marcados y sin marcar) | 404 |
| POST | `/shopping-lists/:id/items` | `createShoppingItemInput` | `201 shoppingItemDto` (creado) o `200 shoppingItemDto` (fusionado, RN-04-08) | 404, 422 |
| POST | `/shopping-lists/:id/items/bulk` | `bulkCreateShoppingItemsInput` | `{ items: shoppingItemDto[] }` (afectados) | 404, 422 |
| POST | `/shopping-lists/:id/add-missing-essentials` | — | `{ items: shoppingItemDto[] }` | 404, 422 (300 productos) |
| PATCH | `/shopping-items/:id` | `updateShoppingItemInput` | `shoppingItemDto` | 404, 409 `STALE_VERSION` (+ `current`), 422 |
| DELETE | `/shopping-items/:id` | — | `204` | 404 (la web lo trata como éxito) |
| GET | `/products?q=&limit=` | `productSearchQuery` | `productDto[]` | 422 |
| POST | `/products` | `createProductInput` | `201 productDto` | 409, 422 |
| PATCH | `/products/:id` | `updateProductInput` | `productDto` | 404, 409, 422 |
| DELETE | `/products/:id` | — | `204` | 404 |
| GET | `/products/frequent?listId=&limit=` | `frequentProductsQuery` | `productDto[]` | 404 (`listId` ajeno), 422 |
| GET | `/products/essentials?listId=` | `essentialsQuery` | `essentialProductDto[]` | 404, 422 |
| GET | `/purchases?cursor=&limit=&productId=` | `purchasesQuery` | `{ items: purchaseDto[], nextCursor: string \| null }` | 422 |

Ejemplo de `409 STALE_VERSION`:

```json
{
  "type": "https://hogaria.obaiges.com/errors/stale-version",
  "title": "Conflicto de versión",
  "status": 409,
  "code": "STALE_VERSION",
  "detail": "Otro miembro acaba de cambiar este producto",
  "current": { "id": "…", "name": "Leche", "quantity": "2", "version": 5, "…": "…" }
}
```

### Servicio interno reutilizable

`ShoppingItemsService.bulkCreate(ctx: { groupId, listId, actorId }, lines: CreateShoppingItemInput[], activity: { summary: string, metadata?: object }): Promise<ShoppingItemDto[]>` aplica RN-04-09 y RN-04-17 (el `clientMutationId` lo toma `RealtimePublisher` del `RequestContext`, spec 03). Para lectura, el asistente (E14) usa `ShoppingListsService.findAll(groupId)` y `ShoppingItemsService.findByList(groupId, listId)`. Lo usan `add-missing-essentials` (esta épica), `POST /recipes/:id/add-to-shopping-list` (E05), `POST /meal-plan/add-to-shopping-list` (E06), la IA nevera (E13) y el asistente (E14). Nadie más escribe `ShoppingItem` directamente.

## 6. Eventos en tiempo real

Todos van a la sala `group:<groupId>` con el sobre de `docs/04`.

| Evento | Cuándo | data |
|---|---|---|
| `shopping.list.created` | `POST /shopping-lists` | `ShoppingListDto` |
| `shopping.list.updated` | `PATCH` (incluido el reordenado: uno por lista movida) | `ShoppingListDto` |
| `shopping.list.deleted` | `DELETE /shopping-lists/:id` | `{ id }` |
| `shopping.item.created` | Alta individual que crea línea | `ShoppingItemDto` |
| `shopping.item.updated` | Alta individual fusionada, `PATCH` (marcar, editar, mover) | `ShoppingItemDto` |
| `shopping.item.deleted` | `DELETE /shopping-items/:id` | `{ id, listId }` |
| `shopping.items.bulk_created` | `items/bulk`, `add-missing-essentials` y `bulkCreate` desde otros módulos | `{ listId, items: ShoppingItemDto[] }` (creados **y** fusionados) |
| `shopping.items.bulk_deleted` | `clear-checked` | `{ listId, ids }` |
| `product.updated` | `POST`/`PATCH /products` (no en los *upsert* implícitos al añadir) | `ProductDto` |
| `product.deleted` | `DELETE /products/:id` | `{ id }` |
| `activity.created` | Cada entrada de §9 (lo emite `ActivityService`) | `ActivityDto` |

**Aplicación en el cliente** (`apps/web/src/features/shopping/realtime.ts`):
- `shopping.item.created/updated`: *upsert* por `id` en `['group', g, 'shopping-list', listId, 'items']` **y** eliminación de ese `id` en la caché de cualquier otra lista (cubre el caso de mover).
- `shopping.items.bulk_created`: *upsert* de cada item en la lista `listId`.
- `*.deleted` / `bulk_deleted`: quitar por `id`.
- Cualquier evento `shopping.item*`: invalidar `['group', g, 'shopping-lists']` con *debounce* de 500 ms (para refrescar `pendingCount`).
- Las filas cambiadas por **otro** miembro reproducen la animación **onda** (`ripple`, DESIGN.md). Los eventos con un `clientMutationId` propio se ignoran.

## 7. Pantallas y UX

Rutas (docs/08): `/g/:groupId/compra`, `/g/:groupId/compra/indispensables`, `/g/:groupId/compra/historial` y `/g/:groupId/compra/:listId` (las dos primeras se declaran antes de `:listId`). Componentes de `DESIGN.md`: `LaneRope` como separador de pasillos, `DepthFigure` para el contador de pendientes, `MemberDot` para quién añadió o marcó, y `ripple` para los cambios remotos. Objetivos táctiles ≥ 44 px.

### 7.1 Listas — `/g/:groupId/compra` (`ShoppingListsPage`)
- Título: **"Compra"**. Una tarjeta por lista con emoji, nombre y `DepthFigure` con los pendientes ("12" + rótulo "por comprar"). Si `pendingCount = 0`: "Todo comprado".
- Botón principal: **"Nueva lista"** → diálogo con "Nombre" (placeholder "Mercadona"), "Emoji (opcional)" y "Crear".
- Menú de cada tarjeta (⋯): "Renombrar", "Subir", "Bajar", "Borrar". Borrar pide confirmación: "¿Borrar la lista Farmacia y sus 4 productos?" [Cancelar] [Borrar]. Si es la última, la opción aparece deshabilitada con la ayuda "Debe quedar al menos una lista".
- Enlaces secundarios: **"Indispensables"** y **"Historial de compras"**.
- Estados: *cargando* = 3 tarjetas *skeleton*; *vacío* (solo si algo falló en la semilla) = "Aún no hay listas" + "Crear lista"; *error* = "No se pudieron cargar las listas" + "Reintentar"; *sin conexión* = banner global y botones de edición deshabilitados.

### 7.2 Lista — `/g/:groupId/compra/:listId` (`ShoppingListPage`)
- Cabecera: emoji + nombre, `DepthFigure` con pendientes y menú (⋯): "Renombrar", "Vaciar comprados", "Indispensables", "Historial de compras", "Borrar lista".
- **Botón "Añadir indispensables que faltan (N)"** encima de la lista, solo si N > 0 (N sale de `GET /products/essentials?listId`). Al pulsarlo: toast "Añadidos 3 indispensables".
- **Pendientes agrupados por pasillo**: rótulo del pasillo (`AISLE_LABELS`) y `LaneRope` entre grupos. Cada fila: casilla circular + nombre + `formatQuantity` + nota en texto secundario + `MemberDot` de quien lo añadió + botón "Editar" (icono lápiz, `aria-label="Editar Leche"`).
  - **Un toque en la fila (fuera del botón Editar) la marca** con actualización optimista; la fila baja a "Comprados" y aparece el toast **"Leche comprado · Deshacer"** (5 s). "Deshacer" envía `PATCH { checked: false }`.
- **Sección "Comprados (N)"** plegable al final, ordenada por `checkedAt` desc, con texto tachado y `MemberDot` de quien lo marcó. Un toque desmarca (sin toast).
- **Barra de añadido rápido fija abajo** (sobre el teclado, con `visualViewport`): campo con placeholder **"Añadir producto… (p. ej. 2 kg tomates)"** y botón "Añadir" (`aria-label="Añadir producto"`). Intro añade, vacía el campo y **mantiene el foco y el teclado abiertos**. La entrada se interpreta con `parseQuickAdd`.
  - Con 1 carácter o más, aparece encima un panel con hasta 8 sugerencias de `GET /products?q=` (nombre + pasillo + unidad por defecto). Tocar una sugerencia añade el producto con su `defaultQuantity`/`defaultUnit`, salvo que el texto ya traiga cantidad.
  - Con el campo vacío y enfocado, aparece una fila de chips **"Sueles comprar"** con `GET /products/frequent?listId` (hasta 12). Un toque en un chip lo añade.
  - Si la respuesta es `200` (fusionado), toast "Sumado a Leche (3 l)".
- **Hoja de edición** (`ShoppingItemSheet`): "Nombre", "Cantidad" (teclado decimal), "Unidad" (selector con `UNITS` + "Sin unidad"), "Pasillo" (selector), "Nota", "Lista" (mover), interruptor **"Indispensable"** (hace `PATCH /products/:productId { isEssential }`) y botones "Guardar" y "Quitar de la lista". Al quitar: toast **"Leche quitado · Deshacer"**; "Deshacer" vuelve a crearlo con `POST` (nuevo `id`).
- **Conflicto `STALE_VERSION`:** la hoja sigue abierta, muestra el aviso **"{Nombre del miembro} acaba de cambiar este producto"** (el nombre sale del `actorId` del último evento en tiempo real recibido para ese producto, que `realtime.ts` guarda en un mapa `itemId → actorId`; si no se conoce, el texto es "Otro miembro acaba de cambiar este producto"), aplica `current` a la caché y conserva el texto que había escrito el usuario en los campos para que pueda volver a "Guardar" (ahora con la versión nueva).
- **Vaciar comprados:** confirmación "¿Quitar los 8 productos comprados? Se guardarán en el historial." [Cancelar] [Vaciar comprados]. Sin deshacer.
- Estados: *cargando* = 6 filas *skeleton*; *vacío* = "La lista está vacía" + texto "Añade el primer producto abajo" + botón "Añadir indispensables" (si hay indispensables); *todo comprado* = "Todo comprado 🎉" sobre la sección Comprados; *error* = "No se pudo cargar la lista" + "Reintentar"; *lista inexistente* (404) = "Esta lista ya no existe" + "Volver a Compra"; *sin conexión* = banner y barra de añadido deshabilitada con placeholder "Sin conexión".

### 7.3 Indispensables — `/g/:groupId/compra/indispensables` (`EssentialsPage`)
- Título "Indispensables" y ayuda "Productos que nunca deberían faltar en casa".
- Lista por pasillo con interruptor para quitarlo de indispensables y el texto "En Mercadona" si está pendiente en alguna lista (`pendingListIds`).
- Campo "Añadir indispensable" con autocompletado del catálogo. Si el producto existe → `PATCH { isEssential: true }`; si no → `POST /products { name, isEssential: true }`.
- Estado vacío: "Aún no hay indispensables" + "Marca como indispensable la leche, el pan o lo que nunca debe faltar".

### 7.4 Historial — `/g/:groupId/compra/historial` (`PurchasesPage`)
- Título "Historial de compras". Agrupado por día ("Hoy", "Ayer", "lunes 9 nov"). Fila: producto, `formatQuantity`, lista (o "Lista eliminada") y `MemberDot` + nombre de quien lo marcó ("Usuario eliminado" si `null`). Scroll infinito con `nextCursor`.
- Vacío: "Todavía no habéis comprado nada con Hogaria".

## 8. Permisos

Sin roles: **cualquier miembro** del grupo ve, crea, edita, marca y borra listas, productos, catálogo e historial. Fuera del grupo: `404 NOT_FOUND` (GroupMemberGuard). Sin sesión: `401`. No hay recursos con propiedad en este módulo.

## 9. Actividad

Se escribe con `ActivityService.record(tx, …)` dentro de la transacción (spec 03, RN-03-25). `entityType` (de `ACTIVITY_ENTITY_TYPES`): `shopping_list`, `shopping_item`, `product`. El `summary` no incluye el nombre del actor (la interfaz lo antepone).

| Acción | `action` | `summary` |
|---|---|---|
| Crear lista | `created` | `creó la lista Farmacia` |
| Renombrar lista | `updated` | `renombró la lista Compra a Mercadona` |
| Borrar lista | `deleted` | `borró la lista Farmacia` |
| Añadir producto | `created` | `añadió Leche a Mercadona` · con cantidad: `añadió Tomates (2 kg) a Mercadona` |
| Fusión de cantidad | `updated` | `sumó 1 l a Leche en Mercadona` |
| Editar producto | `updated` | `cambió Leche en Mercadona` |
| Mover | `updated` | `movió Leche de Mercadona a Farmacia` |
| Marcar | `checked` | `marcó Leche como comprado en Mercadona` |
| Desmarcar | — | *(sin actividad)* |
| Quitar producto | `deleted` | `quitó Leche de Mercadona` |
| Alta en bloque | `created` | `añadió 5 productos a Mercadona` |
| Indispensables | `created` | `añadió 3 indispensables a Mercadona` |
| Vaciar comprados | `cleared` (`entityType = shopping_list`) | `vació 8 comprados de Mercadona` |
| Marcar indispensable | `updated` | `marcó Leche como indispensable` / `quitó Leche de indispensables` |
| Reordenar listas, otros cambios de catálogo | — | *(sin actividad)* |

Las altas en bloque de otros módulos pasan su propio `summary` (ver specs 05, 06, 13 y 14).

## 10. Casos límite

- Dos miembros añaden "leche" a la vez en la misma lista → una sola línea con la suma (RN-04-09).
- A marca y B edita la cantidad del mismo producto a la vez → la edición de B llega con versión antigua → `409 STALE_VERSION`; B ve el aviso y reintenta.
- A borra un producto que B está editando → el `PATCH` de B devuelve `404`; la hoja se cierra con el toast "Este producto ya no está en la lista".
- Deshacer "comprado" después de que otro miembro haya vaciado los comprados → `PATCH` devuelve `404`; toast "Ya no está en la lista".
- Se borra una lista mientras otro miembro la tiene abierta → evento `shopping.list.deleted` → la página muestra "Esta lista ya no existe" y el botón "Volver a Compra".
- Unidades distintas ("1 l leche" y "2 botella leche") → dos líneas (RN-04-08).
- Producto con `productId = null` (catálogo borrado) → se puede marcar, pero no genera `Purchase`.
- Nombre que se normaliza igual a otro ("Tomate" y "tomates") → mismo `Product`.
- Cantidad con coma en la barra rápida (`1,5`) → se envía como `"1.5"`.
- Lista con 300 productos → `422` con el mensaje de RN-04-06; la barra muestra el error en línea.
- Reconexión del socket → se invalidan todas las queries del grupo (docs/04); la lista se recarga entera.
- Usuario eliminado → `addedById`/`checkedById`/`purchasedById` = `null` → "Usuario eliminado".

## 11. Tests

**Unitarios (Vitest, `packages/shared`):** `normalizeProductName` (todas las filas de RN-04-28 y más), `normalizeUnit`, `parseQuickAdd` (tabla de RN-04-32), `mergeQuantities` (con `null`, decimales y redondeo), `formatQuantity`, esquemas zod (`decimalString` rechaza `0`, `-1`, `1.234`, `"abc"`).

**Unitarios (API):** reordenado de listas (RN-04-03), cálculo de fusión, cálculo de frecuentes y de indispensables que faltan.

**Integración (`apps/api/test/shopping/*.int.spec.ts`):**
- Autorización: usuario de otro grupo recibe `404` en GET/PATCH/DELETE de listas, productos e items; sin sesión `401`.
- Alta que crea (`201`) y que fusiona (`200`); unidades distintas no fusionan; producto marcado no fusiona.
- Dos `POST` concurrentes de "leche" → una línea con la suma.
- `PATCH` con `expectedVersion` antigua → `409 STALE_VERSION` con `current`; marcar sin versión → `200`.
- Marcar crea `Purchase` y suma `purchaseCount`; desmarcar lo revierte.
- `clear-checked` emite un único `bulk_deleted` y conserva las compras.
- `add-missing-essentials` solo añade los que faltan; segunda llamada → `items: []`.
- No se puede borrar la última lista (`409`).
- Cada mutación publica el evento correcto (`RealtimePublisher` falso) y escribe `ActivityLog`.

**Componentes (web):** barra de añadido rápido (Intro mantiene el foco, sugerencias, chips de frecuentes), fila (un toque marca, toast con deshacer), hoja de edición con conflicto `STALE_VERSION`, estados vacío, error y sin conexión.

**E2E:**
- **E2E-05** Tiempo real: dos contextos de navegador en el mismo grupo; A añade "Leche" y la marca; B ve la fila aparecer y pasar a "Comprados" sin recargar (y la onda).
- **E2E-06** Lista de la compra: añadir "2 kg tomates", editar la cantidad a 3, marcar, "Vaciar comprados", marcar "Leche" como indispensable y usar "Añadir indispensables que faltan".

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `Purchase.shoppingItemId` + `@@index([shoppingItemId])` → `docs/02`.
- `POST /products`, `DELETE /products/:id` y evento `product.deleted` → `docs/04` (fila "Compra" y catálogo de eventos).
- `409 STALE_VERSION` con `current` y fusión de alta con `200` + `shopping.item.updated` → `docs/04` (errores y Resolución de conflictos).
- Rutas `/compra/indispensables` y `/compra/historial` → `docs/08`.
- Glosario "Sueles comprar" y "Añadir indispensables que faltan" → `docs/10`.

## 13. Fuera de alcance

- Modo offline o cola de cambios sin conexión (ADR-015).
- Reordenar productos a mano dentro de un pasillo y orden de pasillos personalizado por tienda.
- Archivar listas (`archivedAt` queda reservado).
- Precios, presupuesto de la compra y comparador de supermercados.
- Escanear códigos de barras o tickets para la lista (el ticket de E13/E10 es para gastos).
- Conversión entre unidades (g ↔ kg).
- Notificaciones push de cambios en la lista (solo se ven dentro de la app).
