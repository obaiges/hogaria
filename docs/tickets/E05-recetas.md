# E05 · Recetas

> Spec: `docs/specs/05-recetas.md` · Rango: HOG-250 – HOG-299 · Fase: 3
> HOG-251 (`RecipesService.create`) es el endpoint que usan E13 (`source: AI_FRIDGE`) y E14 (`source: AI_CHAT`) para guardar recetas.

---

### HOG-250 · Añadir constantes, utilidades y esquemas zod de recetas a shared

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** shared
- **Depende de:** HOG-200
- **Spec:** `docs/specs/05-recetas.md#3-reglas-de-negocio` (RN-05-05, RN-05-16, RN-05-17, RN-05-19 a RN-05-21) · `#5-api`

**Descripción**
Todo lo compartido del recetario: constantes y etiquetas, la expansión de dietas compatibles, el escalado de raciones, la conversión de un ingrediente en línea de la lista de la compra y los esquemas de la API.

**Criterios de aceptación**
- [ ] `RECIPE_UNITS`, `UTENSILS`, `DIFFICULTY_LABELS` y `RECIPE_SOURCE_LABELS` con los valores de RN-05-19 a RN-05-21; se comprueba que `ALLERGEN_LABELS` y `DIET_LABELS` de HOG-002 coinciden con RN-05-21 (si no, se corrigen).
- [ ] `normalizeUnit` (HOG-200) reconoce los sinónimos de unidades de receta de RN-05-19.
- [ ] `expandSuitableDiets(diets)` cumple los ejemplos de RN-05-05 y `mostRestrictiveDiet(diets)` devuelve la dieta que se muestra como chip (o `null`).
- [ ] `scaleQuantity(q, from, to)` (RN-05-16) e `ingredientToShoppingLine(ingredient, factor, { roundUnits })` (RN-05-17: unidades fuera de `UNITS` sin cantidad; `ud`/`null` hacia arriba si `roundUnits` es `true`).
- [ ] `normalizeTagList(list, max)` para etiquetas y utensilios (RN-05-02, RN-05-03).
- [ ] `packages/shared/src/schemas/recipes.ts` con todos los esquemas de §5 (`recipeDto`, `recipeSummaryDto`, `recipeIngredientDto`, `recipeStepDto`, `createRecipeInput`, `updateRecipeInput`, `recipesQuery`, `addRecipeToShoppingListInput`) y los tipos de `recipe.*` en `RealtimeEventDataMap`.
- [ ] Mensajes zod en español ("Añade al menos un ingrediente", "Añade al menos un paso", "El título es obligatorio").

**Notas técnicas**
- Archivos: `packages/shared/src/recipes/{constants.ts, diets.ts, scale.ts, to-shopping-line.ts}` y `packages/shared/src/schemas/recipes.ts`.
- `allergenFree` en la query es una lista separada por comas: helper `csvEnum(AllergenEnum)`.

**Tests**
- Unit: `diets.spec.ts`, `scale.spec.ts` (redondeo a 2 decimales, `null`), `to-shopping-line.spec.ts` (`kg` se conserva, `cda` sin cantidad, `1.5 ud` → `2`), `schemas/recipes.spec.ts`.
- Integración: —
- E2E: —

---

### HOG-251 · Crear y consultar recetas en la API

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-250, HOG-004, HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/05-recetas.md#validación-y-normalización` (RN-05-01 a RN-05-09) · `docs/02-modelo-datos.md#recipe`

**Descripción**
`POST /recipes` y `GET /recipes/:id` con ingredientes y pasos ordenados, normalización de etiquetas, utensilios, unidades y dietas, el campo `searchText` y `RecipesService.create`/`findOne` reutilizables.

**Criterios de aceptación**
- [ ] `Recipe.searchText String @default("")` ya está en `docs/02-modelo-datos.md` y en el esquema inicial (HOG-004); si la BBDD se creó antes de ese cambio, este ticket añade la migración.
- [ ] `POST` crea receta, ingredientes y pasos en una transacción, con `position` = índice, `suitableDiets` expandida, unidades normalizadas y `searchText` calculado (RN-05-09); responde `201 recipeDto`.
- [ ] `source` admite `MANUAL`, `AI_FRIDGE` y `AI_CHAT`; la actividad usa el texto de §9 según el origen.
- [ ] `GET /recipes/:id` devuelve `recipeDto` con ingredientes y pasos ordenados; borrada, inexistente o de otro grupo → `404`.
- [ ] `RecipesService.create(ctx, input)` y `findOne(groupId, id)` exportados desde `RecipesModule`.
- [ ] Evento `recipe.created` tras el commit.

