# 15 · Inicio (dashboard) y navegación

> Épica: E15 · Tickets: `docs/tickets/E15-inicio.md` · Modelo: `docs/02-modelo-datos.md` (lectura de casi todas las tablas de grupo; ninguna propia) · Rutas: `docs/08-convenciones.md#rutas-de-la-pwa-español-fijadas` · Endpoint: `GET /groups/:g/dashboard` (`docs/04`, fila "Inicio").

## 1. Objetivo

Dar a la PWA su **esqueleto de navegación** (AppShell mobile-first con cabecera, selector de hogar y barra inferior de 5 pestañas) y una pantalla de **Inicio "Hoy"** que resume en un vistazo el día del hogar: una calle (`Lane`) por miembro con su turno de trabajo, sus tareas y sus eventos; las comidas del día; las facturas próximas; lo que queda en las listas; la actividad reciente y un acceso rápido a "¿Qué cocino?". El shell y un Inicio básico se construyen en la **fase 1**; el Inicio se enriquece sección a sección hasta completarse en la **fase 6**, mostrando solo las secciones cuyo módulo ya existe.

## 2. Historias de usuario

- **US-15-01** Como miembro, quiero una barra inferior con Inicio, Compra, Comidas, Tareas y Más, para llegar a lo frecuente con el pulgar.
- **US-15-02** Como miembro de varios hogares, quiero cambiar de hogar desde la cabecera sin perder la sección en la que estoy.
- **US-15-03** Como miembro, quiero ver al abrir la app qué hace hoy cada persona de casa (turno, tareas, eventos).
- **US-15-04** Como miembro, quiero ver qué se come hoy, qué facturas vencen esta semana y cuánto queda en las listas.
- **US-15-05** Como miembro, quiero ver lo último que han hecho los demás.
- **US-15-06** Como miembro, quiero que una notificación me lleve directamente a la tarea, el evento o la factura concreta.
- **US-15-07** Como persona sensible al movimiento, quiero que las transiciones respeten mi preferencia de reducir movimiento.
- **US-15-08** Como miembro, quiero que el Inicio se actualice solo cuando otro miembro cambia algo.

## 3. Reglas de negocio

