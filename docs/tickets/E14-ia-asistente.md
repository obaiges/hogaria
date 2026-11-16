# E14 · IA: asistente por chat

> Spec: `docs/specs/14-ia-asistente.md` · Canónico: `docs/05-ia.md#flujo-3-asistente-por-chat` · Rango: HOG-700 – HOG-749 · Fase: 6
> Depende del núcleo de IA (HOG-650) y de que existan los servicios de E04–E11 que reutilizan las herramientas.

---

### HOG-700 · Definir los esquemas compartidos del asistente

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-002, HOG-650
- **Spec:** `docs/specs/14-ia-asistente.md#5-api`

**Descripción**
Esquemas zod y constantes del asistente en `packages/shared/src/schemas/assistant.ts`, para que API y web compartan contratos de conversaciones, mensajes, propuestas y eventos SSE.

**Criterios de aceptación**
- [ ] `createConversationInput`, `sendAssistantMessageInput`, `aiConversationDto`, `aiMessageDto`, `aiConversationDetailDto`, `pendingActionDto`, `AI_ACTION_STATUSES` como en la spec §5 y §5.2.
- [ ] `assistantStreamEvent` (unión discriminada por `event`) con los 6 eventos de §5.1.
- [ ] `ASSISTANT_TOOL_NAMES`, `assistantReadToolName`, `assistantWriteToolName` y `ASSISTANT_TOOL_LABELS` (textos "Consultando …" en español).
- [ ] Exportado desde el índice de `@hogaria/shared`.

**Notas técnicas**
- `ASSISTANT_TOOL_LABELS`: `get_shopping_lists` → "Consultando la lista de la compra…", `get_meal_plan` → "Consultando el menú…", `get_recipes` → "Buscando recetas…", `get_tasks` → "Consultando tareas…", `get_calendar` → "Consultando el calendario…", `get_work_schedules` → "Consultando horarios…", `get_expenses_summary` → "Consultando gastos…", `get_bills` → "Consultando facturas…", `get_diet_profiles` → "Consultando dietas…".

**Tests**
- Unit: parseo de ejemplos válidos e inválidos de cada evento SSE y de `pendingActionDto`.
- Integración: —
- E2E: —

---

### HOG-701 · Implementar la API de conversaciones del asistente

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-700, HOG-101
- **Spec:** `docs/specs/14-ia-asistente.md#conversaciones-y-privacidad`

**Descripción**
CRUD de conversaciones privadas: listar, crear, obtener con mensajes y borrar, con el filtro `groupId` + `userId` y el límite de 100.

**Criterios de aceptación**
- [ ] `GET/POST /groups/:g/assistant/conversations` y `GET/DELETE /groups/:g/assistant/conversations/:id`.
- [ ] Toda consulta usa `{ id, groupId, userId }`; conversación de otro miembro → 404 (RN-14-01/02).
- [ ] `POST` exige el aviso de IA (`@RequireAiNotice()`); los `GET` y `DELETE`, no.
- [ ] La 101.ª conversación borra la de `updatedAt` más antigua en la misma transacción (RN-14-04).
- [ ] `lastMessagePreview` y `hasPendingAction` calculados (este último: algún `pendingAction.status = 'PENDING'` con `expiresAt` futuro).
- [ ] Los mensajes `TOOL` no aparecen en `GET :id`.
- [ ] `AssistantConversationsService.deleteAllForMember(groupId, userId)` disponible (HOG-708 lo registra en `MemberRemovedHooks`, RN-14-07).

**Notas técnicas**
- `apps/api/src/modules/assistant/{assistant.module.ts, assistant-conversations.controller.ts, assistant-conversations.service.ts}`.
- Sin `ActivityLog` ni eventos de tiempo real (privado).

**Tests**
- Unit: cálculo de `lastMessagePreview`/`hasPendingAction`.
- Integración: `assistant-conversations.int.spec.ts`: 401, 404 grupo ajeno, 404 conversación de otro miembro, límite de 100.
- E2E: —

