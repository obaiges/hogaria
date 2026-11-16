# 06 · Planificador de comidas y dietas

> Épica: E06 · Tickets: `docs/tickets/E06-comidas.md` (HOG-300 – HOG-349) · Modelo: `docs/02-modelo-datos.md` § COMIDAS Y DIETA (`MealPlanEntry`, `DietProfile`, enum `MealSlot`) y § RECETAS (`Diet`, `Allergen`) · API: `docs/04-api-y-tiempo-real.md` (filas "Comidas" y "Yo") · Fase 3

## 1. Objetivo

Que el hogar organice qué come cada día de la semana en 5 franjas, con recetas del recetario o con texto libre, para todos o solo para algunos miembros. Cada persona declara su dieta, sus alergias y lo que no le gusta, y el menú avisa cuando una receta planificada choca con alguno de los comensales. Con un toque se copian semanas y se mandan a la lista de la compra los ingredientes de varios días, ya sumados.

## 2. Historias de usuario

- **US-06-01** Como miembro, quiero ver el menú de la semana (lunes a domingo) con las 5 franjas de cada día.
- **US-06-02** Como miembro, quiero añadir a una franja una receta del recetario o un texto libre ("Sobras", "Cena fuera"), y poder poner varias entradas en la misma franja.
- **US-06-03** Como miembro, quiero indicar para quién es cada comida (todos o miembros concretos) y cuántas raciones.
- **US-06-04** Como miembro, quiero mover, editar o quitar una comida planificada.
- **US-06-05** Como miembro, quiero copiar el menú de una semana a otra.
- **US-06-06** Como miembro, quiero enviar a una lista de la compra los ingredientes de las recetas de un rango de días, con las cantidades iguales sumadas, revisando antes qué se va a añadir.
- **US-06-07** Como persona, quiero rellenar mi perfil de dieta (dieta, alérgenos, otras restricciones y lo que no me gusta), que solo yo puedo editar y que ven los miembros de mis hogares.
- **US-06-08** Como miembro, quiero ver un aviso cuando una receta del menú contiene un alérgeno de un comensal, no es apta para su dieta o lleva algo que no le gusta.
- **US-06-09** Como miembro, quiero consultar las dietas de todo el hogar desde el planificador.

## 3. Reglas de negocio

