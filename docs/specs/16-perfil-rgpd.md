# 16 · Perfil, ajustes y RGPD

> Épica: E16 · Tickets: `docs/tickets/E16-perfil-rgpd.md` · Modelo: `docs/02-modelo-datos.md` (AUTH: `User`, `Session`, `Account`, `SecurityEvent`; y todas las tablas con referencias a usuarios para exportación y borrado) · Seguridad: `docs/03-seguridad.md#privacidad-rgpd`.

## 1. Objetivo

Reunir en **`/perfil`** todo lo personal del usuario: datos de la cuenta (nombre, nombre de usuario, foto), seguridad (contraseña, Google, sesiones), accesos a su dieta y a sus notificaciones, tema visual y sus derechos RGPD: **descargar sus datos** en JSON y **borrar su cuenta** de forma inmediata y permanente. Además, publicar las páginas legales **`/legal/privacidad`** y **`/legal/terminos`** con contenido real para una app privada alojada desde España.

## 2. Historias de usuario

- **US-16-01** Como usuario, quiero cambiar mi nombre visible y mi nombre de usuario.
- **US-16-02** Como usuario, quiero elegir si se ve mi foto de Google o mis iniciales.
- **US-16-03** Como usuario con contraseña, quiero cambiarla pidiendo la actual, y que se cierren mis otras sesiones.
- **US-16-04** Como usuario con contraseña, quiero vincular mi cuenta de Google para entrar con un toque.
- **US-16-05** Como usuario, quiero ver y cerrar mis sesiones abiertas.
- **US-16-06** Como usuario, quiero llegar desde mi perfil a mi dieta y alergias y a mis preferencias de notificación.
- **US-16-07** Como usuario, quiero elegir tema claro, oscuro o el del sistema.
- **US-16-08** Como usuario, quiero descargar todos mis datos en un archivo.
- **US-16-09** Como usuario, quiero borrar mi cuenta sabiendo exactamente qué se borra y qué se queda.
- **US-16-10** Como usuario o persona invitada, quiero leer la política de privacidad y los términos antes y después de registrarme.
- **US-16-11** Como administrador de la plataforma, quiero un acceso a la administración desde mi perfil.

## 3. Reglas de negocio

### Cuenta
- **RN-16-01** `name`: 1–50 caracteres tras `trim()`, sin saltos de línea. Es el "nombre visible" que ven los demás y el único que se envía a la IA.
- **RN-16-02** `username`: mismo esquema que en el registro (`usernameSchema` de `@hogaria/shared`, definido en E01). Se guarda en minúsculas en `username` y tal como se escribió en `displayUsername`. Si ya lo usa otro usuario (comparación en minúsculas) → `409 CONFLICT` "Ese nombre de usuario ya está en uso". Cambiarlo no cierra sesiones.
- **RN-16-03** El **email no se puede cambiar** desde la app (fuera de alcance).
- **RN-16-04** **Foto:** no hay subida de imágenes. `User.image` guarda la URL de la foto de Google (la gestiona Better Auth). El campo `User.preferInitialsAvatar` decide qué se muestra: `true` → iniciales; `false` → foto de Google si `image` no es `null`, si no iniciales. Todas las DTOs que exponen la imagen de un usuario a otros (`GroupMemberDto`, `dashboardDto.members`, actividad, etc.) aplican `publicImage(user) = user.preferInitialsAvatar ? null : user.image`.
- **RN-16-05** Iniciales: primera letra de las dos primeras palabras de `name` en mayúsculas ("Ana María" → "AM"; "óscar" → "Ó"), sobre el color de calle del usuario en el grupo actual (fuera de un grupo: `SEA`).
- **RN-16-06** Al cambiar `name`, `username` o `preferInitialsAvatar` se emite `group.member.updated` en **cada** grupo del usuario.

### Seguridad
- **RN-16-07** Cambiar contraseña: solo si el usuario tiene cuenta `credential`. Usa Better Auth `changePassword` con `currentPassword`, `newPassword` y `revokeOtherSessions: true` (`docs/03`: pide la actual y revoca las demás). La nueva cumple la política de `docs/03` (`passwordPolicy` de shared). Registra `SecurityEvent PASSWORD_CHANGED`.
- **RN-16-08** Vincular Google: solo si no hay cuenta `google`. Usa Better Auth `linkSocial({ provider: 'google' })`; solo funciona si el email de Google coincide y está verificado (`accountLinking` de `docs/03`). Vuelta a `/perfil?vinculado=google` o `/perfil?error=<código>`.
- **RN-16-09** Desvincular Google: solo si además hay cuenta `credential` (nunca dejar al usuario sin forma de entrar). Usa `unlinkAccount({ providerId: 'google' })`.
- **RN-16-10** Usuarios solo de Google no pueden crear contraseña desde aquí (fuera de alcance).
- **RN-16-11** Sesiones: se reutiliza el componente y la API de E01 (HOG-056). E16 solo lo monta en su sección.