---

### HOG-702 · Crear el registro de herramientas y las de lectura de compra, recetas y menú

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-700, HOG-251, HOG-203, HOG-302
- **Spec:** `docs/specs/14-ia-asistente.md#53-herramientas`

**Descripción**
Infraestructura de herramientas (`AssistantTool`, `ToolRegistry`, `zodToGeminiSchema`, recorte a 8 KB, mapeo de usuarios a `{ userId, name }`) y las tres primeras herramientas de lectura: `get_shopping_lists`, `get_recipes` y `get_meal_plan`, reutilizando los servicios de E04, E05 y E06.

**Criterios de aceptación**
- [ ] `tool.types.ts` con `AssistantTool { name, kind, schema, label, run?, propose?, execute? }` y contexto `{ groupId, userId, clientMutationId }`.
- [ ] `zodToGeminiSchema()` soporta object, string, number, integer, boolean, enum, array, nullable y optional; lanza error en tipos no soportados (detectado en tests, no en producción).
- [ ] Validación de argumentos con zod; errores devueltos al modelo como `{ error, issues }` (RN-14-21).
- [ ] Recorte a 8 KB con `truncated: true` (RN-14-17); personas como `{ userId, name }` (RN-14-18).
- [ ] Ids recibidos validados contra el grupo; ajenos → `{ error: "No encontrado" }` (RN-14-19).
- [ ] Las tres herramientas llaman a métodos de los servicios de su módulo (sin Prisma en `assistant`, RN-14-20). Si falta un método de lectura, se añade en el módulo correspondiente.
- [ ] Registro con `@Optional()`: si un servicio no existe, su herramienta no se registra.

**Notas técnicas**
- `apps/api/src/modules/assistant/tools/{tool.types.ts, tool-registry.ts, zod-to-gemini.ts, shopping.tools.ts, recipes.tools.ts, meals.tools.ts}`.
- Límites de rango (≤ 31 días en `get_meal_plan`) como `refine` del esquema.

**Tests**
- Unit: `zodToGeminiSchema.spec.ts` con los esquemas reales; recorte a 8 KB; cada herramienta con servicios simulados.
- Integración: herramienta `get_shopping_lists` contra BBDD real devuelve solo listas del grupo.
- E2E: —

---

### HOG-703 · Añadir las herramientas de lectura de tareas, calendario y horarios

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-702, HOG-352, HOG-404, HOG-452
- **Spec:** `docs/specs/14-ia-asistente.md#53-herramientas`

**Descripción**
Herramientas `get_tasks`, `get_calendar` y `get_work_schedules` reutilizando `TasksService`, `CalendarEventsService.findRange` (con recurrencias expandidas) y `WorkSchedulesService.getGroupView`.

**Criterios de aceptación**
- [ ] Argumentos y rangos máximos de la spec (calendario ≤ 62 días, horarios ≤ 31).
- [ ] `get_tasks` admite `filter` `pending | overdue | today | all` calculados en la zona del grupo.
- [ ] Resultados con nombres de miembros y fechas en ISO + texto legible en español.

**Notas técnicas**
- `tools/{tasks.tools.ts, calendar.tools.ts, schedules.tools.ts}`.

**Tests**
- Unit: cada herramienta con servicios simulados (filtros y rangos).
- Integración: `get_calendar` no devuelve eventos de otro grupo.
- E2E: —

---

### HOG-704 · Añadir las herramientas de lectura de gastos, facturas y dietas

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-702, HOG-301, HOG-503, HOG-553
- **Spec:** `docs/specs/14-ia-asistente.md#53-herramientas`

**Descripción**
Herramientas `get_expenses_summary`, `get_bills` y `get_diet_profiles`.

**Criterios de aceptación**
- [ ] `get_expenses_summary` reutiliza `ExpensesService.summary` y añade importes formateados con `formatMoney`.
- [ ] `get_bills` por defecto hoy → +30 días y `PENDING`.
- [ ] `get_diet_profiles` devuelve dieta, alérgenos (etiqueta ES), restricciones y aversiones por miembro, sin emails.