### Menú (`MealPlanEntry`)
- **RN-06-01** Una entrada tiene `date` (día `YYYY-MM-DD` en la zona del grupo), `slot` (`MealSlot`) y **exactamente uno** de `recipeId` o `title`. Si llegan los dos o ninguno: `422` con el mensaje "Elige una receta o escribe qué se come".
- **RN-06-02** `title` (texto libre): `trim`, 1–80 caracteres. `note`: como mucho 200 caracteres. `servings`: entero 1–50 o `null`.
- **RN-06-03** `recipeId` debe ser una receta del grupo **no borrada**; si no: `404 NOT_FOUND`. Al cambiar de receta a texto libre (`PATCH { recipeId: null, title: "Sobras" }`) se aplica RN-06-01 sobre el estado resultante.
- **RN-06-04** `forUserIds`: array de `userId` sin duplicados (máximo 20) que deben ser **miembros actuales** del grupo; si no: `422` "Alguno de los comensales no es miembro del hogar". Vacío = **todo el grupo** (los miembros de cada momento).
- **RN-06-05** **Raciones por defecto:** si `servings` es `null`, se usa para el cálculo de ingredientes el número de **comensales efectivos** (RN-06-06) y, si es receta y no hay comensales efectivos, `recipe.servings`. La interfaz muestra ese valor como sugerencia al crear y lo envía explícitamente (`servings` siempre informado desde la web).
- **RN-06-06** **Comensales efectivos** de una entrada = `forUserIds` filtrado a los miembros actuales; si `forUserIds` está vacío, todos los miembros actuales. (El filtro es defensivo: RN-06-30 ya limpia `forUserIds` cuando alguien sale.)
- **RN-06-30** **Un miembro sale o es expulsado:** esta épica registra un manejador en `MemberRemovedHooks` (spec 02, RN-02-22) — `onMemberRemoved(tx, { groupId, userId })`, en `apps/api/src/modules/meals/meals.member-removed.ts` — que, dentro de la transacción de salida, quita `userId` de `forUserIds` de todas las entradas del grupo y **borra** las entradas que se queden con `forUserIds` vacío habiendo tenido solo a esa persona (si no, pasarían a ser "para todos"). No emite eventos ni actividad: los clientes invalidan `['group', g, 'meal-plan']` al recibir `group.member.left`.
- **RN-06-07** Varias entradas por franja, con un máximo de 10 por `(date, slot)`; la undécima da `422` "Esta franja ya tiene 10 comidas".
- **RN-06-08** Orden dentro de una franja: `createdAt` ascendente. Orden de franjas: `BREAKFAST`, `MID_MORNING`, `LUNCH`, `SNACK`, `DINNER` (`MEAL_SLOTS` en `shared`). Etiquetas (`MEAL_SLOT_LABELS`): Desayuno · Media mañana · Comida · Merienda · Cena.
- **RN-06-09** `PATCH` es parcial y gana la última escritura; mover = cambiar `date` y/o `slot`.
- **RN-06-10** `GET /meal-plan?from&to`: `from` y `to` obligatorios (`YYYY-MM-DD`), `to >= from` y como mucho 42 días de rango; si no: `422`. Devuelve todas las entradas del rango (sin paginar) ordenadas por `date`, franja y `createdAt`, cada una con un resumen de su receta (incluidas las borradas, con `deletedAt`).
- **RN-06-11** **La semana empieza el lunes** (ISO 8601). Las utilidades `startOfWeekLocal(date, tz)` y `weekDays(weekStart)` viven en `shared` (`lib/dates` de la web las reexporta).

### Copiar semana
- **RN-06-12** `POST /meal-plan/copy-week { fromWeekStart, toWeekStart, mode }`: las dos fechas deben ser **lunes** y distintas (si no: `422`). Se copia cada entrada de la semana origen al mismo día de la semana y la misma franja de la semana destino (`date + (toWeekStart − fromWeekStart)`), conservando `recipeId`, `title`, `servings`, `note` y `forUserIds` (filtrados a los miembros actuales; si se quedan vacíos tras filtrar y no lo estaban, la entrada se copia con `forUserIds = []`).
- **RN-06-13** Las entradas cuya receta está borrada **no** se copian.
- **RN-06-14** `mode = "append"` añade a lo que ya haya en la semana destino (respetando el máximo de RN-06-07: las que no caben no se copian y se informa en `skipped`); `mode = "replace"` borra antes todas las entradas de la semana destino.
- **RN-06-15** Si la semana origen no tiene entradas copiables: `422` "La semana de origen no tiene comidas".
- **RN-06-16** Todo ocurre en una transacción; tras el commit se emite `meal.deleted` por cada entrada borrada y `meal.created` por cada entrada creada, y se registra **una sola** actividad.

### Ingredientes a la lista de la compra
- **RN-06-17** `POST /meal-plan/add-to-shopping-list { from, to, listId, dryRun, keys? }` (rango de como mucho 31 días):
  1. Toma las entradas del rango con `recipeId` cuya receta **no** esté borrada (las de texto libre se ignoran).
  2. Para cada entrada, `factor = (entry.servings ?? raciones por defecto de RN-06-05) / recipe.servings`.
  3. Para cada ingrediente **no opcional**, calcula la línea con `ingredientToShoppingLine(ingredient, factor)` (spec 05, RN-05-17), **pero sin redondear todavía** las unidades `ud`.
  4. **Agrega** las líneas con la misma clave `key = normalizeProductName(name) + "|" + (unit ?? "")` sumando con `mergeQuantities`. El nombre visible es el de la primera aparición y `recipeTitles` acumula los títulos de receta sin repetir.
  5. Tras agregar, redondea hacia arriba al entero las cantidades con unidad `ud` o `null`.
  6. Ordena las líneas por nombre (`localeCompare` con `es`).
