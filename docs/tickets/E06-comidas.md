# E06 · Comidas y dietas

> Spec: `docs/specs/06-comidas-dietas.md` · Rango: HOG-300 – HOG-349 · Fase: 3
> Expone `MealPlanService.create`/`findRange` (E14) y `DietProfileService.getForUsers` (E13, E14).

---

### HOG-300 · Añadir esquemas del menú y la dieta y la lógica de avisos y agregación a shared

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** shared
- **Depende de:** HOG-250
- **Spec:** `docs/specs/06-comidas-dietas.md#5-api` · RN-06-06, RN-06-08, RN-06-11, RN-06-17, RN-06-26 a RN-06-28

**Descripción**
Esquemas de la API del menú y del perfil de dieta, y las funciones puras que usan web y API: comensales efectivos, avisos de dieta y agregación de ingredientes.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/meals.ts` y `packages/shared/src/schemas/diet.ts` con todos los esquemas de §5 (incluidos los *refines*: exactamente uno de `recipeId`/`title`, rango ≤ 42 días en la consulta y ≤ 31 en el envío a la lista).
- [ ] `MEAL_SLOTS` (orden de RN-06-08) y `MEAL_SLOT_LABELS` coinciden con HOG-002 (si no, se corrigen).
- [ ] `effectiveDiners(forUserIds, memberIds)` (RN-06-06).
- [ ] `getMealWarnings(recipe, diners)` devuelve los avisos en el orden y con los textos exactos de RN-06-27 y ninguno para omnívoros sin alergias ni *dislikes*.
- [ ] `aggregateIngredientLines(entries)` aplica RN-06-17 pasos 2 a 6 (sin opcionales, clave `nombre|unidad`, `recipeTitles` sin repetir, redondeo de `ud`/`null` **después** de sumar, orden por nombre con `localeCompare('es')`).
- [ ] Tipos de `meal.*` y `diet.updated` en `RealtimeEventDataMap`.

**Notas técnicas**
- Archivos: `packages/shared/src/meals/{diners.ts, warnings.ts, aggregate.ts}`.
- `aggregateIngredientLines` recibe datos ya cargados (`{ servings, recipe: { servings, ingredients } }[]`) para poder probarse sin BBDD.

**Tests**
- Unit: `warnings.spec.ts` (alérgeno, dieta con `suitableDiets` vacío y lleno, receta vegana para vegetariano sin aviso, *dislike* en título e ingrediente), `aggregate.spec.ts` (misma clave en dos recetas, distinta unidad, 0,5 + 0,5 huevos = 1, opcionales fuera), `schemas/meals.spec.ts`.
- Integración: —
- E2E: —

---

### HOG-301 · Implementar la API del perfil de dieta

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-300, HOG-004, HOG-055, HOG-101, HOG-151
- **Spec:** `docs/specs/06-comidas-dietas.md#perfil-de-dieta-dietprofile` (RN-06-20 a RN-06-25)

**Descripción**
`GET/PUT /me/diet-profile` (solo el propio usuario), `GET /groups/:g/diet-profiles` (todos los miembros) y el evento `diet.updated` en cada grupo del usuario.

**Criterios de aceptación**
- [ ] `GET /me/diet-profile` devuelve el perfil o el de por defecto sin crearlo (`updatedAt: null`).
- [ ] `PUT /me/diet-profile` hace *upsert* con la normalización de RN-06-21 y emite `diet.updated` una vez por grupo del usuario, con el `groupId` de cada sala (`RealtimePublisher.publish(groupId, …)` en bucle).
- [ ] Consentimiento de datos de salud (art. 9.2.a RGPD): si el `PUT` deja `allergens` u `otherRestrictions` no vacíos y `healthConsentAt` es `null`, exige `healthConsent: true` en el cuerpo; si falta → `422 HEALTH_CONSENT_REQUIRED`. Con `healthConsent: true` guarda `DietProfile.healthConsentAt = now` (no se vuelve a pedir). `dietProfileDto` incluye `healthConsentAt`.
- [ ] No escribe `ActivityLog` ni registra el contenido en logs (RN-06-25).
- [ ] `GET /groups/:g/diet-profiles` devuelve `groupDietProfileDto[]` de los miembros actuales (con perfil por defecto si no tienen), ordenados por `joinedAt`, en ≤ 2 consultas.
- [ ] `DietProfileService.getForUsers(groupId, userIds)` exportado (lo usan E13 y E14); solo devuelve perfiles de miembros actuales de ese grupo.
- [ ] No existe ninguna ruta que permita escribir el perfil de otro usuario.