### Preferencias
- **RN-16-12** Tema: `light`, `dark` o `system` (por defecto `system`). Es **por dispositivo**: se guarda en `localStorage['hogaria.theme']` (con `try/catch`; si falla, `system`) y no en el servidor. Se aplica antes del primer pintado mediante `apps/web/public/theme-init.js` (script externo, compatible con la CSP `default-src 'self'`) que pone `data-theme="light"|"dark"` en `<html>` o lo quita para `system`, y actualiza `<meta name="theme-color">`. Los tokens de cada tema son los de `DESIGN.md` (HOG-007).
- **RN-16-13** Dieta y alergias: la edición es de E06. `/perfil` muestra el resumen y abre el editor de E06 (`DietProfileEditor`) en una hoja.
- **RN-16-14** Notificaciones: la edición es de E12 (HOG-602). `/perfil` monta su formulario (`NotificationSettings`) en la sección "Notificaciones".

### Exportar mis datos
- **RN-16-15** `GET /me/export` devuelve un JSON (`userExportDto`, §5.3) con **todos los datos personales del usuario y todo el contenido que creó o que le pertenece**, agrupado por hogar. Cabeceras: `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="hogaria-mis-datos-YYYY-MM-DD.json"` (fecha en `Europe/Madrid`), `Cache-Control: no-store`.
- **RN-16-16** Nunca se exportan: hashes de contraseña, tokens de sesión, tokens OAuth (`accessToken`, `refreshToken`, `idToken`), `tokenHash` de invitaciones, claves de push (`p256dh`, `auth`, `endpoint`) ni datos personales de **otros** usuarios (de otros solo aparecen sus `userId` cuando forman parte de un contenido del usuario, p. ej. la rotación de una tarea).
- **RN-16-17** Límite: **3 exportaciones por hora** por usuario (throttler) → `429 RATE_LIMITED`. Cada exportación registra `SecurityEvent DATA_EXPORTED` con IP y user-agent.
- **RN-16-18** La exportación se genera en memoria en una sola petición (los volúmenes de `docs/02` lo permiten: < 5 MB por usuario). Lecturas con `findMany` paginado internamente de 1000 en 1000 para no cargar tablas enteras de golpe.

### Borrar mi cuenta
- **RN-16-19** `DELETE /me` exige el cuerpo `{ "confirmation": "BORRAR" }` (exacto, en mayúsculas). Cualquier otro valor → `422 VALIDATION_ERROR`.
- **RN-16-20** Si el usuario es el **único** `isPlatformAdmin` de la instancia → `409 CONFLICT` "Eres el único administrador de esta instancia. No puedes borrar tu cuenta desde la app" (se haría por CLI).
- **RN-16-21** El borrado es **inmediato, permanente y en una única transacción** (interactiva, timeout 30 s). Pasos en orden:
  1. **Por cada grupo** del usuario se reutiliza la lógica de salida de E02 (`GroupsService.removeMember(tx, groupId, userId, { reason: 'ACCOUNT_DELETED' })`):
     - si es el **último miembro** → se borra el grupo entero (cascada de todo su contenido, ADR-014);
     - si no → se borra su `GroupMember` y se ejecutan los `MemberRemovedHooks` (spec 02 RN-02-22, ADR-019): se borran sus `CalendarEvent`, `Expense`, `Budget` y `AiConversation` de ese grupo, se le quita de `Task.rotationUserIds` y, si era `currentAssigneeId`, la tarea pasa al siguiente de la rotación (o `null`), `Bill.responsibleUserId` → `null`, se quita de `MealPlanEntry.forUserIds` (borrando las entradas que eran solo para él), y se crea un `ActivityLog` con `actorId: null`, `entityType: "group_member"`, `action: "left"` y `summary` "Un miembro ha eliminado su cuenta".
  2. **Contenido personal** sin relación Prisma (se borra explícitamente): `CalendarEvent` con `ownerId`, `Expense` con `ownerId`, `Budget` con `userId`.
  3. **Referencias en contenido compartido** → `null` (aparecen como "Usuario eliminado"): `Group.createdById`, `GroupInvite.createdById`, `GroupInvite.usedById`, `ShoppingList.createdById`, `ShoppingItem.addedById`, `ShoppingItem.checkedById`, `Purchase.purchasedById`, `Recipe.createdById`, `MealPlanEntry.createdById`, `Task.createdById`, `TaskCompletion.assigneeId`, `TaskCompletion.completedById`, `Bill.createdById`, `BillPayment.paidById`, `ActivityLog.actorId`, `AiUsage.userId`.
  4. `SecurityEvent` `ACCOUNT_DELETED` con `userId`, IP y user-agent (sobrevive: no tiene FK).
  5. Borrado del `User`: caen en cascada `Session`, `Account`, `DietProfile`, `WorkSchedule` (+`WorkScheduleSlot`), `WorkShiftOverride`, `PushSubscription`, `NotificationPreference`, `Reminder`, `AiConversation` (+`AiMessage`).