- **RN-06-18** Con `dryRun = true` no escribe nada y devuelve `{ lines, items: [] }`. Con `dryRun = false` añade con `ShoppingItemsService.bulkCreate` las líneas cuya `key` esté en `keys` (o todas si `keys` no se envía) y devuelve `{ lines, items }`. Las líneas se fusionan con lo que ya hubiera en la lista según la spec 04 (RN-04-08).
- **RN-06-19** Si no hay ninguna línea: `200 { lines: [], items: [] }` y la interfaz muestra "No hay recetas planificadas en estas fechas".

### Perfil de dieta (`DietProfile`)
- **RN-06-20** Cada usuario tiene como mucho un `DietProfile` (personal, no de grupo). `GET /me/diet-profile` devuelve el guardado o, si no existe, uno **por defecto** sin crearlo: `diet = OMNIVORE`, arrays vacíos, `notes = null`, `updatedAt = null`.
- **RN-06-21** `PUT /me/diet-profile` hace *upsert* con el documento completo. `otherRestrictions` y `dislikes`: como mucho 20 elementos cada uno, cada elemento con `trim` y 1–40 caracteres, sin duplicados (comparando con `normalizeProductName`). `notes`: como mucho 300 caracteres. `allergens`: sin duplicados.
- **RN-06-21b** **Consentimiento para datos de salud** (art. 9.2.a RGPD, `docs/03-seguridad.md`): si el perfil resultante tiene `allergens` u `otherRestrictions` no vacíos y `DietProfile.healthConsentAt` es `null`, el `PUT` debe llevar `healthConsent: true`; si no, `422 HEALTH_CONSENT_REQUIRED` ("Tienes que aceptar el tratamiento de tus alergias y restricciones"). Con `healthConsent: true` y `healthConsentAt = null` se fija `healthConsentAt = now()`; si ya existía, no cambia. Con `healthConsent: false` se **retira** el consentimiento: el servicio exige `allergens` y `otherRestrictions` vacíos (si no, `422 HEALTH_CONSENT_REQUIRED`) y pone `healthConsentAt = null`. `diet` y `dislikes` no requieren consentimiento.
- **RN-06-22** **Solo el propio usuario** edita su perfil: solo existe la ruta `/me/diet-profile`; no hay ninguna ruta para editar el de otro.
- **RN-06-23** **Visibilidad:** `GET /groups/:g/diet-profiles` devuelve el perfil (o el de por defecto) de **cada miembro actual** del grupo, con su nombre visible y su `laneColor`. Lo puede consultar cualquier miembro. Un usuario que no comparte grupo no puede verlo.
- **RN-06-24** Al guardar, se emite `diet.updated` **una vez por cada grupo** del usuario (sala `group:<id>`, con ese `groupId` en el sobre).
- **RN-06-25** El perfil de dieta es un dato de salud (docs/03): **no genera actividad** y no se envía en ningún log.

### Avisos de dieta (`getMealWarnings`, en `shared`)
- **RN-06-26** Para una entrada con receta, `getMealWarnings(recipe, diners)` devuelve los avisos de cada comensal efectivo, donde `recipe = { title, allergens, suitableDiets, ingredientNames }` y `diners = GroupDietProfileDto[]`. Las entradas de texto libre y las de receta borrada no tienen avisos.
- **RN-06-27** Tipos de aviso, en este orden:
  1. **`ALLERGEN`** (grave): por cada alérgeno de `recipe.allergens` que esté en `diner.allergens` → "Contiene {alérgeno en minúsculas}: {Nombre} tiene alergia" (ej.: "Contiene huevos: Lucía tiene alergia"). Se usa "tiene alergia" para no tener que inferir el género.
  2. **`DIET`** (aviso): si `diner.diet ≠ OMNIVORE` y `recipe.suitableDiets` no contiene `diner.diet`:
     - si `suitableDiets` no está vacío → "No es apta para dieta {dieta en minúsculas} ({Nombre})" (ej.: "No es apta para dieta vegana (Ana)");
     - si está vacío → "No consta que sea apta para dieta {dieta} ({Nombre})".
  3. **`DISLIKE`** (informativo): por cada elemento de `diner.dislikes` cuyo valor normalizado esté contenido en el título normalizado o en algún `ingredientName` normalizado → "A {Nombre} no le gusta: {elemento}".
