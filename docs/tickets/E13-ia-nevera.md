# E13 · IA: núcleo + nevera → recetas

> Spec: `docs/specs/13-ia-nevera.md` · Canónico de IA: `docs/05-ia.md` · Rango: HOG-650 – HOG-699 · Fase: 3
> HOG-650 es el **núcleo de IA** del que dependen también E10 (escaneo de ticket) y E14 (asistente).

---

### HOG-650 · Crear el núcleo de IA (cliente Gemini, cuota, aviso e imágenes)

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-003, HOG-004, HOG-006, HOG-010, HOG-055, HOG-101, HOG-151
- **Spec:** `docs/specs/13-ia-nevera.md#núcleo-de-ia-compartido-por-e10-e13-y-e14`

**Descripción**
Crear el módulo `ai` con todo lo que comparten las features de IA: el cliente de Gemini con salida estructurada y reintento, el servicio de cuotas diarias por grupo, el guard del aviso de privacidad con su endpoint de aceptación, la validación de imágenes, `GET /groups/:g/ai/quota` y el evento `ai.quota.updated`. No incluye ninguna feature concreta ni `streamChat` (lo añade HOG-705).

**Criterios de aceptación**
- [ ] `GeminiClient` es un provider inyectable por el token `GEMINI_CLIENT` con `generateStructured<T>({ feature, prompt, schema, responseSchema, images?, signal? })` que devuelve `{ data, model, inputTokens, outputTokens }`.
- [ ] Usa `GEMINI_MODEL`; si la variable está vacía, la API falla al arrancar con un mensaje claro (RN-13-01).
- [ ] Timeout de 30 s por intento, reintento único si zod falla, 429/`RESOURCE_EXHAUSTED` → `AI_UNAVAILABLE` sin reintento (RN-13-02..04). Los errores internos se mapean a `errorCode` (`GEMINI_RATE_LIMITED`, `TIMEOUT`, `SCHEMA_INVALID`, `SAFETY_BLOCKED`, `UPSTREAM_ERROR`).
- [ ] `AiQuotaService` con `getQuota(groupId)`, `assertAvailable(groupId, feature)` y `record(groupId, userId, feature, result)`; día natural en `Group.timezone`; `AI_LIMIT_REACHED` con extensiones `feature`, `limit`, `resetsAt` (RN-13-07..09).
- [ ] `record` con `success = true` publica `ai.quota.updated` mediante `RealtimePublisher` tras escribir (RN-13-10).
- [ ] `AiNoticeGuard` devuelve `403 AI_NOTICE_REQUIRED` si `aiNoticeAcceptedAt` es `null` (RN-13-05); decorador `@RequireAiNotice()` para aplicarlo.
- [ ] `POST /api/v1/me/ai-notice` idempotente devuelve `{ aiNoticeAcceptedAt }` (RN-13-06).
- [ ] `GET /api/v1/groups/:groupId/ai/quota` devuelve las 4 features en orden `AI_FEATURES`, sin exigir el aviso.
- [ ] `image.util.ts` exporta `validateImages(files)` (1–4, MIME permitido, ≤ 5 MB, magic bytes) y lanza `IMAGE_INVALID`; también `aiImagesInterceptor()` (multer `memoryStorage`) que traduce los errores de multer a `IMAGE_INVALID` (RN-13-13/14).
- [ ] Throttler con nombre `ai` (6/min por usuario) reutilizable con `@AiThrottle()` (RN-13-11).
- [ ] Esquemas `aiQuotaDto`, `aiNoticeDto`, `aiLimitProblemExt`, `AI_FEATURES`, `AI_FEATURE_LABELS` y constantes de imagen en `packages/shared/src/schemas/ai.ts`.
- [ ] `FakeGeminiClient` en `apps/api/test/fakes/fake-gemini.client.ts` que devuelve fixtures por nombre y permite simular errores.

