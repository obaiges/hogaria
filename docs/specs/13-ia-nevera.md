# 13 · IA: núcleo + nevera → recetas ("¿Qué cocino?")

> Épica: E13 · Tickets: `docs/tickets/E13-ia-nevera.md` · Modelo: `docs/02-modelo-datos.md` (secciones IA: `AiUsage`, `AiFeature`; AUTH: `User.aiNoticeAcceptedAt`; COMIDAS Y DIETA: `DietProfile`) · Documento canónico de IA: `docs/05-ia.md` (esta spec lo amplía y no lo contradice).

## 1. Objetivo

Dar a Hogaria una **capa de IA común** (cliente de Gemini con salida estructurada, cuotas diarias por grupo, aviso de privacidad, validación de imágenes) que reutilizan la nevera (E13), el asistente (E14) y el escaneo de tickets (E10). Sobre ella, construir el flujo **"¿Qué cocino?"**: el usuario hace de 1 a 4 fotos de la nevera o la despensa, revisa los ingredientes detectados, elige filtros y comensales y recibe 3 recetas con lo que "tienes" y lo que "te falta". Puede guardar una receta en el recetario y mandar lo que falta a una lista de la compra.

## 2. Historias de usuario

- **US-13-01** Como miembro, quiero ver y aceptar una sola vez un aviso claro de privacidad antes de usar la IA, para saber qué se envía a Google.
- **US-13-02** Como miembro, quiero hacer hasta 4 fotos (nevera, congelador, despensa) en un solo análisis, para que la IA vea todo lo que tengo.
- **US-13-03** Como miembro, quiero corregir la lista de ingredientes detectados (quitar, añadir, renombrar) antes de pedir recetas, porque la IA puede equivocarse.
- **US-13-04** Como miembro, quiero escribir los ingredientes a mano sin hacer fotos, para no gastar un análisis cuando ya sé lo que hay.
- **US-13-05** Como miembro, quiero filtrar por tiempo total, dificultad, utensilios, franja y raciones, para recibir recetas que pueda hacer hoy.
- **US-13-06** Como miembro, quiero elegir quién va a comer, para que las recetas respeten sus dietas y alergias.
- **US-13-07** Como miembro, quiero ver para cada receta qué ingredientes tengo y cuáles me faltan, y cualquier aviso de alérgenos.
- **US-13-08** Como miembro, quiero guardar una receta propuesta en el recetario del grupo.
- **US-13-09** Como miembro, quiero mandar los ingredientes que faltan a una lista de la compra con un toque.
- **US-13-10** Como miembro, quiero saber cuántos usos de IA le quedan hoy al grupo antes de usarla.

## 3. Reglas de negocio

### Núcleo de IA (compartido por E10, E13 y E14)