- **RN-06-28** `otherRestrictions` y `notes` **no** se comprueban automáticamente (son texto libre); se muestran en "Dietas del hogar".
- **RN-06-29** Los avisos **no bloquean**: se puede guardar igual. Se calculan en el cliente con los datos de `GET /meal-plan` (resumen de receta) y `GET /groups/:g/diet-profiles`, y se recalculan al llegar `diet.updated`, `recipe.updated` o `meal.*`.

## 4. Modelo de datos

`MealPlanEntry` y `DietProfile` de `docs/02-modelo-datos.md`. `forUserIds` vacío = todo el grupo. Se reutilizan `Recipe`, `RecipeIngredient`, `Diet` y `Allergen` (spec 05). Campo propio: `DietProfile.healthConsentAt` (consentimiento explícito, RN-06-21b).

## 5. API

Rutas de grupo bajo `/api/v1/groups/:groupId` (con `GroupMemberGuard`) y personales bajo `/api/v1/me`. Esquemas en `packages/shared/src/schemas/meals.ts` y `packages/shared/src/schemas/diet.ts`.

### DTO

```ts
mealRecipeSummaryDto = z.object({ id: uuid, title: z.string(), servings: int, allergens: z.array(AllergenEnum),
  suitableDiets: z.array(DietEnum), ingredientNames: z.array(z.string()), deletedAt: datetime.nullable() })
mealPlanEntryDto = z.object({
  id, groupId, date: dateString, slot: MealSlotEnum,
  recipeId: uuid.nullable(), recipe: mealRecipeSummaryDto.nullable(),
  title: z.string().nullable(), servings: int.nullable(), forUserIds: z.array(uuid),
  note: z.string().nullable(), createdById: uuid.nullable(), createdAt: datetime, updatedAt: datetime,
})
aggregatedIngredientLineDto = z.object({ key: z.string(), name: z.string(), quantity: decimalString.nullable(),
  unit: z.enum(UNITS).nullable(), recipeTitles: z.array(z.string()) })
dietProfileDto = z.object({ userId: uuid, diet: DietEnum, allergens: z.array(AllergenEnum),
  otherRestrictions: z.array(z.string()), dislikes: z.array(z.string()), notes: z.string().nullable(),
  healthConsentAt: datetime.nullable(), updatedAt: datetime.nullable() })
groupDietProfileDto = dietProfileDto.extend({ name: z.string(), laneColor: LaneColorEnum })
mealWarning = z.object({ type: z.enum(['ALLERGEN','DIET','DISLIKE']), userId: uuid, message: z.string() }) // solo cliente
```

### Entrada

```ts
mealPlanRangeQuery = z.object({ from: dateString, to: dateString }) // + refine to >= from y ≤ 42 días
createMealPlanEntryInput = z.object({
  date: dateString, slot: MealSlotEnum,
  recipeId: uuid.nullable().default(null), title: z.string().trim().min(1).max(80).nullable().default(null),
  servings: z.number().int().min(1).max(50).nullable().default(null),
  forUserIds: z.array(uuid).max(20).default([]), note: z.string().trim().max(200).nullable().default(null),
}).refine(exactamente uno de recipeId/title)
updateMealPlanEntryInput = createMealPlanEntryInput.innerType().partial()  // refine sobre el estado resultante en el servicio
copyWeekInput = z.object({ fromWeekStart: dateString, toWeekStart: dateString, mode: z.enum(['append','replace']) })
mealPlanToShoppingListInput = z.object({ from: dateString, to: dateString, listId: uuid, dryRun: z.boolean(),
  keys: z.array(z.string()).min(1).max(200).optional() })   // + refine rango ≤ 31 días
putDietProfileInput = z.object({ diet: DietEnum, allergens: z.array(AllergenEnum),
  otherRestrictions: z.array(z.string().trim().min(1).max(40)).max(20),
  dislikes: z.array(z.string().trim().min(1).max(40)).max(20), notes: z.string().trim().max(300).nullable(),
  healthConsent: z.boolean().optional() })   // RN-06-21b
```