### Navegación y shell
- **RN-15-01** Rutas dentro del shell: todas las `/g/:groupId/**`, `/perfil` y `/admin`. Fuera del shell (sin barra inferior ni cabecera de hogar): `/entrar`, `/registro`, `/recuperar`, `/invite/:token`, `/grupos`, `/legal/*`.
- **RN-15-02** La barra inferior tiene siempre **5 pestañas** en este orden: **Inicio** (`/g/:g`), **Compra** (`/g/:g/compra`), **Comidas** (`/g/:g/comidas`), **Tareas** (`/g/:g/tareas`), **Más** (abre una hoja, no navega).
- **RN-15-03** Pestaña activa: Inicio si la ruta es exactamente `/g/:g`; Compra si empieza por `/g/:g/compra`; Comidas si empieza por `/g/:g/comidas`; Tareas si empieza por `/g/:g/tareas`; **Más** para cualquier otra ruta de `/g/:g/**` y para `/perfil` y `/admin`.
- **RN-15-04** La hoja **"Más"** contiene, en este orden y agrupados: *Organización* — Calendario, Horarios; *Cocina* — Recetas, ¿Qué cocino?; *Dinero* — Gastos, Facturas; *IA* — Asistente; *Hogar* — Actividad, Ajustes del grupo; *Tú* — Perfil; y, solo si `me.isPlatformAdmin`, *Plataforma* — Administración (`/admin`).
- **RN-15-05** **Registro de navegación** (`apps/web/src/app/navigation.ts`): cada entrada tiene `enabled`. Cada épica pone `enabled: true` en el mismo ticket en que crea su ruta. Una entrada de "Más" con `enabled: false` **no se muestra**. Una pestaña de la barra con `enabled: false` **sí se muestra** y su ruta pinta `ComingSoonPage` ("Esta sección llegará pronto").
- **RN-15-06** Ruta raíz `/`: sin sesión → `/entrar`. Con sesión: si `localStorage['hogaria.lastGroupId']` es un grupo del que sigue siendo miembro → `/g/:lastGroupId`; si no, el primer grupo de `GET /me/groups` (por `joinedAt`); sin grupos → `/grupos`.
- **RN-15-07** Cada vez que se entra en `/g/:groupId/**` de un grupo válido se guarda `hogaria.lastGroupId` (envuelto en `try/catch`).
- **RN-15-08** `RequireGroup`: si `groupId` no está en `['me', 'groups']` (tras cargarlo), se pinta `NotFoundPage` con "No encontrado" dentro del shell sin barra inferior (E2E-15). Nunca se distingue "no existe" de "no tienes acceso".
- **RN-15-09** `RequireAuth`: sin sesión en una ruta protegida → `/entrar?volver=<ruta+query codificada>`. Tras iniciar sesión, la página de login navega a `volver` **solo** si empieza por `/` y no por `//` ni contiene `://` (evita redirecciones abiertas); si no, a `/`.
- **RN-15-10** **Cambio de hogar**: navega a la misma sección del nuevo grupo conservando el primer segmento tras `/g/:groupId` y descartando el resto (p. ej. `/g/A/compra/LIST` → `/g/B/compra`; `/g/A/recetas/ID` → `/g/B/recetas`; `/g/A` → `/g/B`). Desde `/perfil` o `/admin` → `/g/B`.
- **RN-15-11** El selector de hogar muestra un desplegable (chevron) solo si el usuario tiene **2 o más** grupos. Siempre incluye la acción "Crear o unirme a un hogar" → `/grupos`.
- **RN-15-12** En `/perfil` y `/admin` la barra inferior usa `hogaria.lastGroupId` (RN-15-06) para construir sus enlaces; si el usuario no tiene grupos, no hay barra inferior.
- **RN-15-13** **Deep links** (formato común a notificaciones, asistente y enlaces internos), parámetros de consulta en español:
  - `?fecha=YYYY-MM-DD` → la pantalla abre ese día/semana (Comidas, Calendario, Horarios, Inicio).
  - `?destacar=<id>` → la pantalla hace scroll hasta el elemento, le da foco y reproduce **una** onda (`ripple`). Si el id no existe, se ignora sin error.
  - URLs canónicas para recordatorios: tarea `/g/:g/tareas?destacar=<taskId>`; evento `/g/:g/calendario?fecha=<YYYY-MM-DD>&destacar=<eventId>`; factura `/g/:g/facturas?destacar=<billPaymentId>`.
- **RN-15-14** Al abrir un deep link de un grupo distinto al último usado, el shell cambia de grupo (RN-15-07) sin pedir confirmación; si no es miembro, RN-15-08.
- **RN-15-15** **Transiciones de ruta**: fundido cruzado de 150 ms con la View Transitions API (`viewTransition` de React Router) al cambiar de pestaña o de pantalla. Con `prefers-reduced-motion: reduce`, **sin animación**. En navegadores sin la API, sin animación.
- **RN-15-16** Restauración del scroll: `ScrollRestoration` de React Router (al volver atrás se recupera la posición; al navegar adelante, arriba del todo).
- **RN-15-17** **Sin conexión** (`navigator.onLine === false` o socket desconectado 5 s o más; spec 03 RN-03-22): el AppShell monta el `OfflineBanner` de E03 (HOG-155) bajo la cabecera, con el texto "Sin conexión. Los cambios no se guardarán"; los controles de edición se deshabilitan con `useCanEdit()` o la prop `requiresConnection` de E03 (ADR-015). Esta épica no reimplementa esa lógica (HOG-752 solo la integra). Al recuperar la conexión el banner desaparece y se invalidan las queries del grupo (lo hace el `RealtimeProvider`, HOG-152).
- **RN-15-18** Todas las páginas de feature se cargan con `lazy` de React Router (un chunk por ruta). El shell, el router y los providers van en el chunk principal.