- **RN-13-01** La clave `GEMINI_API_KEY` solo existe en la API. El navegador nunca llama a Gemini ni recibe la clave. El modelo se lee de `GEMINI_MODEL`; si está vacío, la API **no arranca** (error de configuración en el bootstrap), para que no se use un nombre de modelo fijado en código.
- **RN-13-02** Toda llamada estructurada usa `responseMimeType: "application/json"` + `responseSchema` y valida la respuesta con el esquema zod equivalente. Si la validación falla, se **reintenta una sola vez** con la misma entrada; si vuelve a fallar → `503 AI_UNAVAILABLE`.
- **RN-13-03** Timeout de **30 s** por llamada a Gemini (incluido el reintento, cada intento tiene su propio timeout de 30 s). Un timeout → `503 AI_UNAVAILABLE`.
- **RN-13-04** Si Gemini responde 429 / `RESOURCE_EXHAUSTED` (cuota gratuita de Google agotada) → `503 AI_UNAVAILABLE` con `detail` "La IA está saturada, prueba en unos minutos". No se reintenta.
- **RN-13-05** **Aviso de privacidad:** todos los endpoints de IA que envían datos a Gemini o preparan su uso (`/groups/:g/ai/fridge/*`, `/groups/:g/ai/receipt` y, del asistente, los indicados en la spec 14 §5: crear conversación, enviar mensaje y confirmar acción) exigen `User.aiNoticeAcceptedAt != null`; si es `null` → `403 AI_NOTICE_REQUIRED`. `GET /groups/:g/ai/quota` **no** lo exige.
- **RN-13-06** Aceptar el aviso (`POST /me/ai-notice`) guarda `aiNoticeAcceptedAt = now()` solo si era `null` (idempotente: una segunda llamada devuelve la fecha original). El aviso es por usuario, no por grupo.
- **RN-13-07** **Cuota diaria por grupo y feature:** `used` = número de filas `AiUsage` con `success = true`, mismo `groupId` y `feature`, y `createdAt` dentro del día natural actual en la zona horaria del grupo (`Group.timezone`). `limit` sale de las variables `AI_LIMIT_FRIDGE_DETECT` (10), `AI_LIMIT_FRIDGE_RECIPES` (15), `AI_LIMIT_CHAT` (60) y `AI_LIMIT_RECEIPT` (20). `resetsAt` = siguiente 00:00 en la zona del grupo, expresado en UTC ISO.
- **RN-13-08** Antes de llamar a Gemini se comprueba `used < limit`; si no → `429 AI_LIMIT_REACHED` con las extensiones `feature`, `limit` y `resetsAt` en el problem+json. Se tolera un exceso de, como mucho, las peticiones concurrentes del mismo grupo que pasen la comprobación a la vez (no se usa bloqueo).
- **RN-13-09** Cada llamada a Gemini (éxito o fallo, incluidos los reintentos agrupados en una sola fila) registra una fila `AiUsage` con `model`, `inputTokens`, `outputTokens`, `success` y `errorCode` (`GEMINI_RATE_LIMITED`, `TIMEOUT`, `SCHEMA_INVALID`, `SAFETY_BLOCKED`, `UPSTREAM_ERROR`). **Solo las filas con `success = true` cuentan para la cuota.**
- **RN-13-10** Tras registrar un uso con `success = true` se publica `ai.quota.updated` en la sala del grupo con el `AiQuotaDto` de esa feature.
- **RN-13-11** Throttle adicional por usuario: **6 peticiones de IA por minuto** (todas las features juntas, throttler con nombre `ai`). Al superarlo → `429 RATE_LIMITED` con `Retry-After`. Un 429 del throttler no crea fila `AiUsage`.
- **RN-13-12** Orden de comprobaciones en todo endpoint de IA: `AuthGuard` → `GroupMemberGuard` → `AiNoticeGuard` → throttler `ai` → validación zod / imágenes → cuota (RN-13-08) → Gemini → registro de uso.
- **RN-13-13** **Imágenes:** de 1 a 4 por petición, tipo `image/jpeg`, `image/png` o `image/webp`, como mucho **5 MB** cada una. Se valida la **firma (magic bytes)**, no solo el MIME declarado: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF????WEBP`. Si falla cualquiera → `422 IMAGE_INVALID` y no se llama a Gemini ni se crea `AiUsage`.
- **RN-13-14** Las imágenes se reciben con almacenamiento **en memoria** (multer `memoryStorage`), se envían a Gemini en línea (base64) y se descartan: nunca se escriben a disco, a la base de datos ni a los logs. El servidor no reescala; reescalar es responsabilidad del cliente (RN-13-15).
- **RN-13-15** El cliente reduce cada foto antes de subirla: lado mayor **≤ 1600 px**, re-codificada a **JPEG calidad 0,8**, sin metadatos EXIF (al pasar por `<canvas>` se pierden, incluida la geolocalización).
- **RN-13-16** En los prompts nunca se envían emails ni nombres completos: los miembros aparecen por su `User.name` (nombre visible). En la nevera ni siquiera se envían nombres: las restricciones se agregan (RN-13-24).

### Nevera

- **RN-13-17** `detect` devuelve como mucho 60 ingredientes, en español, en minúsculas y sin duplicados (el servidor deduplica por `normalizeProductName` de `@hogaria/shared` conservando la primera aparición y la confianza más alta).
- **RN-13-18** Si `detect` devuelve 0 ingredientes, la respuesta es válida (200, lista vacía) y **sí** cuenta como uso; la interfaz muestra el estado "No hemos reconocido ningún ingrediente".
- **RN-13-19** La lista de ingredientes es editable en el cliente: quitar, añadir (texto libre 1–60 caracteres) y renombrar. Se exige al menos 1 ingrediente para pedir recetas. Máximo 60.
- **RN-13-20** Escribir ingredientes a mano (sin fotos) no consume la cuota de `FRIDGE_DETECT`.
- **RN-13-21** `forUserIds` debe contener solo miembros actuales del grupo; si alguno no lo es → `422 VALIDATION_ERROR` (`path: "forUserIds"`). Vacío = todos los miembros actuales.
- **RN-13-22** Un comensal sin `DietProfile` se trata como `OMNIVORE` sin alérgenos ni restricciones.
- **RN-13-23** Dieta efectiva = la más restrictiva de los comensales según el orden `VEGAN > VEGETARIAN > PESCATARIAN > OMNIVORE`.
- **RN-13-24** Restricciones efectivas = unión de `allergens`, `otherRestrictions` y `dislikes` de todos los comensales. Se envían al prompt **agregadas y sin nombres** ("Comensales: 3. Dieta: vegetariana. Alérgenos prohibidos: huevo, frutos de cáscara. Evitar: coliflor. Otras: sin lactosa").
- **RN-13-25** La respuesta de `recipes` contiene **entre 0 y 3 recetas**. Gemini debe devolver 3; si no puede cumplir las restricciones, devuelve menos y lo explica en `notes`. 0 recetas es una respuesta válida y cuenta como uso.
- **RN-13-26** **Defensa en profundidad de alérgenos** (servidor, tras validar la salida): para cada receta se calcula `detectedAllergens` = `allergens` declarados por la IA ∪ alérgenos encontrados por palabras clave en los nombres de sus ingredientes (`ALLERGEN_KEYWORDS` de `@hogaria/shared`, comparando con `normalizeProductName`). Se sustituye `allergens` por `detectedAllergens`. Si `detectedAllergens ∩ alérgenos de los comensales ≠ ∅`, se rellena `allergenConflicts` con la intersección y se añade un `warning` por alérgeno: "Contiene {alérgeno en minúsculas}, que algún comensal tiene marcado como alérgeno". La receta **no** se elimina, pero se muestra marcada (ver §7).
- **RN-13-27** Defensa de dieta: si `suitableDiets` de la receta no incluye la dieta efectiva (y la efectiva no es `OMNIVORE`), se añade el warning "Puede no ser apta para dieta {dieta en minúsculas}".
- **RN-13-28** **"Tienes / te falta":** el servidor recalcula `available` de cada ingrediente y sobrescribe el valor de la IA: `available = true` si el nombre normalizado del ingrediente coincide con algún ingrediente de entrada o con un básico de despensa (`PANTRY_BASICS` de shared: sal, aceite, aceite de oliva, agua, pimienta, vinagre, azúcar) según la regla de `matchesIngredient` (§5.4).
- **RN-13-29** Si `allowExtraIngredients = false`, el prompt pide no usar nada fuera de la lista + básicos; si aun así una receta tiene ingredientes con `available = false` (y no `optional`), se añade el warning "Necesita ingredientes que no tienes".
- **RN-13-30** Guardar una receta se hace con el endpoint normal de recetas (`POST /groups/:g/recipes`, HOG-251) con `source: "AI_FRIDGE"`. La IA no guarda nada por sí misma. Se aplican todas las reglas, la actividad y el tiempo real de E05.
- **RN-13-31** Mandar lo que falta se hace con `POST /groups/:g/shopping-lists/:id/items/bulk` (HOG-203). Por defecto se preseleccionan los ingredientes con `available = false`; el usuario puede desmarcar alguno o marcar otros. La deduplicación (sumar cantidades) es la de E04.
- **RN-13-32** El estado del flujo (fotos ya analizadas, ingredientes, filtros, resultados) vive solo en memoria del cliente (store Zustand por `groupId`). Sobrevive a cambiar de pestaña dentro de la app, no a recargar. Las fotos (blobs reducidos) se liberan (`URL.revokeObjectURL`) en cuanto `detect` responde con éxito.
- **RN-13-33** Las respuestas de `detect` y `recipes` no se guardan en la base de datos (solo la fila `AiUsage`).

## 4. Modelo de datos

- `User.aiNoticeAcceptedAt` (AUTH) — aceptación del aviso.
- `AiUsage` + enum `AiFeature` (IA) — contador de cuota y auditoría de consumo.
- `DietProfile` (COMIDAS Y DIETA) — solo lectura, para calcular restricciones.
- `Recipe`, `RecipeIngredient`, `RecipeStep` (RECETAS) — escritura a través de E05.
- `ShoppingItem` (COMPRA) — escritura a través de E04.

No hay tablas nuevas. Usa `User.aiNoticeAcceptedAt` (expuesto en `meDto`) y `AiUsage`.

## 5. API

Base `/api/v1`. Todas las rutas requieren sesión. Esquemas en `packages/shared/src/schemas/ai.ts`.

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| `POST` | `/me/ai-notice` | — (sin cuerpo) | `aiNoticeDto` | 401 |
| `GET` | `/groups/:g/ai/quota` | — | `AiQuotaDto[]` (las 4 features, orden de `AI_FEATURES`) | 401, 404 |
| `POST` | `/groups/:g/ai/fridge/detect` | `multipart/form-data`, campo `images` repetido 1–4 veces | `fridgeDetectDto` | 401, 403 `AI_NOTICE_REQUIRED`, 404, 422 `IMAGE_INVALID`, 429 `AI_LIMIT_REACHED` / `RATE_LIMITED`, 503 `AI_UNAVAILABLE` |
| `POST` | `/groups/:g/ai/fridge/recipes` | `fridgeRecipesInput` | `fridgeRecipesDto` | 401, 403 `AI_NOTICE_REQUIRED`, 404, 422 `VALIDATION_ERROR`, 429, 503 |

Endpoints de otros módulos que usa la pantalla (sin cambios de contrato):
- `POST /groups/:g/recipes` (E05, HOG-251) con `source: "AI_FRIDGE"`.
- `GET /groups/:g/shopping-lists` y `POST /groups/:g/shopping-lists/:id/items/bulk` (E04, HOG-203).
- `GET /groups/:g/members` (E02) y `GET /groups/:g/diet-profiles` (E06).

### 5.1 Esquemas de núcleo

```ts
// packages/shared/src/schemas/ai.ts
export const AI_FEATURES = ['FRIDGE_DETECT', 'FRIDGE_RECIPES', 'CHAT', 'RECEIPT'] as const;
export const aiFeatureSchema = z.enum(AI_FEATURES);