### Endpoints

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| GET | `/groups/:g/meal-plan?from&to` | `mealPlanRangeQuery` | `mealPlanEntryDto[]` | 404, 422 |
| POST | `/groups/:g/meal-plan` | `createMealPlanEntryInput` | `201 mealPlanEntryDto` | 404 (receta), 422 |
| PATCH | `/groups/:g/meal-plan/:id` | `updateMealPlanEntryInput` | `mealPlanEntryDto` | 404, 422 |
| DELETE | `/groups/:g/meal-plan/:id` | — | `204` | 404 (la web lo trata como éxito) |
| POST | `/groups/:g/meal-plan/copy-week` | `copyWeekInput` | `{ created: mealPlanEntryDto[], deletedIds: uuid[], skipped: int }` | 422 |
| POST | `/groups/:g/meal-plan/add-to-shopping-list` | `mealPlanToShoppingListInput` | `{ lines: aggregatedIngredientLineDto[], items: ShoppingItemDto[] }` | 404 (lista), 422 |
| GET | `/groups/:g/diet-profiles` | — | `groupDietProfileDto[]` (uno por miembro actual, ordenados por `joinedAt`) | 404 |
| GET | `/me/diet-profile` | — | `dietProfileDto` | 401 |
| PUT | `/me/diet-profile` | `putDietProfileInput` | `dietProfileDto` | 401, 422 `VALIDATION_ERROR` / `HEALTH_CONSENT_REQUIRED` |

## 6. Eventos en tiempo real

| Evento | Cuándo | data | Sala |
|---|---|---|---|
| `meal.created` | `POST /meal-plan`; cada entrada creada por `copy-week` | `MealPlanEntryDto` | group |
| `meal.updated` | `PATCH /meal-plan/:id` | `MealPlanEntryDto` | group |
| `meal.deleted` | `DELETE /meal-plan/:id`; cada entrada borrada por `copy-week` en modo `replace` | `{ id, date }` | group |
| `diet.updated` | `PUT /me/diet-profile` | `DietProfileDto` | cada grupo del usuario |
| `shopping.items.bulk_created` | `add-to-shopping-list` con `dryRun = false` | `{ listId, items }` | group |
| `activity.created` | Ver §9 | `ActivityDto` | group |

Cliente (`apps/web/src/features/meals/realtime.ts`): en `group.member.left` invalida `['group', g, 'meal-plan']` y `['group', g, 'diet-profiles']`. Las queries del menú usan la clave `['group', g, 'meal-plan', { from, to }]`. En `meal.created/updated` → *upsert* en todas las cachés cuyo rango contenga `data.date` (y eliminación del `id` en las que ya no lo contengan, por si se movió de semana); en `meal.deleted` → quitar el `id`. En `diet.updated` → actualizar el perfil dentro de `['group', g, 'diet-profiles']` y, si es el propio, `['me', 'diet-profile']`. Las entradas cambiadas por otro miembro reproducen la onda.

## 7. Pantallas y UX

Ruta: `/g/:groupId/comidas` (`MealPlannerPage`), con la semana en la URL: `?semana=YYYY-MM-DD` (lunes; por defecto, la semana actual). El perfil de dieta se edita en `/perfil` (sección con ancla `#dieta`). Componentes de DESIGN.md: `LaneRope` entre franjas y entre días, `MemberDot` para los comensales, `DepthFigure` para el número del día, corchera roja/blanca (`LaneRope` de límite) para avisos de alérgenos, y `ripple` para cambios remotos.