### Inicio ("Hoy")
- **RN-15-19** `GET /groups/:g/dashboard?date=YYYY-MM-DD`; si falta `date`, el servidor usa el día actual en `Group.timezone`. La web siempre envía la fecha de hoy calculada en la zona del grupo (`lib/dates.ts`).
- **RN-15-20** La respuesta se compone de **secciones**. Cada sección la aporta un *section provider* registrado en el `DashboardModule`. **Si el provider de una sección no está registrado (su módulo aún no existe), su clave no aparece en la respuesta**, y la web no pinta esa sección. `date`, `timezone`, `members`, `lanes` y `activity` están siempre (fase 1).
- **RN-15-21** Los providers se ejecutan en paralelo (`Promise.all`); si uno falla, la respuesta completa es 500 (no hay respuestas parciales ocultando errores).
- **RN-15-22** **Calles**: una por miembro actual, en este orden: el usuario actual primero y después por `joinedAt`. Más una calle **"Sin asignar"** (`userId: null`) solo si hay tareas de hoy sin asignar. Dentro de cada calle, las sub-secciones `shift`, `tasks` y `events` aparecen solo si su provider está registrado (RN-15-20).
- **RN-15-23** `shift` (E08): estado efectivo del día para ese miembro (horario vigente + excepción del día): `WORKING` con sus turnos, `DAY_OFF`, `VACATION`, `SICK` o `NO_SCHEDULE` (sin horario vigente o sin turnos ese día de la semana).
- **RN-15-24** `tasks` (E07): tareas no archivadas con `currentAssigneeId` = miembro (o `null` en "Sin asignar") y `nextDueAt` ≤ fin del día `date` en la zona del grupo. `overdue = true` si `nextDueAt` < inicio del día `date`. Orden: vencidas primero, luego por `nextDueAt`. Como mucho 5 + `moreCount`.
- **RN-15-25** `events` (E09): ocurrencias (recurrencias expandidas) cuyo intervalo `[start, end)` corta el día `date` en la zona del grupo, en la calle de su `ownerId`. Orden: todo el día primero, luego por hora. Como mucho 5 + `moreCount`.
- **RN-15-26** `meals` (E06): entradas del plan del día `date`, en orden de franja (`BREAKFAST`, `MID_MORNING`, `LUNCH`, `SNACK`, `DINNER`) y, dentro de la franja, por `createdAt`. Título = título de la receta si hay `recipeId` (y no está borrada), si no `title`.
- **RN-15-27** `bills` (E11): `BillPayment` con `status = PENDING` y `periodDueDate` ≤ `date + 6 días` (incluye vencidos anteriores a `date`), de facturas no archivadas. Orden por `periodDueDate`. Como mucho 10 + `moreCount`. `amountCents` = importe real si existe, si no el estimado de la factura, si no `null`. `totalCents` = suma de los no nulos de **todos** los recibos del rango (no solo los 10 mostrados).
- **RN-15-28** `shopping` (E04): listas no archivadas, por `position`, con `pendingCount` = items con `checked = false`. `totalPending` = suma.
- **RN-15-29** `activity`: las 5 entradas más recientes del grupo (mismo `ActivityDto` que `GET /activity`).
- **RN-15-30** El Inicio se refresca: al enfocar la app (`refetchOnWindowFocus`), al reconectar el socket, con los eventos de §6 y al cambiar de día en la zona del grupo (temporizador hasta la siguiente medianoche local, que cambia la clave de la query).
- **RN-15-31** El acceso rápido **"¿Qué cocino?"** se muestra si la entrada `fridge` del registro de navegación está `enabled`; muestra "Te quedan {n} análisis hoy" con `useAiQuota` (HOG-655) si está disponible.

## 4. Modelo de datos

E15 no tiene tablas propias. Lee (a través de los servicios de cada módulo): `GroupMember`, `User`, `ActivityLog`, `WorkSchedule`/`WorkScheduleSlot`/`WorkShiftOverride`, `Task`, `CalendarEvent`, `MealPlanEntry`/`Recipe`, `Bill`/`BillPayment`, `ShoppingList`/`ShoppingItem`.