- **RN-16-22** Tras el commit: se emite `group.member.left` (`{ userId }`) y `activity.created` en cada grupo superviviente; `session.revoked` en la sala `user:<userId>` y se desconectan sus sockets; se cancelan sus temporizadores en memoria (`ReminderScheduler.cancelForUser(userId)`); se invalida la caché del `GroupMemberGuard` para ese usuario; la respuesta `204` borra la cookie de sesión (`Set-Cookie` caducada con el mismo `Domain`).
- **RN-16-23** Las invitaciones pendientes creadas por el usuario **siguen siendo válidas** (pertenecen al grupo; cualquier miembro puede revocarlas).
- **RN-16-24** `GET /me/deletion-preview` devuelve qué se borrará: hogares en los que es el único miembro y recuento de su contenido personal, y si es el único administrador. La web lo muestra en el diálogo de confirmación.
- **RN-16-25** En la interfaz, cualquier referencia a un usuario `null` (o a un id que ya no existe) se muestra como **"Usuario eliminado"** con un `MemberDot` neutro (utilidad `displayUserName(user | null)` de `@hogaria/shared`).
- **RN-16-26** Las copias de seguridad (E17) pueden contener los datos borrados hasta que rotan (máximo **8 semanas**); así se informa en la política de privacidad. Si se restaura una copia, el administrador debe volver a borrar las cuentas eliminadas después de la fecha de la copia con `pnpm --filter api cli delete-user --id <uuid>`, identificándolas por los `SecurityEvent ACCOUNT_DELETED` de la base anterior a la restauración (si sigue accesible) o, si no, por los eventos `account.deleted` del log (14 días); procedimiento en `deploy/README.md` (spec 17, RN-17-25).

### Legal y administración
- **RN-16-27** `/legal/privacidad` y `/legal/terminos` son **públicas** (sin sesión), fuera del shell, precacheadas por el service worker y enlazadas desde `/entrar`, `/registro` (E01), el `AiNoticeDialog` (E13) y `/perfil`.
- **RN-16-28** El nombre del responsable y el email de contacto se inyectan en build con `VITE_LEGAL_CONTROLLER_NAME` y `VITE_LEGAL_CONTACT_EMAIL` (`docs/06-despliegue.md`). Si faltan, el build de producción falla. La fecha de la versión vigente es la constante `LEGAL_UPDATED_AT` (`"2026-11-11"`) en `apps/web/src/features/legal/version.ts`.
- **RN-16-29** El enlace "Administración" (→ `/admin`, E01 HOG-059) solo aparece si `me.isPlatformAdmin`.

## 4. Modelo de datos

Lectura y borrado sobre todas las tablas con referencias a usuarios (lista exacta en RN-16-21). Campo propio: `User.preferInitialsAvatar` (`docs/02-modelo-datos.md`). Ninguno de esos campos tiene FK: la lista cerrada de RN-16-21 y un test guardián sobre el DMMF de Prisma garantizan que no se olvida ninguno (`docs/02`, convenciones).

## 5. API

Base `/api/v1`. Esquemas en `packages/shared/src/schemas/me.ts` (archivo de E01; se amplía).

| Método | Ruta | Entrada (zod) | Salida | Errores |
|---|---|---|---|---|
| `GET` | `/me` | — | `meDto` | 401 |
| `PATCH` | `/me` | `updateMeInput` | `meDto` | 401, 409 `CONFLICT`, 422 |
| `GET` | `/me/export` | — | `userExportDto` (descarga) | 401, 429 `RATE_LIMITED` |
| `GET` | `/me/deletion-preview` | — | `deletionPreviewDto` | 401 |
| `DELETE` | `/me` | `deleteMeInput` | 204 | 401, 409 `CONFLICT`, 422 |

Operaciones de Better Auth usadas desde la web (sin endpoint propio): `changePassword`, `linkSocial`, `unlinkAccount`, `listAccounts`, `signOut` y las de sesiones (E01).

### 5.1 Cuenta

```ts
export const meDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  username: z.string().nullable(),
  displayUsername: z.string().nullable(),
  image: z.string().url().nullable(),          // ya resuelta con publicImage (RN-16-04)
  googleImage: z.string().url().nullable(),    // User.image sin resolver (para la vista previa del selector)
  preferInitialsAvatar: z.boolean(),
  isPlatformAdmin: z.boolean(),
  aiNoticeAcceptedAt: z.string().datetime().nullable(),   // spec 13
  hasPassword: z.boolean(),                    // existe Account providerId = 'credential'
  hasGoogle: z.boolean(),                      // = linkedProviders.includes('google') (spec 01)
  linkedProviders: z.array(z.enum(['credential', 'google'])),
  createdAt: z.string().datetime(),
});

export const updateMeInput = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[^\n\r]+$/).optional(),
  username: usernameSchema.optional(),          // de E01
  preferInitialsAvatar: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nada que actualizar' });
```

### 5.2 Borrado

```ts
export const deleteMeInput = z.object({ confirmation: z.literal('BORRAR') });

export const deletionPreviewDto = z.object({
  groupsToDelete: z.array(z.object({ id: z.string().uuid(), name: z.string(), emoji: z.string() })),
  groupsToLeave: z.array(z.object({ id: z.string().uuid(), name: z.string(), emoji: z.string() })),
  personal: z.object({
    calendarEvents: z.number().int(),
    expenses: z.number().int(),
    budgets: z.number().int(),
    workSchedules: z.number().int(),
    aiConversations: z.number().int(),
    hasDietProfile: z.boolean(),
  }),
  isSoleAdmin: z.boolean(),
});
```

### 5.3 Exportación (`userExportDto`, versión 1)

Fechas en ISO; días `YYYY-MM-DD`; dinero en céntimos (`amountCents`) y también formateado (`amountFormatted: "12,34 €"`) para que sea legible.

