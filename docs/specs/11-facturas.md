# 11 · Gastos fijos y facturas

> Épica: E11 · Tickets: `docs/tickets/E11-facturas.md` · Modelo: `docs/02-modelo-datos.md` (sección "Gastos fijos y facturas": `Bill`, `BillPayment`, enums `BillCategory`, `BillFrequency`, `BillPaymentStatus`) · Recordatorios: `docs/specs/12-notificaciones.md`

## 1. Objetivo

Que el hogar tenga controlados los gastos que se repiten (alquiler, luz, agua, internet, seguros, colegio…): cuándo vence cada recibo, si ya se ha pagado, cuánto costó y cuánto suman al mes. Las facturas son **compartidas**: cualquier miembro las crea, edita y marca como pagadas. Un aviso push llega unos días antes del vencimiento al responsable (o a todos).

## 2. Historias de usuario

- **US-11-01** Como miembro, quiero dar de alta un gasto fijo con su frecuencia, día de vencimiento e importe estimado.
- **US-11-02** Como miembro, quiero ver los próximos vencimientos ordenados y los recibos vencidos sin pagar.
- **US-11-03** Como miembro, quiero marcar un recibo como pagado con el importe real, y deshacerlo si me equivoco.
- **US-11-04** Como responsable de una factura, quiero un aviso N días antes del vencimiento.
- **US-11-05** Como miembro, quiero ver el historial de pagos de cada factura y el total mensual de gastos fijos.
- **US-11-06** Como miembro, quiero archivar una factura que ya no pagamos sin perder su historial.

## 3. Reglas de negocio

**Factura (`Bill`)**

- **RN-11-01** Cualquier miembro del grupo puede crear, editar, archivar, borrar y pagar facturas (sin propiedad).
- **RN-11-02** Campos: `name` 1–60; `provider` ≤ 60 o `null`; `category` del enum; `estimatedAmountCents` 1–10 000 000 o `null`; `frequency`; `dueDay`; `startDate`; `endDate` (`null` o ≥ `startDate`); `reminderDaysBefore` 0–30 o `null` = sin aviso; `responsibleUserId` = miembro actual del grupo o `null` (= todos); `notes` ≤ 500 o `null`.
- **RN-11-03** `dueDay`: con `WEEKLY`, 1–7 (ISO: 1 = lunes); con el resto, 1–31. Fuera de rango → `422`.
- **RN-11-04** Máximo 100 facturas no archivadas por grupo → `422`.

**Cálculo de vencimientos** (función pura `computeDueDates(bill, from, to)` en `packages/shared`, sobre días `YYYY-MM-DD` sin horas)

- **RN-11-05** Intervalo en meses por frecuencia: `MONTHLY` 1, `BIMONTHLY` 2, `QUARTERLY` 3, `SEMIANNUAL` 6, `YEARLY` 12.
- **RN-11-06** Frecuencias mensuales: el **mes ancla** es el mes de `startDate`. Los periodos son los meses `ancla + k × intervalo` (k ≥ 0). En cada uno, el vencimiento es el día `min(dueDay, último día de ese mes)`. Se conservan los vencimientos con `startDate ≤ vencimiento ≤ (endDate ?? ∞)`.
- **RN-11-07** `WEEKLY`: los vencimientos son todos los días con día ISO de la semana = `dueDay` y `≥ startDate` (y `≤ endDate`).
- **RN-11-08** Para cambiar el mes de una factura anual (o el ciclo de una bimestral) se cambia `startDate`; no hay campo de mes.
- **RN-11-09** **Ejemplos** (deben ser tests):
  | Factura | Vencimientos |
  |---|---|
  | `MONTHLY`, `dueDay` 31, inicio 2026-01-01 | 2026-01-31, 2026-02-28, 2026-03-31, 2026-04-30, 2026-05-31 |
  | `MONTHLY`, `dueDay` 30, inicio 2028-01-15 | 2028-01-30, **2028-02-29** (bisiesto), 2028-03-30 |
  | `MONTHLY`, `dueDay` 29, inicio 2027-02-01 | **2027-02-28**, 2027-03-29 |
  | `MONTHLY`, `dueDay` 5, inicio 2026-11-11 | 2026-12-05 (el 05/11 es anterior al inicio), 2027-01-05 |
  | `BIMONTHLY`, `dueDay` 5, inicio 2026-01-20 | 2026-03-05, 2026-05-05, 2026-07-05 (el 05/01 es anterior al inicio y el ciclo sigue el ancla de enero) |
  | `QUARTERLY`, `dueDay` 15, inicio 2026-02-01 | 2026-02-15, 2026-05-15, 2026-08-15, 2026-11-15 |
  | `YEARLY`, `dueDay` 31, inicio 2026-02-10 | 2026-02-28, 2027-02-28, 2028-02-29 |
  | `WEEKLY`, `dueDay` 5 (viernes), inicio 2026-11-11 (miércoles) | 2026-11-13, 2026-11-20, 2026-11-27 |
  | `MONTHLY`, `dueDay` 10, inicio 2026-01-01, fin 2026-03-10 | 2026-01-10, 2026-02-10, 2026-03-10 |