**Notas técnicas**
- Archivos: `apps/api/src/modules/diet/{diet.module.ts, diet-profile.controller.ts, group-diet-profiles.controller.ts, diet-profile.service.ts}`.

**Tests**
- Integración: `apps/api/test/diet/diet-profile.int.spec.ts` (por defecto, *upsert*, deduplicado de *dislikes* sin acentos, alergias sin consentimiento → 422 `HEALTH_CONSENT_REQUIRED` y con él se fija `healthConsentAt`, `diet.updated` en 2 grupos, sin `ActivityLog`, 404 de grupo ajeno, 401, el perfil de un usuario de otro grupo no aparece).
- E2E: —

---

### HOG-302 · Implementar la API del menú (consultar, crear, editar y quitar comidas)

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-300, HOG-251, HOG-101, HOG-151, HOG-153
- **Spec:** `docs/specs/06-comidas-dietas.md#menú-mealplanentry` (RN-06-01 a RN-06-11)

**Descripción**
`GET /meal-plan?from&to`, `POST`, `PATCH` y `DELETE` de `MealPlanEntry`, con el resumen de receta incrustado y `MealPlanService.create`/`findRange` reutilizables.

**Criterios de aceptación**
- [ ] `GET` valida el rango (≤ 42 días) y devuelve las entradas ordenadas por fecha, franja (`MEAL_SLOTS`) y `createdAt`, con `recipe: mealRecipeSummaryDto` (incluidas las borradas con `deletedAt`) en una sola consulta con `include`.
- [ ] `POST` y `PATCH` aplican RN-06-01 a RN-06-04 sobre el estado resultante: receta del grupo y no borrada (si no, `404`), comensales miembros (si no, `422`), máximo 10 por franja (`422`).
- [ ] Al pasar a receta se guarda `title = null`, y al pasar a texto libre `recipeId = null`.
- [ ] `DELETE` → `204` + `meal.deleted { id, date }`; inexistente → `404`.
- [ ] Eventos `meal.created`/`meal.updated` con `MealPlanEntryDto` y actividad de §9 (fecha corta y franja en minúsculas, en la zona del grupo).
- [ ] `MealPlanService.create(ctx, input)` y `findRange(groupId, from, to)` exportados desde `MealsModule`.

**Notas técnicas**
- Archivos: `apps/api/src/modules/meals/{meals.module.ts, meal-plan.controller.ts, meal-plan.service.ts, meal-plan.mapper.ts}`.
- `date` es `@db.Date`: convertir con las utilidades de `shared/dates` y nunca con `new Date('YYYY-MM-DD')` a pelo.

**Tests**
- Unit: textos de actividad (`formatMealActivity`).
- Integración: `apps/api/test/meals/meal-plan.int.spec.ts` (los dos a la vez → 422, ninguno → 422, receta borrada → 404, comensal ajeno → 422, 11.ª entrada → 422, rango de 43 días → 422, mover de día, receta borrada sigue apareciendo con `deletedAt`, 404 de otro grupo, 401, eventos y actividad).
- E2E: —

---

### HOG-303 · Copiar el menú de una semana a otra (API)

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-302
- **Spec:** `docs/specs/06-comidas-dietas.md#copiar-semana` (RN-06-12 a RN-06-16)

**Descripción**
`POST /meal-plan/copy-week` en modo `append` o `replace`, en una transacción, con eventos por entrada y una sola actividad.