## 5. API

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| `GET` | `/groups/:g/dashboard` | query `dashboardQuery` | `dashboardDto` | 401, 404, 422 |

Endpoints que usa el shell (de otras épicas): `GET /me` (E01), `GET /me/groups` (E02), `GET /groups/:g` (E02).

```ts
// packages/shared/src/schemas/dashboard.ts
export const dashboardQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),   // fecha válida; si no → 422
});

const dashboardMemberDto = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  image: z.string().url().nullable(),        // null si no hay o si el usuario prefiere iniciales (spec 16)
  laneColor: LaneColorEnum,
  isMe: z.boolean(),
});

const shiftTodayDto = z.object({
  status: z.enum(['WORKING', 'DAY_OFF', 'VACATION', 'SICK', 'NO_SCHEDULE']),
  slots: z.array(z.object({
    startTime: z.string(),                   // "08:00"
    endTime: z.string(),                     // "15:00"
    endsNextDay: z.boolean(),                // endTime <= startTime
    label: z.string().nullable(),
  })),
  note: z.string().nullable(),               // nota de la excepción, si la hay
});

const taskTodayDto = z.object({
  id: z.string().uuid(),
  title: z.string(),
  emoji: z.string().nullable(),
  dueAt: z.string().datetime(),
  allDay: z.boolean(),
  overdue: z.boolean(),
});

const eventTodayDto = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: EventCategoryEnum,
  allDay: z.boolean(),
  occurrenceStart: z.string().datetime(),
  occurrenceEnd: z.string().datetime(),
  location: z.string().nullable(),
});

const laneDto = z.object({
  userId: z.string().uuid().nullable(),      // null = "Sin asignar"
  shift: shiftTodayDto.optional(),           // solo si existe E08 (y nunca en la calle "Sin asignar")
  tasks: z.object({ items: z.array(taskTodayDto), moreCount: z.number().int() }).optional(),   // E07
  events: z.object({ items: z.array(eventTodayDto), moreCount: z.number().int() }).optional(), // E09
});

export const dashboardDto = z.object({
  date: z.string(),                          // "2026-11-11"
  timezone: z.string(),                      // "Europe/Madrid"
  members: z.array(dashboardMemberDto),
  lanes: z.array(laneDto),
  activity: z.array(activityDto),            // ≤ 5
  meals: z.object({                          // E06
    entries: z.array(z.object({
      id: z.string().uuid(),
      slot: MealSlotEnum,
      title: z.string(),
      recipeId: z.string().uuid().nullable(),
      forUserIds: z.array(z.string().uuid()),
    })),
  }).optional(),
  bills: z.object({                          // E11
    items: z.array(z.object({
      billPaymentId: z.string().uuid(),
      billId: z.string().uuid(),
      name: z.string(),
      category: BillCategoryEnum,
      periodDueDate: z.string(),             // "YYYY-MM-DD"
      amountCents: z.number().int().nullable(),
      overdue: z.boolean(),
    })),
    moreCount: z.number().int(),
    totalCents: z.number().int(),
  }).optional(),
  shopping: z.object({                       // E04
    lists: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      emoji: z.string().nullable(),
      pendingCount: z.number().int(),
    })),
    totalPending: z.number().int(),
  }).optional(),
});
```

### Arquitectura del endpoint

```
apps/api/src/modules/dashboard/
├─ dashboard.module.ts
├─ dashboard.controller.ts             # GET /groups/:groupId/dashboard (GroupMemberGuard)
├─ dashboard.service.ts                # calcula el rango del día, ejecuta providers, compone la respuesta
├─ dashboard-section.provider.ts       # interfaz + token DASHBOARD_SECTIONS (multi-provider)
└─ sections/
   ├─ members.section.ts · activity.section.ts           # fase 1
   ├─ shifts.section.ts (E08) · tasks.section.ts (E07) · events.section.ts (E09)
   └─ meals.section.ts (E06) · bills.section.ts (E11) · shopping.section.ts (E04)
```