**Recibos (`BillPayment`) y materialización**

- **RN-11-10** Un `BillPayment` representa el recibo de un periodo (`@@unique([billId, periodDueDate])`). Estado `PENDING` ("Pendiente") o `PAID` ("Pagada"). **Vencida** es derivado: `status = PENDING` y `periodDueDate < hoy` (zona del grupo); no se guarda.
- **RN-11-11** **Ventana de materialización:** `[primer día del mes actual, hoy + 60 días]` (zona del grupo). Para cada factura no archivada se crean (`createMany` con `skipDuplicates`) los recibos `PENDING` de los vencimientos de `computeDueDates` dentro de la ventana.
- **RN-11-12** La materialización se ejecuta: (a) al crear una factura; (b) al editarla; (c) al restaurarla del archivo; (d) en cada tick de 6 h del `MaintenanceCron` (handler `bills.materialize`, orden 10, registrado en el `SchedulerTickRegistry` que crea E03; spec 03 RN-03-25), para todas las facturas no archivadas de todos los grupos, en lotes de 100 facturas por consulta.
- **RN-11-13** **Al editar** una factura (cambio de `frequency`, `dueDay`, `startDate` o `endDate`), en la misma transacción: se borran los recibos `PENDING` con `periodDueDate ≥ primer día del mes actual` que **ya no** correspondan al nuevo calendario y que no tengan `note`; se crean los que falten. Los `PAID` nunca se tocan. Los `PENDING` de meses anteriores al actual tampoco.
- **RN-11-14** **Archivar** (`PATCH { archived: true }`): `archivedAt = ahora`; se borran los recibos `PENDING` con `periodDueDate ≥ hoy`; se conservan los pagados y los vencidos; se cancelan los recordatorios. **Restaurar** (`archived: false`) vuelve a materializar.
- **RN-11-15** **Borrar** una factura: borrado físico con sus recibos (cascada) y cancelación de recordatorios. La UI pide confirmación porque se pierde el historial.

**Pagar y deshacer**

- **RN-11-16** `POST /bill-payments/:id/pay` con `amountCents` (obligatorio, 1–10 000 000; la UI lo prellena con el estimado), `paidAt` opcional (instante ≤ ahora; por defecto ahora) y `note` opcional (≤ 200). Pone `status = PAID`, `paidById = user.id`. Si ya estaba `PAID`, **sobrescribe** importe, fecha, nota y `paidById` (sirve para corregir el importe).
- **RN-11-17** Se puede pagar por adelantado un recibo futuro y pagar recibos de facturas archivadas.
- **RN-11-18** `POST /bill-payments/:id/unpay`: vuelve a `PENDING` con `amountCents`, `paidAt` y `paidById` a `null` (la `note` se conserva). Si ya era `PENDING`, responde `200` sin cambios.
- **RN-11-19** Pagar o deshacer llama a `scheduler.upsertForSource('BILL', billId)` tras el commit (pagar cancela el aviso de ese recibo; deshacer lo recrea si su `fireAt` sigue en el futuro).