### 7.1 Planificador semanal — `/g/:groupId/comidas`
- Cabecera: título **"Menú"**, rango de la semana ("9 – 15 nov"), botones "Semana anterior" y "Semana siguiente" (`aria-label`), y "Hoy" (si no se está en la semana actual). Menú (⋯): **"Copiar semana"**, **"Enviar a la lista"**, **"Dietas del hogar"**.
- Cuerpo: los 7 días en vertical, de lunes a domingo; al entrar se hace scroll hasta hoy. Cada día: `DepthFigure` con el número del día + nombre ("martes"), el día de hoy resaltado, y las 5 franjas separadas por `LaneRope`.
- Cada franja: rótulo ("Comida") y sus entradas como tarjetas compactas: título de la receta o texto libre, comensales (`MemberDot` de cada uno o "Todos"), raciones ("4 rac.") y un icono de aviso si `getMealWarnings` devuelve algo (rojo si hay `ALLERGEN`). Botón "+" por franja (`aria-label="Añadir a Comida del martes"`).
- Receta borrada: la tarjeta muestra el título tachado y "Receta eliminada".
- Tocar una tarjeta abre la hoja de edición. Tocar el título de una receta dentro de la hoja abre `/recetas/:id`.
- Estados: *cargando* = *skeleton* de los 7 días; *semana vacía* = cada franja con su "+" y, arriba, el texto "Aún no hay nada planificado esta semana" con el botón "Copiar la semana pasada" (abre §7.3 con origen = semana anterior); *error* = "No se pudo cargar el menú" + "Reintentar"; *sin conexión* = banner y botones "+" y de edición deshabilitados.

### 7.2 Hoja de entrada (`MealEntrySheet`, crear y editar)
- Título "Añadir a Comida · martes 10 nov" o "Editar comida".
- Selector segmentado **"Receta" | "Texto libre"**.
  - Receta: buscador del recetario (`GET /recipes?q=`, primero las favoritas) con placeholder "Buscar receta"; muestra la elegida con su chip de dieta.
  - Texto libre: campo "¿Qué se come?" (placeholder "Sobras, Cena fuera…").
- **"¿Quién come?"**: chip "Todos" (seleccionado por defecto) y un chip con `MemberDot` + nombre por miembro. Elegir un miembro desactiva "Todos"; quitar todos vuelve a "Todos".
- **"Raciones"**: stepper con el valor por defecto de RN-06-05 (se actualiza al cambiar los comensales mientras el usuario no lo haya tocado).
- "Día" y "Franja" (para mover) y "Nota".
- **Avisos** en vivo debajo de la receta, con el texto de RN-06-27 (alérgenos con la corchera roja/blanca). No impiden guardar.
- Botones **"Guardar"** y, al editar, **"Quitar del menú"**. Al quitar: toast "Comida quitada · Deshacer" (5 s); "Deshacer" la vuelve a crear con `POST` y los mismos datos.
- Desde el detalle de receta (spec 05, botón "Planificar") se abre esta hoja con la receta elegida y la fecha = hoy, franja = Comida.

### 7.3 Copiar semana (`CopyWeekSheet`)
- Título "Copiar el menú de esta semana". Destino: "La semana que viene" (por defecto) o "Otra semana…" (selector de lunes). Modo: **"Añadir a lo que haya"** (por defecto) o **"Reemplazar lo que haya"** (con el aviso "Se borrarán N comidas de esa semana").
- Botón **"Copiar"**. Toast: "Menú copiado a la semana del 16 nov" (+ " · 2 comidas no cabían" si `skipped > 0`), con el enlace "Ver".