```ts
export const userExportDto = z.object({
  exportVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  app: z.literal('Hogaria'),
  user: z.object({ id, name, email, emailVerified, username, displayUsername, image, preferInitialsAvatar,
                   isPlatformAdmin, aiNoticeAcceptedAt, createdAt, updatedAt }),
  accounts: z.array(z.object({ providerId, createdAt })),                     // sin tokens ni hash
  sessions: z.array(z.object({ createdAt, updatedAt, expiresAt, ipAddress, userAgent })),  // sin token
  securityEvents: z.array(z.object({ type, ipAddress, userAgent, createdAt })),            // propios, ≤ 180 días
  dietProfile: z.object({ diet, allergens, otherRestrictions, dislikes, notes, updatedAt }).nullable(),
  notificationPreferences: z.object({ tasks, events, bills, quietHoursStart, quietHoursEnd }).nullable(),
  pushSubscriptions: z.array(z.object({ userAgent, createdAt, lastSuccessAt })),   // sin endpoint ni claves
  workSchedules: z.array(z.object({ name, validFrom, validTo, slots: z.array(z.object({ weekday, startTime, endTime, label })) })),
  workShiftOverrides: z.array(z.object({ date, type, startTime, endTime, note })),
  pendingReminders: z.array(z.object({ groupId, sourceType, title, fireAt })),
  aiUsage: z.array(z.object({ groupId, feature, model, success, createdAt })),
  groups: z.array(z.object({
    group: z.object({ id, name, emoji, timezone }),
    membership: z.object({ laneColor, joinedAt }),
    owned: z.object({                                      // contenido que le pertenece (propiedad)
      calendarEvents: z.array(/* CalendarEvent completo salvo groupId */),
      expenses: z.array(/* Expense + categoryName + amountFormatted */),
      budgets: z.array(/* Budget + categoryName + amountFormatted */),
      aiConversations: z.array(z.object({ title, createdAt, messages: z.array(z.object({ role, content, toolName, pendingAction, createdAt })) })),
    }),
    created: z.object({                                    // contenido compartido que creó
      shoppingLists: z.array(/* name, emoji, createdAt, archivedAt */),
      shoppingItems: z.array(/* listName, name, quantity, unit, note, checked, createdAt */),
      recipes: z.array(/* receta completa con ingredients y steps, incluidas las borradas lógicamente */),
      mealPlanEntries: z.array(/* date, slot, recipeTitle, title, servings, note */),
      tasks: z.array(/* title, description, rrule, rotationMode, createdAt, archivedAt */),
      bills: z.array(/* name, provider, category, estimatedAmountCents, frequency, dueDay, startDate, endDate */),
      invites: z.array(/* createdAt, expiresAt, usedAt, revokedAt (sin token) */),
    }),
    participation: z.object({                              // acciones propias en contenido compartido
      taskCompletions: z.array(/* taskTitle, dueAt, skipped, completedAt, wasAssignee */),
      purchases: z.array(/* productName, quantity, unit, purchasedAt */),
      billPaymentsPaid: z.array(/* billName, periodDueDate, amountCents, paidAt */),
      activity: z.array(/* action, entityType, summary, createdAt */),   // actorId = usuario, ≤ 90 días
    }),
  })),
});
```

El esquema zod completo (sin comentarios de relleno) se escribe en HOG-800 con exactamente estos campos.

## 6. Eventos en tiempo real

| Evento | Cuándo | data | Sala |
|---|---|---|---|
| `group.member.updated` | `PATCH /me` cambia `name`, `username` o `preferInitialsAvatar` | `GroupMemberDto` | cada grupo del usuario |
| `group.member.left` | Borrado de cuenta, en cada grupo superviviente | `{ userId }` | group |
| `activity.created` | Borrado de cuenta ("Un miembro ha eliminado su cuenta") | `ActivityDto` | group |
| `session.revoked` | Borrado de cuenta y cambio de contraseña (otras sesiones; lo emite E01) | `{}` | user |

## 7. Pantallas y UX

Sistema visual de `DESIGN.md`. Ruta **`/perfil`** dentro del shell (spec 15, RN-15-12). Una sola página con secciones ancladas (`#cuenta`, `#seguridad`, `#dieta`, `#notificaciones`, `#apariencia`, `#datos`, `#legal`, `#admin`); los formularios se abren en hojas inferiores (no hay subrutas). Título de la página: "Perfil".

### 7.1 Cabecera
Avatar grande (foto o iniciales, RN-16-04/05), nombre, `@displayUsername` y email en texto secundario.

### 7.2 "Tu cuenta" (`#cuenta`)
- **Nombre** → hoja "Cambiar nombre": campo "Nombre visible" (ayuda: "Es como te verán en tus hogares") + "Guardar".
- **Nombre de usuario** → hoja "Cambiar nombre de usuario": campo con prefijo "@" y ayuda con las reglas de E01; error 409 en el campo: "Ese nombre de usuario ya está en uso".
- **Foto**: dos opciones tipo radio "Foto de Google" (con miniatura de `googleImage`; deshabilitada con la ayuda "No hay foto de Google" si es `null`) e "Iniciales" (con la vista previa). Se guarda al cambiar.
- **Email**: solo lectura, ayuda "El email no se puede cambiar".

