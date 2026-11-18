# E15 · Inicio (dashboard) y navegación

> Spec: `docs/specs/15-inicio-navegacion.md` · Rango: HOG-750 – HOG-799
> **Fase 1:** HOG-750 – HOG-756 (shell, navegación, Inicio básico). **Fase 6:** HOG-757 – HOG-766 (secciones del Inicio completo). Las secciones de fase 6 pueden adelantarse en cuanto exista su módulo: solo dependen de él.

---

### HOG-750 · Crear el AppShell con barra inferior, rutas y selector de hogar

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** web
- **Depende de:** HOG-005, HOG-007, HOG-008, HOG-009, HOG-104
- **Spec:** `docs/specs/15-inicio-navegacion.md#71-appshell-appswebsrcapplayoutappshelltsx`

**Descripción**
Esqueleto de navegación de la PWA: árbol de rutas con `lazy`, guards `RequireAuth` y `RequireGroup`, cabecera con `GroupSwitcher` y avatar, barra inferior de 5 pestañas, registro de navegación y páginas `NotFoundPage`, `ComingSoonPage` y `RouteErrorPage`.

**Criterios de aceptación**
- [x] Router (data mode) en `apps/web/src/app/router.tsx` con todas las rutas de `docs/08` registradas; las de módulos sin implementar apuntan a `ComingSoonPage` (pestañas) o no se enlazan ("Más") según RN-15-05.
- [x] `navigation.ts` con el registro de entradas (`id`, `label`, `icon`, `to(groupId)`, `placement: 'tab' | 'more'`, `section`, `enabled`, `requiresAdmin?`).
- [x] `BottomNav` con las 5 pestañas, pestaña activa según RN-15-03, `aria-current`, 44 px y `safe-area-inset-bottom`.
- [x] `GroupSwitcher` con hoja "Tus hogares" (RN-15-11) y cambio de hogar con RN-15-10; avatar → `/perfil`.
- [x] Redirección de `/` (RN-15-06), `hogaria:lastGroupId` (RN-15-07, con `try/catch`), `RequireAuth` con `?volver=` (RN-15-09) y `RequireGroup` → `NotFoundPage` (RN-15-08).
- [x] `/perfil` y `/admin` dentro del shell con la barra de `lastGroupId` (RN-15-12).
- [x] Rutas fuera del shell según RN-15-01; `*` → `NotFoundPage`.
- [x] Enlace "Saltar al contenido"; 375 px y modo oscuro.

**Notas técnicas**
- `apps/web/src/app/{router.tsx, navigation.ts, guards.tsx, layout/AppShell.tsx, layout/BottomNav.tsx, layout/GroupSwitcher.tsx, layout/AppHeader.tsx, pages/NotFoundPage.tsx, pages/ComingSoonPage.tsx, pages/RouteErrorPage.tsx}`.
- Utilidades puras `switchGroupPath()` y `isSafeReturnTo()` en `apps/web/src/app/navigation-utils.ts`.
- Validar `groupId` como UUID antes de consultar.

**Tests**
- Unit: `navigation.spec.ts`, `switch-group-path.spec.ts`, `safe-return-to.spec.ts`; `GroupSwitcher` con 1 y 3 grupos.
- Integración: —
- E2E: E2E-15 (grupo ajeno, de E02) debe pasar con este shell.

---

### HOG-751 · Crear la hoja "Más"

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-750
- **Spec:** `docs/specs/15-inicio-navegacion.md#71-appshell-appswebsrcapplayoutappshelltsx` (RN-15-04)

**Descripción**
Hoja inferior que abre la pestaña "Más" con las entradas del registro agrupadas, ocultando las deshabilitadas y mostrando "Administración" solo a administradores.

**Criterios de aceptación**
- [x] Secciones y orden exactos de RN-15-04; solo entradas `enabled`.
- [x] "Administración" solo si `me.isPlatformAdmin`.
- [x] El botón atrás del sistema cierra la hoja (entrada de historial con `state.sheet = 'more'`); Esc también.
- [x] Foco atrapado en la hoja y devuelto a la pestaña "Más" al cerrar.

**Notas técnicas**
- `apps/web/src/app/layout/MoreSheet.tsx` sobre el `Sheet` de `components/ui`.