export const aiQuotaDto = z.object({
  feature: aiFeatureSchema,
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
  resetsAt: z.string().datetime(),          // siguiente 00:00 en la zona del grupo, en UTC
});
export type AiQuotaDto = z.infer<typeof aiQuotaDto>;

export const aiNoticeDto = z.object({
  aiNoticeAcceptedAt: z.string().datetime(),
});

// Extensiones del problem+json de AI_LIMIT_REACHED
export const aiLimitProblemExt = z.object({
  feature: aiFeatureSchema,
  limit: z.number().int(),
  resetsAt: z.string().datetime(),
});

// Etiquetas ES para la interfaz
export const AI_FEATURE_LABELS: Record<AiFeature, { one: string; many: string }> = {
  FRIDGE_DETECT:  { one: 'análisis',              many: 'análisis' },
  FRIDGE_RECIPES: { one: 'propuesta de recetas',  many: 'propuestas de recetas' },
  CHAT:           { one: 'mensaje al asistente',  many: 'mensajes al asistente' },
  RECEIPT:        { one: 'ticket escaneado',      many: 'tickets escaneados' },
};

export const AI_IMAGE_MAX_COUNT = 4;
export const AI_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AI_IMAGE_MAX_DIMENSION = 1600;
export const AI_IMAGE_JPEG_QUALITY = 0.8;
export const AI_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
```

### 5.2 `detect`

```ts
export const fridgeIngredientSchema = z.object({
  name: z.string().min(1).max(60),                 // "pimiento rojo"
  quantityHint: z.string().max(40).nullable(),     // "2 unidades", "medio paquete"
  confidence: z.enum(['high', 'medium', 'low']),
});
// Salida de Gemini y DTO de la API (idénticos)
export const fridgeDetectDto = z.object({
  ingredients: z.array(fridgeIngredientSchema).max(60),
  notes: z.string().max(300).nullable(),           // "La foto está oscura; puede faltar algo"
});
```

Multipart: el campo se llama `images` (en multer `FilesInterceptor('images', 4, { storage: memoryStorage(), limits: { fileSize: AI_IMAGE_MAX_BYTES, files: 4 } })`). Un `LIMIT_FILE_SIZE` o `LIMIT_FILE_COUNT` de multer se traduce a `422 IMAGE_INVALID` con `detail` "Cada foto puede ocupar como mucho 5 MB" o "Puedes subir como mucho 4 fotos".

### 5.3 `recipes`

```ts
export const fridgeRecipeFiltersSchema = z.object({
  maxTotalMinutes: z.number().int().min(5).max(240).nullable(), // prep + cook
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable(),     // máxima aceptada
  utensils: z.array(z.string().min(1).max(40)).max(10),          // disponibles; [] = sin restricción
  mealSlot: z.enum(['BREAKFAST', 'MID_MORNING', 'LUNCH', 'SNACK', 'DINNER']).nullable(),
  servings: z.number().int().min(1).max(12),
});