**Notas técnicas**
- Archivos: `apps/api/src/modules/recipes/{recipes.module.ts, recipes.controller.ts, recipes.service.ts, recipe.mapper.ts}`.
- `totalMinutes` se calcula en el *mapper*.

**Tests**
- Unit: `recipes.service.spec.ts` (cálculo de `searchText`, normalizaciones).
- Integración: `apps/api/test/recipes/create.int.spec.ts` (201 con orden, 422 sin ingredientes o sin pasos, `source` de IA, 404 de otro grupo, 401, evento y actividad).
- E2E: —

---

### HOG-252 · Editar, marcar como favorita y borrar recetas en la API

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-251
- **Spec:** `docs/specs/05-recetas.md#edición-y-borrado` (RN-05-10 a RN-05-12)

**Descripción**
`PATCH /recipes/:id` parcial (con sustitución completa de ingredientes o pasos si vienen) y `DELETE` con borrado lógico.

**Criterios de aceptación**
- [ ] `PATCH` actualiza solo los campos enviados; si trae `ingredients` o `steps`, borra y recrea esa lista en la misma transacción; recalcula `searchText` si cambian título, etiquetas o ingredientes.
- [ ] `source` no se puede cambiar (el esquema lo rechaza).
- [ ] `isFavorite` true → actividad "marcó Lentejas como favorita"; false → sin actividad; cualquier otro cambio → "editó la receta Lentejas".
- [ ] `DELETE` pone `deletedAt`, emite `recipe.deleted { id }` y registra la actividad; después, `GET`/`PATCH`/`DELETE` → `404`.
- [ ] `PATCH` emite `recipe.updated` con el `recipeDto` completo.

**Notas técnicas**
- Mismos archivos que HOG-251.

**Tests**
- Integración: `apps/api/test/recipes/update-delete.int.spec.ts` (sustituir ingredientes cambia sus `id`, parcial no toca pasos, favorita, borrado lógico y 404 posteriores, 404 de otro grupo).
- E2E: —

---

### HOG-253 · Buscar y filtrar recetas con paginación por cursor

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-251
- **Spec:** `docs/specs/05-recetas.md#búsqueda-y-filtros-get-recipes` (RN-05-13 a RN-05-15)

**Descripción**
`GET /recipes` con búsqueda sin acentos sobre `searchText`, los filtros combinables de la spec y `RecipesService.search` reutilizable (E06 y E14).

**Criterios de aceptación**
- [ ] Sin parámetros: no borradas, por `id` desc, `{ items: recipeSummaryDto[], nextCursor }` con `ingredientCount`.
- [ ] `q` normalizado y dividido en palabras con AND sobre `searchText`.
- [ ] Filtros `favorite`, `diet`, `allergenFree`, `maxMinutes`, `difficulty`, `utensil`, `tag` y `source` exactamente como RN-05-15 (incluido que `maxMinutes` excluye recetas sin tiempos).
- [ ] `RecipesService.search(groupId, query)` exportado.
- [ ] Una consulta para la página (con `_count` de ingredientes).

**Notas técnicas**
- Arrays de Postgres: `has`, `hasSome` y `NOT hasSome` de Prisma para `suitableDiets`, `allergens`, `tags` y `utensils`.
- `maxMinutes`: `$queryRaw` o filtro con `OR` sobre los casos de `null`; documentar la elección en el código.

**Tests**
- Integración: `apps/api/test/recipes/search.int.spec.ts` (acentos: "pure de patata" encuentra "Puré de patatas"; AND de palabras; cada filtro; vegana aparece con `diet=VEGETARIAN`; paginación con 70 recetas).
- E2E: —

---

### HOG-254 · Añadir los ingredientes de una receta a la lista de la compra (API)

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-251, HOG-203
- **Spec:** `docs/specs/05-recetas.md#raciones-y-lista-de-la-compra` (RN-05-17, RN-05-18)

