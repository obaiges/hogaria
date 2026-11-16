# E11 · Gastos fijos y facturas

> Spec: `docs/specs/11-facturas.md` · Rango: HOG-550 – HOG-599 · Fase: 5
> Orden recomendado: HOG-550 → HOG-551 → HOG-552 → HOG-553 → HOG-554 → HOG-555 → HOG-556 → HOG-557 → HOG-558 → HOG-559 → HOG-560 → HOG-561.

### HOG-550 · Esquemas zod, constantes y cálculo puro de vencimientos

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/11-facturas.md#3-reglas-de-negocio`

**Descripción**
Esquemas de facturas y recibos, constantes de categorías y frecuencias, y las funciones puras `computeDueDates`, `isOverdue`, `computeBillFireAt` y `summarizeBillPayments`.

**Criterios de aceptación**
- [ ] `packages/shared/src/schemas/bills.ts` con `createBillInput`, `updateBillInput`, `billDto`, `billPaymentDto`, `listBillPaymentsQuery`, `payBillPaymentInput` (refine: `dueDay` 1–7 en `WEEKLY`, `endDate ≥ startDate`, rango ≤ 400 días).
- [ ] `packages/shared/src/constants/bills.ts` con `BILL_CATEGORY_META`, `BILL_FREQUENCY_LABELS`, `BILL_FREQUENCY_MONTHS`, `BILL_MATERIALIZE_DAYS_AHEAD`, `BILL_REMINDER_TIME`.
- [ ] `computeDueDates(bill, from, to)` cumple RN-11-05 a RN-11-07 y **todos** los ejemplos de RN-11-09.
- [ ] `isOverdue(payment, today)`; `computeBillFireAt(periodDueDate, reminderDaysBefore, tz)` (09:00 local); `summarizeBillPayments(payments, month)` → `{ totalCents, paidCents, pendingCents }` (RN-11-24).
- [ ] `formatBillPeriod(periodDueDate, frequency, today)` → "noviembre", "diciembre de 2025", "vie 13 nov" (semanal).

**Notas técnicas**
- `packages/shared/src/bills/due-dates.ts`. Trabajar con días `YYYY-MM-DD` (sin horas) para evitar efectos de zona.

**Tests**
- Unit: tabla de RN-11-09 completa, `endDate` inclusiva, ventana vacía, `summarizeBillPayments` con estimados nulos, `isOverdue` en el borde de medianoche.

---

### HOG-551 · API de facturas: CRUD, archivar y restaurar

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-550, HOG-003, HOG-004, HOG-101, HOG-106, HOG-151, HOG-153
- **Spec:** `docs/specs/11-facturas.md#5-api`

**Descripción**
`GET/POST /groups/:g/bills`, `GET/PATCH/DELETE /groups/:g/bills/:id` con `nextPayment`, archivar/restaurar por `PATCH { archived }`, eventos y actividad. Con `reminderDaysBefore` opcional.

**Criterios de aceptación**
- [ ] `Bill.reminderDaysBefore Int? @default(3)` (`null` = sin aviso) ya está en `docs/02-modelo-datos.md` y en el esquema inicial (HOG-004); si la BBDD se creó antes de ese cambio, este ticket añade la migración.
- [ ] `responsibleUserId` debe ser miembro actual (422); máximo 100 facturas activas (422).
- [ ] `GET /bills` ordenado por `nextPayment.periodDueDate` (sin próximo al final, luego por nombre); `?includeArchived=true`.
- [ ] Archivar borra los `PENDING` con `periodDueDate ≥ hoy` (RN-11-14); borrar elimina en cascada.
- [ ] `bill.created/updated/deleted` y actividad de la spec §9.
- [ ] La materialización y los avisos se enchufan en HOG-552 y HOG-554 (este ticket deja los puntos de llamada).
- [ ] `bills.member-removed.ts` registra en `MemberRemovedHooks` (HOG-106) un manejador que, con el `tx` recibido, pone a `null` el `responsibleUserId` de las facturas del grupo cuyo responsable sale; los avisos los recalcula el manejador de E12 (`rebuildGroup`).

**Notas técnicas**
- `apps/api/src/modules/bills/bills.controller.ts` + `bills.service.ts`.

**Tests**
- Integración `apps/api/test/bills.int.spec.ts`: CRUD, 422, archivar/restaurar, 401/404.

---

### HOG-552 · Materialización de recibos (al crear/editar y en el tick de 6 h)

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-551, HOG-153
- **Spec:** `docs/specs/11-facturas.md#3-reglas-de-negocio`

**Descripción**
`BillPaymentMaterializer` que crea los recibos `PENDING` de la ventana `[1.º del mes actual, hoy + 60 días]`, reajusta al editar (RN-11-13) y se registra como handler `bills.materialize` (orden 10) del `SchedulerTickRegistry` (HOG-153), que ejecuta el `MaintenanceCron`.

