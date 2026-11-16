# 05 · Recetas

> Épica: E05 · Tickets: `docs/tickets/E05-recetas.md` (HOG-250 – HOG-299) · Modelo: `docs/02-modelo-datos.md` § RECETAS (`Recipe`, `RecipeIngredient`, `RecipeStep`, enums `Difficulty`, `RecipeSource`, `Diet`, `Allergen`) · API: `docs/04-api-y-tiempo-real.md` (fila "Recetas") · Fase 3

## 1. Objetivo

Un recetario compartido por el hogar, escrito a mano, que sirva para cocinar (raciones escalables en pantalla), para planificar el menú (E06) y para llenar la lista de la compra con un toque. Las recetas propuestas por la IA (nevera en E13 y asistente en E14) se guardan con el mismo endpoint y quedan marcadas con su origen. No hay información nutricional, ni fotos, ni importación desde URL.

## 2. Historias de usuario

- **US-05-01** Como miembro, quiero escribir una receta con título, raciones, tiempos, dificultad, ingredientes y pasos para tenerla siempre a mano.
- **US-05-02** Como miembro, quiero indicar los alérgenos (los 14 de la UE), las dietas compatibles, los utensilios y unas etiquetas libres para poder filtrar después.
- **US-05-03** Como miembro, quiero cambiar el número de raciones al ver una receta y que las cantidades se recalculen.
- **US-05-04** Como miembro, quiero buscar por texto (título, etiqueta o ingrediente) y filtrar por favoritas, dieta, sin un alérgeno, tiempo máximo, dificultad o utensilio.
- **US-05-05** Como miembro, quiero marcar recetas como favoritas del hogar.
- **US-05-06** Como miembro, quiero añadir a una lista de la compra los ingredientes que elija de una receta, escalados a las raciones que voy a cocinar.
- **US-05-07** Como miembro, quiero editar y borrar cualquier receta del hogar.
- **US-05-08** Como miembro, quiero saber si una receta la propuso la IA.

## 3. Reglas de negocio

### Validación y normalización
- **RN-05-01** `title`: `trim`, 1–120 caracteres. `description`: como mucho 1000 caracteres o `null`. `servings`: entero 1–50 (por defecto 4). `prepMinutes` y `cookMinutes`: enteros 0–1440 o `null`. `difficulty`: `EASY | MEDIUM | HARD` o `null`.
- **RN-05-02** `tags`: como mucho 10; cada una se recorta, se pasa a minúsculas, mide 1–30 caracteres y se eliminan duplicados conservando el primer orden.
- **RN-05-03** `utensils`: como mucho 15; misma normalización que las etiquetas. La interfaz sugiere los valores de `UTENSILS` (RN-05-20), pero se admite cualquier texto (la IA puede devolver otros).
- **RN-05-04** `allergens` y `suitableDiets`: arrays sin duplicados de los enums `Allergen` y `Diet`.
- **RN-05-05** **Dietas compatibles con implicación:** el orden de restricción es `VEGAN` ⊂ `VEGETARIAN` ⊂ `PESCATARIAN` ⊂ `OMNIVORE` (lo que es apto para una dieta lo es para todas las menos restrictivas). Al guardar, el servicio sustituye `suitableDiets` por `expandSuitableDiets(suitableDiets)`, que añade todas las menos restrictivas que la más restrictiva marcada. Ejemplos: `[VEGAN]` → `[VEGAN, VEGETARIAN, PESCATARIAN, OMNIVORE]`; `[PESCATARIAN]` → `[PESCATARIAN, OMNIVORE]`; `[]` → `[]` (= "no indicado"). La interfaz muestra solo el chip de la más restrictiva ("Vegana").
- **RN-05-06** `ingredients`: entre 1 y 60. Cada uno: `name` 1–80 caracteres; `quantity` decimal positivo con 2 decimales como mucho (`decimalString` de la spec 04) o `null`; `unit` texto de 1–20 caracteres o `null`, que se guarda pasado por `normalizeUnit` (si el resultado está en `RECIPE_UNITS` se guarda la forma canónica; si no, el texto normalizado tal cual); `note` como mucho 120 caracteres o `null`; `optional` booleano (por defecto `false`). `position` = índice en el array (0..n-1).
- **RN-05-07** `steps`: entre 1 y 50; `text` 1–2000 caracteres. `position` = índice en el array.
- **RN-05-08** `source`: `MANUAL` por defecto. E13 crea recetas con `AI_FRIDGE` y E14 con `AI_CHAT` usando este mismo `POST`. Una vez creada, `source` no se puede cambiar (no está en `updateRecipeInput`).
- **RN-05-09** `searchText` = `normalizeProductName` aplicado a `title`, cada etiqueta y cada nombre de ingrediente, unidos con espacios. El servicio lo recalcula en cada `POST` y en cada `PATCH` que toque esos campos.