export const fridgeRecipesInput = z.object({
  ingredients: z.array(z.string().trim().min(1).max(60)).min(1).max(60),
  filters: fridgeRecipeFiltersSchema,
  forUserIds: z.array(z.string().uuid()).max(20),   // [] = todo el grupo
  allowExtraIngredients: z.boolean(),
});

// Salida de Gemini (validación previa a la post-validación del servidor)
export const fridgeRecipeAiSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500),
  servings: z.number().int().min(1).max(12),
  prepMinutes: z.number().int().min(0).max(600),
  cookMinutes: z.number().int().min(0).max(600),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  utensils: z.array(z.string().max(40)).max(10),
  allergens: z.array(AllergenEnum),
  suitableDiets: z.array(DietEnum),
  ingredients: z.array(z.object({
    name: z.string().min(1).max(60),
    quantity: z.string().max(20).nullable(),        // "200", "1/2", "al gusto"
    unit: z.string().max(20).nullable(),            // "g", "ud", "cucharada"
    available: z.boolean(),
  })).min(1).max(30),
  steps: z.array(z.string().min(1).max(600)).min(1).max(20),
  warnings: z.array(z.string().max(200)).max(10),
});
export const fridgeRecipesAiOutput = z.object({
  recipes: z.array(fridgeRecipeAiSchema).max(3),    // docs/05: hasta 3 recetas, más `notes`
  notes: z.string().max(300).nullable(),            // "Con huevo prohibido solo hemos encontrado 2 recetas"
});