### 7.4 Enviar a la lista (`MealPlanToListSheet`)
- Título "Enviar ingredientes a la lista". Rango "Desde" / "Hasta" (por defecto, de hoy al domingo de la semana mostrada; si la semana es futura, de lunes a domingo). Selector "Lista".
- Al cambiar cualquier valor se pide la vista previa (`dryRun: true`) y se muestran las líneas con casilla (todas marcadas), cantidad y "Para: Lentejas, Cocido".
- Botón **"Añadir N productos a Mercadona"** → `dryRun: false` con las `keys` marcadas. Toast "Añadidos 12 productos a Mercadona" + "Ver lista".
- Vacío: "No hay recetas planificadas en estas fechas".

### 7.5 Dietas del hogar (`GroupDietsSheet`)
- Una fila por miembro: `MemberDot` + nombre, dieta, chips de alérgenos ("Sin alergias declaradas" si no hay), "Otras restricciones", "No le gusta" y notas.
- En la propia fila del usuario: botón **"Editar mi dieta"** → `/perfil#dieta`.

### 7.6 Mi dieta — sección de `/perfil` (`DietProfileSection`)
- Título "Mi dieta" y texto: **"Lo verán los miembros de tus hogares. Se usa para avisarte en el menú y para que la IA no te proponga lo que no puedes comer."**
- "Dieta": opciones Omnívora, Vegetariana, Pescetariana y Vegana. "Alergias": los 14 alérgenos como chips. "Otras restricciones" y "No me gusta": campos de chips (Intro añade, placeholders "Sin lactosa, bajo en sal…" y "Coliflor…"). "Notas".
- **Consentimiento** (RN-06-21b): si `healthConsentAt` es `null` y hay alergias u otras restricciones marcadas, aparece la casilla obligatoria **"Acepto que Hogaria trate mis alergias y restricciones para proponer comidas"** con enlace a `/legal/privacidad`; sin marcarla, "Guardar" queda deshabilitado. Con consentimiento ya dado se muestra "Consentimiento dado el {fecha}" y el enlace **"Retirar consentimiento"** (`Dialog`: "Se borrarán tus alergias y restricciones" → `PUT` con ambos vacíos y `healthConsent: false`).
- Botón **"Guardar"** → toast "Dieta guardada".
- La sección se compone de `DietProfileSummary` (lectura) y `DietProfileEditor` (formulario), exportados desde `features/diet` para que E16 los monte en `/perfil#dieta`.
- Si la página `/perfil` todavía es un *placeholder* (E16 es de la fase 6), esta épica monta la sección dentro de ese *placeholder*.

## 8. Permisos

- **Menú:** cualquier miembro ve, crea, edita, mueve, copia, borra y envía a la lista. Fuera del grupo: `404`.
- **Perfil de dieta:** lo edita **solo su dueño** (solo existe `/me/diet-profile`). Lo ven los miembros de cualquier grupo que comparta con él, mediante `GET /groups/:g/diet-profiles`. No existe una ruta para editar el perfil de otro usuario, así que no hay `403 FORBIDDEN_NOT_OWNER` posible; el test de autorización comprueba que no hay ninguna vía de escritura ajena.

## 9. Actividad

`entityType = meal_plan_entry`. Las fechas del `summary` usan el formato corto en la zona del grupo ("martes 10 nov") y la franja en minúsculas.

| Acción | `action` | `summary` |
|---|---|---|
| Crear con receta | `created` | `planificó Lentejas para la comida del martes 10 nov` |
| Crear con texto | `created` | `planificó «Sobras» para la cena del martes 10 nov` |
| Editar o mover | `updated` | `cambió la comida del martes 10 nov` (franja y día **resultantes**) |
| Borrar | `deleted` | `quitó Lentejas de la comida del martes 10 nov` |
| Copiar semana | `created` | `copió el menú de la semana del 9 nov a la del 16 nov` |
| Enviar a la lista | `created` (`entityType = shopping_list`, vía `bulkCreate`) | `añadió 12 ingredientes del menú a Mercadona` |
| Perfil de dieta | — | *(nunca genera actividad: RN-06-25)* |

## 10. Casos límite