**Notas técnicas**
- `tools/{expenses.tools.ts, bills.tools.ts, diet.tools.ts}`.

**Tests**
- Unit: con servicios simulados.
- Integración: —
- E2E: —

---

### HOG-705 · Orquestar el turno del asistente con streaming SSE

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-701, HOG-702
- **Spec:** `docs/specs/14-ia-asistente.md#mensajes-y-streaming`

**Descripción**
`POST .../messages` que guarda el mensaje del usuario, construye el contexto, llama a `GeminiClient.streamChat` con las herramientas, ejecuta las de lectura en bucle y emite los eventos SSE. Incluye añadir `streamChat` al `GeminiClient`.

**Criterios de aceptación**
- [ ] `GeminiClient.streamChat({ system, history, tools, signal })` implementado (y en `FakeGeminiClient` con guiones).
- [ ] Comprobaciones previas como problem+json: aviso, throttler `ai`, cuota `CHAT`, 409 si hay turno en curso (RN-14-09), 422 con 200 mensajes (RN-14-05).
- [ ] Contexto y prompt `assistant-system.v1` (RN-14-15/16, §5.5) con snapshot.
- [ ] Eventos `user_message`, `tool`, `delta`, `done`, `error` en el orden garantizado; `: ping` cada 15 s; cabeceras SSE de §5.1.
- [ ] Máximo 5 rondas (RN-14-14) y 60 s por turno (RN-14-13).
- [ ] Guarda mensajes `TOOL` (auditoría) y el `ASSISTANT` final; fija `title` con el primer mensaje (RN-14-03).
- [ ] Uso `CHAT` registrado una vez por turno; fallo antes de producir nada → borra el mensaje del usuario y `retryable: true` (RN-14-10/11); desconexión del cliente → abort y mensaje parcial (RN-14-12).

**Notas técnicas**
- `assistant-messages.controller.ts` escribe en `res` (Express) directamente; desactivar compresión para la ruta.
- `assistant-turn.service.ts` es un `AsyncGenerator` de eventos; el controller solo serializa. Escuchar `req.on('close')` para abortar.
- Añadir `flush_interval -1` al `deploy/Caddyfile` (`docs/06-despliegue.md`).

**Tests**
- Unit: `assistant-context.spec.ts`; bucle con guiones del fake (5 rondas, error a mitad).
- Integración: `assistant-stream.int.spec.ts` leyendo el stream con Supertest (`.buffer(true).parse(...)`): orden de eventos, 409, 422, fallo inicial, uso contado una vez.
- E2E: cubierto por E2E-13.

---

### HOG-706 · Implementar las herramientas de escritura como propuestas (pendingAction)

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-705, HOG-351, HOG-450
- **Spec:** `docs/specs/14-ia-asistente.md#53-herramientas` (escritura)

**Descripción**
Las 5 herramientas de escritura validan con el esquema REST del módulo, generan `summary` y `preview` en el servidor y crean un mensaje `ASSISTANT` con `pendingAction` sin ejecutar nada.

**Criterios de aceptación**
- [ ] `add_shopping_items`, `create_meal_plan_entries`, `create_recipe`, `create_task`, `create_calendar_event` con los esquemas reutilizados de `@hogaria/shared` (RN-14-21).
- [ ] `summary`/`preview` desde plantillas fijas (RN-14-23), `expiresAt = +24 h`, `status = PENDING`.
- [ ] Evento SSE `action` por propuesta; al modelo se devuelve `{ status: "proposed", summary }` (RN-14-22).
- [ ] Máximo 3 propuestas por turno.
- [ ] No se llama a ningún servicio de escritura durante el turno (verificado con espías en tests).

**Notas técnicas**
- `propose()` en cada `*.tools.ts`; plantillas en `tools/summaries.ts`.

