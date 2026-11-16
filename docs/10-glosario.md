# 10 · Glosario (español ↔ código)

> **Obligatorio.** En la interfaz se usa la columna "Español (UI)". En el código, la columna "Código". No se inventan sinónimos: si "lista" ya es `ShoppingList`, no aparece un `PurchaseList`.

| Español (UI) | Código | Notas |
|---|---|---|
| Hogar / grupo | `Group` | En la UI se dice "hogar" o "grupo" según el contexto ("Tus hogares", "Ajustes del grupo"). Ruta `/g/:groupId` |
| Miembro | `GroupMember` | |
| Invitación | `GroupInvite` | Enlace `/invite/:token` |
| Color de calle | `laneColor` / `LaneColor` | Color identificativo del miembro |
| Calle | `Lane` (componente) | Fila por miembro en vistas de día y semana |
| Corchera | `LaneRope` (componente) | Separador decorativo y funcional entre calles |
| Cifra de profundidad | `DepthFigure` (componente) | Número clave rotulado (totales, contadores) |
| Onda | `ripple` (animación) | Resalta un cambio llegado en tiempo real |
| Lista de la compra | `ShoppingList` | |
| Producto (en lista) | `ShoppingItem` | En la UI: "producto" |
| Producto (catálogo) | `Product` | Lo que el grupo compra habitualmente |
| Indispensable | `isEssential` | "Indispensables" = productos que nunca deben faltar |
| Frecuentes | `frequent` | Ordenados por `purchaseCount` |
| Historial de compras | `Purchase` | |
| Pasillo | `Aisle` | Categoría del súper |
| Comprado / marcar | `checked` / `check` | |
| Vaciar comprados | `clearChecked` | |
| Receta | `Recipe` | |
| Ingrediente | `RecipeIngredient` | |
| Paso | `RecipeStep` | |
| Raciones | `servings` | |
| Utensilios | `utensils` | |
| Alérgenos | `Allergen` | 14 de la UE |
| Dieta | `Diet` / `DietProfile` | Omnívora, vegetariana, vegana, pescetariana |
| Planificador de comidas / menú | `MealPlan` / `MealPlanEntry` | |
| Franja | `MealSlot` | Desayuno `BREAKFAST`, Media mañana `MID_MORNING`, Comida `LUNCH`, Merienda `SNACK`, Cena `DINNER` |
| Tarea | `Task` | |
| Completar / hecha | `complete` / `TaskCompletion` | |
| Saltar esta vez | `skip` | |
| Rotación | `rotationMode` / `ROUND_ROBIN` | "Por turnos" en la UI |
| Le toca a | `currentAssigneeId` | |
| Horario de trabajo | `WorkSchedule` | |
| Franja horaria (trabajo) | `WorkScheduleSlot` | En la UI: "turno" |
| Excepción de horario | `WorkShiftOverride` | Libre, Vacaciones, Baja, Horario especial |
| Evento | `CalendarEvent` | |
| Calendario | `calendar` | |
| Gasto (de ocio) | `Expense` | |
| Categoría de gasto | `ExpenseCategory` | |
| Presupuesto | `Budget` | Mensual |
| Gasto fijo / factura | `Bill` | En la UI: "Facturas y gastos fijos" |
| Pago de factura / recibo | `BillPayment` | Estado "Pendiente" o "Pagada" |
| Recordatorio | `Reminder` | |
| Notificación | `push` / `PushSubscription` | |
| Actividad | `ActivityLog` | "Ana añadió Leche a Mercadona" |
| Inicio | `dashboard` | |
| Asistente | `assistant` / `AiConversation` | |
| Nevera (IA) | `fridge` | "¿Qué cocino?" en la UI |
| Ticket (IA) | `receipt` | "Escanear ticket" |
| Uso de IA / límite | `AiUsage` / `quota` | "Te quedan 7 análisis hoy" |
| Administrador | `isPlatformAdmin` | Solo el dueño de la instancia |
| Usuario eliminado | `displayUserName(null)` | Referencia a un usuario borrado o inexistente |
| Mostrar iniciales | `preferInitialsAvatar` | En lugar de la foto de Google |
| Consentimiento de salud | `healthConsentAt` | Casilla "Acepto que Hogaria trate mis alergias y restricciones para proponer comidas" |
| Destacar (deep link) | `?destacar=` / `useDeepLinkHighlight` | Scroll, foco y una onda; abre la hoja de detalle en tareas, calendario y facturas |
| Más | `MoreSheet` | Hoja con los módulos que no están en la barra inferior (no tiene ruta) |
| Sueles comprar | `frequent` | Texto de la UI para los frecuentes |
| Añadir indispensables que faltan | `addMissingEssentials` | |
| Comensales | `forUserIds` | Vacío = todo el hogar |
| Aviso de dieta | `MealWarning` / `getMealWarnings` | `ALLERGEN`, `DIET`, `DISLIKE` |
| Vencida | `isOverdue` | Derivado (tareas y recibos de facturas) |
| Repetición | `rrule` / `RecurrenceSpec` | |
| Por calles | vista `calles` (componente `Lane`) | `?vista=calles` en tareas |
| Horario efectivo | `EffectiveDay` / `computeEffectiveDay` | Horario de un día tras aplicar excepciones |
| Plantilla de horario | `WORK_SCHEDULE_TEMPLATES` | Solo rellena el formulario |
| Copiar día | `copyDay` | Acción del formulario de horario |
| No trabaja · Sin horario | `NOT_WORKING` · `NO_SCHEDULE` | Estados del horario efectivo |
| Ocurrencia | `occurrence` / `occurrenceStartsAt` | En la URL web: `?ocurrencia=` |
| Solo este evento · Toda la serie | `scope=this` · `scope=all` | |
| Capas del calendario | `calendarLayers` | |
| Categoría de evento | `EventCategory` | General `GENERAL`, Cumpleaños `BIRTHDAY`, Médico `MEDICAL`, Colegio `SCHOOL`, Trabajo `WORK`, Social `SOCIAL`, Viaje `TRAVEL`, Otros `OTHER` |
| Resumen mensual | `expenseSummary` | |
| Movimientos | lista de `Expense` | `?vista=movimientos` en gastos |
| Exmiembro | `isMember = false` | Autor de gastos que ya no está en el hogar |
| Estado del presupuesto | `OK` · `WARNING` · `EXCEEDED` | "Cerca del límite" (`WARNING`), "Superado" (`EXCEEDED`) |
| Próximos vencimientos | vista `proximos` | `?vista=proximos` en facturas |
| Responsable (factura) | `responsibleUserId` | Quién recibe el aviso; vacío = todos |
| Pagar · Deshacer pago | `pay` · `unpay` | |
| Categoría de factura | `BillCategory` | Alquiler, Hipoteca, Luz, Agua, Gas, Internet, Teléfono, Seguro, Suscripción, Comunidad, Impuestos, Colegio, Otros (`BILL_CATEGORY_META`) |
| Frecuencia de factura | `BillFrequency` | Semanal, Mensual, Bimestral, Trimestral, Semestral, Anual (`BILL_FREQUENCY_LABELS`) |
| Horas de silencio | `quietHoursStart` / `quietHoursEnd` | |
| Aviso de prueba | `push-subscriptions/test` | |
| Este dispositivo | suscripción con el `endpoint` local | |
| Activar avisos | `requestPermission` + `subscribe` | |
| Estado del recordatorio | `ReminderStatus` | Pendiente `PENDING`, Enviado `SENT`, Perdido `MISSED`, Fallido `FAILED`, Cancelado `CANCELLED` |
| Propuesta (asistente) | `pendingAction` | Estados `PENDING`, `EXECUTING`, `CONFIRMED` ("Hecho"), `REJECTED` ("Descartada"), `FAILED` ("No se ha podido hacer"), `EXPIRED` ("Caducada") (`AI_ACTION_STATUSES`) |