**Criterios de aceptación**
- [ ] Al crear, editar (cambios de calendario) y restaurar, dentro de la transacción del servicio.
- [ ] Edición: borra `PENDING` desde el mes actual que no encajan y sin `note`; nunca toca `PAID` ni meses anteriores.
- [ ] Tick: todas las facturas no archivadas, en lotes de 100, con `createMany({ skipDuplicates: true })`; idempotente; no emite eventos realtime.
- [ ] Ventana calculada con la zona de cada grupo.

**Notas técnicas**
- `apps/api/src/modules/bills/bill-payment-materializer.service.ts`; registro en `onModuleInit` de `BillsModule`.

**Tests**
- Integración: factura creada a mitad de mes con `startDate` anterior genera el recibo vencido del mes; dos ticks no duplican; edición de `dueDay` conserva pagados.

---

### HOG-553 · API de recibos: listar, pagar y deshacer

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-552
- **Spec:** `docs/specs/11-facturas.md#5-api`

**Descripción**
`GET /groups/:g/bill-payments?from&to&status&billId`, `POST /bill-payments/:id/pay` y `POST /bill-payments/:id/unpay`.

**Criterios de aceptación**
- [ ] Listado ordenado por `periodDueDate` y nombre, con `isOverdue` y el resumen `bill`; rango ≤ 400 días (422); filtro `billId` nuevo (añadir a `docs/04` en el mismo PR).
- [ ] `pay` cumple RN-11-16/17 (sobrescribe si ya estaba pagado; `paidAt ≤ ahora`); `unpay` cumple RN-11-18.
- [ ] Emite `bill_payment.updated` y `bill.updated` (cambia `nextPayment`); actividad "pagó Luz de noviembre (47,85 €)", "corrigió el pago…", "desmarcó el pago…".
- [ ] Llama a `scheduler.upsertForSource('BILL', billId)` tras el commit.

**Notas técnicas**
- `apps/api/src/modules/bills/bill-payments.controller.ts` + `bill-payments.service.ts`.

**Tests**
- Integración: pagar, corregir, deshacer (idempotente), 422 con `paidAt` futuro, 404 de otro grupo, eventos.

---

### HOG-554 · Proveedor de recordatorios de facturas (`BILL`)

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-601, HOG-553
- **Spec:** `docs/specs/11-facturas.md#3-reglas-de-negocio`

**Descripción**
`BillRemindersProvider` con `sourceType = 'BILL'` registrado en el `ReminderScheduler`, y llamadas `upsertForSource`/`cancelForSource` en los servicios de facturas.

**Criterios de aceptación**
- [ ] Por cada recibo `PENDING` de factura no archivada con `reminderDaysBefore ≠ null`, `fireAt` = RN-11-20; sin aviso si `fireAt ≤ ahora`.
- [ ] Destinatarios: responsable o todos los miembros actuales (RN-11-21); `title`/`body`/`url` según RN-11-22 (`/g/<groupId>/facturas?destacar=<billPaymentId>`).
- [ ] `computeForHorizon` en ≤ 3 consultas; `computeForGroup` implementado.
- [ ] Crear, editar, restaurar → `upsertForSource`; archivar, borrar → `cancelForSource` (RN-11-23).

**Notas técnicas**
- `apps/api/src/modules/bills/bill-reminders.provider.ts`.

**Tests**
- Integración: responsable recibe; sin responsable reciben todos; `null` no genera; pagar cancela; deshacer recrea si sigue en el futuro.

---

### HOG-555 · Hooks de datos y tiempo real de facturas (web)

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-553, HOG-006, HOG-152
- **Spec:** `docs/specs/11-facturas.md#6-eventos-en-tiempo-real`

**Descripción**
Hooks de facturas y recibos con mutaciones optimistas (pagar/deshacer) y manejadores de `bill.*` y `bill_payment.updated`.

**Criterios de aceptación**
- [ ] `apps/web/src/features/bills/api.ts`: `useBills({ includeArchived })` (`['group', g, 'bills', …]`), `useBillPayments(query)` (`['group', g, 'bill-payments', query]`), `useCreateBill`, `useUpdateBill`, `useDeleteBill`, `usePayBillPayment`, `useUnpayBillPayment`.
- [ ] `realtime.ts` según la spec §6 (setQueryData en todas las listas que contengan el recibo; invalidación de recibos al cambiar facturas; onda).

**Tests**
- Unit: manejadores con un `QueryClient` de prueba.

---

### HOG-556 · Pantalla Facturas: héroe, próximos vencimientos y lista

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-555, HOG-009, HOG-750, HOG-756
- **Spec:** `docs/specs/11-facturas.md#7-pantallas-y-ux`

**Descripción**
Ruta `/g/:groupId/facturas` con héroe (total del mes y vencidas), vistas "Próximos" y "Facturas", ficha de factura con historial y estados.