### 7.3 "Seguridad" (`#seguridad`)
- **Contraseña** (si `hasPassword`) → hoja "Cambiar contraseña": "Contraseña actual", "Nueva contraseña" (con indicador de requisitos de `docs/03`), "Repite la nueva contraseña"; botón "Cambiar contraseña". Éxito: toast "Contraseña cambiada. Hemos cerrado tus otras sesiones". Error de contraseña actual: "La contraseña actual no es correcta".
- **Google**: "Vinculada" con botón "Desvincular" (solo si `hasPassword`; confirmación "¿Desvincular tu cuenta de Google? Podrás seguir entrando con tu contraseña") o botón "Vincular con Google". Al volver con `?vinculado=google`: toast "Cuenta de Google vinculada"; con `?error=`: "No se ha podido vincular. La cuenta de Google debe usar el mismo email que tu cuenta de Hogaria". Después se limpia la URL.
- **Sesiones abiertas**: componente de E01 (HOG-056).

### 7.4 Resto de secciones
- **"Dieta y alergias"** (`#dieta`): resumen de E06 (`DietProfileSummary`: "Vegetariana · sin huevo, sin frutos de cáscara" o "Sin indicar") + "Editar" → `DietProfileEditor` de E06 en una hoja. Ayuda: "Lo ven los miembros de tus hogares y se usa para proponer recetas".
- **"Notificaciones"** (`#notificaciones`): `NotificationSettings` de E12 (HOG-602).
- **"Apariencia"** (`#apariencia`): control segmentado "Tema": "Claro" · "Oscuro" · "Sistema". Cambia al instante.
- **"Tus datos"** (`#datos`):
  - **"Descargar mis datos"** → descarga el JSON. Texto de ayuda: "Un archivo con tu cuenta y todo lo que has creado en Hogaria". Mientras se genera: botón con spinner "Preparando…". En iOS instalada como app (`navigator.standalone`), si `navigator.canShare({ files })` es `true`, se usa la hoja de compartir; si no, enlace de descarga. Error 429: "Ya has descargado tus datos varias veces. Prueba dentro de una hora".
  - **"Borrar mi cuenta"** (estilo destructivo) → diálogo §7.5.
- **"Legal"** (`#legal`): "Política de privacidad" → `/legal/privacidad`, "Términos de uso" → `/legal/terminos`; versión de la app en texto pequeño ("Hogaria {versión}").
- **"Administración"** (`#admin`, solo administradores): "Administración de la plataforma" → `/admin`.
- **"Cerrar sesión"**: botón al final (usa la función de cierre de sesión de E01; limpia la caché de TanStack Query y las claves `hogaria.*` de `localStorage` salvo `hogaria.theme`, y navega a `/entrar`).

### 7.5 Diálogo "Borrar tu cuenta"
- Carga `GET /me/deletion-preview` (skeleton mientras tanto).
- Si `isSoleAdmin`: solo el texto de RN-16-20 y "Cerrar".
- Texto: "Esto borra tu cuenta **para siempre** y no se puede deshacer."
  - "Se borrará: tu cuenta, tu perfil de dieta, tus horarios, tus eventos ({n}), tus gastos ({n}) y presupuestos ({n}) y tus conversaciones con el asistente ({n})."
  - "Lo que has creado en tus hogares (listas, recetas, tareas, facturas…) se quedará y aparecerá como «Usuario eliminado»."
  - Si `groupsToDelete` no está vacío: "Eres el único miembro de estos hogares, que se borrarán con todo su contenido: {emoji nombre, …}" sobre una `LaneRope` de límite (roja/blanca).
  - Enlace "Descargar mis datos antes".
- Campo "Escribe BORRAR para confirmar" (`autocomplete="off"`, `autocapitalize="characters"`). El botón **"Borrar mi cuenta"** solo se habilita si el valor es exactamente `BORRAR`.
- Al confirmar: botón con spinner; éxito → la web desuscribe el push del navegador (`pushManager.getSubscription()?.unsubscribe()`), limpia la caché y `localStorage` (`hogaria.*` salvo `hogaria.theme`) y navega a `/entrar?cuenta=borrada`, donde se muestra "Tu cuenta se ha borrado. ¡Gracias por usar Hogaria!" (texto que E01 pinta si recibe ese parámetro).
- Error: toast con `ERROR_MESSAGES_ES`; el diálogo sigue abierto.

### 7.6 Estados de `/perfil`
- **Cargando**: skeleton de cabecera y 3 secciones.
- **Error** al cargar `GET /me`: "No hemos podido cargar tu perfil" + "Reintentar".
- **Sin conexión**: banner global; todos los botones que escriben (guardar, cambiar contraseña, vincular, exportar, borrar) deshabilitados; el tema sí se puede cambiar (es local).

### 7.7 Páginas legales
Layout propio (sin shell): cabecera con el logotipo/nombre "Hogaria" y "Volver" (historial o `/`), contenido en una columna legible, índice de secciones con anclas, "Última actualización: 11 de noviembre de 2026". Contenido en JSX en `apps/web/src/features/legal/content/{PrivacyContent.tsx, TermsContent.tsx}` (nada de HTML inyectado). Los marcadores `{RESPONSABLE}` y `{EMAIL}` se sustituyen por `VITE_LEGAL_CONTROLLER_NAME` y `VITE_LEGAL_CONTACT_EMAIL`.