**Tests**
- Unit: plantillas de `summary`/`preview` (singular/plural); límite de 3.
- Integración: propuesta guardada con los argumentos validados; listId ajeno → sin propuesta.
- E2E: cubierto por E2E-13.

---

### HOG-707 · Confirmar y descartar acciones propuestas

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-706
- **Spec:** `docs/specs/14-ia-asistente.md#herramientas` (RN-14-24..27)

**Descripción**
Endpoints `.../actions/:messageId/confirm` y `.../reject` con transición atómica de estado y ejecución mediante el servicio del módulo como una mutación normal.

**Criterios de aceptación**
- [ ] `PENDING → EXECUTING` con actualización condicional; si no aplica → 409 (RN-14-25).
- [ ] Caducada → 409 y `EXPIRED` (RN-14-24); `EXECUTING` de más de 2 min se trata como `PENDING`.
- [ ] Ejecuta `execute()` de la herramienta con `{ groupId, userId, clientMutationId }` del `X-Client-Mutation-Id`; el módulo genera actividad y evento.
- [ ] Éxito → `CONFIRMED` + `result` con `link`; 4xx → `FAILED` + error devuelto; 5xx → vuelve a `PENDING`.
- [ ] `reject`: `PENDING → REJECTED`, 409 en otro estado.
- [ ] `create_recipe` con `source: 'AI_CHAT'`; `create_calendar_event` con dueño = usuario (RN-14-27).

**Notas técnicas**
- `assistant-actions.service.ts`. Prisma: `updateMany({ where: { id, conversationId, pendingAction: { path: ['status'], equals: 'PENDING' } } })`.

**Tests**
- Unit: máquina de estados.
- Integración: `assistant-actions.int.spec.ts`: confirmar crea items y `ActivityLog`, evento con `clientMutationId`; doble confirmación 409; caducada; lista borrada → `FAILED`; conversación de otro miembro → 404.
- E2E: E2E-13.

---

### HOG-708 · Aplicar retención y borrado de conversaciones

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-701, HOG-106, HOG-153
- **Spec:** `docs/specs/14-ia-asistente.md#conversaciones-y-privacidad` (RN-14-06/07)

**Descripción**
Purga de conversaciones de más de 180 días dentro del cron de 6 h existente y borrado de las conversaciones al salir de un grupo.

**Criterios de aceptación**
- [ ] Handler `assistant.purge` (orden 30) registrado en el `SchedulerTickRegistry` (HOG-153): como mucho una vez cada 24 h, llama a `AssistantConversationsService.purgeOlderThan(180 días)` (conversaciones sin actividad, por `updatedAt`); no se crea un cron nuevo.
- [ ] El índice `@@index([updatedAt])` de `AiConversation` ya está en `docs/02-modelo-datos.md` y en el esquema inicial (HOG-004); si la BBDD se creó antes de ese cambio, este ticket añade la migración.
- [ ] Registra en `MemberRemovedHooks` (HOG-106) un manejador que llama a `deleteAllForMember(groupId, userId)` dentro de la transacción de salida o expulsión (RN-14-07).

**Notas técnicas**
- Borrado con `deleteMany` (los mensajes caen en cascada).

**Tests**
- Unit: —
- Integración: purga (conversación de 181 días borrada, de 179 conservada); salir del grupo borra las del usuario y no las de otros.
- E2E: —

---

### HOG-709 · Crear el cliente SSE y los hooks del asistente en la web

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-700, HOG-006
- **Spec:** `docs/specs/14-ia-asistente.md#51-protocolo-sse-de-post-messages`

**Descripción**
`lib/sse.ts` para consumir SSE sobre `fetch` (POST con cookies y `AbortSignal`) y los hooks de TanStack Query del asistente.