**Tests**
- Unit: entradas visibles según `enabled` y admin; cierre con atrás.
- E2E: cubierto por E2E-16 (HOG-766).

---

### HOG-752 · Integrar el banner de sin conexión (HOG-155) en el AppShell

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 1
- **Capa:** web
- **Depende de:** HOG-155, HOG-750
- **Spec:** `docs/specs/15-inicio-navegacion.md#navegación-y-shell` (RN-15-17) · `docs/specs/03-tiempo-real-actividad.md` (RN-03-22)

**Descripción**
Montar en el `AppShell` el `OfflineBanner` que ya construye HOG-155 y comprobar que los controles del shell usan `useCanEdit()`. **No** se reimplementa la detección de conexión: toda la lógica (`connection-store`, `OFFLINE_GRACE_MS = 5000`, `useConnectionStatus()`, `useCanEdit()`, `networkMode: 'always'`) vive en HOG-155.

**Criterios de aceptación**
- [x] `OfflineBanner` (de HOG-155) se renderiza una sola vez en el `AppShell`, bajo la cabecera y por encima del contenido, sin tapar la barra inferior; si HOG-155 lo montó en el layout raíz, se mueve aquí (no hay dos banners).
- [x] El selector de hogar y los botones de acción del shell (FAB, "Nuevo hogar") usan la prop `requiresConnection` de HOG-155.
- [x] No existe ningún `useIsOffline()`, `ConnectionBanner` ni `lib/connection.ts` paralelos; no se abre un segundo socket.

**Notas técnicas**
- Solo toca `apps/web/src/app/layout/AppShell.tsx`.

**Tests**
- Unit: el `AppShell` muestra el banner cuando el `connection-store` está en `offline` (estado simulado).
- E2E: `context.setOffline(true)` muestra el banner (dentro de E2E-16, HOG-766).

---

### HOG-753 · Añadir transiciones de ruta y restauración del scroll

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P2 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-750
- **Spec:** `docs/specs/15-inicio-navegacion.md#navegación-y-shell` (RN-15-15/16)

**Descripción**
Fundido cruzado de 150 ms con la View Transitions API al navegar, sin animación con `prefers-reduced-motion` o sin soporte, y `ScrollRestoration`.

**Criterios de aceptación**
- [ ] Enlaces de `BottomNav`, `MoreSheet` y `GroupSwitcher` usan `viewTransition`.
- [ ] CSS que anula `::view-transition-old(root)`/`::view-transition-new(root)` con `prefers-reduced-motion: reduce`.
- [ ] `ScrollRestoration` en el layout raíz.
- [ ] Sin errores en navegadores sin `document.startViewTransition` (Safari < 18).

**Notas técnicas**
- Estilos en `apps/web/src/styles/transitions.css`.

**Tests**
- Unit: —
- E2E: Playwright con `reducedMotion: 'reduce'` no detecta animaciones (`document.getAnimations().length === 0` tras navegar).

---

### HOG-754 · Crear la API del Inicio con secciones registrables

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-100, HOG-101, HOG-153
- **Spec:** `docs/specs/15-inicio-navegacion.md#5-api`

**Descripción**
`GET /groups/:g/dashboard` con el `DashboardModule`, el token multi-provider `DASHBOARD_SECTIONS` y las secciones base `members` y `activity`; las calles se construyen con los miembros (sin sub-secciones todavía).

**Criterios de aceptación**
- [x] `dashboardQuery` y `dashboardDto` en `packages/shared/src/schemas/dashboard.ts` exactamente como la spec.
- [x] `date` por defecto = hoy en `Group.timezone`; formato o fecha inválida → 422.
- [x] `dayStartUtc`/`dayEndUtc` con `@date-fns/tz` (correcto en cambios de hora).
- [x] Providers en paralelo; claves opcionales omitidas si no hay provider (RN-15-20/21).
- [x] Calles en el orden de RN-15-22; `members[].isMe`.
- [x] `activity` = 5 últimas, reutilizando `ActivityService` (HOG-153).

**Notas técnicas**
- `apps/api/src/modules/dashboard/{dashboard.module.ts, dashboard.controller.ts, dashboard.service.ts, dashboard-section.provider.ts, sections/members.section.ts, sections/activity.section.ts}`.