**Notas técnicas**
- Archivos: `apps/api/src/modules/ai/{ai.module.ts, gemini.client.ts, ai-quota.service.ts, ai-notice.guard.ts, ai-notice.controller.ts, ai-quota.controller.ts, image.util.ts, ai-throttle.decorator.ts}`.
- SDK `@google/genai`. `responseSchema` se escribe a mano (subconjunto OpenAPI de Gemini) junto a cada prompt; no derivar automáticamente en este ticket.
- Nunca registrar en logs el contenido de las imágenes ni el prompt completo: solo `feature`, `model`, tokens, duración y `errorCode`.
- `resetsAt`: usar `@date-fns/tz` (`TZDate`) para obtener `startOfDay(addDays(now, 1))` en la zona del grupo.
- Añadir `ai.quota.updated` al tipo de eventos en `packages/shared/src/realtime.ts` si no está.

**Tests**
- Unit: `ai-quota.service.spec.ts`, `gemini.client.spec.ts`, `image.util.spec.ts`, `ai-notice.guard.spec.ts` (ver spec §11).
- Integración: `apps/api/test/ai/ai-core.int.spec.ts` — 401/404 en quota, aviso idempotente, cuota que no cuenta fallos, evento emitido.
- E2E: —

---

### HOG-651 · Añadir esquemas y utilidades de la nevera en shared

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-002, HOG-650
- **Spec:** `docs/specs/13-ia-nevera.md#5-api`

**Descripción**
Definir en `@hogaria/shared` los esquemas zod de `detect` y `recipes` y las utilidades puras que usan tanto el servidor (post-validación) como la web (mapeos al guardar).

**Criterios de aceptación**
- [ ] `fridgeIngredientSchema`, `fridgeDetectDto`, `fridgeRecipeFiltersSchema`, `fridgeRecipesInput`, `fridgeRecipeAiSchema`, `fridgeRecipesAiOutput`, `fridgeRecipeDto`, `fridgeRecipesDto` exactamente como en la spec §5.2–5.3.
- [ ] `packages/shared/src/ai/`: `matchesIngredient`, `PANTRY_BASICS`, `ALLERGEN_KEYWORDS`, `detectAllergens(ingredientNames)`, `parseLooseQuantity`, `toShoppingUnit` (spec §5.4).
- [ ] Todo exportado desde el índice de `@hogaria/shared`.

**Notas técnicas**
- `ALLERGEN_KEYWORDS` se guarda ya normalizado (sin tildes, minúsculas) y se compara con `normalizeProductName` por palabras completas.
- `toShoppingUnit` mapea a `UNITS` existentes; no añade unidades nuevas.

**Tests**
- Unit: `matchesIngredient.spec.ts`, `parseLooseQuantity.spec.ts` (`"1,5"`, `"1/2"`, `"½"`, `"2-3"`, `"al gusto"`), `toShoppingUnit.spec.ts`, `detectAllergens.spec.ts`, parseo de fixtures válidos/ inválidos con los esquemas.
- Integración: —
- E2E: —

---

### HOG-652 · Implementar la detección de ingredientes (fridge/detect)

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-650, HOG-651
- **Spec:** `docs/specs/13-ia-nevera.md#nevera`

**Descripción**
Endpoint `POST /groups/:g/ai/fridge/detect` que recibe 1–4 fotos, llama a Gemini con el prompt `fridge-detect.v1` y devuelve la lista de ingredientes deduplicada.

**Criterios de aceptación**
- [ ] Prompt `apps/api/src/modules/ai/prompts/fridge-detect.v1.ts` (función pura con versión) que pide ingredientes en español de España, en minúsculas, con `quantityHint` aproximado y `confidence`, máximo 60, y `notes` si la foto es mala.
- [ ] `FridgeService.detect(groupId, userId, files)` sigue el orden de comprobaciones RN-13-12 y registra `AiUsage` (`FRIDGE_DETECT`).
- [ ] Deduplicación por `normalizeProductName` conservando la primera aparición y la mayor confianza (RN-13-17).
- [ ] 0 ingredientes → 200 con lista vacía y cuenta como uso (RN-13-18).
- [ ] Ningún buffer de imagen se conserva tras la respuesta (no se asigna a variables de módulo ni a logs).

**Notas técnicas**
- `apps/api/src/modules/ai/fridge.controller.ts` + `fridge.service.ts`. Usa `aiImagesInterceptor()`, `@RequireAiNotice()` y `@AiThrottle()` de HOG-650.
- Imágenes como `inlineData { mimeType, data: base64 }`.