**Criterios de aceptación**
- [ ] `streamSse(url, { body, signal })` → `AsyncIterable<{ event, data }>`; tolera eventos partidos entre chunks y comentarios.
- [ ] Si la respuesta no es `text/event-stream`, se parsea como problem+json y se lanza el `ApiError` normal.
- [ ] Hooks `useConversations`, `useConversation(id)`, `useCreateConversation`, `useDeleteConversation`, `useSendAssistantMessage` (gestiona el stream y actualiza la caché), `useConfirmAction`, `useRejectAction` (con `X-Client-Mutation-Id`).
- [ ] Claves: `['group', g, 'assistant', 'conversations']` y `['group', g, 'assistant', 'conversation', id]`.

**Notas técnicas**
- `apps/web/src/lib/sse.ts`, `apps/web/src/features/assistant/api.ts`. Validar cada `data` con `assistantStreamEvent`.

**Tests**
- Unit: `sse.spec.ts` (chunks partidos, `: ping`, `error`, problem+json); hook de envío con MSW.
- Integración: —
- E2E: —

---

### HOG-710 · Construir la pantalla del asistente con streaming e historial

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-709, HOG-705, HOG-655, HOG-750
- **Spec:** `docs/specs/14-ia-asistente.md#7-pantallas-y-ux`

**Descripción**
Ruta `/g/:groupId/asistente` con conversación nueva, chat con streaming, chips de herramienta, lista de conversaciones, borrado y todos los estados.

**Criterios de aceptación**
- [ ] Ruta lazy registrada y entrada "Asistente" activada en `navigation.ts`.
- [ ] Conversación nueva con saludo, 6 sugerencias, nota de privacidad y `AiQuotaBadge feature="CHAT"`; el primer envío crea la conversación y sustituye la URL por `?c=<id>`.
- [ ] Burbujas, Markdown restringido (`react-markdown`, `skipHtml`), cursor de streaming, chips de `tool`, "Detener".
- [ ] Campo con contador desde 1800, Enter/Mayús+Enter, deshabilitado sin conexión o sin cuota (texto exacto de la spec).
- [ ] Hoja de conversaciones con preview, fecha relativa, indicador de propuesta pendiente y "Borrar conversación" con confirmación.
- [ ] Estados cargando, error, 404, error de stream con "Reintentar" y texto devuelto al campo.
- [ ] `aria-live` solo con el mensaje final; 375 px y modo oscuro.

**Notas técnicas**
- `apps/web/src/features/assistant/{pages/AssistantPage.tsx, components/MessageList.tsx, components/Composer.tsx, components/ConversationsSheet.tsx}`.
- Añadir `react-markdown` a `apps/web` (`docs/01-arquitectura.md`).

**Tests**
- Unit: `Composer` (contador, Enter, deshabilitado); `MessageList` con stream simulado; hoja vacía.
- Integración: —
- E2E: E2E-13.

---

### HOG-711 · Mostrar la tarjeta de acción con confirmar y descartar

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-710, HOG-707
- **Spec:** `docs/specs/14-ia-asistente.md#72-pantalla-de-chat` (tarjeta de acción)

**Descripción**
`AssistantActionCard` con los 6 estados de `pendingAction`, botones "Confirmar"/"Descartar" y enlace "Ver" al resultado.

**Criterios de aceptación**
- [ ] Textos exactos por estado (`PENDING`, `EXECUTING`, `CONFIRMED`, `REJECTED`, `EXPIRED`, `FAILED`).
- [ ] Botones deshabilitados durante la mutación y sin conexión; un 409 refresca la conversación sin mostrar error.
- [ ] Tras confirmar, la caché del módulo afectado se actualiza por el evento en tiempo real (no hace falta invalidarla a mano).
- [ ] Separación con `LaneRope` decorativa.

**Notas técnicas**
- `apps/web/src/features/assistant/components/AssistantActionCard.tsx`.

**Tests**
- Unit: los 6 estados; confirmar/descartar con MSW; 409.
- Integración: —
- E2E: E2E-13.

---