```ts
interface DashboardSectionProvider {
  key: 'members' | 'activity' | 'shifts' | 'tasks' | 'events' | 'meals' | 'bills' | 'shopping';
  load(ctx: { groupId: string; userId: string; date: string; dayStartUtc: Date; dayEndUtc: Date; timezone: string }): Promise<unknown>;
}
```
Cada provider llama a un método de lectura del **servicio de su módulo** (no Prisma directo para datos de otros módulos), igual que el asistente (spec 14, RN-14-20). `shifts`, `tasks` y `events` devuelven un mapa por `userId` que el servicio funde en `lanes`.

## 6. Eventos en tiempo real

El Inicio no emite eventos. Escucha (en `features/dashboard/realtime.ts`) y reacciona sobre la clave `['group', groupId, 'dashboard', date]`:

| Evento | Reacción |
|---|---|
| `activity.created` | `setQueryData`: añade al principio de `activity` y recorta a 5 |
| `group.member.joined` / `.updated` / `.left`, `group.updated` | invalidar |
| `task.*`, `event.*`, `schedule.updated`, `meal.*`, `recipe.updated`, `bill.*`, `bill_payment.updated`, `shopping.list.*`, `shopping.item.*`, `shopping.items.bulk_*` | invalidar (agrupado con *debounce* de 500 ms) |

Las calles y tarjetas cuyo contenido cambió por otro miembro (`actorId !== me.id`) reproducen la **onda** (`ripple`) una vez tras el refetch.

## 7. Pantallas y UX

Sigue `DESIGN.md` (sistema "Piscina municipal"); componentes firma por nombre: `Lane`, `LaneRope`, `DepthFigure`, `MemberDot`, animación `ripple`.

### 7.1 AppShell (`apps/web/src/app/layout/AppShell.tsx`)
- **Cabecera** (56 px + `safe-area-inset-top`):
  - Izquierda: `GroupSwitcher` = emoji + nombre del grupo (truncado con elipsis) + chevron si hay ≥ 2 grupos. Al tocar abre una hoja "Tus hogares": lista de grupos (emoji, nombre, marca en el actual) y al final "Crear o unirme a un hogar". `aria-label="Cambiar de hogar, actual: {nombre}"`.
  - Derecha: avatar (foto o iniciales sobre el color de calle del usuario en el grupo actual) → `/perfil`. `aria-label="Tu perfil"`.
- **Banner de conexión** (`ConnectionBanner`) bajo la cabecera, `role="status"`.
- **Contenido** (`<main id="contenido">`), con un enlace "Saltar al contenido" oculto hasta recibir foco.
- **Barra inferior** (`BottomNav`, 64 px + `safe-area-inset-bottom`): 5 botones con icono lucide y etiqueta siempre visible — Inicio (`Home`), Compra (`ShoppingCart`), Comidas (`CookingPot`), Tareas (`ListChecks`), Más (`Menu`). La activa lleva `aria-current="page"` y el indicador visual de `DESIGN.md`. Objetivos ≥ 44 px. `<nav aria-label="Navegación principal">`.
- **Hoja "Más"** (`MoreSheet`): título "Más"; secciones de RN-15-04 con icono + etiqueta; al elegir, navega y se cierra. El botón atrás del sistema la cierra (al abrirla se añade una entrada de historial con `state.sheet = 'more'`).
- **Páginas auxiliares**: `NotFoundPage` ("No encontrado" / "Este hogar o esta página no existe, o no tienes acceso." / botón "Ir al inicio" → `/`); `ComingSoonPage` ("Esta sección llegará pronto"); `RouteErrorPage` (error de carga de chunk o excepción: "Algo ha fallado" + "Recargar").