**Criterios de aceptación**
- [ ] `fromWeekStart` y `toWeekStart` deben ser lunes y distintos (`422`).
- [ ] Copia conservando día de la semana, franja, receta, título, raciones, nota y comensales (filtrados a los miembros actuales); no copia las de receta borrada.
- [ ] `append` respeta el máximo de 10 por franja y cuenta las que no caben en `skipped`; `replace` borra antes la semana destino.
- [ ] Semana origen sin entradas copiables → `422` "La semana de origen no tiene comidas".
- [ ] Devuelve `{ created, deletedIds, skipped }`; tras el commit emite `meal.deleted` y `meal.created` por entrada y registra una actividad "copió el menú de la semana del 9 nov a la del 16 nov".

**Notas técnicas**
- Método `copyWeek` en `meal-plan.service.ts`; `createMany` no devuelve filas en Prisma < 5.14: usar `createManyAndReturn` si está disponible o `create` en bucle dentro de la transacción (≤ 350 filas).

**Tests**
- Integración: `apps/api/test/meals/copy-week.int.spec.ts` (append, replace, skipped, martes → 422, origen vacío → 422, receta borrada no se copia, eventos y una actividad).
- E2E: —

---

### HOG-304 · Enviar los ingredientes del menú a la lista de la compra (API)

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-302, HOG-203
- **Spec:** `docs/specs/06-comidas-dietas.md#ingredientes-a-la-lista-de-la-compra` (RN-06-17 a RN-06-19)

**Descripción**
`POST /meal-plan/add-to-shopping-list` con vista previa (`dryRun`) y alta filtrada por `keys`, reutilizando `aggregateIngredientLines` y `ShoppingItemsService.bulkCreate`.

**Criterios de aceptación**
- [ ] Carga en una consulta las entradas del rango con receta no borrada e ingredientes, y calcula las líneas con `aggregateIngredientLines`.
- [ ] `dryRun: true` → `{ lines, items: [] }` sin escribir nada.
- [ ] `dryRun: false` → añade las líneas de `keys` (o todas) con `bulkCreate` y la actividad "añadió N ingredientes del menú a {lista}"; devuelve `{ lines, items }`.
- [ ] Sin líneas → `200 { lines: [], items: [] }` sin evento.
- [ ] Lista de otro grupo → `404`; rango > 31 días → `422`.

**Notas técnicas**
- `MealsModule` importa `ShoppingModule`.

**Tests**
- Integración: `apps/api/test/meals/add-to-list.int.spec.ts` (misma receta dos días suma cantidades; raciones de la entrada escalan; texto libre ignorado; `dryRun` no escribe; `keys` filtra; fusión con un item ya en la lista).
- E2E: cubierto en E2E-08 (HOG-313).

---

### HOG-305 · Limpiar los comensales del menú cuando un miembro sale del hogar

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P1 · **Puntos:** 1
- **Capa:** api
- **Depende de:** HOG-302, HOG-106
- **Spec:** `docs/specs/06-comidas-dietas.md#menú-mealplanentry` (RN-06-30) · `docs/specs/02-grupos-invitaciones.md` (RN-02-22)

**Descripción**
Registrar en `MemberRemovedHooks` (mecanismo de E02) el manejador que quita al usuario de `forUserIds` y borra las entradas que eran solo para él.

**Criterios de aceptación**
- [ ] `apps/api/src/modules/meals/meals.member-removed.ts` registra `onMemberRemoved(tx, { groupId, userId })` al iniciar el módulo.
- [ ] Usa el `tx` recibido (nunca `this.prisma`) y hace como mucho 2 consultas (`UPDATE … SET for_user_ids = array_remove(...)` y `DELETE` de las que quedan vacías habiendo contenido solo a ese usuario).
- [ ] No emite eventos ni actividad; `features/meals/realtime.ts` invalida `meal-plan` y `diet-profiles` en `group.member.left`.

**Notas técnicas**
- Para distinguir "vacía porque era solo para él" de "vacía = para todos", el `DELETE` se hace **antes** del `array_remove`: `WHERE group_id = $1 AND for_user_ids = ARRAY[$2]::uuid[]`.