**Tests**
- Unit: snapshot del prompt; deduplicación.
- Integración: `fridge-detect.int.spec.ts` con fixture `fridge-detect.ok.json`: 1 y 4 imágenes; 5 imágenes, magic bytes falsos y 6 MB → 422 sin `AiUsage`; aviso no aceptado → 403; otro grupo → 404.
- E2E: cubierto por E2E-09 (HOG-662).

---

### HOG-653 · Implementar la generación de recetas (fridge/recipes) con restricciones de dieta

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-650, HOG-651
- **Spec:** `docs/specs/13-ia-nevera.md#nevera`

**Descripción**
Endpoint `POST /groups/:g/ai/fridge/recipes` que calcula las restricciones de los comensales (dieta más restrictiva, alérgenos, aversiones), construye el prompt `fridge-recipes.v1` y devuelve hasta 3 recetas.

**Criterios de aceptación**
- [ ] `forUserIds` validado contra los miembros actuales (RN-13-21); vacío = todos.
- [ ] `diet-constraints.ts` calcula dieta efectiva y unión de restricciones; comensal sin perfil = omnívoro sin restricciones (RN-13-22..24).
- [ ] Prompt `fridge-recipes.v1.ts` con las reglas de `docs/05-ia.md` y sin nombres de personas (RN-13-16, RN-13-24); pide `notes` si devuelve menos de 3.
- [ ] La salida se valida con `fridgeRecipesAiOutput` (0–3 recetas) y se registra `AiUsage` (`FRIDGE_RECIPES`).
- [ ] La respuesta incluye `constraints` con lo aplicado.

**Notas técnicas**
- `apps/api/src/modules/ai/fridge.service.ts` (`recipes()`), `apps/api/src/modules/ai/diet-constraints.ts`.
- Lee `DietProfile` con Prisma filtrando por los `userId` de miembros del grupo (`GroupMember` del `groupId`), nunca solo por `userId` recibido.
- La post-validación de alérgenos y "tienes/te falta" se hace en HOG-654; aquí se deja un punto de extensión (`postValidate`).

**Tests**
- Unit: `diet-constraints.spec.ts`; snapshot del prompt (sin nombres ni emails).
- Integración: `fridge-recipes.int.spec.ts`: `forUserIds` ajeno → 422; respuesta OK con fixture; fallo de esquema → reintento → 503 y `AiUsage` con `SCHEMA_INVALID`.
- E2E: cubierto por E2E-09.

---

### HOG-654 · Validar alérgenos, dieta y "tienes/te falta" en el servidor

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-653
- **Spec:** `docs/specs/13-ia-nevera.md#nevera` (RN-13-26..29)

**Descripción**
Defensa en profundidad: tras la respuesta de Gemini, el servidor recalcula alérgenos por palabras clave, marca conflictos con los comensales, avisa si la dieta no encaja y recalcula qué ingredientes están disponibles.

**Criterios de aceptación**
- [ ] `allergen-guard.ts` exporta `postValidateRecipes(recipes, constraints, inputIngredients, allowExtra)`.
- [ ] `allergens` = declarados ∪ detectados por `ALLERGEN_KEYWORDS`; `allergenConflicts` = intersección con los comensales; un warning por conflicto con el texto exacto de RN-13-26.
- [ ] Warning de dieta (RN-13-27) y de ingredientes extra (RN-13-29).
- [ ] `available` recalculado con `matchesIngredient` contra la entrada + `PANTRY_BASICS` (RN-13-28).
- [ ] No se eliminan recetas; no se duplican warnings idénticos.

**Notas técnicas**
- `apps/api/src/modules/ai/allergen-guard.ts`. Función pura, sin Prisma.
- Etiquetas ES de alérgenos y dietas desde `packages/shared` (`ALLERGEN_LABELS`, `DIET_LABELS`), en minúsculas en el texto del warning.

**Tests**
- Unit: `allergen-guard.spec.ts` (huevo no declarado + comensal alérgico; dieta vegana con receta solo vegetariana; "aceite de oliva" disponible por básico; "leche de coco" marca MILK).
- Integración: fixture `fridge-recipes.allergen-leak.json` → `allergenConflicts: ['EGGS']`.
- E2E: —