**Recordatorios**

- **RN-11-20** Para cada recibo `PENDING` de una factura no archivada con `reminderDaysBefore ≠ null`: `fireAt = zonedToUtc((periodDueDate − reminderDaysBefore días) + "09:00", tz)`. `occurrenceAt = zonedToUtc(periodDueDate + "00:00", tz)`. Si `fireAt ≤ ahora`, no hay aviso para ese recibo (no se envía con retraso).
- **RN-11-21** Destinatarios: `responsibleUserId` si no es `null`; si es `null`, **todos los miembros actuales** del grupo.
- **RN-11-22** Contenido: `title` = "Factura: Luz"; `body` = "Vence el lun 5 ene · 45,20 € aprox." (sin importe si `estimatedAmountCents` es `null`; con `reminderDaysBefore = 0`: "Vence hoy · 45,20 € aprox."); `url` = `/g/<groupId>/facturas?destacar=<billPaymentId>`.
- **RN-11-23** Llamadas al scheduler (después del commit): crear, editar, restaurar → `upsertForSource('BILL', billId)`; archivar, borrar → `cancelForSource('BILL', billId)`; tras el tick de materialización, el propio tick reconcilia el horizonte (E12).

**Totales**

- **RN-11-24** **Total mensual de gastos fijos** de un mes `M`: suma, para los recibos con `periodDueDate` en `M`, de `amountCents` si `PAID` o `estimatedAmountCents ?? 0` si `PENDING`. Se muestra desglosado: "Pagado" (suma de `PAID`) y "Pendiente" (suma estimada de `PENDING`). Se calcula en el cliente con `GET /bill-payments` (función pura `summarizeBillPayments` en `shared`).
- **RN-11-25** El historial de 6 meses muestra solo importes **pagados** por mes de vencimiento.

## 4. Modelo de datos

`Bill`, `BillPayment` y `Reminder` (`sourceType = BILL`, `sourceId = billId`) de `docs/02-modelo-datos.md`. `Bill.reminderDaysBefore` es opcional (`null` = sin aviso).

Constantes en `packages/shared/src/constants/bills.ts`:

```ts
export const BILL_CATEGORY_META = {
  RENT: { label: 'Alquiler', icon: 'Home' }, MORTGAGE: { label: 'Hipoteca', icon: 'Landmark' },
  ELECTRICITY: { label: 'Luz', icon: 'Zap' }, WATER: { label: 'Agua', icon: 'Droplet' },
  GAS: { label: 'Gas', icon: 'Flame' }, INTERNET: { label: 'Internet', icon: 'Wifi' },
  PHONE: { label: 'Teléfono', icon: 'Smartphone' }, INSURANCE: { label: 'Seguro', icon: 'ShieldCheck' },
  SUBSCRIPTION: { label: 'Suscripción', icon: 'Repeat' }, COMMUNITY: { label: 'Comunidad', icon: 'Building' },
  TAXES: { label: 'Impuestos', icon: 'FileText' }, SCHOOL: { label: 'Colegio', icon: 'School' },
  OTHER: { label: 'Otros', icon: 'Receipt' },
} as const;
export const BILL_FREQUENCY_LABELS = {
  WEEKLY: 'Semanal', MONTHLY: 'Mensual', BIMONTHLY: 'Bimestral', QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral', YEARLY: 'Anual',
} as const;
export const BILL_FREQUENCY_MONTHS = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, YEARLY: 12 } as const;
export const BILL_MATERIALIZE_DAYS_AHEAD = 60;
export const BILL_REMINDER_TIME = '09:00';
```

## 5. API

Rutas bajo `/api/v1/groups/:groupId`, con `AuthGuard` + `GroupMemberGuard`. Esquemas en `packages/shared/src/schemas/bills.ts`.