#### Texto de `/legal/privacidad`

> **Política de privacidad de Hogaria**
>
> Hogaria es una aplicación privada para organizar un hogar compartido. Solo pueden usarla las personas invitadas. Esta política explica qué datos tratamos, para qué y cuáles son tus derechos, de acuerdo con el Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
>
> **1. Responsable** (`#responsable`)
> El responsable del tratamiento es {RESPONSABLE}, persona que administra esta instancia de Hogaria desde España. Puedes escribir a {EMAIL} para cualquier cuestión sobre tus datos.
>
> **2. Qué datos tratamos** (`#datos`)
> - **Cuenta:** nombre visible, email, nombre de usuario, contraseña (guardada solo como hash, nunca en claro) y, si entras con Google, tu identificador de Google y la dirección de tu foto de perfil.
> - **Datos de tus hogares:** listas de la compra, recetas, menús, tareas, eventos del calendario, horarios de trabajo, gastos, presupuestos y facturas que tú o los demás miembros añadís.
> - **Dieta y alergias:** tu tipo de dieta, alérgenos, restricciones y alimentos que no te gustan (ver apartado 3).
> - **Uso de la IA:** las fotos que haces de la nevera o de tickets (solo mientras se analizan) y los mensajes que escribes al asistente.
> - **Seguridad y técnicos:** sesiones abiertas (dispositivo/navegador e IP), registros de inicio de sesión y de acciones sensibles, y suscripciones a notificaciones del navegador.
>
> **3. Datos de salud** (`#salud`)
> Las alergias e intolerancias son datos de salud (categoría especial del artículo 9 RGPD). Rellenarlas es **voluntario**: solo las tratamos si tú las indicas, con tu consentimiento explícito, para avisarte de alérgenos y proponer comidas adecuadas. Las ven únicamente los miembros de tus hogares y la IA cuando propone recetas o responde en el asistente de esos hogares. Puedes borrarlas cuando quieras desde tu perfil, lo que retira tu consentimiento.
>
> **4. Para qué usamos tus datos y con qué base legal** (`#finalidades`)
> - Prestarte el servicio (cuenta, hogares, listas, recordatorios…): ejecución de los términos de uso que aceptas (art. 6.1.b RGPD).
> - Dieta y alergias: tu consentimiento explícito (art. 9.2.a RGPD).
> - Funciones de IA: tu consentimiento, que das al aceptar el aviso de IA la primera vez (art. 6.1.a RGPD). Puedes no usarlas.
> - Seguridad (evitar accesos indebidos, registros de seguridad y copias de seguridad): interés legítimo en proteger el servicio y tus datos (art. 6.1.f RGPD).
> No usamos tus datos para publicidad, no hacemos perfiles comerciales y no vendemos ni cedemos datos.
>
> **5. Inteligencia artificial** (`#ia`)
> Para analizar fotos, proponer recetas, leer tickets y responder en el asistente, Hogaria envía a **Google Gemini** (Google LLC) las fotos, los mensajes y los datos del hogar necesarios para responder (por ejemplo, productos de la lista o, si eliges comensales, sus dietas y alergias, sin nombres ni emails). Usamos el **plan gratuito** de Gemini: según sus condiciones, **Google puede usar estos datos para mejorar sus productos y algunas personas pueden revisarlos**. Por eso no debes enviar fotos con personas ni información que no quieras compartir. Hogaria **no guarda las fotos**: se procesan en memoria y se descartan. La IA puede equivocarse: revisa siempre los resultados, en especial los avisos de alérgenos.
>
> **6. Quién trata datos por nosotros** (`#encargados`)
> Para funcionar sin coste usamos estos proveedores, que actúan como encargados del tratamiento:
> - **Neon** (base de datos PostgreSQL), con los datos alojados en la Unión Europea (Fráncfort, Alemania).
> - **Oracle Cloud** (servidor de la aplicación y copias de seguridad cifradas), en un centro de datos de la Unión Europea.
> - **Cloudflare** (entrega de la web): recibe tu IP y datos técnicos de la conexión al cargar la aplicación.
> - **Google** (inicio de sesión con Google, si lo usas, y Gemini para la IA).
> - **Resend** (envío de emails de verificación y de recuperación de contraseña): recibe tu email y el contenido del mensaje.
> - **Servicios de notificaciones** de tu navegador (Google, Apple o Mozilla), que entregan las notificaciones cifradas.
> Algunos de estos proveedores son de Estados Unidos o pueden acceder desde allí. Las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo de la Comisión Europea.
>
> **7. Cuánto tiempo los conservamos** (`#conservacion`)
> - Tu cuenta y tus datos, mientras no borres la cuenta. Al borrarla, se eliminan **de inmediato**.
> - El historial de actividad de los hogares, 90 días.
> - Las conversaciones con el asistente, hasta que las borres o pasen 180 días sin usarlas.
> - Los registros de seguridad (incluida la IP), 180 días.
> - Los registros técnicos del servidor, como máximo 14 días.
> - Las copias de seguridad, que están cifradas, se renuevan cada semana y se conservan como máximo **8 semanas**: durante ese tiempo pueden contener datos ya borrados.
> - El contenido compartido que creaste (por ejemplo, una receta) se queda en el hogar como «Usuario eliminado», sin datos que te identifiquen.
>
> **8. Tus derechos** (`#derechos`)
> Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar tu consentimiento en cualquier momento:
> - Desde la app: en **Perfil** puedes corregir tus datos, **descargar todos tus datos** en un archivo y **borrar tu cuenta**.
> - Escribiendo a {EMAIL}. Responderemos en el plazo máximo de un mes.
> Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).
>
> **9. Cookies y almacenamiento local** (`#cookies`)
> Hogaria **no usa cookies de terceros, ni de analítica ni de publicidad**. Solo usa cookies técnicas imprescindibles: la de tu sesión y, temporalmente, la de la invitación con la que te registras. También guarda en tu dispositivo preferencias como el tema o el último hogar abierto. Al ser imprescindibles o preferencias tuyas, no requieren consentimiento.
>
> **10. Seguridad** (`#seguridad`)
> Las conexiones van cifradas (HTTPS), las contraseñas se guardan con un algoritmo de hash robusto, las sesiones usan cookies protegidas y cada hogar solo es accesible para sus miembros. Las copias de seguridad están cifradas.
>
> **11. Menores** (`#menores`)
> Los menores de 14 años solo pueden usar Hogaria con el consentimiento de sus padres o tutores, que son quienes deben invitarlos y supervisar su uso.
>
> **12. Cambios** (`#cambios`)
> Si cambiamos esta política, lo indicaremos en la app con la nueva fecha de actualización.