// DTO de la API = salida de Gemini post-validada + campos de servidor
export const fridgeRecipeDto = fridgeRecipeAiSchema.extend({
  allergenConflicts: z.array(AllergenEnum),         // RN-13-26; [] si no hay
});
export const fridgeRecipesDto = z.object({
  recipes: z.array(fridgeRecipeDto).max(3),
  notes: z.string().max(300).nullable(),
  constraints: z.object({                            // eco de lo aplicado (RN-13-23/24)
    diners: z.number().int().min(1),
    diet: DietEnum,
    allergens: z.array(AllergenEnum),
    otherRestrictions: z.array(z.string()),
    dislikes: z.array(z.string()),
  }),
});
```

`AllergenEnum` y `DietEnum` son los de `packages/shared/src/constants` (creados en HOG-002 a partir de los enums Prisma).

### 5.4 Utilidades puras (shared)

`packages/shared/src/ai/`:
- `matchesIngredient(a: string, b: string): boolean` → normaliza ambos con `normalizeProductName`; `true` si son iguales o si **todas** las palabras del más corto aparecen en el más largo ("pimiento" ↔ "pimiento rojo" = true; "aceite" ↔ "aceite de oliva" = true; "leche" ↔ "leche de coco" = true, aceptado).
- `PANTRY_BASICS`: `['sal', 'aceite', 'aceite de oliva', 'agua', 'pimienta', 'vinagre', 'azúcar']`.
- `ALLERGEN_KEYWORDS: Record<Allergen, string[]>` (normalizadas): GLUTEN (harina, pan, pasta, trigo, cebada, centeno, cuscus, seitan, galleta, pan rallado), CRUSTACEANS (gamba, langostino, cigala, cangrejo, bogavante), EGGS (huevo, mayonesa), FISH (atun, salmon, merluza, bacalao, sardina, anchoa, boqueron), PEANUTS (cacahuete), SOY (soja, tofu, tempeh, edamame), MILK (leche, queso, nata, mantequilla, yogur, requeson, bechamel), TREE_NUTS (nuez, almendra, avellana, anacardo, pistacho, pinon), CELERY (apio), MUSTARD (mostaza), SESAME (sesamo, tahini), SULPHITES (vino, vinagre de vino), LUPIN (altramuz), MOLLUSCS (mejillon, almeja, calamar, sepia, pulpo, berberecho). La lista es ampliable sin cambiar la API. "leche de coco", "leche de avena" y similares darán falso positivo de MILK: se acepta (mejor avisar de más).
- `parseLooseQuantity(s: string | null): string | null` → `"200"`→`"200"`, `"1,5"`→`"1.5"`, `"1/2"`→`"0.5"`, `"½"`→`"0.5"`, `"2-3"`→`"3"`; cualquier otra cosa (`"al gusto"`) → `null`. Devuelve decimal como string con como mucho 2 decimales.
- `toShoppingUnit(unit: string | null): string | null` → mapea a `UNITS` de shared (`"gramos"`→`"g"`, `"unidad(es)"`→`"ud"`, `"litro(s)"`→`"l"`…); si no hay equivalencia → `null`.

### 5.5 Mapeos al guardar (cliente)

**Receta → `createRecipeInput` (E05):** `title`, `description`, `servings`, `prepMinutes`, `cookMinutes`, `difficulty`, `utensils`, `allergens` (ya post-validados), `suitableDiets`, `tags: ['ia']`, `source: 'AI_FRIDGE'`, `ingredients[i] = { name, quantity: parseLooseQuantity(q), unit, note: parseLooseQuantity(q) === null && q ? q : null, optional: false }`, `steps` = cada string en orden. Los `warnings` no se guardan.

**Faltantes → `bulkCreateShoppingItemsInput` (E04):** por ingrediente seleccionado `{ name, quantity: parseLooseQuantity(q), unit: toShoppingUnit(u), note: <texto original "q u" si quantity o unit quedaron en null y había texto; si no, null> }`.

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `ai.quota.updated` | Tras registrar un `AiUsage` con `success = true` de cualquier feature (nevera, asistente, ticket) | `AiQuotaDto` de esa feature |
| `recipe.created` | Al guardar una receta (lo emite E05) | `RecipeDto` |
| `shopping.items.bulk_created` | Al mandar faltantes (lo emite E04) | `{ listId, items }` |

Cliente: `features/ai/realtime.ts` aplica `setQueryData(['group', groupId, 'ai-quota'], …)` sustituyendo la entrada de la feature. No hay ripple (no es una fila visible de otro miembro).

## 7. Pantallas y UX

Ruta: **`/g/:groupId/nevera`**, título de pantalla **"¿Qué cocino?"**. Acceso desde la hoja "Más" ("¿Qué cocino?") y desde la tarjeta de acceso rápido del Inicio (E15). Sigue `DESIGN.md` (sistema "Piscina municipal"); los colores se refieren por nombre de token, nunca por hex.

### 7.1 Componentes de núcleo (reutilizables por E10 y E14)

- **`AiNoticeDialog`** (`features/ai/components/AiNoticeDialog.tsx`): diálogo modal que aparece la primera vez que el usuario intenta una acción de IA si `me.aiNoticeAcceptedAt === null`, o al recibir `AI_NOTICE_REQUIRED`. Tras aceptar, se repite la acción que lo disparó.
  - Título: **"Antes de usar la IA"**
  - Texto: "Para analizar fotos y proponer recetas, Hogaria envía a Google Gemini las fotos que hagas y los datos necesarios (ingredientes y, si eliges comensales, sus dietas y alergias, sin nombres). Usamos el plan gratuito de Gemini: **Google puede usar estos datos para mejorar sus productos** y algunas personas de Google pueden revisarlos. No envíes fotos con personas ni datos que no quieras compartir. Hogaria no guarda tus fotos."
  - Enlace: "Más información en la política de privacidad" → `/legal/privacidad#ia`.
  - Botones: **"Entendido, continuar"** (primario) y **"Ahora no"** (cierra sin aceptar).