**Tests**
- Integración: `apps/api/test/meals/member-removed.int.spec.ts` (entrada para [A, B] queda [B]; entrada para [A] se borra; entrada para todos no cambia).
- E2E: —

---

### HOG-306 · Crear los hooks de datos y el tiempo real del menú y la dieta en la web

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-300, HOG-006, HOG-152
- **Spec:** `docs/specs/06-comidas-dietas.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks de TanStack Query del menú y de la dieta y manejadores de `meal.*`, `diet.updated` y `group.member.left`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/meals/api.ts` con `useMealPlan(from, to)`, `useCreateMealEntry`, `useUpdateMealEntry`, `useDeleteMealEntry` (optimistas), `useCopyWeek`, `useMealPlanToListPreview(input)` y `useMealPlanToList`, `useGroupDietProfiles()`, `useMyDietProfile()` y `useSaveMyDietProfile()`.
- [ ] `realtime.ts` aplica §6: *upsert* por rango que contiene `date` (y quitarlo de los que no), borrado por `id`, `diet.updated` en `diet-profiles` y `['me', 'diet-profile']`, invalidación en `group.member.left`, onda en `meal_plan_entry:<id>`.
- [ ] Hook `useMealWarnings(entry)` que combina el resumen de receta, los comensales efectivos y los perfiles con `getMealWarnings`.

**Notas técnicas**
- Claves: `['group', g, 'meal-plan', { from, to }]`, `['group', g, 'diet-profiles']`, `['me', 'diet-profile']`.

**Tests**
- Unit: manejadores de `realtime.ts` (entrada movida de una semana a otra) y `useMealWarnings`.
- E2E: —

---

### HOG-307 · Construir el planificador semanal

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-306, HOG-750, HOG-009
- **Spec:** `docs/specs/06-comidas-dietas.md#71-planificador-semanal--gcomidas`

**Descripción**
`/g/:groupId/comidas?semana=` con navegación entre semanas, los 7 días en vertical y las 5 franjas con sus tarjetas.

**Criterios de aceptación**
- [ ] Cabecera "Menú" con rango de la semana, anterior/siguiente (`aria-label`), "Hoy" y menú con "Copiar semana", "Enviar a la lista" y "Dietas del hogar" (las hojas son HOG-310, HOG-311 y HOG-312).
- [ ] La semana va en `?semana=` (lunes; por defecto la actual) y al entrar se hace scroll hasta hoy.
- [ ] Día con `DepthFigure` + nombre y las 5 franjas separadas por `LaneRope`; cada franja con sus tarjetas (título, `MemberDot`s o "Todos", raciones) y el botón "+" con `aria-label`.
- [ ] Receta borrada: título tachado y "Receta eliminada".
- [ ] Onda en las tarjetas cambiadas por otro.
- [ ] Estados: cargando, semana vacía (con "Copiar la semana pasada"), error y sin conexión.
- [ ] 375 px y modo oscuro.

**Notas técnicas**
- `apps/web/src/features/meals/pages/MealPlannerPage.tsx`, `components/{WeekHeader.tsx, DayBlock.tsx, SlotRow.tsx, MealEntryCard.tsx}`.
- Sustituye el `ComingSoonPage` de la ruta de comidas de HOG-750.

**Tests**
- Unit: `MealPlannerPage.spec.tsx` con MSW (semana en la URL, orden de franjas, receta borrada, vacío, error).
- E2E: cubierto en HOG-313.

---

### HOG-308 · Crear la hoja de añadir y editar comida

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-307, HOG-255
- **Spec:** `docs/specs/06-comidas-dietas.md#72-hoja-de-entrada-mealentrysheet-crear-y-editar`

**Descripción**
`MealEntrySheet` para elegir receta o texto libre, comensales, raciones, día, franja y nota, y quitar la comida con deshacer. Incluye el botón "Planificar" del detalle de receta.