---

### HOG-655 · Crear la base web de IA (aviso, cuota, errores y tiempo real)

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-650, HOG-008, HOG-009, HOG-152, HOG-750
- **Spec:** `docs/specs/13-ia-nevera.md#71-componentes-de-núcleo-reutilizables-por-e10-y-e14`

**Descripción**
Componentes y hooks de IA reutilizables por la nevera, el asistente y el escaneo de tickets: diálogo del aviso, indicador de cuota, manejo de errores de IA y suscripción a `ai.quota.updated`.

**Criterios de aceptación**
- [ ] `AiNoticeDialog` con los textos exactos de la spec §7.1; al aceptar llama a `POST /me/ai-notice`, actualiza `['me']` y ejecuta el callback pendiente.
- [ ] Hook `useRequireAiNotice()` que devuelve `run(action)`: si `me.aiNoticeAcceptedAt` es `null` abre el diálogo y ejecuta `action` tras aceptar.
- [ ] `useAiQuota(groupId)` con clave `['group', groupId, 'ai-quota']` y `AiQuotaBadge` (singular, plural y agotado con hora `HH:mm` en la zona del grupo).
- [ ] `handleAiError` mapea `AI_NOTICE_REQUIRED`, `AI_LIMIT_REACHED`, `AI_UNAVAILABLE`, `IMAGE_INVALID` y `RATE_LIMITED` a los mensajes de la spec.
- [ ] `features/ai/realtime.ts` actualiza la caché de cuota con `ai.quota.updated`.
- [ ] Funciona en 375 px y en modo oscuro.

**Notas técnicas**
- `apps/web/src/features/ai/{api.ts, realtime.ts, errors.ts, components/AiNoticeDialog.tsx, components/AiQuotaBadge.tsx}`.
- `GET /me` incluye `aiNoticeAcceptedAt` (`meDto`, spec 01); si HOG-055 no lo añadió aún, se añade aquí.

**Tests**
- Unit (Testing Library + MSW): `AiQuotaBadge` en sus 3 estados; `AiNoticeDialog` aceptar/cancelar; `handleAiError`.
- Integración: —
- E2E: cubierto por E2E-09.

---

### HOG-656 · Reducir fotos en el cliente antes de subirlas

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-005
- **Spec:** `docs/specs/13-ia-nevera.md#71-componentes-de-núcleo-reutilizables-por-e10-y-e14` (RN-13-15)

**Descripción**
Utilidad `resizeImage(file)` que reduce cada foto a ≤ 1600 px por el lado mayor, JPEG 0,8, respetando la orientación EXIF y eliminando metadatos. La usan la nevera y el escaneo de tickets (E10).

**Criterios de aceptación**
- [ ] `apps/web/src/lib/image.ts` exporta `resizeImage(file: File): Promise<Blob>` y `ImageReadError`.
- [ ] Imágenes ya pequeñas también se re-codifican (para quitar EXIF).
- [ ] Orientación correcta (`createImageBitmap(..., { imageOrientation: 'from-image' })`).
- [ ] Error legible "No hemos podido leer esta foto. Prueba con otra o hazla con la cámara" si no se puede decodificar.

**Notas técnicas**
- Preferir `OffscreenCanvas` si existe; si no, `<canvas>` en memoria. Liberar el `ImageBitmap` con `close()`.

**Tests**
- Unit: con `createImageBitmap`/canvas simulados: cálculo de dimensiones (4000×3000 → 1600×1200; 1200×800 sin cambio de tamaño), tipo `image/jpeg`, calidad 0,8.
- Integración: —
- E2E: —

---

### HOG-657 · Construir la pantalla "¿Qué cocino?": fotos e ingredientes

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-652, HOG-655, HOG-656
- **Spec:** `docs/specs/13-ia-nevera.md#72-flujo-de-la-pantalla-4-pasos-una-sola-ruta`

**Descripción**
Ruta `/g/:groupId/nevera` con el store del flujo y los pasos 1 (Fotos) y 2 (Ingredientes), incluidos los estados de carga, cancelación, cuota agotada y "escribir a mano".