- **`AiQuotaBadge`** (`features/ai/components/AiQuotaBadge.tsx`): prop `feature`. Texto "Te quedan {limit-used} {AI_FEATURE_LABELS[f].many} hoy" (singular si queda 1: "Te queda 1 análisis hoy"). Si `used >= limit`: "Habéis usado los {limit} {many} de hoy. Se renuevan a las 00:00" (hora de `resetsAt` formateada en la zona del grupo, `HH:mm`). Mientras carga: skeleton de una línea.
- **`useAiQuota(groupId)`** y **`useAcceptAiNotice()`** en `features/ai/api.ts`. Clave de query: `['group', groupId, 'ai-quota']`.
- **`handleAiError(error)`** (`features/ai/errors.ts`): mapea `AI_NOTICE_REQUIRED` → abre `AiNoticeDialog`; `AI_LIMIT_REACHED` → toast con el texto de límite; `AI_UNAVAILABLE` → toast "La IA está saturada, prueba en unos minutos" (o el `detail` recibido); `IMAGE_INVALID` → toast con `detail`; `RATE_LIMITED` → "Vas muy rápido. Espera un minuto".
- **`resizeImage(file): Promise<Blob>`** (`apps/web/src/lib/image.ts`): `createImageBitmap(file, { imageOrientation: 'from-image' })` → `<canvas>` (u `OffscreenCanvas`) con lado mayor ≤ 1600 px → `toBlob('image/jpeg', 0.8)`. Si el archivo no es imagen o no se puede decodificar (p. ej. HEIC no soportado por el navegador) → error "No hemos podido leer esta foto. Prueba con otra o hazla con la cámara".

### 7.2 Flujo de la pantalla (4 pasos, una sola ruta)

Cabecera de pantalla: título "¿Qué cocino?", y debajo un **`DepthFigure`** con la cuota de análisis: valor = restantes de `FRIDGE_DETECT`, rótulo "ANÁLISIS HOY". Indicador de pasos (1 Fotos · 2 Ingredientes · 3 Preferencias · 4 Recetas) separados por `LaneRope` decorativa. El botón atrás del sistema retrocede de paso (paso como `?paso=` en la URL: `fotos`, `ingredientes`, `preferencias`, `recetas`; sin parámetro = `fotos`). Si se entra directamente a un paso sin datos en el store, se redirige a `fotos`.

**Paso 1 · Fotos**
- Texto: "Haz fotos de la nevera, el congelador o la despensa. Puedes añadir hasta 4."
- Botones: **"Hacer foto"** (`<input type="file" accept="image/*" capture="environment">`) y **"Elegir de la galería"** (`accept="image/jpeg,image/png,image/webp" multiple`).
- Miniaturas en rejilla 2×2 con botón "Quitar foto" (icono X, `aria-label="Quitar foto {n}"`). Al llegar a 4, los botones de añadir se deshabilitan con el texto "Máximo 4 fotos".
- Primario: **"Analizar fotos"** (deshabilitado sin fotos). Secundario: **"Prefiero escribir los ingredientes"** → paso 2 con lista vacía (no consume cuota).
- Cargando (análisis): las miniaturas muestran una animación de onda (`ripple`; con `prefers-reduced-motion` solo un spinner estático) y el texto "Mirando qué hay… puede tardar unos segundos". El botón queda deshabilitado y se puede **cancelar** ("Cancelar", aborta el `fetch`).
- Cuota agotada: el primario se deshabilita y se muestra el texto de límite de `AiQuotaBadge`; sigue disponible "Prefiero escribir los ingredientes".

**Paso 2 · Ingredientes**
- Título: "Esto es lo que hemos visto". Si `notes` no es `null`, se muestra como aviso informativo encima.
- Lista editable: cada fila con el nombre (editable en línea, toque para editar), `quantityHint` en texto secundario y, si `confidence = "low"`, una etiqueta "¿seguro?" (las confianzas `high` y `medium` no muestran nada). Botón "Quitar" por fila (`aria-label="Quitar {nombre}"`).
- Campo **"Añadir ingrediente"** + botón "Añadir" (Enter también añade). Duplicados (por `normalizeProductName`) se ignoran con el texto "Ya está en la lista".
- Vacío (0 detectados): "No hemos reconocido ningún ingrediente. Añádelos a mano o prueba con otra foto con más luz." con botones "Volver a las fotos" y el campo de añadir.
- Primario: **"Elegir preferencias"** (deshabilitado con 0 ingredientes).

**Paso 3 · Preferencias**
- **Comensales ("¿Quién come?")**: chips por miembro con `MemberDot` y nombre, todos seleccionados por defecto; debajo de cada chip seleccionado con perfil restrictivo, una línea secundaria con el resumen ("vegetariana · sin huevo"). Datos de `GET /groups/:g/diet-profiles` (E06); si falla esa carga, se muestran los chips sin resumen (no bloquea).
- **Raciones**: stepper 1–12, por defecto = número de comensales seleccionados.
- **Tiempo total**: segmentado "Sin límite · 15 min · 30 min · 45 min · 1 h · 1 h 30" → `maxTotalMinutes` `null|15|30|45|60|90`.
- **Dificultad**: "Cualquiera · Fácil · Media · Difícil" → `null|EASY|MEDIUM|HARD`.
- **Franja**: "Cualquiera · Desayuno · Media mañana · Comida · Merienda · Cena".
- **Utensilios que tienes (opcional)**: chips multiselección de `UTENSILS` (shared, E05), máximo 10. Ninguno = sin restricción.
- **Interruptor** "Permitir algún ingrediente que no tengo" (`allowExtraIngredients`, por defecto **activado**).
- Primario: **"Proponer recetas"** con `AiQuotaBadge feature="FRIDGE_RECIPES"` debajo.
- Cargando: tarjetas skeleton ×3 y "Pensando recetas…" (cancelable).