#### Texto de `/legal/terminos`

> **Términos de uso de Hogaria**
>
> **1. Qué es Hogaria.** Hogaria es una aplicación web privada y gratuita, administrada por {RESPONSABLE}, para organizar un hogar compartido. Solo se accede por invitación. Al crear tu cuenta aceptas estos términos y la política de privacidad.
>
> **2. Tu cuenta.** Debes dar datos ciertos, custodiar tu contraseña y no compartir tu cuenta. Eres responsable de lo que se haga con ella. Puedes borrarla cuando quieras desde tu perfil.
>
> **3. Hogares y contenido.** Lo que añades a un hogar lo ven y, salvo tus eventos, horarios, gastos y presupuestos, lo pueden editar todos sus miembros. Solo invita a personas de confianza. Conservas la titularidad de tu contenido y nos permites guardarlo y mostrarlo a los miembros de tus hogares solo para prestar el servicio.
>
> **4. Uso aceptable.** No puedes usar Hogaria para fines ilegales, para acosar a otras personas, para subir contenido ilícito o de terceros sin permiso, ni intentar acceder a hogares o cuentas ajenas, saturar el servicio o eludir sus límites.
>
> **5. Inteligencia artificial.** Las funciones de IA son una ayuda y pueden equivocarse. Revisa siempre las recetas propuestas, **en especial los alérgenos e ingredientes si hay alergias**, y los datos leídos de tickets antes de guardarlos. Hogaria no da consejo médico, nutricional, legal ni financiero. El uso de la IA tiene un límite diario por hogar.
>
> **6. Servicio sin garantías.** Hogaria se ofrece gratis, tal cual y sin compromiso de disponibilidad. Puede haber interrupciones, cambios o pérdida de funciones. Aunque hacemos copias de seguridad, te recomendamos descargar tus datos de vez en cuando. En la medida en que la ley lo permita, el responsable no responde de daños derivados del uso o la imposibilidad de uso del servicio, salvo dolo o culpa grave.
>
> **7. Suspensión y baja.** El administrador puede bloquear cuentas que incumplan estos términos o pongan en riesgo el servicio. Si Hogaria deja de prestarse, se avisará con antelación razonable para que puedas descargar tus datos.
>
> **8. Cambios.** Podemos actualizar estos términos; te lo indicaremos en la app con la nueva fecha. Si no estás de acuerdo, puedes borrar tu cuenta.
>
> **9. Ley aplicable.** Estos términos se rigen por la ley española. Si eres consumidor, son competentes los juzgados de tu domicilio.
>
> **10. Contacto.** {EMAIL}.

## 8. Permisos

- `/perfil`, `GET/PATCH/DELETE /me`, `GET /me/export`, `GET /me/deletion-preview`: solo el propio usuario (con sesión). No hay forma de actuar sobre otro usuario desde aquí.
- `/legal/*`: público.
- `/admin`: solo `isPlatformAdmin` (E01).

## 9. Actividad

- `PATCH /me` no genera `ActivityLog` (los cambios se ven por `group.member.updated`).
- Borrado de cuenta: un `ActivityLog` por grupo superviviente, `actorId: null`, `entityType: "group_member"`, `entityId: <id del GroupMember borrado>`, `action: "left"`, `summary: "Un miembro ha eliminado su cuenta"`.
- Exportación y borrado registran además `SecurityEvent` (`DATA_EXPORTED`, `ACCOUNT_DELETED`); cambio de contraseña, `PASSWORD_CHANGED`.

## 10. Casos límite