```ts
const billFields = z.object({
  name: z.string().trim().min(1).max(60),
  provider: z.string().trim().max(60).nullable().default(null),
  category: z.enum(BILL_CATEGORIES),
  estimatedAmountCents: z.number().int().min(1).max(10_000_000).nullable().default(null),
  frequency: z.enum(BILL_FREQUENCIES),
  dueDay: z.number().int().min(1).max(31),               // refine: WEEKLY → 1..7
  startDate: isoDate,
  endDate: isoDate.nullable().default(null),            // refine: ≥ startDate
  reminderDaysBefore: z.number().int().min(0).max(30).nullable().default(3),
  responsibleUserId: z.string().uuid().nullable().default(null), // servidor: miembro actual → si no, 422
  notes: z.string().trim().max(500).nullable().default(null),
});
export const createBillInput = billFields;
export const updateBillInput = billFields.partial().extend({ archived: z.boolean().optional() });

export const billPaymentDto = z.object({
  id: z.string().uuid(), billId: z.string().uuid(), groupId: z.string().uuid(),
  periodDueDate: isoDate, amountCents: z.number().int().nullable(),
  status: z.enum(['PENDING', 'PAID']), isOverdue: z.boolean(),
  paidAt: z.string().datetime().nullable(), paidById: z.string().uuid().nullable(), note: z.string().nullable(),
  bill: z.object({                                        // resumen para pintar sin otra consulta
    name: z.string(), provider: z.string().nullable(), category: z.enum(BILL_CATEGORIES),
    estimatedAmountCents: z.number().int().nullable(), responsibleUserId: z.string().uuid().nullable(),
    archived: z.boolean(),
  }),
});

export const billDto = billFields.extend({
  id: z.string().uuid(), groupId: z.string().uuid(), createdById: z.string().uuid().nullable(),
  archivedAt: z.string().datetime().nullable(),
  nextPayment: billPaymentDto.nullable(),                 // PENDING más antiguo (incluye vencidos); null si no hay
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const listBillPaymentsQuery = z.object({
  from: isoDate, to: isoDate,                             // inclusive, máximo 400 días
  status: z.enum(['PENDING', 'PAID']).optional(),
  billId: z.string().uuid().optional(),                   // filtra por factura (historial de la ficha)
});

export const payBillPaymentInput = z.object({
  amountCents: z.number().int().min(1).max(10_000_000),
  paidAt: z.string().datetime().optional(),               // ≤ ahora
  note: z.string().trim().max(200).nullable().optional(),
});
```

| Método | Ruta | Entrada | Salida | Errores |
|---|---|---|---|---|
| GET | `/groups/:g/bills[?includeArchived=true]` | — | `billDto[]` ordenadas por `nextPayment.periodDueDate` asc (sin próximo, al final; luego por nombre) | 401, 404 |
| POST | `/groups/:g/bills` | `createBillInput` | 201 `billDto` | 401, 404, 422 |
| GET | `/groups/:g/bills/:id` | — | `billDto` | 401, 404 |
| PATCH | `/groups/:g/bills/:id` | `updateBillInput` | `billDto` | 401, 404, 422 |
| DELETE | `/groups/:g/bills/:id` | — | 204 | 401, 404 |
| GET | `/groups/:g/bill-payments?from&to&status&billId` | `listBillPaymentsQuery` | `billPaymentDto[]` ordenados por `periodDueDate` asc, luego nombre de factura | 401, 404, 422 |
| POST | `/groups/:g/bill-payments/:id/pay` | `payBillPaymentInput` | `billPaymentDto` | 401, 404, 422 |
| POST | `/groups/:g/bill-payments/:id/unpay` | — | `billPaymentDto` | 401, 404 |

## 6. Eventos en tiempo real

| Evento | Cuándo | data |
|---|---|---|
| `bill.created` | `POST /bills` | `BillDto` |
| `bill.updated` | `PATCH /bills/:id` (incluido archivar o restaurar), y tras pagar o deshacer (cambia `nextPayment`) | `BillDto` |
| `bill.deleted` | `DELETE /bills/:id` | `{ id }` |
| `bill_payment.updated` | `pay` / `unpay` | `BillPaymentDto` |