**Tests**
- Unit: `dashboard.service.spec.ts` (sin providers opcionales; orden de calles).
- Integración: `dashboard.int.spec.ts` (401, 404, 422, respuesta de fase 1).
- E2E: —

---

### HOG-755 · Construir la pantalla de Inicio básica

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-750, HOG-754, HOG-152
- **Spec:** `docs/specs/15-inicio-navegacion.md#72-inicio-gdgroupid-featuresdashboardpageshomepagetsx`

**Descripción**
Página `/g/:groupId` con saludo y fecha, calles por miembro (`Lane` + `LaneRope` + `MemberDot`), actividad reciente, tarjeta "Invita a tu hogar" y todos los estados; renderiza cada sección solo si su clave existe en la respuesta.

**Criterios de aceptación**
- [x] Saludo por franja horaria y fecha en español en la zona del grupo.
- [x] Calles con "Tú", nombres y "Nada para hoy" cuando no hay contenido.
- [x] Actividad reciente (5) con "Ver toda la actividad" y su vacío.
- [x] "Invita a tu hogar" si el grupo tiene un único miembro.
- [x] Estados cargando, error con "Reintentar" y sin conexión (datos en caché).
- [x] `features/dashboard/realtime.ts` con `activity.created` (setQueryData) y eventos de miembros (invalidar); onda en cambios de otros.
- [x] Clave `['group', g, 'dashboard', date]` y cambio automático de día a medianoche (RN-15-30).
- [x] Componente de sección genérico que no pinta nada si la clave falta (base para HOG-763/764).

**Notas técnicas**
- `apps/web/src/features/dashboard/{api.ts, realtime.ts, pages/HomePage.tsx, components/Greeting.tsx, components/TodayLanes.tsx, components/RecentActivity.tsx}`.

**Tests**
- Unit: `greeting.spec.ts`; `TodayLanes` sin sub-secciones; estados.
- E2E: cubierto por E2E-16.

---

### HOG-756 · Soportar deep links y la vuelta tras iniciar sesión

- **Épica:** E15 · **Fase:** 1 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-750
- **Spec:** `docs/specs/15-inicio-navegacion.md#navegación-y-shell` (RN-15-09, RN-15-13, RN-15-14)

**Descripción**
Utilidades comunes para los parámetros `?fecha=` y `?destacar=` (scroll, foco y una onda) y la integración del `?volver=` con la pantalla de login, para que las notificaciones (E12) y el asistente (E14) lleven al elemento exacto.

**Criterios de aceptación**
- [ ] Hook `useDeepLinkHighlight(ids)` que, si `?destacar=` coincide con un id renderizado, hace scroll, da foco y reproduce una onda (sin animación con reduced motion) y luego elimina el parámetro de la URL (`replace`).
- [ ] Hook `useDeepLinkDate()` que devuelve la fecha de `?fecha=` validada o `null`.
- [ ] Función `buildDeepLink({ type: 'task' | 'event' | 'bill', groupId, id, date? })` en `packages/shared/src/deep-links.ts` con las URLs canónicas de RN-15-13 (la usa el scheduler para `Reminder.url`).
- [ ] La página `/entrar` (E01) navega a `volver` validado con `isSafeReturnTo`.

**Notas técnicas**
- `apps/web/src/lib/deep-links.ts`. Si la página de login aún no existe, dejar el hook `useReturnTo()` listo y apuntado en E01.

**Tests**
- Unit: `buildDeepLink`, `useDeepLinkDate` (fechas inválidas), `useDeepLinkHighlight` con id inexistente.
- E2E: E2E-16 (deep link sin sesión).

---

### HOG-757 · Añadir la sección de turnos de trabajo al Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-754, HOG-404
- **Spec:** `docs/specs/15-inicio-navegacion.md#inicio-hoy` (RN-15-23)

**Descripción**
Provider `shifts` que rellena `lanes[].shift` con el estado efectivo del día de cada miembro reutilizando el servicio de horarios de E08.

**Criterios de aceptación**
- [ ] `WORKING` con turnos (`endsNextDay`), `DAY_OFF`, `VACATION`, `SICK`, `NO_SCHEDULE` y `note` de la excepción.
- [ ] La calle "Sin asignar" nunca lleva `shift`.
- [ ] Reutiliza `WorkSchedulesService` (sin Prisma directo).