- Dos usuarios piden el mismo `username` a la vez: el índice único de la BBDD decide; el perdedor recibe 409 (se captura `P2002`).
- `PATCH /me` sin campos → 422 "Nada que actualizar".
- El usuario borra su cuenta con otra sesión abierta en otro dispositivo: esa sesión recibe `session.revoked`, su siguiente petición responde 401 y la web vuelve a `/entrar`.
- Borrado de cuenta cuando otro miembro sale del mismo grupo a la vez y el usuario queda como último: la lógica de E02 se ejecuta dentro de la transacción y vuelve a contar miembros; si queda solo, el grupo se borra.
- Tarea con rotación en la que solo estaba el usuario: queda con `rotationUserIds = []`, `currentAssigneeId = null` y `rotationMode` sin cambios (la gestiona el resto en E07).
- Gasto cuya categoría está archivada: se borra igual (el `Restrict` es sobre la categoría, no sobre el gasto).
- Exportación de un usuario sin grupos: `groups: []`.
- Usuario bloqueado (`blockedAt`) no puede iniciar sesión y por tanto no puede exportar ni borrar desde la app; el administrador lo gestiona (fuera de alcance).
- `theme-init.js` falla o `localStorage` está bloqueado: se usa `system` sin errores.
- Vincular Google con una cuenta de Google ya vinculada a otro usuario: Better Auth devuelve error → mensaje genérico de §7.3.

## 11. Tests

**Unitarios**
- `publicImage`, `initials`, `displayUserName` (shared).
- `user-export.builder.spec.ts`: no aparecen campos prohibidos (RN-16-16) — test que recorre el JSON y falla si encuentra claves `password`, `token`, `accessToken`, `refreshToken`, `idToken`, `tokenHash`, `p256dh`, `auth`, `endpoint`.
- `user-deletion.service.spec.ts` (con Prisma de test): orden de pasos.
- Web: hoja de nombre de usuario (409 en el campo), selector de foto, control de tema (aplica `data-theme`), diálogo de borrado (botón solo con "BORRAR" exacto; "borrar" no vale), textos legales con marcadores sustituidos.

**Integración (`apps/api/test/me/*.int.spec.ts`)**
- `PATCH /me`: 401; 409 username duplicado (en mayúsculas distintas); evento `group.member.updated` en los 2 grupos del usuario.
- `GET /me/export`: cabeceras; incluye contenido propio de 2 grupos; no incluye datos de otro usuario (email ajeno no aparece en el JSON); 4.ª exportación en una hora → 429; `SecurityEvent DATA_EXPORTED`.
- `DELETE /me` — **matriz completa**: con un grupo donde es único miembro (el grupo desaparece con todo su contenido) y otro con 2 miembros: eventos, gastos, presupuestos, horarios, dieta, conversaciones, sesiones y suscripciones del usuario borrados; cada campo de RN-16-21.3 a `null`; rotación y responsable actualizados; `ActivityLog` "Un miembro ha eliminado su cuenta"; `SecurityEvent ACCOUNT_DELETED`; eventos emitidos tras el commit; 422 con "borrar"; 409 si es el único administrador; la sesión deja de ser válida (siguiente petición 401).

**E2E**
- **E2E-14**: crear contenido (un producto y un evento) → Perfil → "Descargar mis datos" (Playwright captura la descarga y comprueba `exportVersion: 1` y el email del usuario) → "Borrar mi cuenta" → escribir BORRAR → llega a `/entrar?cuenta=borrada` → iniciar sesión con esas credenciales falla con el error genérico → con el otro miembro, el producto aparece como añadido por "Usuario eliminado".

## 12. Cambios pendientes en documentos canónicos

Aplicado en documentos canónicos el 2026-11-11.

- `User.preferInitialsAvatar` → `docs/02`.
- Regla real de referencias a usuarios (sin FK, lista cerrada y test guardián) → `docs/02` (convenciones).
- `GET /me/deletion-preview`, cuerpo de `DELETE /me` y descarga de `GET /me/export` → `docs/04` (fila "Yo").
- `meDto` ampliado (`googleImage`, `preferInitialsAvatar`, `linkedProviders`, `aiNoticeAcceptedAt`; se conserva `hasGoogle`) → §5 de esta spec, spec 01 y `docs/04`.
- `VITE_LEGAL_CONTROLLER_NAME`, `VITE_LEGAL_CONTACT_EMAIL` y región de la UE → `docs/06`.
- Retenciones publicadas y regla tras restaurar una copia → `docs/03` (Retenciones), RN-16-26 y spec 17 (RN-17-25).
- Consentimiento de salud `DietProfile.healthConsentAt` (aceptado) → spec 06 (RN-06-21b), `docs/02`, `docs/03` y `docs/04`.
- Exportar el formulario de notificaciones (`NotificationSettings`) → spec 12 (§7.1).
- `removeMember(tx, groupId, userId, { reason })` → spec 02 (RN-02-22).
- `/entrar?cuenta=borrada` y enlaces legales → spec 01 (§7).

## 13. Fuera de alcance

- Cambiar el email.
- Subir una foto propia.
- Añadir una contraseña a una cuenta solo de Google.
- Borrado diferido o "periodo de gracia" para recuperar la cuenta.
- Exportación en otros formatos (CSV, PDF) o por email.
- Gestión de usuarios bloqueados (es de E01, HOG-059).
- Banner de cookies (no hace falta: no hay cookies no esenciales).