La materialización del tick de 6 h **no** emite eventos (sin actor y sin cambios visibles urgentes; los clientes los ven en su próxima consulta). Cliente: `bill.*` hace `setQueryData` en `['group', g, 'bills']` e **invalida** `['group', g, 'bill-payments']` (crear o editar cambia los recibos materializados). `bill_payment.updated` hace `setQueryData` del recibo en todas las listas en caché que lo contengan. Las filas cambiadas por otro miembro hacen la **onda**.

## 7. Pantallas y UX

Ruta: `/g/:groupId/facturas` (desde "Más" → "Facturas y gastos fijos"). Patrón "Héroe de agua" + "Lista + FAB + Sheet". Parámetros: `?vista=proximos|facturas|historial` (por defecto `proximos`) y `?destacar=<id>` (abre la hoja del recibo; destino de los avisos push) o `?factura=<id>` (abre la ficha de la factura).

### 7.1 Cabecera (héroe de agua)

- `DepthFigure` grande con el total del mes actual (RN-11-24), etiqueta "GASTOS FIJOS DE NOVIEMBRE"; debajo, en pequeño, "Pagado 812,40 € · Pendiente 245,00 €". Si hay recibos vencidos, segunda `DepthFigure` pequeña en variante `limit`: "2 VENCIDAS".
- `SegmentedControl` "Próximos · Facturas · Historial".

### 7.2 Próximos vencimientos

- Datos: `GET /bill-payments?from=<hoy − 365 días>&to=<hoy + 60 días>&status=PENDING`.
- Secciones: **"Vencidas"** (si hay), separada de las demás por `LaneRope` variante `limit` y con el texto "Vencida hace 3 días" en cada fila; **"Esta semana"**, **"Este mes"**, **"Más adelante"**.
- Fila: icono de categoría, nombre y proveedor, fecha ("vie 13 nov" / "Hoy" / "Mañana"), importe estimado ("≈ 45,20 €") y `MemberDot` del responsable (o "Todos"). Botón a la derecha "Pagar" (44 px).
- "Pagar" → hoja §7.5. Tocar la fila → ficha de la factura (§7.4).
- Vacío: `EmptyState` "No hay recibos pendientes en los próximos 60 días" + "Añadir factura" (si no hay facturas: "Aún no hay gastos fijos. Añade el alquiler, la luz o internet").

### 7.3 Facturas (lista)

- Todas las facturas no archivadas: nombre, proveedor, frecuencia y día ("Mensual · día 5", "Semanal · viernes"), estimado, próximo vencimiento. Interruptor "Mostrar archivadas".
- `Fab` "+" → "Nueva factura".

### 7.4 Ficha de factura (hoja)

- Datos de la factura, responsable ("Avisar a: Ana" / "Avisar a: todos"), recordatorio ("Aviso 3 días antes a las 9:00" / "Sin aviso"), notas.
- Historial de recibos de los últimos 12 meses (`GET /bill-payments?billId=…&from=<hoy − 365>&to=<hoy + 60>`): fecha de vencimiento, estado ("Pagada el 3 nov por Óscar · 47,85 €" / "Pendiente" / "Vencida"), con acción "Pagar" o "Deshacer pago".
- Acciones: "Editar", "Archivar"/"Restaurar", "Borrar" (`Dialog`: "¿Borrar «Luz»? Se borrará también su historial de pagos. Si ya no la pagáis, mejor archívala." [Borrar] [Archivar] [Cancelar]).

### 7.5 Pagar recibo (hoja)

- Título "Pagar Luz · vence el vie 13 nov". Campo "Importe pagado" prellenado con el estimado (o vacío), "Fecha de pago" (Hoy por defecto; selector de fecha que envía `paidAt` = 12:00 local de ese día), "Nota (opcional)".
- "Marcar como pagada" → toast "Luz marcada como pagada" + "Deshacer" (5 s → `unpay`).
- En recibos pagados: "Deshacer pago" con `Dialog` de confirmación.