### Edición y borrado
- **RN-05-10** `PATCH` es parcial y gana la última escritura. Si incluye `ingredients` o `steps`, **sustituye la lista completa** (borra y vuelve a crear en la misma transacción; los `id` cambian). Si no los incluye, no se tocan.
- **RN-05-11** `isFavorite` es **del hogar** (uno para todo el grupo), no por persona. Se cambia con `PATCH { isFavorite }`.
- **RN-05-12** **Borrado lógico:** `DELETE` pone `deletedAt = now`. Una receta borrada no aparece en `GET /recipes`, `GET /recipes/:id` responde `404` y no se puede planificar (E06) ni añadir a la lista. Las entradas del menú que ya la usaban la siguen mostrando con el aviso "Receta eliminada" (ver spec 06). No hay restauración desde la interfaz.

### Búsqueda y filtros (`GET /recipes`)
- **RN-05-13** Por defecto: recetas con `deletedAt = null`, ordenadas por `id` desc (las más recientes primero), paginadas por cursor.
- **RN-05-14** `q`: se normaliza con `normalizeProductName` y se divide en palabras; la receta coincide si `searchText` contiene **todas** las palabras (`ILIKE '%palabra%'` con AND).
- **RN-05-15** Filtros combinables (AND):
  - `favorite=true` → `isFavorite = true`;
  - `diet=VEGETARIAN` → `suitableDiets` contiene esa dieta (gracias a RN-05-05 una receta vegana también aparece);
  - `allergenFree=GLUTEN,MILK` → `allergens` no contiene ninguno de ellos (las recetas sin alérgenos declarados también aparecen);
  - `maxMinutes=30` → `coalesce(prepMinutes,0) + coalesce(cookMinutes,0) <= 30`, excluyendo las que tienen los dos tiempos a `null`;
  - `difficulty=EASY`;
  - `utensil=horno` → `utensils` contiene ese valor (normalizado);
  - `tag=rápida` → `tags` contiene ese valor (normalizado);
  - `source=MANUAL|AI_FRIDGE|AI_CHAT`.

### Raciones y lista de la compra
- **RN-05-16** **Escalado en la vista** (solo cliente, no se guarda): `scaleQuantity(quantity, from, to) = quantity × to / from`, redondeado a 2 decimales. Las cantidades `null` siguen siendo `null`. El selector va de 1 a 50 y empieza en `recipe.servings`.
- **RN-05-17** **Añadir a la lista** (`POST /recipes/:id/add-to-shopping-list`):
  - entrada: `listId`, `servings` (por defecto `recipe.servings`) e `ingredientIds` (los marcados en la hoja, al menos 1, todos de esa receta; si alguno no lo es: `422`);
  - cada ingrediente se convierte con `ingredientToShoppingLine(ingredient, factor)` (en `shared`), con `factor = servings / recipe.servings`:
    - `quantity` escalada y redondeada a 2 decimales;
    - si la unidad canónica está en `UNITS` de la compra, se conserva; si no (por ejemplo `cda` o `pizca`), la línea va **sin cantidad ni unidad**;
    - si la unidad es `ud` o `null` y hay cantidad, se redondea **hacia arriba** al entero (`1.5` huevos → `2`);
    - `name` = nombre del ingrediente; `note` = `null`; `aisle` no se envía (así `bulkCreate` usa el del `Product` del catálogo si existe, o `OTHER`, según RN-04-07);
  - se llama a `ShoppingItemsService.bulkCreate` (spec 04, RN-04-17), que fusiona con lo que ya hay en la lista;
  - devuelve `{ items: ShoppingItemDto[] }` (los afectados) y emite `shopping.items.bulk_created`.