### HOG-712 · Añadir el botón flotante del asistente en Inicio

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 1
- **Capa:** web
- **Depende de:** HOG-710, HOG-755
- **Spec:** `docs/specs/14-ia-asistente.md#71-acceso`

**Descripción**
`AssistantFab` en la página de Inicio que lleva a `/g/:groupId/asistente`.

**Criterios de aceptación**
- [ ] 56 px, esquina inferior derecha, por encima de la barra inferior y respetando `safe-area-inset-bottom`.
- [ ] `aria-label="Abrir asistente"`, foco visible, solo en Inicio.
- [ ] No tapa el último elemento del Inicio (padding inferior añadido a la página).

**Notas técnicas**
- `apps/web/src/features/assistant/components/AssistantFab.tsx`, montado en `features/dashboard/pages/HomePage.tsx`.

**Tests**
- Unit: navega a la ruta correcta.
- E2E: E2E-13 entra por este botón.

---

### HOG-713 · Montar la evaluación del asistente con respuestas fake

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-707, HOG-703, HOG-704
- **Spec:** `docs/specs/14-ia-asistente.md#11-tests` (evaluación)

**Descripción**
Set de 16 escenarios con guiones del `FakeGeminiClient` y reloj fijo que comprueban que la orquestación llama a las herramientas correctas con argumentos válidos y crea las propuestas esperadas.

**Criterios de aceptación**
- [ ] Un fixture JSON por escenario en `apps/api/test/fixtures/ai/assistant/` con `question`, `script`, `expect`.
- [ ] Runner `assistant-eval.int.spec.ts` parametrizado (`it.each`) que verifica herramientas, argumentos, propuestas, 1 uso de `CHAT` y que nada se escribe antes de confirmar.
- [ ] Los 16 escenarios de la tabla de la spec pasan.
- [ ] Añadir un escenario nuevo solo requiere un JSON.

**Notas técnicas**
- Reloj fijo `2026-11-11T09:00:00+01:00` con `vi.setSystemTime`. Datos con factories (`createGroupWithMembers(3)` + listas "Mercadona" y "Compra").

**Tests**
- Integración: el propio runner.

---

### HOG-714 · Escribir el e2e del asistente (E2E-13)

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** full-stack
- **Depende de:** HOG-711, HOG-712, HOG-011
- **Spec:** `docs/specs/14-ia-asistente.md#11-tests`

**Descripción**
Flujo e2e del asistente con el guion fake "Añade leche a Compra".

**Criterios de aceptación**
- [ ] `apps/web/e2e/assistant.e2e.ts`: botón flotante de Inicio → aviso → pregunta → tarjeta → "Confirmar" → "Hecho" → "Leche" visible en `/g/:g/compra/:listId`.
- [ ] Pasa en Pixel 7 y iPhone 14.

**Notas técnicas**
- El fake elige el guion por el texto exacto de la pregunta (`assistant/add-milk.json`).

**Tests**
- E2E: **E2E-13**.

---

### HOG-715 · Crear un script de evaluación manual contra Gemini real

- **Épica:** E14 · **Fase:** 6 · **Prioridad:** P3 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-713
- **Spec:** `docs/specs/14-ia-asistente.md#11-tests`

**Descripción**
Script opcional `pnpm --filter api ai:eval` que ejecuta las preguntas de los escenarios contra Gemini real en local (base de datos local con el seed de demo) y genera un informe de qué herramientas eligió el modelo. Sirve para validar cambios de prompt antes de subir la versión.

**Criterios de aceptación**
- [ ] Nunca se ejecuta en CI (sale con error si `CI=true`).
- [ ] Informe en consola: pregunta, herramientas esperadas vs. llamadas, ✓/✗ y tokens usados.
- [ ] Respeta un máximo de 20 preguntas por ejecución para no agotar la cuota gratuita.

**Notas técnicas**
- `apps/api/src/cli/ai-eval.ts`, usa `GEMINI_API_KEY` local y el seed de demo (HOG-865).

**Tests**
- Unit: comparación esperado/obtenido.