**Criterios de aceptación**
- [ ] Segmentado "Receta" | "Texto libre"; buscador de recetas con `useRecipes({ q })` (favoritas primero).
- [ ] "¿Quién come?" con "Todos" y chips de miembros (`MemberDot`); raciones por defecto según RN-06-05 que siguen a los comensales mientras el usuario no las toque.
- [ ] "Día", "Franja" y "Nota"; validación en español.
- [ ] "Quitar del menú" → toast "Comida quitada · Deshacer" que la vuelve a crear con `POST`.
- [ ] En `RecipeDetailPage` (HOG-257) aparece "Planificar", que abre la hoja con la receta, hoy y la franja Comida.

**Notas técnicas**
- `apps/web/src/features/meals/components/MealEntrySheet.tsx` con React Hook Form + `createMealPlanEntryInput`. Los avisos los añade HOG-309 en el *slot* `warnings` de la hoja.

**Tests**
- Unit: `MealEntrySheet.spec.tsx` (cambio receta ↔ texto, raciones por defecto, quitar y deshacer).
- E2E: cubierto en HOG-313.

---

### HOG-309 · Mostrar los avisos de dieta y alérgenos en el menú

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-308
- **Spec:** `docs/specs/06-comidas-dietas.md#avisos-de-dieta-getmealwarnings-en-shared` (RN-06-26 a RN-06-29)

**Descripción**
Icono de aviso en las tarjetas y lista de avisos en vivo en la hoja, con la corchera roja/blanca para los alérgenos.

**Criterios de aceptación**
- [ ] `MealEntryCard` muestra un icono de aviso (rojo si hay `ALLERGEN`) con `aria-label` que resume los avisos ("2 avisos: contiene huevos…").
- [ ] `MealEntrySheet` lista los avisos en vivo al cambiar receta o comensales, con los textos de RN-06-27 y `LaneRope variant="limit"` para los alérgenos; no impiden guardar.
- [ ] Se recalculan al llegar `diet.updated`, `recipe.updated` o `meal.*`.

**Notas técnicas**
- `apps/web/src/features/meals/components/MealWarnings.tsx` con `useMealWarnings` (HOG-306).

**Tests**
- Unit: `MealWarnings.spec.tsx` (alérgeno en rojo, varios avisos, ninguno).
- E2E: —

---

### HOG-310 · Crear la hoja de copiar semana

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-307, HOG-303
- **Spec:** `docs/specs/06-comidas-dietas.md#73-copiar-semana-copyweeksheet`

**Descripción**
`CopyWeekSheet` con destino, modo y confirmación.

**Criterios de aceptación**
- [ ] Destino "La semana que viene" (por defecto) u "Otra semana…" (selector de lunes); modo "Añadir a lo que haya" o "Reemplazar lo que haya" con el aviso "Se borrarán N comidas de esa semana" (N de la caché o de una consulta del rango destino).
- [ ] Toast "Menú copiado a la semana del 16 nov" (+ "· N comidas no cabían") con "Ver", que navega a esa semana.
- [ ] El estado vacío del planificador abre esta hoja con origen = semana anterior y destino = la mostrada.
- [ ] Error `422` mostrado en la hoja.

**Notas técnicas**
- `apps/web/src/features/meals/components/CopyWeekSheet.tsx`.

**Tests**
- Unit: `CopyWeekSheet.spec.tsx` (cuerpo de la petición en ambos modos, toast con `skipped`).
- E2E: —

---

### HOG-311 · Crear la hoja de enviar ingredientes del menú a la lista

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-307, HOG-304, HOG-209
- **Spec:** `docs/specs/06-comidas-dietas.md#74-enviar-a-la-lista-mealplantolistsheet`

**Descripción**
`MealPlanToListSheet` con rango, lista, vista previa con casillas y confirmación.

**Criterios de aceptación**
- [ ] Rango por defecto según §7.4; selector de lista con `useShoppingLists`.
- [ ] Al cambiar rango o lista pide la vista previa (`dryRun: true`) y muestra las líneas con casilla, cantidad y "Para: …".
- [ ] "Añadir N productos a {lista}" envía `dryRun: false` con las `keys` marcadas; toast "Añadidos N productos a {lista}" + "Ver lista".
- [ ] Vacío: "No hay recetas planificadas en estas fechas"; sin conexión: botón deshabilitado.