- **RN-05-18** Los ingredientes con `optional = true` aparecen **desmarcados** por defecto en la hoja de añadir; el resto, marcados.
- **RN-05-19** `RECIPE_UNITS` = `UNITS` de la compra + `['cda','cdta','pizca','diente','taza','vaso','manojo','rodaja','hoja','chorrito']`. `normalizeUnit` (spec 04, RN-04-30) añade los sinónimos: `cucharada(s)` → `cda`, `cucharadita(s)` → `cdta`, `pizcas` → `pizca`, `dientes` → `diente`, `tazas` → `taza`, `vasos` → `vaso`, `manojos` → `manojo`, `rodajas` → `rodaja`, `hojas` → `hoja`, `chorritos` → `chorrito`.
- **RN-05-20** `UTENSILS` (sugerencias, en minúsculas): `horno`, `microondas`, `airfryer`, `thermomix`, `olla exprés`, `olla lenta`, `sartén`, `plancha`, `wok`, `batidora`, `robot de cocina`, `vaporera`.
- **RN-05-21** Etiquetas en la interfaz (en `shared`):
  - `DIFFICULTY_LABELS`: Fácil · Media · Difícil.
  - `DIET_LABELS`: Omnívora · Vegetariana · Vegana · Pescetariana.
  - `ALLERGEN_LABELS`: Gluten · Crustáceos · Huevos · Pescado · Cacahuetes · Soja · Leche · Frutos de cáscara · Apio · Mostaza · Sésamo · Sulfitos · Altramuces · Moluscos.
  - `RECIPE_SOURCE_LABELS`: Manual · IA (nevera) · IA (asistente).

## 4. Modelo de datos

`Recipe`, `RecipeIngredient` y `RecipeStep` de `docs/02-modelo-datos.md` § RECETAS. `Recipe.deletedAt` es borrado lógico. `Recipe.searchText` alimenta la búsqueda (RN-05-09).

## 5. API

Rutas bajo `/api/v1/groups/:groupId`, con `AuthGuard` + `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/recipes.ts`.

### DTO

```ts
recipeIngredientDto = z.object({ id: uuid, position: int, name: z.string(), quantity: decimalString.nullable(),
  unit: z.string().nullable(), note: z.string().nullable(), optional: z.boolean() })
recipeStepDto = z.object({ id: uuid, position: int, text: z.string() })
recipeSummaryDto = z.object({
  id, groupId, title: z.string(), servings: int, prepMinutes: int.nullable(), cookMinutes: int.nullable(),
  totalMinutes: int.nullable(),          // prep + cook si alguno no es null; null si los dos lo son
  difficulty: DifficultyEnum.nullable(), tags: z.array(z.string()), utensils: z.array(z.string()),
  allergens: z.array(AllergenEnum), suitableDiets: z.array(DietEnum), source: RecipeSourceEnum,
  isFavorite: z.boolean(), ingredientCount: int, createdById: uuid.nullable(),
  createdAt: datetime, updatedAt: datetime,
})
recipeDto = recipeSummaryDto.omit({ ingredientCount: true }).extend({
  description: z.string().nullable(), ingredients: z.array(recipeIngredientDto), steps: z.array(recipeStepDto),
})
```

### Entrada

```ts
recipeIngredientInput = z.object({ name: z.string().trim().min(1).max(80), quantity: decimalString.nullable().default(null),
  unit: z.string().trim().min(1).max(20).nullable().default(null), note: z.string().trim().max(120).nullable().default(null),
  optional: z.boolean().default(false) })
createRecipeInput = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).nullable().default(null),
  servings: z.number().int().min(1).max(50).default(4),
  prepMinutes: z.number().int().min(0).max(1440).nullable().default(null),
  cookMinutes: z.number().int().min(0).max(1440).nullable().default(null),
  difficulty: DifficultyEnum.nullable().default(null),
  tags: z.array(z.string()).max(10).default([]), utensils: z.array(z.string()).max(15).default([]),
  allergens: z.array(AllergenEnum).default([]), suitableDiets: z.array(DietEnum).default([]),
  source: RecipeSourceEnum.default('MANUAL'), isFavorite: z.boolean().default(false),
  ingredients: z.array(recipeIngredientInput).min(1).max(60),
  steps: z.array(z.object({ text: z.string().trim().min(1).max(2000) })).min(1).max(50),
})
updateRecipeInput = createRecipeInput.omit({ source: true }).partial().refine(alguno presente)
recipesQuery = z.object({
  q: z.string().trim().max(60).optional(), favorite: z.coerce.boolean().optional(), diet: DietEnum.optional(),
  allergenFree: csv(AllergenEnum).optional(), maxMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  difficulty: DifficultyEnum.optional(), utensil: z.string().max(30).optional(), tag: z.string().max(30).optional(),
  source: RecipeSourceEnum.optional(), cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
addRecipeToShoppingListInput = z.object({ listId: uuid, servings: z.number().int().min(1).max(50).optional(),
  ingredientIds: z.array(uuid).min(1).max(60) })
```