- Rango que cruza el cambio de hora → no afecta: las fechas son `@db.Date`.
- Un comensal sale del grupo → se le quita de `forUserIds`; las entradas que eran solo para él se borran (RN-06-30). Los avisos solo tienen en cuenta a los miembros actuales.
- Se borra la receta de una entrada → "Receta eliminada"; la entrada no aporta ingredientes ni se copia.
- La misma receta en varios días → los ingredientes se suman por clave (RN-06-17).
- Ingredientes con la misma clave pero unidades distintas ("200 g" y "1 paquete" de arroz) → dos líneas.
- Copiar una semana sobre sí misma → `422`.
- Dos miembros editan la misma entrada → gana la última escritura; la otra vista recibe `meal.updated` y hace la onda.
- `PUT /me/diet-profile` de un usuario sin grupos → se guarda y no se emite ningún evento.
- Un miembro nuevo sin perfil → aparece con el perfil por defecto (Omnívora, sin alergias).
- La IA (E13) lee los perfiles de los comensales con `DietProfileService.getForUsers(groupId, userIds)`, y el asistente (E14) usa `MealPlanService.findRange(groupId, from, to)` y `MealPlanService.create(ctx, input)`; los expone esta épica.

## 11. Tests

**Unitarios (`shared`):** `getMealWarnings` (alérgeno, dieta con `suitableDiets` vacío y no vacío, implicación vegana ⇒ vegetariana, *dislike* en el título y en un ingrediente, omnívoro sin avisos), agregación de líneas (`aggregateIngredientLines`: misma clave, distinta unidad, redondeo de `ud` tras sumar, opcionales excluidos), `startOfWeekLocal`, comensales efectivos.

**Integración (`apps/api/test/meals/*.int.spec.ts`, `apps/api/test/diet/*.int.spec.ts`):** autorización (404 en otro grupo, 401 sin sesión); `recipeId` y `title` a la vez → 422; `forUserIds` con un no miembro → 422; receta borrada → 404; rango de más de 42 días → 422; `copy-week` en `append` y `replace` (eventos y actividad única), lunes obligatorio; `add-to-shopping-list` con `dryRun` (no escribe) y con `keys`; `PUT /me/diet-profile` emite `diet.updated` en cada grupo y no escribe `ActivityLog`; `GET /groups/:g/diet-profiles` devuelve perfiles por defecto; un usuario no puede modificar el perfil de otro por ninguna ruta.

**Componentes (web):** hoja de entrada (receta ↔ texto, comensales, raciones por defecto, avisos en vivo), hoja de enviar a la lista (vista previa y casillas), sección "Mi dieta".

**E2E:** **E2E-08** Crear la receta "Lentejas" (spec 05) → planificarla en la **comida del martes** de la semana actual desde el planificador → "Enviar a la lista" del lunes al domingo → los ingredientes aparecen en la lista "Compra".

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `diet.updated` un sobre por grupo → `docs/04` (catálogo de eventos).
- Máximo 10 entradas por franja y validación/filtrado de `forUserIds` → `docs/02` (regla de `MealPlanEntry`).
- Glosario "Comensales" y "Aviso de dieta" → `docs/10`.
- Borrar las entradas que eran solo para el miembro que sale → spec 02 (RN-02-22), `docs/02` y ADR-019.
- Consentimiento de salud (`DietProfile.healthConsentAt`, `HEALTH_CONSENT_REQUIRED`), pedido por la spec 16 → RN-06-21b y §5/§7.6 de esta spec, `docs/02`, `docs/03` y `docs/04`.
- Exportar `DietProfileSummary`/`DietProfileEditor` para `/perfil` (spec 16) → §7.6 de esta spec.

## 13. Fuera de alcance

- Información nutricional, calorías y macros.
- Generar el menú semanal automáticamente con IA (se puede pedir al asistente de E14, que propone entradas con `create_meal_plan_entries`).
- Plantillas de menú con nombre y menús rotativos.
- Comprobación automática de `otherRestrictions` (texto libre).
- Arrastrar y soltar entradas entre días.
- Avisos push del menú.