**Notas técnicas**
- `apps/api/src/modules/dashboard/sections/shifts.section.ts`.

**Tests**
- Unit: cada estado; turno nocturno.
- Integración: excepción de vacaciones gana al horario.

---

### HOG-758 · Añadir la sección de tareas de hoy al Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-754, HOG-352
- **Spec:** `docs/specs/15-inicio-navegacion.md#inicio-hoy` (RN-15-24)

**Descripción**
Provider `tasks` que rellena `lanes[].tasks` (y crea la calle "Sin asignar" si procede).

**Criterios de aceptación**
- [ ] Filtro, `overdue`, orden y límite 5 + `moreCount` de RN-15-24.
- [ ] Calle "Sin asignar" solo si hay tareas sin asignar.
- [ ] Reutiliza `TasksService`.

**Notas técnicas**
- `sections/tasks.section.ts`.

**Tests**
- Unit: vencidas primero; `moreCount`.
- Integración: tarea con `nextDueAt` a las 23:30 locales cuenta hoy; a las 00:30 de mañana, no.

---

### HOG-759 · Añadir la sección de eventos de hoy al Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-754, HOG-452
- **Spec:** `docs/specs/15-inicio-navegacion.md#inicio-hoy` (RN-15-25)

**Descripción**
Provider `events` que rellena `lanes[].events` con las ocurrencias del día por dueño.

**Criterios de aceptación**
- [ ] Ocurrencias expandidas que cortan el día; orden todo el día → por hora; 5 + `moreCount`.
- [ ] Reutiliza `CalendarEventsService.findRange`.

**Notas técnicas**
- `sections/events.section.ts`.

**Tests**
- Unit: evento de varios días; cumpleaños anual.
- Integración: evento excluido (`exdates`) no aparece.

---

### HOG-760 · Añadir la sección de comidas de hoy al Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 1
- **Capa:** api
- **Depende de:** HOG-754, HOG-302
- **Spec:** `docs/specs/15-inicio-navegacion.md#inicio-hoy` (RN-15-26)

**Descripción**
Provider `meals` con las entradas del plan del día.

**Criterios de aceptación**
- [ ] Orden por franja y `createdAt`; título de receta o libre; receta borrada → `title` o "Receta eliminada".
- [ ] Reutiliza `MealPlanService.findRange`.

**Notas técnicas**
- `sections/meals.section.ts`.

**Tests**
- Unit: orden y títulos.

---

### HOG-761 · Añadir la sección de facturas próximas al Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** api
- **Depende de:** HOG-754, HOG-553
- **Spec:** `docs/specs/15-inicio-navegacion.md#inicio-hoy` (RN-15-27)

**Descripción**
Provider `bills` con los recibos pendientes de los próximos 7 días y los vencidos.

**Criterios de aceptación**
- [ ] Rango, orden, límite 10 + `moreCount`, `overdue`, `amountCents` (real → estimado → null) y `totalCents` sobre todo el rango.
- [ ] Facturas archivadas excluidas.
- [ ] Reutiliza `BillPaymentsService`.

**Notas técnicas**
- `sections/bills.section.ts`.

**Tests**
- Unit: importe nulo; total con más de 10 recibos.
- Integración: recibo pagado no aparece.

---

### HOG-762 · Añadir la sección de listas de la compra al Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 1
- **Capa:** api
- **Depende de:** HOG-754, HOG-202
- **Spec:** `docs/specs/15-inicio-navegacion.md#inicio-hoy` (RN-15-28)

**Descripción**
Provider `shopping` con los pendientes por lista.

**Criterios de aceptación**
- [ ] Listas no archivadas por `position` con `pendingCount`; `totalPending`.
- [ ] Una sola consulta agregada (`groupBy` o `_count`) a través del servicio de E04.

**Notas técnicas**
- `sections/shopping.section.ts`.

**Tests**
- Unit: totales.
- Integración: items marcados no cuentan.

---

### HOG-763 · Pintar turnos, tareas y eventos en las calles del Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-755, HOG-757, HOG-758, HOG-759
- **Spec:** `docs/specs/15-inicio-navegacion.md#72-inicio-gdgroupid-featuresdashboardpageshomepagetsx` (punto 2)