**Descripción**
`POST /recipes/:id/add-to-shopping-list` escala los ingredientes elegidos a las raciones pedidas y los añade con `ShoppingItemsService.bulkCreate`.

**Criterios de aceptación**
- [ ] `ingredientIds` deben pertenecer a la receta (si no, `422`); lista de otro grupo o inexistente → `404`; receta borrada → `404`.
- [ ] Usa `ingredientToShoppingLine(…, factor, { roundUnits: true })` con `factor = servings / recipe.servings` (`servings` por defecto = el de la receta).
- [ ] Devuelve `{ items }` (afectados) y emite `shopping.items.bulk_created` con la actividad "añadió 6 ingredientes de Lentejas a Mercadona".

**Notas técnicas**
- Endpoint en `recipes.controller.ts`; el `RecipesModule` importa `ShoppingModule`.

**Tests**
- Integración: `apps/api/test/recipes/add-to-list.int.spec.ts` (escalado 4 → 2, `cda` sin cantidad, fusión con un item existente, `ingredientIds` ajeno → 422).
- E2E: —

---

### HOG-255 · Crear los hooks de datos y el tiempo real de recetas en la web

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-250, HOG-006, HOG-152
- **Spec:** `docs/specs/05-recetas.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks de TanStack Query del recetario y manejadores de `recipe.*`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/recipes/api.ts` con `useRecipes(filters)` (infinita, clave `['group', g, 'recipes', filters]`), `useRecipe(id)`, `useCreateRecipe`, `useUpdateRecipe`, `useToggleFavorite` (optimista), `useDeleteRecipe` y `useAddRecipeToShoppingList`.
- [ ] `realtime.ts` aplica §6: detalle con `setQueryData`, listas invalidadas, `meal-plan` invalidado en `updated`/`deleted`, y onda en las tarjetas (`recipe:<id>`).
- [ ] Hook `useRecipeFiltersFromUrl()` que lee y escribe los filtros en la query string.

**Notas técnicas**
- Registrar los manejadores en `apps/web/src/lib/realtime/handlers.ts`.

**Tests**
- Unit: manejadores de `realtime.ts` y `useRecipeFiltersFromUrl` (ida y vuelta de la URL).
- E2E: —

---

### HOG-256 · Construir el recetario con búsqueda, filtros y favoritas

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-255, HOG-750, HOG-008, HOG-009
- **Spec:** `docs/specs/05-recetas.md#71-recetario--grecetas-recipespage`

**Descripción**
`/g/:groupId/recetas` con buscador, chips de filtros, tarjetas con favorita de un toque y scroll infinito.

**Criterios de aceptación**
- [ ] Buscador con placeholder "Buscar receta, ingrediente o etiqueta" y *debounce* de 300 ms; filtros de §7.1 en la URL y "Quitar filtros".
- [ ] Tarjeta con título, `totalMinutes`, dificultad, chip de la dieta más restrictiva, estrella de favorita (optimista, con `aria-label`) y etiqueta "IA" si `source ≠ MANUAL`.
- [ ] Botón "Nueva receta" → `/recetas/nueva`.
- [ ] Estados: cargando, vacío sin filtros (con "Nueva receta" y "¿Qué cocino?"), vacío con filtros, error y sin conexión.
- [ ] 375 px y modo oscuro.

**Notas técnicas**
- `apps/web/src/features/recipes/pages/RecipesPage.tsx`, `components/{RecipeCard.tsx, RecipeFilters.tsx}`.
- Sustituye el `ComingSoonPage` de la ruta de recetas de HOG-750.

**Tests**
- Unit: `RecipesPage.spec.tsx` con MSW (búsqueda en la URL, filtros, vacíos, favorita optimista con *rollback*).
- E2E: —

---

### HOG-257 · Construir el detalle de receta con raciones escalables

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-255, HOG-009
- **Spec:** `docs/specs/05-recetas.md#72-detalle--grecetasid-recipedetailpage`

**Descripción**
`/g/:groupId/recetas/:id` con datos, selector de raciones que recalcula las cantidades, ingredientes, pasos, favorita, editar y borrar.