**Paso 4 · Recetas**
- Si `constraints` es restrictivo, cabecera "Teniendo en cuenta: {dieta}, sin {alérgenos}" (lista separada por comas).
- Si `notes` no es `null`, aviso informativo.
- Hasta 3 tarjetas de receta. Cada tarjeta: título, descripción, metadatos (`DepthFigure` pequeño con minutos totales rotulado "MIN", dificultad, raciones), utensilios, alérgenos (chips), y la lista de ingredientes en dos grupos **"Tienes"** y **"Te falta"** (con contador "Te faltan 3").
- Si `allergenConflicts.length > 0`: la tarjeta lleva una **`LaneRope` en su variante de límite (roja/blanca)** en el borde superior y un bloque de aviso con los `warnings`. Otros `warnings` se muestran como avisos neutros.
- Pasos de la receta plegados ("Ver pasos").
- Acciones por tarjeta:
  - **"Guardar receta"** → `POST /recipes`. Éxito: el botón pasa a "Guardada" (deshabilitado, con check) y toast "Receta guardada" con acción "Ver" → `/g/:groupId/recetas/:id`. Error: toast con `ERROR_MESSAGES_ES` y el botón vuelve a estar disponible.
  - **"Añadir lo que falta"** (solo si hay alguno con `available = false`) → abre una hoja inferior: selector de lista ("¿A qué lista?", por defecto la primera no archivada por `position`), casillas con los ingredientes que faltan (preseleccionados) y los que tienes (no preseleccionados, plegados en "Añadir también algo que tengo"). Primario "Añadir {n} productos". Éxito: toast "Añadidos {n} productos a {lista}" con acción "Ver lista" → `/g/:groupId/compra/:listId`.
- Pie: **"Otras recetas"** (vuelve a llamar a `recipes` con los mismos datos; consume cuota) y **"Empezar de nuevo"** (vacía el store y vuelve al paso 1, pide confirmación si hay recetas sin guardar: "¿Empezar de nuevo? Perderás estas recetas").
- 0 recetas: "No hemos encontrado recetas que cumplan todo. Prueba a quitar algún filtro o a permitir ingredientes que no tienes." con botón "Cambiar preferencias".

### 7.3 Estados generales

- **Cargando inicial** (cuota y miembros): skeleton de la cabecera y del paso 1.
- **Error** al cargar la cuota: el `DepthFigure` muestra "—" y el resto funciona; los errores de IA se muestran por toast (§7.1) sin perder el estado del paso.
- **Sin conexión**: banner global del shell (E15) "Sin conexión. Los cambios no se guardarán"; los botones "Analizar fotos", "Proponer recetas", "Guardar receta" y "Añadir lo que falta" se deshabilitan. Se puede seguir editando la lista de ingredientes (es estado local).
- **Accesibilidad**: cada paso tiene un `<h2>` con foco al cambiar de paso; los resultados se anuncian con `aria-live="polite"` ("3 recetas propuestas"); objetivos táctiles ≥ 44 px.

## 8. Permisos

- Cualquier miembro del grupo puede usar la nevera; la cuota es **compartida** por el grupo.
- El aviso es por usuario: aceptar en un grupo vale para todos sus grupos.
- La receta guardada pertenece al grupo (cualquier miembro la edita, regla general de E05).
- Usuario de otro grupo → 404 en todos los endpoints `/groups/:g/ai/*`.

## 9. Actividad

Los endpoints `detect`, `recipes`, `quota` y `ai-notice` **no** generan `ActivityLog`. Generan actividad, a través de sus propios servicios:
- Guardar receta → la de E05 (`entityType: "recipe"`, `action: "created"`, p. ej. "guardó la receta Tortilla de calabacín").
- Faltantes a la lista → la de E04 para la creación en bloque (p. ej. "añadió 4 productos a Compra").

## 10. Casos límite

- Foto HEIC en iOS: Safari la convierte a JPEG al elegirla con `accept="image/*"`; si el navegador no puede decodificarla, `resizeImage` falla con el mensaje de §7.1 y no se sube.
- Foto mayor de 5 MB tras reducir (casi imposible a 1600 px): el servidor responde `IMAGE_INVALID`.
- Archivo renombrado `.jpg` que no es una imagen: magic bytes → `IMAGE_INVALID`.
- Gemini devuelve JSON válido pero con ingredientes en inglés: el prompt lo prohíbe; no hay corrección automática; el usuario puede editarlos.
- Gemini devuelve más de 3 recetas o un campo fuera de rango → falla zod → reintento → `AI_UNAVAILABLE` (fila `AiUsage` con `SCHEMA_INVALID`).
- Respuesta bloqueada por filtros de seguridad de Gemini → `AI_UNAVAILABLE`, `errorCode: SAFETY_BLOCKED`, `detail` "La IA no ha podido procesar estas fotos".
- Un comensal sale del grupo entre el paso 3 y el envío → 422 en `forUserIds`; el cliente refresca miembros y muestra "La lista de comensales ha cambiado".
- Medianoche en la zona del grupo entre dos peticiones: la cuota se reinicia; el cliente se entera por `ai.quota.updated` del siguiente uso o al reenfocar (TanStack Query `refetchOnWindowFocus`).
- El usuario cancela una petición en curso: el servidor puede completar la llamada a Gemini; si lo hace con éxito, **cuenta** como uso (se acepta).
- Doble toque en "Guardar receta": el botón se deshabilita durante la mutación; no hay idempotencia en servidor.
- La lista de destino se borra mientras la hoja está abierta → 404 → toast "Esa lista ya no existe" y se recargan las listas.
- Grupo con un único miembro: el selector de comensales muestra solo a ese miembro.