**Criterios de aceptación**
- [ ] Parámetros `?vista`, `?destacar=<billPaymentId>` (abre la hoja del recibo y reproduce la onda; inexistente → "Este recibo ya no existe") y `?factura=<billId>` (abre la ficha de la factura).
- [ ] `DepthFigure` del total mensual con "Pagado … · Pendiente …"; "N VENCIDAS" en variante `limit` si las hay.
- [ ] "Próximos": secciones "Vencidas" (separada por `LaneRope` `limit`, "Vencida hace 3 días"), "Esta semana", "Este mes", "Más adelante"; botón "Pagar" de 44 px.
- [ ] "Facturas": lista con frecuencia y día ("Mensual · día 5"), "Mostrar archivadas".
- [ ] Ficha con historial de 12 meses y acciones Editar / Archivar o Restaurar / Borrar (diálogo con opción de archivar).
- [ ] Estados obligatorios; entrada "Facturas y gastos fijos" en "Más".

**Notas técnicas**
- `apps/web/src/features/bills/pages/BillsPage.tsx`, `components/UpcomingList.tsx`, `BillList.tsx`, `BillDetailSheet.tsx`.

**Tests**
- Componentes: agrupación por secciones con la fecha simulada; corchera en vencidas; ficha.

---

### HOG-557 · Formulario de factura con vista previa de vencimientos

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-556, HOG-603
- **Spec:** `docs/specs/11-facturas.md#76-crear-o-editar-factura-hoja`

**Descripción**
Hoja de crear/editar factura con chips de sugerencia, frecuencia, día (1–31 o L–D), aviso, responsable y vista previa de los 3 próximos vencimientos.

**Criterios de aceptación**
- [ ] Campos y opciones de "Avisar" de la spec §7.6 (incluido "Sin aviso" → `null`).
- [ ] Ayudas de meses cortos y del ciclo; vista previa con `computeDueDates`.
- [ ] Tras guardar con aviso, `maybeAsk()` de HOG-603.
- [ ] Validación con `zodResolver`; toasts "Factura guardada".

**Notas técnicas**
- `apps/web/src/features/bills/components/BillFormSheet.tsx`.

**Tests**
- Componentes: semanal cambia el selector de día; vista previa para `dueDay` 31; "Sin aviso".

---

### HOG-558 · Pagar y deshacer pago (web)

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-556
- **Spec:** `docs/specs/11-facturas.md#75-pagar-recibo-hoja`

**Descripción**
Hoja "Pagar Luz · vence el vie 13 nov" con importe prellenado, fecha de pago y nota; deshacer con toast y desde la ficha.

**Criterios de aceptación**
- [ ] Importe prellenado con el estimado; fecha "Hoy" por defecto (envía `paidAt` = 12:00 local del día elegido).
- [ ] Toast "Luz marcada como pagada" + "Deshacer" (5 s → `unpay`); "Deshacer pago" en la ficha con `Dialog`.
- [ ] Actualización optimista con rollback.

**Tests**
- Componentes: cuerpo enviado; deshacer.

---

### HOG-559 · Historial y total mensual de gastos fijos

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-556
- **Spec:** `docs/specs/11-facturas.md#77-historial`

**Descripción**
Vista "Historial" con barras de 6 meses de lo pagado (mes actual con la parte pendiente estimada), lista por mes y tabla alternativa.

**Criterios de aceptación**
- [ ] Datos de `GET /bill-payments` del 1.º del mes − 5 al último día del mes actual; agregación con `summarizeBillPayments`.
- [ ] Recharts con colores de tokens; pendiente en trama clara; total encima de cada barra.
- [ ] Lista de recibos pagados por mes; "Ver como tabla".

**Tests**
- Componentes: agregación por mes y tabla alternativa.

---

### HOG-560 · E2E-12: factura mensual pagada

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-558, HOG-559, HOG-011
- **Spec:** `docs/specs/11-facturas.md#11-tests`

**Descripción**
Flujo crítico E2E-12 de `docs/07-testing.md`.

**Criterios de aceptación**
- [ ] `apps/web/e2e/bills.e2e.ts`: crear "Internet" mensual (inicio el día 1 del mes actual, vencimiento el día de hoy) → aparece pendiente en "Esta semana" → "Pagar" 39,90 € → sale de próximos → la ficha muestra "Pagada … 39,90 €" → "Historial" lo suma en el mes actual.
- [ ] Pasa en Pixel 7 y iPhone 14.

**Tests**
- E2E: E2E-12.

---

### HOG-561 · Capa "Facturas" en el calendario

- **Épica:** E11 · **Fase:** 5 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-460, HOG-555
- **Spec:** `docs/specs/09-calendario.md#3-reglas-de-negocio`

**Descripción**
Activar la capa "Facturas" del calendario (RN-09-23/24): recibos pendientes en el rango, en la calle "Hogar", con "Vencida" y corchera `limit`.

**Criterios de aceptación**
- [ ] Interruptor "Facturas" visible y activado por defecto.
- [ ] Usa `useBillPayments({ from, to, status: 'PENDING' })` con la misma clave que E11.
- [ ] Agenda, semana (calle "Hogar") y mes (icono `Receipt`); tocar → `/g/:g/facturas?destacar=<id>`.
- [ ] Vencidas con el texto "Vencida" y `LaneRope` `limit`.

**Notas técnicas**
- Nueva entrada en `apps/web/src/features/calendar/layers/`.

**Tests**
- Componentes: la capa pinta recibos y respeta el interruptor.