**Criterios de aceptación**
- [ ] Selector de raciones 1–50 con `DepthFigure`; recalcula con `scaleQuantity` y muestra "Original: 4 raciones" + "Restablecer".
- [ ] Ingredientes con `formatQuantity`, nota y "(opcional)"; pasos numerados.
- [ ] Chips, "Contiene: …" y "Propuesta por la IA" según §7.2.
- [ ] Menú con "Editar" (→ `/recetas/:id/editar`) y "Borrar" (confirmación de §7.2, toast "Receta borrada" y vuelta al recetario).
- [ ] Botón "Añadir a la lista" (abre la hoja de HOG-259). El botón "Planificar" solo se muestra si existe la hoja de E06 (lo conecta HOG-308).
- [ ] Estados: cargando, 404 (también al recibir `recipe.deleted`), error y sin conexión (raciones siguen activas).

**Notas técnicas**
- `apps/web/src/features/recipes/pages/RecipeDetailPage.tsx`, `components/{ServingsStepper.tsx, IngredientList.tsx, StepList.tsx}`.

**Tests**
- Unit: `RecipeDetailPage.spec.tsx` (escalado 4 → 6, restablecer, 404).
- E2E: —

---

### HOG-258 · Construir el formulario de crear y editar receta

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-255
- **Spec:** `docs/specs/05-recetas.md#74-formulario--recetasnueva-y-recetasideditar-recipeformpage` · `docs/08-convenciones.md`

**Descripción**
Rutas `/g/:groupId/recetas/nueva` y `/g/:groupId/recetas/:id/editar` con filas dinámicas de ingredientes y pasos, alérgenos, dietas, utensilios y etiquetas.

**Criterios de aceptación**
- [ ] Rutas añadidas al router (`nueva` antes de `:id`), como fija `docs/08-convenciones.md`.
- [ ] Campos en el orden de §7.4; ingredientes y pasos con añadir, quitar y subir/bajar; la última fila vacía se ignora.
- [ ] Unidad como combobox con `RECIPE_UNITS` y texto libre; utensilios con `UTENSILS` + "Otro…"; etiquetas como chips.
- [ ] Marcar "Vegana" marca también Vegetariana y Pescetariana en la vista (RN-05-05).
- [ ] Validación en línea con los mensajes en español de zod; "¿Descartar los cambios?" al salir con cambios.
- [ ] Al editar, si llega `recipe.updated` de otro miembro: aviso no bloqueante de §7.4.
- [ ] Al guardar → navega al detalle con el toast "Receta guardada".

**Notas técnicas**
- `apps/web/src/features/recipes/pages/RecipeFormPage.tsx`, `components/{IngredientFields.tsx, StepFields.tsx, AllergenPicker.tsx, DietPicker.tsx, ChipInput.tsx}` con React Hook Form (`useFieldArray`) + `createRecipeInput`.
- `AllergenPicker` y `ChipInput` se reutilizan en la dieta de E06 (HOG-312): exportarlos desde `components/`.

**Tests**
- Unit: `RecipeFormPage.spec.tsx` (crear con 3 ingredientes y 2 pasos, quitar y reordenar, errores, implicación de dietas, edición con datos cargados).
- E2E: primer tramo de E2E-08 (HOG-313).

---

### HOG-259 · Crear la hoja "Añadir a la lista" desde una receta

- **Épica:** E05 · **Fase:** 3 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-257, HOG-254, HOG-209
- **Spec:** `docs/specs/05-recetas.md#73-hoja-añadir-a-la-lista-addrecipetolistsheet`

**Descripción**
Hoja para elegir lista, raciones e ingredientes y añadirlos a la compra.

**Criterios de aceptación**
- [ ] Selector de lista (por defecto la de `position` 0, con `useShoppingLists` de HOG-209) y de raciones (empieza en el valor del detalle).
- [ ] Casillas de ingredientes con opcionales desmarcados (RN-05-18), atajos "Todos"/"Ninguno" y cantidad escalada tal como irá a la lista (`ingredientToShoppingLine`).
- [ ] Botón "Añadir N productos a {lista}" deshabilitado con 0; al terminar, toast "Añadidos N productos a {lista}" con "Ver lista".
- [ ] Sin conexión: botón deshabilitado.

**Notas técnicas**
- `apps/web/src/features/recipes/components/AddRecipeToListSheet.tsx`.

**Tests**
- Unit: `AddRecipeToListSheet.spec.tsx` (opcionales desmarcados, escalado, cuerpo de la petición con `ingredientIds`).
- E2E: —