## 11. Tests

**Unitarios (Vitest)**
- `ai-quota.service.spec.ts`: cuenta solo `success = true`; día natural en `Europe/Madrid` y en otra zona (`America/New_York`) alrededor de la medianoche y del cambio de hora; `resetsAt` correcto; lanza `AI_LIMIT_REACHED` con extensiones.
- `gemini.client.spec.ts` (con SDK simulado): reintento único ante zod inválido; timeout de 30 s con temporizadores falsos; 429 → `AI_UNAVAILABLE` sin reintento.
- `image.util.spec.ts`: magic bytes válidos/inválidos de JPEG, PNG, WebP; tamaño > 5 MB; más de 4 archivos.
- `ai-notice.guard.spec.ts`: `null` → `AI_NOTICE_REQUIRED`; fecha → pasa.
- `packages/shared/src/ai/*.spec.ts`: `matchesIngredient`, `parseLooseQuantity`, `toShoppingUnit`, detección por `ALLERGEN_KEYWORDS`.
- `diet-constraints.spec.ts`: dieta más restrictiva, unión de restricciones, comensal sin perfil.
- `allergen-guard.spec.ts`: añade alérgeno detectado por palabra clave, rellena `allergenConflicts` y `warnings`; aviso de dieta; recálculo de `available`.
- Prompts: snapshot de `fridge-detect.v1` y `fridge-recipes.v1` con una entrada fija (comprueba que no aparecen nombres ni emails).
- Web: `resizeImage` (con canvas simulado: respeta 1600 px y calidad), `AiQuotaBadge` (singular/plural/agotado), `AiNoticeDialog` (aceptar repite la acción).

**Integración (Supertest, `apps/api/test/ai/*.int.spec.ts`, Gemini fake con `apps/api/test/fixtures/ai/fridge-detect.ok.json`, `fridge-recipes.ok.json`, `fridge-recipes.allergen-leak.json`)**
- Autorización: sin sesión 401; otro grupo 404; aviso no aceptado 403 `AI_NOTICE_REQUIRED`.
- `POST /me/ai-notice` idempotente.
- `detect`: 1 y 4 imágenes OK; 5 imágenes, PNG falso y 6 MB → 422 `IMAGE_INVALID` sin fila `AiUsage`.
- Cuota: con `AI_LIMIT_FRIDGE_DETECT=2`, la 3.ª llamada → 429 con `resetsAt`; un fallo de Gemini no consume cuota; se emite `ai.quota.updated` solo en éxitos.
- `recipes`: `forUserIds` con un usuario ajeno → 422; el fixture `allergen-leak` (receta con "huevo" sin declarar `EGGS` y comensal alérgico) devuelve `allergenConflicts: ['EGGS']` y el warning.
- Throttle: 7.ª petición en un minuto del mismo usuario → 429 `RATE_LIMITED`.

**E2E (Playwright)**
- **E2E-09**: nevera → subir foto (fixture `apps/web/e2e/fixtures/fridge.jpg`) → aceptar aviso → editar ingredientes (quitar uno, añadir "huevos") → elegir filtros → recetas (fake) → guardar receta (aparece en `/recetas`) → "Añadir lo que falta" a "Compra" (aparecen en la lista).

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `POST /me/ai-notice` → `docs/04` (fila "Yo").
- `meDto.aiNoticeAcceptedAt` → `docs/04` (fila "Yo"); ya estaba en el `meDto` de la spec 01.
- Salida de `recipes` con `.max(3)` + `notes`, y `allergenConflicts`/`constraints` en el DTO → `docs/05`.
- `GET /ai/quota` con las 4 features en orden y extensiones de `AI_LIMIT_REACHED` → `docs/05` y `docs/04`.
- Reducción de imágenes en el cliente → `docs/05` (principio 3).
- `source` opcional en `createRecipeInput` → ya recogido en la spec 05 (RN-05-08).
- La API no arranca con `GEMINI_MODEL` vacío → `docs/06` (Variables de entorno) y `docs/05` (principio 5).

## 13. Fuera de alcance

- Inventario o despensa persistente (no se guardan los ingredientes detectados).
- Guardar o reutilizar fotos.
- Información nutricional o calorías.
- Planificar directamente la receta propuesta en el menú (se guarda y se planifica desde E06).
- Elegir modelo de IA desde la interfaz.
- Reescalado o recorte de imágenes en el servidor.