### 7.2 Inicio (`/g/:groupId`, `features/dashboard/pages/HomePage.tsx`)
Orden vertical:
1. **Saludo y fecha**: "Buenos días, {nombre}" (06:00–13:59), "Buenas tardes, {nombre}" (14:00–20:59), "Buenas noches, {nombre}" (resto), en la zona del grupo; debajo la fecha "miércoles, 11 de noviembre" (con mayúscula inicial).
2. **Calles de hoy** (`TodayLanes`): un `Lane` por calle, separados por `LaneRope`. Cada calle: `MemberDot` + nombre ("Tú" para el usuario actual; "Sin asignar" para `userId: null`) y en filas:
   - turno (si `shift`): "08:00–15:00 · Turno mañana", "22:00–06:00 (+1)" si `endsNextDay`, "Libre", "Vacaciones", "Baja" o "Sin horario";
   - tareas (si `tasks`): cada una con casilla para completar (usa la mutación de E07; deshabilitada sin conexión) y "Vencida" si `overdue`; "+{moreCount} más" → `/g/:g/tareas`;
   - eventos (si `events`): "10:00 Dentista" o "Todo el día · Cumpleaños de Lucía"; toque → `/g/:g/calendario?fecha=<date>&destacar=<id>`.
   - Si una calle no tiene nada que mostrar: "Nada para hoy".
3. **Comidas de hoy** (si `meals`): lista por franja ("Comida · Lentejas con chorizo"). Vacío: "No hay nada planificado para hoy" + botón "Planificar" → `/g/:g/comidas?fecha=<date>`.
4. **Acceso rápido "¿Qué cocino?"** (RN-15-31): tarjeta con texto "Haz una foto a la nevera y te proponemos recetas" y "Te quedan {n} análisis hoy" → `/g/:g/nevera`.
5. **Listas** (si `shopping`): `DepthFigure` con `pendingCount` de la primera lista y rótulo "QUEDAN {n} EN LISTA" ("QUEDA 1 EN LISTA"; si 0: "LISTA AL DÍA"), con el nombre de la lista debajo; el resto de listas como filas "{emoji} {nombre} · {n}". Toque → `/g/:g/compra/:listId`. Sin listas: se oculta.
6. **Facturas próximas** (si `bills` y hay items): título "Facturas esta semana", `DepthFigure` con `formatMoney(totalCents)` rotulado "A PAGAR"; filas "Luz · vence el vie 14 · 45,20 €" (o "importe sin definir"), las vencidas con la `LaneRope` de límite (roja/blanca) y la etiqueta "Vencida"; "+{moreCount} más" → `/g/:g/facturas`. Sin items: la sección se oculta.
7. **Actividad reciente**: 5 entradas (`MemberDot` + "{nombre} {summary}" + hora relativa) y "Ver toda la actividad" → `/g/:g/actividad`. Vacío: "Todavía no hay actividad. ¡Empezad a usar Hogaria!".
8. **Botón flotante del asistente** (lo añade E14, HOG-712).

**Fase 1** (antes de que existan E04–E11): el Inicio muestra 1, 2 (calles solo con nombre y "Nada para hoy"), 7 y, si no hay más miembros, una tarjeta "Invita a tu hogar" → `/g/:g/ajustes`.

### 7.3 Estados del Inicio
- **Cargando**: skeleton de saludo, 2 calles y 2 tarjetas.
- **Error**: "No hemos podido cargar el inicio" + "Reintentar" (el shell sigue operativo).
- **Vacío**: cada sección tiene su vacío (arriba); no hay vacío global.
- **Sin conexión**: banner global; se muestran los últimos datos en caché; casillas de tareas deshabilitadas.

## 8. Permisos

- Shell: cualquier usuario con sesión. `/admin` en el menú solo si `isPlatformAdmin` (la ruta la protege E01, HOG-059).
- Dashboard: cualquier miembro del grupo (`GroupMemberGuard`); usuario de otro grupo → 404. Todo lo que muestra es visible para todo el grupo (calendario, horarios y gastos son de solo lectura para no dueños, pero visibles).

## 9. Actividad

E15 no genera `ActivityLog`. Completar una tarea desde el Inicio usa el servicio de E07, que genera la suya.

## 10. Casos límite