### 7.6 Crear o editar factura (hoja)

- Campos: "Nombre" (autofocus; chips de sugerencia por categoría que rellenan nombre y categoría: "Alquiler", "Luz", "Agua", "Gas", "Internet", "Móvil", "Comunidad", "Seguro"), "Categoría", "Proveedor (opcional)", "Importe estimado (opcional)", "Frecuencia", "Día de vencimiento" (1–31, o selector L–D si es semanal), "Desde" (hoy por defecto), "Hasta (opcional)", "Avisar" (Sin aviso · El mismo día · 1 · 2 · 3 · 5 · 7 · 15 días antes), "Responsable" (Todos + miembros con `MemberDot`), "Notas".
- Ayudas en línea: con `dueDay ≥ 29`: "En los meses más cortos vencerá el último día del mes". Con frecuencia distinta de mensual o semanal: "El ciclo empieza en el mes de «Desde»: próximos vencimientos 15/02, 15/05, 15/08". La vista previa de los 3 próximos vencimientos se calcula en el cliente con `computeDueDates`.
- Si hay aviso y el dispositivo no tiene permiso de notificaciones, al guardar se abre el `NotificationPrompt` de E12.

### 7.7 Historial

- Barras verticales (Recharts) de los últimos 6 meses con lo **pagado** por mes y el total encima; barra del mes actual con la parte pendiente estimada en trama clara. Debajo, lista por mes con cada recibo pagado. "Ver como tabla" para accesibilidad.
- Datos: `GET /bill-payments?from=<1.º del mes − 5>&to=<último día del mes actual>`.

### 7.8 Estados

- Cargando: skeleton del héroe y 5 filas. Error: `ErrorState` "No hemos podido cargar las facturas" + "Reintentar". Sin conexión: `OfflineBanner`; "Pagar", `Fab` y edición deshabilitados.
- Recibo no encontrado (`?destacar=` de uno borrado): toast "Este recibo ya no existe".

## 8. Permisos

Cualquier miembro ve, crea, edita, archiva, borra, paga y deshace el pago de cualquier factura del grupo. Solo el responsable (o todos, si no hay) recibe el aviso push.

## 9. Actividad

| Acción | `entityType` / `action` | `summary` |
|---|---|---|
| Crear | `bill` / `created` | "añadió la factura Luz (Iberdrola)" (sin proveedor: "añadió la factura Luz") |
| Editar | `bill` / `updated` | "editó la factura Luz" |
| Archivar / restaurar | `bill` / `archived` · `restored` | "archivó la factura Gimnasio" / "restauró la factura Gimnasio" |
| Borrar | `bill` / `deleted` | "borró la factura Gimnasio" |
| Pagar | `bill_payment` / `paid` | "pagó Luz de noviembre (47,85 €)" (semanal: "pagó Limpieza del vie 13 nov (40,00 €)") |
| Corregir un pago ya hecho | `bill_payment` / `updated` | "corrigió el pago de Luz de noviembre (47,85 €)" |
| Deshacer pago | `bill_payment` / `unpaid` | "desmarcó el pago de Luz de noviembre" |

El periodo se nombra con el mes de `periodDueDate` en minúsculas ("noviembre"); si no es del año actual, con el año ("diciembre de 2025").

## 10. Casos límite