**Descripción**
Completar `TodayLanes` con las filas de turno, tareas (con casilla para completar) y eventos, y sus enlaces de deep link.

**Criterios de aceptación**
- [ ] Textos de turno exactos de la spec, incluido "(+1)".
- [ ] Completar tarea con la mutación de E07 (optimista); deshabilitada sin conexión; "Vencida".
- [ ] Evento → `/g/:g/calendario?fecha=<date>&destacar=<id>`; "+{n} más" → pantalla del módulo.
- [ ] Cada fila solo si su clave existe.

**Notas técnicas**
- `features/dashboard/components/{LaneShiftRow.tsx, LaneTaskRow.tsx, LaneEventRow.tsx}`.

**Tests**
- Unit: combinaciones con/sin claves; textos de turno.
- E2E: E2E-16.

---

### HOG-764 · Pintar comidas, listas, facturas y "¿Qué cocino?" en el Inicio

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-755, HOG-760, HOG-761, HOG-762, HOG-655
- **Spec:** `docs/specs/15-inicio-navegacion.md#72-inicio-gdgroupid-featuresdashboardpageshomepagetsx` (puntos 3–6)

**Descripción**
Tarjetas de comidas de hoy, acceso rápido "¿Qué cocino?", `DepthFigure` de listas ("QUEDAN 4 EN LISTA") y facturas de la semana con `LaneRope` de límite en las vencidas.

**Criterios de aceptación**
- [ ] Comidas con su vacío y "Planificar" → `/g/:g/comidas?fecha=<date>`.
- [ ] "¿Qué cocino?" solo si la entrada `fridge` está habilitada; cuota con `useAiQuota`.
- [ ] `DepthFigure` de listas con singular/plural/"LISTA AL DÍA" y filas del resto de listas.
- [ ] Facturas: `DepthFigure` "A PAGAR" con `formatMoney`, "importe sin definir", "Vencida" con `LaneRope` de límite; sección oculta sin items.

**Notas técnicas**
- `features/dashboard/components/{MealsTodayCard.tsx, FridgeShortcutCard.tsx, ShoppingDepthCard.tsx, UpcomingBillsCard.tsx}`.

**Tests**
- Unit: textos de `DepthFigure`; facturas vencidas; ocultación de secciones.
- E2E: E2E-16.

---

### HOG-765 · Actualizar el Inicio en tiempo real con los eventos de los módulos

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-763, HOG-764
- **Spec:** `docs/specs/15-inicio-navegacion.md#6-eventos-en-tiempo-real`

**Descripción**
Ampliar `features/dashboard/realtime.ts` con todos los eventos de la tabla §6 (invalidación con *debounce* de 500 ms) y la onda en la calle o tarjeta afectada por otro miembro.

**Criterios de aceptación**
- [ ] Todos los eventos de §6 invalidan la clave del día.
- [ ] Varios eventos en 500 ms provocan un solo refetch.
- [ ] Onda solo si `actorId !== me.id`.

**Notas técnicas**
- Determinar la calle afectada por `actorId`/`ownerId`/`currentAssigneeId` del `data` cuando exista; si no, onda en la tarjeta de la sección.

**Tests**
- Unit: *debounce* con temporizadores falsos; eventos propios sin onda.
- E2E: E2E-16 (tarea completada en B actualiza A).

---

### HOG-766 · Escribir el e2e de Inicio y navegación (E2E-16)

- **Épica:** E15 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 3
- **Capa:** full-stack
- **Depende de:** HOG-751, HOG-752, HOG-756, HOG-765, HOG-011
- **Spec:** `docs/specs/15-inicio-navegacion.md#11-tests`

**Descripción**
E2E del flujo de navegación e Inicio descrito en la spec (E2E-16 de `docs/07-testing.md`).

**Criterios de aceptación**
- [ ] `apps/web/e2e/home-navigation.e2e.ts` cubre: calles de 2 miembros, 5 pestañas, hoja "Más", cambio de hogar conservando sección, deep link sin sesión con `?volver=`, banner sin conexión y actualización en tiempo real con dos contextos.
- [ ] Pasa en Pixel 7 y iPhone 14.

**Tests**
- E2E: **E2E-16**.