### Endpoints

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/recipes` | `recipesQuery` | `{ items: recipeSummaryDto[], nextCursor: string \| null }` | 422 |
| POST | `/recipes` | `createRecipeInput` | `201 recipeDto` | 422 |
| GET | `/recipes/:id` | — | `recipeDto` | 404 (no existe, otro grupo o borrada) |
| PATCH | `/recipes/:id` | `updateRecipeInput` | `recipeDto` | 404, 422 |
| DELETE | `/recipes/:id` | — | `204` (borrado lógico) | 404 |
| POST | `/recipes/:id/add-to-shopping-list` | `addRecipeToShoppingListInput` | `{ items: ShoppingItemDto[] }` | 404 (receta o lista), 422 |

### Servicio reutilizable

`RecipesService` expone `create(ctx, input)` (lo usan E13 con `source: 'AI_FRIDGE'` y E14 con `source: 'AI_CHAT'`), `findOne(groupId, id)` y `search(groupId, query)` (mismos filtros que `recipesQuery`; lo usan E06 y E14). Ninguna otra épica escribe en `recipes` directamente.

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `recipe.created` | `POST /recipes` (también desde E13 y E14) | `RecipeDto` |
| `recipe.updated` | `PATCH /recipes/:id` (incluida la favorita) | `RecipeDto` |
| `recipe.deleted` | `DELETE /recipes/:id` | `{ id }` |
| `shopping.items.bulk_created` | `add-to-shopping-list` (lo emite `bulkCreate`) | `{ listId, items }` |
| `activity.created` | Ver §9 | `ActivityDto` |

Cliente (`apps/web/src/features/recipes/realtime.ts`): en `recipe.created/updated` → `setQueryData(['group', g, 'recipe', id], dto)` e `invalidateQueries(['group', g, 'recipes'])`; en `recipe.deleted` → `removeQueries` del detalle e invalidar la lista; además, en `recipe.updated` y `recipe.deleted`, invalidar `['group', g, 'meal-plan']` (el menú incrusta un resumen de la receta). Si el usuario está viendo una receta que otro borra: "Esta receta se ha eliminado" + "Volver al recetario".

## 7. Pantallas y UX

Rutas (docs/08): `/g/:groupId/recetas`, `/g/:groupId/recetas/nueva` (se declara antes de `:id`), `/g/:groupId/recetas/:id` y `/g/:groupId/recetas/:id/editar`. Componentes de DESIGN.md: `DepthFigure` para raciones y minutos, `LaneRope` como separador entre ingredientes y pasos, `ripple` para cambios remotos.

### 7.1 Recetario — `/g/:groupId/recetas` (`RecipesPage`)
- Título **"Recetas"**. Buscador con placeholder **"Buscar receta, ingrediente o etiqueta"** (con *debounce* de 300 ms; el texto va en `?q=` de la URL).
- Fila de chips de filtro: **"Favoritas"**, **"Dieta"** (Vegetariana, Pescetariana, Vegana), **"Sin…"** (multiselección de alérgenos), **"Tiempo"** (≤ 15, ≤ 30, ≤ 60 min), **"Dificultad"**, **"Utensilio"**. Los filtros activos se reflejan en la URL y hay un botón "Quitar filtros".
- Tarjeta de receta: título, `totalMinutes` ("25 min"), dificultad, chip de la dieta más restrictiva, estrella de favorita (botón con `aria-label="Marcar como favorita"` / "Quitar de favoritas"; un toque, optimista) y la etiqueta "IA" si `source ≠ MANUAL`.
- Botón principal: **"Nueva receta"** → `/recetas/nueva`.
- Scroll infinito con `nextCursor`.
- Estados: *cargando* = 4 tarjetas *skeleton*; *vacío sin filtros* = "Aún no hay recetas" + "Escribe la primera o pide ideas a ¿Qué cocino?" con botones "Nueva receta" y "¿Qué cocino?" (→ `/nevera`); *vacío con filtros* = "Ninguna receta coincide" + "Quitar filtros"; *error* = "No se pudieron cargar las recetas" + "Reintentar"; *sin conexión* = banner y botones de crear y favorita deshabilitados.

### 7.2 Detalle — `/g/:groupId/recetas/:id` (`RecipeDetailPage`)
- Título, descripción, chips (dificultad, dieta más restrictiva, utensilios, etiquetas), "Contiene: Gluten, Huevos" si hay alérgenos, y "Propuesta por la IA" si `source ≠ MANUAL`.
- `DepthFigure` de tiempos: "Preparación 10 min · Cocción 20 min".
- **Selector de raciones** (− `DepthFigure` +, rótulo "raciones", 1–50). Al cambiarlo se recalculan las cantidades (RN-05-16) y se muestra "Original: 4 raciones" con un enlace "Restablecer".
- **Ingredientes**: `formatQuantity` + unidad + nombre + nota; los opcionales con la etiqueta "(opcional)".
- **Pasos** numerados.
- Barra de acciones: **"Añadir a la lista"**, **"Planificar"** (abre la hoja de entrada de menú de E06 con la receta ya elegida; hasta que exista E06, el botón no se muestra), favorita, menú (⋯) con "Editar" y "Borrar".
- Borrar: confirmación "¿Borrar la receta Lentejas? Si está en el menú, seguirá apareciendo como receta eliminada." [Cancelar] [Borrar] → vuelve al recetario con el toast "Receta borrada".
- Estados: *cargando* = *skeleton*; *404* = "Esta receta no existe o se ha eliminado" + "Volver al recetario"; *error* = "Reintentar"; *sin conexión* = acciones de edición deshabilitadas (las raciones sí se pueden cambiar).

### 7.3 Hoja "Añadir a la lista" (`AddRecipeToListSheet`)
- Título "Añadir ingredientes a la lista". Selector **"Lista"** (por defecto la de `position` 0). Selector **"Raciones"** (empieza en el valor del detalle).
- Lista de ingredientes con casillas (RN-05-18), cada uno con la cantidad escalada tal como irá a la lista. Atajos "Todos" y "Ninguno".
- Botón **"Añadir N productos a Mercadona"** (deshabilitado con 0). Al terminar: toast "Añadidos 6 productos a Mercadona" con el enlace "Ver lista".

### 7.4 Formulario — `/recetas/nueva` y `/recetas/:id/editar` (`RecipeFormPage`)
- Campos en este orden: "Título" *, "Descripción", "Raciones" * (stepper), "Preparación (min)", "Cocción (min)", "Dificultad" (segmentado Fácil/Media/Difícil/—).
- **Ingredientes**: filas con "Cantidad", "Unidad" (combobox con `RECIPE_UNITS` y texto libre), "Ingrediente" *, "Nota" y la casilla "Opcional"; botones "Añadir ingrediente", "Quitar" y subir/bajar (orden = posición). La última fila vacía se ignora al guardar.
- **Pasos**: áreas de texto numeradas con "Añadir paso", "Quitar" y subir/bajar.
- **Alérgenos**: los 14 como chips conmutables. **Apta para**: Vegetariana, Pescetariana y Vegana como chips (aplica RN-05-05 en la vista previa: marcar Vegana marca las demás). **Utensilios**: chips de `UTENSILS` + "Otro…". **Etiquetas**: campo de chips (Intro añade).
- Botones **"Guardar"** y "Cancelar". Si hay cambios sin guardar, al salir: "¿Descartar los cambios?".
- Validación en línea con los mensajes de zod en español ("Añade al menos un ingrediente", "Añade al menos un paso", "El título es obligatorio").
- Si otro miembro guarda la misma receta mientras se edita (llega `recipe.updated`): aviso no bloqueante "Ana acaba de cambiar esta receta. Si guardas, se sobrescribirán sus cambios." (gana la última escritura).

## 8. Permisos

Sin roles: **cualquier miembro** ve, crea, edita, marca como favorita, borra y añade a la lista cualquier receta del grupo. Fuera del grupo: `404`. Sin sesión: `401`.

## 9. Actividad

`entityType = recipe`, escrito con `ActivityService.record(tx, …)` dentro de la transacción.

| Acción | `action` | `summary` |
|---|---|---|
| Crear (`MANUAL`) | `created` | `creó la receta Lentejas` |
| Crear (`AI_FRIDGE` o `AI_CHAT`) | `created` | `guardó la receta Tortilla de patatas propuesta por la IA` |
| Editar | `updated` | `editó la receta Lentejas` |
| Marcar favorita | `updated` | `marcó Lentejas como favorita` |
| Quitar favorita | — | *(sin actividad)* |
| Borrar | `deleted` | `borró la receta Lentejas` |
| Añadir a la lista | `created` (`entityType = shopping_list`, vía `bulkCreate`) | `añadió 6 ingredientes de Lentejas a Mercadona` |

## 10. Casos límite

- Receta con todas las cantidades `null` → el escalado no cambia nada y la hoja de añadir crea líneas sin cantidad.
- Unidad desconocida ("puñado") → se guarda "puñado"; en la lista va sin cantidad ni unidad.
- `servings` de la receta = 1 y se escala a 50 → factor 50; las cantidades se redondean a 2 decimales y deben caber en `Decimal(10,2)` (si una supera 99 999 999,99, se guarda sin cantidad).
- Dos miembros editan la misma receta → gana la última escritura; el otro ve el aviso de §7.4.
- Se borra una receta que está en el menú → la entrada muestra "Receta eliminada" (spec 06) y no se pueden enviar sus ingredientes.
- Búsqueda con acentos ("Pure de patata" encuentra "Puré de patatas") gracias a `searchText` normalizado.
- `ingredientIds` de otra receta → `422`.
- La lista destino es de otro grupo → `404`.
- Receta creada por la IA con `utensils` o `tags` fuera de rango → la IA (E13/E14) debe recortar antes de llamar; si no, `422`.

## 11. Tests

**Unitarios (`shared`):** `expandSuitableDiets`, `scaleQuantity`, `ingredientToShoppingLine` (unidades de compra, de receta, `ud` hacia arriba, `null`), normalización de etiquetas, `normalizeUnit` con `RECIPE_UNITS`, esquemas zod (mínimos de ingredientes y pasos).

**Integración (`apps/api/test/recipes/*.int.spec.ts`):** autorización (404 en otro grupo, 401 sin sesión); `POST` con ingredientes y pasos ordenados; `PATCH` que sustituye ingredientes; borrado lógico (404 después y fuera de la lista); `q` sin acentos, AND de palabras; cada filtro de RN-05-15 (incluida la implicación de dietas y `allergenFree`); `add-to-shopping-list` escala, fusiona con la lista y emite `shopping.items.bulk_created`; eventos `recipe.*` y `ActivityLog`.

**Componentes (web):** formulario (añadir y quitar filas, validación, Vegana marca las demás), selector de raciones, hoja de añadir a la lista, estados vacío y error del recetario.

**E2E:** **E2E-08** (parte de recetas): crear la receta "Lentejas" con 3 ingredientes y 2 pasos desde el formulario; el resto del flujo está en la spec 06.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `Recipe.searchText` → `docs/02`.
- Comentario de `Recipe.suitableDiets` expandida → `docs/02`.
- Rutas `/recetas/nueva` y `/recetas/:id/editar` → `docs/08`.
- Constantes `RECIPE_UNITS` y `UTENSILS` → `docs/01` (paquete compartido).

## 13. Fuera de alcance

- Importar recetas desde URL y fotos de recetas (docs/00).
- Información nutricional y calorías.
- Favoritas por persona, valoraciones y comentarios.
- Detección automática de alérgenos a partir de los ingredientes.
- Modo cocina a pantalla completa con temporizadores.
- Restaurar recetas borradas desde la interfaz.
- Ordenar el recetario alfabéticamente (solo por recientes).