**Criterios de aceptación**
- [ ] Ruta registrada (lazy) y entrada "¿Qué cocino?" activada en la navegación (`apps/web/src/app/navigation.ts`, ver spec 15).
- [ ] Paso actual en `?paso=`; sin datos en el store se redirige a `fotos` (spec §7.2).
- [ ] Paso 1: cámara y galería, máximo 4 fotos, quitar foto, "Analizar fotos" con `DepthFigure` de cuota, cancelación con `AbortController`, "Prefiero escribir los ingredientes".
- [ ] Paso 2: lista editable (renombrar, quitar, añadir, evitar duplicados con "Ya está en la lista"), `notes`, estado vacío con los textos de la spec.
- [ ] Store `useFridgeStore` (Zustand) por `groupId`; las URLs de objeto se revocan tras `detect` correcto (RN-13-32).
- [ ] Estados de carga, error (toast vía `handleAiError`) y sin conexión (botones deshabilitados).

**Notas técnicas**
- `apps/web/src/features/fridge/{api.ts, store.ts, pages/FridgePage.tsx, components/PhotoStep.tsx, components/IngredientsStep.tsx}`.
- `useDetectIngredients()` envía `FormData` con `images` repetido; no añadir `Content-Type` a mano.

**Tests**
- Unit: `IngredientsStep` (añadir, duplicado, quitar, vacío); store (reset, revocación de URLs).
- Integración: —
- E2E: cubierto por E2E-09.

---

### HOG-658 · Añadir preferencias y comensales a "¿Qué cocino?"

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-657, HOG-653
- **Spec:** `docs/specs/13-ia-nevera.md#72-flujo-de-la-pantalla-4-pasos-una-sola-ruta` (Paso 3)

**Descripción**
Paso 3: comensales con resumen de dieta, raciones, tiempo, dificultad, franja, utensilios e interruptor de ingredientes extra, y llamada a `recipes`.

**Criterios de aceptación**
- [ ] Chips de comensales con `MemberDot`, todos seleccionados por defecto; si están todos, se envía `forUserIds: []`.
- [ ] Resumen de dieta por comensal desde `GET /groups/:g/diet-profiles` (E06); si falla, se muestran los chips sin resumen.
- [ ] Raciones por defecto = comensales seleccionados (1–12).
- [ ] Opciones de tiempo, dificultad, franja y utensilios exactamente como en la spec; `allowExtraIngredients` activado por defecto.
- [ ] "Proponer recetas" con `AiQuotaBadge feature="FRIDGE_RECIPES"`, skeleton ×3 y cancelación.

**Notas técnicas**
- `apps/web/src/features/fridge/components/PreferencesStep.tsx`. Formulario con React Hook Form + `fridgeRecipesInput`.
- `UTENSILS` y etiquetas de franja/dificultad desde `@hogaria/shared`.

**Tests**
- Unit: construcción del input (todos seleccionados → `[]`; raciones por defecto; "Sin límite" → `null`).
- Integración: —
- E2E: cubierto por E2E-09.

---

### HOG-659 · Mostrar las recetas propuestas con "tienes / te falta" y avisos

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-658, HOG-654
- **Spec:** `docs/specs/13-ia-nevera.md#72-flujo-de-la-pantalla-4-pasos-una-sola-ruta` (Paso 4)

**Descripción**
Paso 4: tarjetas de receta con ingredientes agrupados en "Tienes" y "Te falta", avisos de alérgenos con `LaneRope` de límite, cabecera de restricciones, "Otras recetas", "Empezar de nuevo" y estado sin recetas.

**Criterios de aceptación**
- [ ] Tarjeta con título, descripción, `DepthFigure` de minutos totales ("MIN"), dificultad, raciones, utensilios, alérgenos y pasos plegados.
- [ ] Grupos "Tienes" / "Te falta" con contador "Te faltan {n}".
- [ ] `allergenConflicts` no vacío → `LaneRope` variante de límite + bloque de avisos; otros warnings como aviso neutro.
- [ ] Cabecera "Teniendo en cuenta: …" y `notes` si existen.
- [ ] Estado 0 recetas con "Cambiar preferencias"; "Empezar de nuevo" con confirmación.
- [ ] Resultados anunciados con `aria-live="polite"`.