- **Meses cortos y bisiestos:** RN-11-09.
- **Factura creada a mitad de mes con vencimiento ya pasado:** con `startDate` anterior (p. ej. inicio 2026-11-01, `dueDay` 5, creada el 11/11) se materializa el recibo del 05/11, que aparece como "Vencida" para que se marque como pagada. Con `startDate` = hoy, el primero es el del mes siguiente.
- **Cambio de hora:** los vencimientos son días (`@db.Date`), no les afecta. El aviso a las 09:00 local se calcula con la zona del grupo, así que sigue a las 9:00 tras el cambio de hora.
- **`reminderDaysBefore` mayor que los días que faltan** (factura creada el día 3 que vence el 5 con aviso de 7 días): ese recibo no tiene aviso (RN-11-20).
- **Responsable que sale del grupo:** `responsibleUserId` pasa a `null` (todos) en la transacción de salida (manejador de E11 en `MemberRemovedHooks`, spec 02 RN-02-22) y E02 reconcilia los avisos con `scheduler.rebuildGroup(groupId)` tras el commit. Si el responsable borra su cuenta, mismo efecto.
- **`endDate` en el pasado al editar:** se borran los `PENDING` futuros (RN-11-13) y la factura deja de generar recibos; no se archiva sola.
- **Recibo pagado y después se edita la factura** cambiando el día: el pagado se conserva con su fecha antigua; puede convivir con un pendiente del mismo mes con la fecha nueva (unicidad por `(billId, periodDueDate)`).
- **Dos miembros pagan el mismo recibo a la vez:** last-write-wins (el segundo sobrescribe importe y `paidById`); ambos reciben `bill_payment.updated` con el estado final.
- **Ventana de materialización:** el tick de 6 h solo materializa hasta hoy + 60; la capa Facturas del calendario y "Más adelante" no muestran recibos más allá.
- **Factura semanal y totales mensuales:** un mes puede tener 4 o 5 recibos semanales; el total mensual los suma todos.
- **Rangos > 400 días** en `bill-payments` → `422`.

## 11. Tests

- **Unit (`packages/shared`):** `computeDueDates` con todos los ejemplos de RN-11-09, `endDate` inclusiva, ventana vacía; `summarizeBillPayments` (pagado, pendiente estimado, nulos a 0); `isOverdue` en el límite de medianoche en `Europe/Madrid`; cálculo de `fireAt` del aviso.
- **Integración (`apps/api/test/bills.int.spec.ts`):** CRUD; materialización al crear (ventana desde el 1.º del mes actual); edición que borra pendientes que ya no encajan y conserva pagados; archivar y restaurar; `pay` (incluida la corrección de un pagado) y `unpay`; `422` con `dueDay` 8 semanal y con responsable no miembro; handler del tick idempotente (dos ejecuciones no duplican); llamadas a `upsertForSource`/`cancelForSource`; proveedor `BILL` (destinatarios: responsable o todos; sin aviso si `reminderDaysBefore = null` o `fireAt` pasado); eventos realtime; autorización 401/404.
- **Componentes:** formulario (ayuda de meses cortos, vista previa de vencimientos, semanal con selector de día), hoja de pago, secciones de próximos con la corchera en "Vencidas".
- **E2E-12** (`apps/web/e2e/bills.e2e.ts`): crear la factura mensual "Internet" con inicio el día 1 del mes actual y vencimiento el día de hoy → aparece en "Esta semana" como pendiente → "Pagar" con 39,90 € → desaparece de próximos → en la ficha se ve "Pagada … 39,90 €" y en "Historial" suma en el mes actual.

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `Bill.reminderDaysBefore Int?` → `docs/02`.
- Comentario de materialización de `BillPayment` → `docs/02`.
- `billId` en `GET /bill-payments` e `includeArchived` en `GET /bills` → `docs/04` (fila "Facturas").
- `responsibleUserId = null` y `rebuildGroup` al salir el responsable → spec 02 (RN-02-22) y ADR-019.
- Glosario de facturas (vencida, próximos vencimientos, responsable, pagar, categorías y frecuencias) → `docs/10`.
- Deep link `?destacar=<billPaymentId>` y `?factura=<billId>` (sustituyen a `?payment=` y `?bill=`) → `docs/08`, `docs/02` (`Reminder.url`) y RN-11-22/§7 de esta spec.

## 13. Fuera de alcance

- Reparto del importe entre miembros.
- Adjuntar el PDF o la foto de la factura.
- Importar facturas desde el banco o el correo.
- Frecuencias personalizadas (cada 4 meses, días hábiles, "último viernes del mes").
- Avisos de "recibo vencido sin pagar" posteriores al vencimiento.