- Usuario expulsado del grupo mientras lo ve: llega `group.member.left` con su `userId` → la web invalida `['me', 'groups']`, `RequireGroup` pinta `NotFoundPage` y se borra `hogaria.lastGroupId` si coincidía.
- Grupo borrado (salió el último miembro desde otro dispositivo): igual que el anterior.
- `localStorage` no disponible (modo privado de Safari): RN-15-06 cae al primer grupo; nada falla.
- Cambio de hora (último domingo de marzo/octubre): `dayStartUtc`/`dayEndUtc` se calculan con `@date-fns/tz`, nunca sumando 24 h.
- Turno nocturno de ayer que termina hoy (22:00–06:00): aparece en el día en que empieza (el de ayer), no hoy. Hoy solo se ve si hoy también tiene turno.
- Evento de varios días: aparece en cada día que corta.
- Receta borrada (`deletedAt`) en una entrada del plan: título = `title` de la entrada si existe, si no "Receta eliminada".
- Más de 8 miembros: colores de calle repetidos (regla de `docs/02`); las calles siguen el orden de RN-15-22.
- Ruta con `groupId` mal formado (no UUID): `NotFoundPage` sin llamar a la API.
- Fallo al cargar un chunk tras un despliegue (hash antiguo): `RouteErrorPage` con "Recargar" (recarga completa).
- Deep link con `?destacar=` a un elemento que ya no existe: se ignora.

## 11. Tests

**Unitarios**
- `navigation.spec.ts`: pestaña activa (RN-15-03) para 12 rutas; entradas deshabilitadas ocultas en "Más" y `ComingSoonPage` en pestañas.
- `switch-group-path.spec.ts`: RN-15-10.
- `safe-return-to.spec.ts`: RN-15-09 (`/g/x` sí; `//evil.com`, `https://evil.com`, `javascript:` no).
- `greeting.spec.ts`: franjas horarias en la zona del grupo.
- API: `dashboard.service.spec.ts` (composición sin providers opcionales → solo claves base; orden de calles; calle "Sin asignar"); cada `*.section.spec.ts` con servicios simulados (vencidas, `moreCount`, rango de facturas, cambio de hora).
- Web: `TodayLanes` (con y sin `shift`/`tasks`/`events`), tarjeta de listas (singular, plural, 0), facturas vencidas.

**Integración**
- `dashboard.int.spec.ts`: 401; 404 grupo ajeno; 422 con `date=2026-13-40`; respuesta de fase 1 sin claves opcionales; con datos de tareas/eventos/facturas en la frontera del día (23:30 y 00:30 en `Europe/Madrid`).

**E2E**
- **E2E-15** (de E02, se apoya en `RequireGroup`/`NotFoundPage` de este módulo): URL de un grupo ajeno muestra "No encontrado".
- **E2E-16** (`docs/07-testing.md`): login → Inicio muestra las calles de los 2 miembros → navegar por las 5 pestañas y la hoja "Más" → cambiar de hogar conserva la sección → deep link `/g/:g/tareas?destacar=<id>` sin sesión pasa por `/entrar?volver=` y llega a la tarea → completar una tarea en el contexto B hace que el Inicio de A se actualice sin recargar.
- `axe` sin violaciones en Inicio y en la hoja "Más" (E17, HOG-856).

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `Reminder.url` con `?destacar=`/`?fecha=` → `docs/02`; es la convención única adoptada por las specs 07, 09, 11 y 12.
- Parámetros `?fecha=`, `?destacar=`, `?volver=` y hoja "Más" sin ruta → `docs/08`.
- E2E-16 → `docs/07`.
- Secciones opcionales del dashboard → `docs/04` (fila "Inicio").
- `?destacar=` en tareas, calendario y facturas → specs 07, 09 y 11 (§7).
- `/entrar` con `?volver=` (sustituye a `?redirect=`) → spec 01 (§7).
- Banner sin conexión: se reutiliza el de E03 (HOG-155) con 5 s de gracia → RN-15-17 de esta spec.

## 13. Fuera de alcance

- Personalizar el orden o la visibilidad de las secciones del Inicio.
- Ver el Inicio de otros días (el parámetro `date` existe para la medianoche y los tests; no hay navegación por días).
- Widgets de sistema o accesos directos de la PWA (`shortcuts` del manifest).
- Gestos de deslizar entre pestañas.
- Insignias numéricas en la barra inferior.