**Notas técnicas**
- `apps/web/src/features/fridge/components/{RecipesStep.tsx, FridgeRecipeCard.tsx}`.

**Tests**
- Unit: `FridgeRecipeCard` con y sin conflictos; agrupación tienes/falta; estado vacío.
- Integración: —
- E2E: cubierto por E2E-09.

---

### HOG-660 · Guardar una receta propuesta en el recetario

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-659, HOG-251
- **Spec:** `docs/specs/13-ia-nevera.md#55-mapeos-al-guardar-cliente` (RN-13-30)

**Descripción**
Botón "Guardar receta" que convierte la receta propuesta a `createRecipeInput` y la crea con `source: "AI_FRIDGE"` usando la mutación de E05.

**Criterios de aceptación**
- [ ] Mapeo exacto de la spec §5.5 (`parseLooseQuantity`, `note` con el texto original, `tags: ['ia']`).
- [ ] Botón deshabilitado durante la mutación; tras éxito pasa a "Guardada" y toast "Receta guardada" con acción "Ver" → `/g/:groupId/recetas/:id`.
- [ ] Error → toast con `ERROR_MESSAGES_ES` y el botón vuelve a estar disponible.
- [ ] Reutiliza el hook de creación de `features/recipes/api.ts` (no se duplica la llamada).

**Notas técnicas**
- `apps/web/src/features/fridge/mappers.ts` (`toCreateRecipeInput`). Requiere que `createRecipeInput` acepte `source` opcional (spec 05).

**Tests**
- Unit: `toCreateRecipeInput` ("al gusto" → `quantity: null`, `note: "al gusto"`).
- Integración: (API de E05) crear con `source: 'AI_FRIDGE'` persiste el origen.
- E2E: E2E-09.

---

### HOG-661 · Mandar los ingredientes que faltan a una lista de la compra

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-659, HOG-203
- **Spec:** `docs/specs/13-ia-nevera.md#72-flujo-de-la-pantalla-4-pasos-una-sola-ruta` (RN-13-31)

**Descripción**
Hoja "Añadir lo que falta": selector de lista, casillas preseleccionadas con lo que falta y opción de añadir lo que se tiene; llama al endpoint en bloque de E04.

**Criterios de aceptación**
- [ ] Lista por defecto: la primera no archivada por `position`.
- [ ] Faltantes preseleccionados; los disponibles plegados en "Añadir también algo que tengo".
- [ ] Mapeo de la spec §5.5 (`toShoppingUnit`, nota con el texto original).
- [ ] Éxito: toast "Añadidos {n} productos a {lista}" con "Ver lista"; 404 de la lista → "Esa lista ya no existe" y recarga de listas.
- [ ] Reutiliza el hook de alta en bloque de `features/shopping/api.ts`.

**Notas técnicas**
- `apps/web/src/features/fridge/components/AddMissingSheet.tsx`, `mappers.ts` (`toBulkShoppingItems`).

**Tests**
- Unit: `toBulkShoppingItems`; preselección.
- Integración: —
- E2E: E2E-09.

---

### HOG-662 · Escribir el e2e de la nevera (E2E-09)

- **Épica:** E13 · **Fase:** 3 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-660, HOG-661, HOG-011
- **Spec:** `docs/specs/13-ia-nevera.md#11-tests`

**Descripción**
Flujo e2e completo de la nevera con Gemini simulado en la API de test.

**Criterios de aceptación**
- [ ] Con `NODE_ENV=test` la API usa `FakeGeminiClient` con los fixtures `fridge-detect.ok.json` y `fridge-recipes.ok.json`.
- [ ] `apps/web/e2e/fridge.e2e.ts`: subir `e2e/fixtures/fridge.jpg` → aceptar aviso → quitar un ingrediente y añadir "huevos" → filtros → 3 recetas → guardar una (visible en `/recetas`) → añadir faltantes a "Compra" (visibles en la lista).
- [ ] Pasa en Pixel 7 y iPhone 14.

**Notas técnicas**
- La selección del fake se hace en `ai.module.ts` según `NODE_ENV`, nunca con una variable que pueda activarse en producción.

**Tests**
- E2E: **E2E-09**.