**Notas técnicas**
- `apps/web/src/features/meals/components/MealPlanToListSheet.tsx`.

**Tests**
- Unit: `MealPlanToListSheet.spec.tsx` (vista previa, desmarcar una línea cambia `keys`, vacío).
- E2E: cubierto en HOG-313.

---

### HOG-312 · Crear la sección "Mi dieta" del perfil y la hoja "Dietas del hogar"

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-306, HOG-258, HOG-750
- **Spec:** `docs/specs/06-comidas-dietas.md#75-dietas-del-hogar-groupdietssheet` · `#76-mi-dieta--sección-de-perfil-dietprofilesection`

**Descripción**
Formulario del perfil de dieta en `/perfil#dieta` (solo el propio usuario) y hoja de solo lectura con las dietas de todos los miembros desde el planificador.

**Criterios de aceptación**
- [ ] `DietProfileSection` en `/perfil` con el texto explicativo de §7.6, dieta (4 opciones), 14 alérgenos (reutiliza `AllergenPicker` de HOG-258), "Otras restricciones" y "No me gusta" (`ChipInput`), notas y "Guardar" → toast "Dieta guardada".
- [ ] La primera vez que se guardan alergias u otras restricciones (`healthConsentAt` es `null`), el formulario muestra la casilla obligatoria "Acepto que Hogaria trate mis alergias y restricciones para proponer comidas" y envía `healthConsent: true`; sin marcarla, "Guardar" queda deshabilitado. Con `healthConsentAt` ya fijado, la casilla no aparece.
- [ ] Exporta `DietProfileSummary` (resumen de solo lectura) y `DietProfileEditor` (formulario) para que E16 (HOG-804) los monte en `/perfil#dieta`.
- [ ] Si `/perfil` es aún el *placeholder* de HOG-750, la sección se monta dentro de él con el ancla `#dieta`.
- [ ] `GroupDietsSheet` con una fila por miembro (`MemberDot`, dieta, alergias o "Sin alergias declaradas", restricciones, "No le gusta", notas) y "Editar mi dieta" → `/perfil#dieta` en la fila propia.
- [ ] Ninguna fila ajena tiene controles de edición.
- [ ] Estados de carga, error y sin conexión en ambos.

**Notas técnicas**
- `apps/web/src/features/diet/components/{DietProfileSection.tsx, DietProfileSummary.tsx, DietProfileEditor.tsx, GroupDietsSheet.tsx}`.

**Tests**
- Unit: `DietProfileSection.spec.tsx` (guardar envía el documento completo, duplicados de chips, casilla de consentimiento obligatoria la primera vez), `GroupDietsSheet.spec.tsx` (solo la fila propia tiene "Editar mi dieta").
- E2E: —

---

### HOG-313 · Escribir el e2e de receta → menú → lista (E2E-08)

- **Épica:** E06 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-258, HOG-308, HOG-311, HOG-011
- **Spec:** `docs/specs/06-comidas-dietas.md#11-tests` · `docs/specs/05-recetas.md#11-tests` · `docs/07-testing.md`

**Descripción**
Flujo crítico E2E-08 en Playwright (Pixel 7 e iPhone 14).

**Criterios de aceptación**
- [ ] `apps/web/e2e/recipe-meal-shopping.e2e.ts`: crear la receta "Lentejas" (4 raciones; ingredientes "Lentejas" 300 g, "Cebolla" 1 ud y "Zanahoria" 2 ud; 2 pasos) en `/recetas/nueva` → en `/comidas`, "+" en la **Comida del martes** de la semana actual, elegir "Lentejas", poner "Raciones" a 4 y guardar → "Enviar a la lista" de lunes a domingo a la lista "Compra" → en la lista aparecen "Lentejas · 300 g", "Cebolla · 1 ud" y "Zanahoria · 2 ud" (factor 4/4 = 1).
- [ ] Pasa en local y en CI sin `waitForTimeout`.

**Notas técnicas**
- Fijar el reloj del navegador (`page.clock`) a un miércoles para que el martes de la semana actual sea determinista.

**Tests**
- E2E: E2E-08.
