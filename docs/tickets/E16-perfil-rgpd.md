# E16 · Perfil, ajustes y RGPD

> Spec: `docs/specs/16-perfil-rgpd.md` · Rango: HOG-800 – HOG-849 · Fase: 6

---

### HOG-800 · Ampliar los esquemas compartidos de perfil, exportación y borrado

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** shared
- **Depende de:** HOG-002
- **Spec:** `docs/specs/16-perfil-rgpd.md#5-api`

**Descripción**
Ampliar `packages/shared/src/schemas/me.ts` con los contratos de la spec y añadir las utilidades de presentación de usuarios.

**Criterios de aceptación**
- [ ] `meDto` (campos nuevos), `updateMeInput`, `deleteMeInput`, `deletionPreviewDto` y `userExportDto` completos (sin comentarios de relleno) según §5.
- [ ] Utilidades `publicImage(user)`, `initials(name)` y `displayUserName(user | null)` → "Usuario eliminado" en `packages/shared/src/users.ts`.
- [ ] Constante `USER_REFERENCE_FIELDS` con la lista cerrada de campos de RN-16-21.3 (la usan el servicio de borrado y su test).

**Notas técnicas**
- Si `me.ts` no existe aún (E01), crearlo; si existe, ampliar sin romper sus usos.

**Tests**
- Unit: `initials` ("Ana María" → "AM", "óscar" → "Ó"), `publicImage`, `displayUserName(null)`; parseo de un export de ejemplo.

---

### HOG-801 · Editar nombre, nombre de usuario y foto desde la API

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-800, HOG-004, HOG-055, HOG-151
- **Spec:** `docs/specs/16-perfil-rgpd.md#cuenta`

**Descripción**
Uso de `User.preferInitialsAvatar`, `GET /me` con los campos nuevos y `PATCH /me`, aplicando `publicImage` en todas las DTOs de usuario y emitiendo `group.member.updated`.

**Criterios de aceptación**
- [ ] `User.preferInitialsAvatar Boolean @default(false)` ya está en `docs/02-modelo-datos.md` y en el esquema inicial (HOG-004); si la BBDD se creó antes de ese cambio, este ticket añade la migración.
- [ ] `GET /me` devuelve `meDto` completo (`hasPassword` y `linkedProviders` desde `Account`).
- [ ] `PATCH /me` valida RN-16-01/02, guarda `username` en minúsculas y `displayUsername` tal cual; duplicado → 409 (también capturando `P2002`).
- [ ] Emite `group.member.updated` en cada grupo del usuario (RN-16-06).
- [ ] `GroupMemberDto`, actividad y dashboard usan `publicImage` (búsqueda de todos los mapeos de `image`).

**Notas técnicas**
- `apps/api/src/modules/users/{me.controller.ts, me.service.ts}`. No usar la ruta de Better Auth `update-user` para `username` (validación y evento propios).

**Tests**
- Unit: `me.service.spec.ts`.
- Integración: `me.int.spec.ts` (401, 409 con mayúsculas distintas, evento en 2 grupos, `PATCH` vacío 422).

---

### HOG-802 · Construir la página de perfil y la sección "Tu cuenta"

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-801, HOG-750
- **Spec:** `docs/specs/16-perfil-rgpd.md#7-pantallas-y-ux`

**Descripción**
Ruta `/perfil` con cabecera, índice de secciones ancladas, estados y la sección "Tu cuenta" (nombre, nombre de usuario, foto y email).

**Criterios de aceptación**
- [ ] Página con las anclas de §7 y las secciones vacías preparadas para HOG-803/804/805/807/809.
- [ ] Hojas "Cambiar nombre" y "Cambiar nombre de usuario" con los textos y el error 409 en el campo.
- [ ] Selector "Foto de Google"/"Iniciales" con vista previa; deshabilitado sin `googleImage`.
- [ ] Componente `UserAvatar` reutilizable (foto o iniciales sobre color de calle) usado también por la cabecera del shell.
- [ ] Estados cargando, error y sin conexión; 375 px y modo oscuro.
- [ ] Entrada "Perfil" habilitada en `navigation.ts`.

**Notas técnicas**
- `apps/web/src/features/profile/{api.ts, pages/ProfilePage.tsx, components/AccountSection.tsx, components/UserAvatar.tsx}`.

**Tests**
- Unit: hojas de edición (validación, 409), selector de foto.

---

### HOG-803 · Integrar la sección de seguridad (contraseña, Google y sesiones) en el perfil

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-802, HOG-056, HOG-060, HOG-061
- **Spec:** `docs/specs/16-perfil-rgpd.md#73-seguridad-seguridad`

**Descripción**
Montar en la página de perfil de HOG-802 la sección "SEGURIDAD" que ya construye E01: lista de sesiones (HOG-056), cambio de contraseña (HOG-060) y vinculación de Google (HOG-061). **No** se reimplementa ninguna de esas piezas; si la página mínima `/perfil` de E01 ya las contiene, se mueven a la estructura definitiva sin duplicarlas. Lo único nuevo es "Desvincular Google" (spec 16 §7.3).

**Criterios de aceptación**
- [ ] La sección usa los componentes de E01 tal cual: `SecuritySection` y la lista de dispositivos de HOG-056 (Better Auth: `GET /api/auth/list-sessions`, `POST /api/auth/revoke-session`, `POST /api/auth/revoke-other-sessions`), la hoja "Cambiar contraseña" de HOG-060 y el bloque de Google de HOG-061.
- [ ] Desaparece la página mínima `/perfil` provisional de E01 (una sola ruta `/perfil`, la de HOG-802); no quedan dos `SecuritySection`.
- [ ] La vuelta de `linkSocial` (HOG-061) llega a `/perfil?vinculado=google` y se gestiona `?error=`; la URL se limpia después.
- [ ] Nuevo: "Desvincular Google" (`authClient.unlinkAccount({ providerId: 'google' })`) solo si `hasPassword` y `linkedProviders` incluye `google`, con `Dialog` de confirmación.

**Notas técnicas**
- Solo toca `apps/web/src/features/profile/pages/ProfilePage.tsx` (montaje) y añade el botón de desvincular al bloque de Google de HOG-061.

**Tests**
- Unit: la página de perfil renderiza una sola sección de seguridad; "Desvincular" oculto sin contraseña.
- Integración: — (los cubren HOG-056 y HOG-060).

---

### HOG-804 · Integrar dieta, notificaciones, administración y cerrar sesión en el perfil

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-802, HOG-602, HOG-059, HOG-312
- **Spec:** `docs/specs/16-perfil-rgpd.md#74-resto-de-secciones`

**Descripción**
Montar en `/perfil` los componentes de otras épicas: resumen y editor de dieta (E06), formulario de notificaciones (E12), enlace a `/admin` y "Cerrar sesión".

**Criterios de aceptación**
- [ ] `#dieta`: `DietProfileSummary` + "Editar" abre `DietProfileEditor` en una hoja.
- [ ] `#notificaciones`: `NotificationSettings` de E12.
- [ ] `#admin` solo con `isPlatformAdmin`.
- [ ] "Cerrar sesión" limpia la caché y `hogaria.*` (salvo `hogaria.theme`) y navega a `/entrar`.
- [ ] `#legal` con enlaces y versión de la app.

**Notas técnicas**
- E06 (HOG-312) exporta `DietProfileSummary`/`DietProfileEditor` y E12 (HOG-602) el formulario de preferencias; si falta un export, se añade en su feature, sin duplicar formularios.

**Tests**
- Unit: visibilidad de `#admin`; limpieza en cerrar sesión.

---

### HOG-805 · Permitir elegir tema claro, oscuro o del sistema

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-007, HOG-802
- **Spec:** `docs/specs/16-perfil-rgpd.md#preferencias` (RN-16-12)

**Descripción**
Selector de tema por dispositivo con aplicación antes del primer pintado mediante un script externo compatible con la CSP.

**Criterios de aceptación**
- [ ] `apps/web/public/theme-init.js` cargado de forma síncrona en `<head>` de `index.html`; aplica `data-theme` y `theme-color`.
- [ ] `useTheme()` en `apps/web/src/lib/theme.ts` (leer/escribir `hogaria.theme` con `try/catch`, escuchar `prefers-color-scheme` en modo sistema).
- [ ] Control "Claro · Oscuro · Sistema" en `#apariencia`; cambio instantáneo sin parpadeo al recargar.
- [ ] Sin scripts en línea (la CSP de `docs/03` no los permite).

**Notas técnicas**
- El mecanismo de tokens de tema es el de HOG-007/`DESIGN.md`; no se definen colores aquí.

**Tests**
- Unit: `useTheme` con `matchMedia` simulado y `localStorage` que lanza.
- E2E: recargar en modo oscuro no muestra el tema claro en la primera captura (`page.emulateMedia` + `data-theme`).

---

### HOG-806 · Exportar los datos del usuario en JSON

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-800, HOG-055
- **Spec:** `docs/specs/16-perfil-rgpd.md#exportar-mis-datos`

**Descripción**
`GET /me/export` que construye `userExportDto` con todos los datos personales y el contenido propio o creado por el usuario, sin secretos ni datos de terceros.

**Criterios de aceptación**
- [ ] Estructura exacta de §5.3 validada con `userExportDto` antes de enviarla.
- [ ] Cabeceras de RN-16-15; nombre de archivo con la fecha en `Europe/Madrid`.
- [ ] Ningún campo prohibido de RN-16-16 (test automático que recorre las claves).
- [ ] Throttle 3/hora → 429; `SecurityEvent DATA_EXPORTED`.
- [ ] Lecturas por lotes de 1000 (RN-16-18); recetas borradas lógicamente incluidas.

**Notas técnicas**
- `apps/api/src/modules/export/{export.module.ts, export.controller.ts, user-export.builder.ts}`. Es una lectura transversal autorizada: puede usar Prisma directamente (es el módulo `export` de `docs/01`), siempre filtrando por el `userId` de la sesión.

**Tests**
- Unit: `user-export.builder.spec.ts` (campos prohibidos, formato de dinero).
- Integración: `me-export.int.spec.ts` (contenido de 2 grupos, sin email ajeno, 429, cabeceras).

---

### HOG-807 · Añadir "Descargar mis datos" en el perfil

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 1
- **Capa:** web
- **Depende de:** HOG-806, HOG-802
- **Spec:** `docs/specs/16-perfil-rgpd.md#74-resto-de-secciones`

**Descripción**
Botón en `#datos` que descarga el JSON (o usa la hoja de compartir en iOS instalada).

**Criterios de aceptación**
- [ ] `fetch` con credenciales → `Blob` → descarga con el nombre de `Content-Disposition`.
- [ ] En `navigator.standalone` con `canShare({ files })` → `navigator.share`.
- [ ] Estado "Preparando…", error 429 con el texto de la spec, deshabilitado sin conexión.

**Notas técnicas**
- `apps/web/src/features/profile/components/DataSection.tsx`, utilidad `downloadBlob()` en `lib/download.ts`.

**Tests**
- Unit: nombre de archivo desde la cabecera; ruta de compartir vs. descarga.
- E2E: E2E-14.

---

### HOG-808 · Borrar la cuenta del usuario (API)

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 5
- **Capa:** api
- **Depende de:** HOG-800, HOG-106, HOG-150, HOG-151, HOG-601
- **Spec:** `docs/specs/16-perfil-rgpd.md#borrar-mi-cuenta`

**Descripción**
`GET /me/deletion-preview` y `DELETE /me` con `UserDeletionService`: salida de cada grupo reutilizando la lógica de E02 (borrando el grupo si es el último), borrado del contenido personal, nulado de referencias compartidas y borrado del usuario en una transacción, y efectos posteriores (eventos, sockets, recordatorios, cookie).

**Criterios de aceptación**
- [ ] `deletion-preview` con hogares a borrar/abandonar, recuentos e `isSoleAdmin`.
- [ ] `DELETE /me` con `{ confirmation: 'BORRAR' }`; 422 en otro caso; 409 si es el único administrador (RN-16-19/20).
- [ ] Pasos 1–5 de RN-16-21 en una transacción interactiva (timeout 30 s), usando `USER_REFERENCE_FIELDS`.
- [ ] Reutiliza `removeMember(tx, groupId, userId, { reason: 'ACCOUNT_DELETED' })` de HOG-106 (acepta transacción externa).
- [ ] Efectos tras el commit de RN-16-22 (eventos, `session.revoked` + desconexión, `scheduler.cancelForUser`, caché del guard, cookie borrada); 204.
- [ ] `SecurityEvent ACCOUNT_DELETED`.

**Notas técnicas**
- `apps/api/src/modules/users/{user-deletion.service.ts, me.controller.ts}`. `RealtimeGateway.disconnectUser(userId)` si no existe, se añade en `realtime/` (HOG-150).
- `ReminderScheduler.cancelForUser(userId)` lo crea HOG-601 (solo limpia temporizadores en memoria).

**Tests**
- Unit: orden de pasos con dependencias simuladas.
- Integración: cubierto en detalle por HOG-811.

---

### HOG-809 · Añadir el diálogo "Borrar mi cuenta" en el perfil

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 2
- **Capa:** web
- **Depende de:** HOG-808, HOG-802
- **Spec:** `docs/specs/16-perfil-rgpd.md#75-diálogo-borrar-tu-cuenta`

**Descripción**
Diálogo de confirmación con la vista previa de lo que se borra, el campo "BORRAR" y la limpieza local tras el borrado.

**Criterios de aceptación**
- [ ] Textos exactos de §7.5 con recuentos y lista de hogares que se borran sobre `LaneRope` de límite.
- [ ] Caso `isSoleAdmin` sin botón de borrar.
- [ ] Botón habilitado solo con `BORRAR` exacto.
- [ ] Tras 204: desuscribir push, limpiar caché y `hogaria.*` (salvo tema) y navegar a `/entrar?cuenta=borrada`.

**Notas técnicas**
- `apps/web/src/features/profile/components/DeleteAccountDialog.tsx`.

**Tests**
- Unit: habilitación del botón ("borrar", " BORRAR" no valen), caso administrador.
- E2E: E2E-14.

---

### HOG-810 · Publicar las páginas de privacidad y términos

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** web
- **Depende de:** HOG-005, HOG-008
- **Spec:** `docs/specs/16-perfil-rgpd.md#77-páginas-legales`

**Descripción**
Rutas públicas `/legal/privacidad` y `/legal/terminos` con el texto íntegro de la spec, índice con anclas y sustitución de responsable y email desde variables de build.

**Criterios de aceptación**
- [ ] Texto literal de §7.7 en JSX (sin `dangerouslySetInnerHTML`), con las anclas indicadas (incluida `#ia`).
- [ ] `VITE_LEGAL_CONTROLLER_NAME` y `VITE_LEGAL_CONTACT_EMAIL` sustituidos; el build de producción falla si faltan (comprobación en `vite.config.ts`).
- [ ] `LEGAL_UPDATED_AT` mostrado como "Última actualización: 11 de noviembre de 2026".
- [ ] Rutas fuera del shell, sin sesión y precacheadas por el service worker.
- [ ] `.env.example` de la web con `VITE_LEGAL_CONTROLLER_NAME` y `VITE_LEGAL_CONTACT_EMAIL` (`docs/06-despliegue.md`).

**Notas técnicas**
- `apps/web/src/features/legal/{pages/PrivacyPage.tsx, pages/TermsPage.tsx, content/PrivacyContent.tsx, content/TermsContent.tsx, version.ts}`.

**Tests**
- Unit: los marcadores se sustituyen y no queda ningún `{RESPONSABLE}`/`{EMAIL}` en el render.
- E2E: acceso sin sesión a ambas páginas (dentro de E2E-14).

---

### HOG-811 · Probar la matriz completa del borrado de cuenta

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P0 · **Puntos:** 3
- **Capa:** api
- **Depende de:** HOG-808
- **Spec:** `docs/specs/16-perfil-rgpd.md#11-tests`

**Descripción**
Test de integración que crea un usuario con datos en todas las tablas (un grupo donde es único miembro y otro compartido) y comprueba campo a campo el resultado del borrado.

**Criterios de aceptación**
- [ ] Factory `createUserWithFullFootprint()` en `apps/api/test/factories/`.
- [ ] Verifica: grupo en solitario desaparecido con todo su contenido; borrado de lo personal; cada campo de `USER_REFERENCE_FIELDS` a `null`; rotación y responsable actualizados; `forUserIds` sin el usuario; `ActivityLog` y `SecurityEvent`; eventos emitidos solo tras el commit; la sesión deja de valer (401).
- [ ] Test "guardián" que falla si aparece en `schema.prisma` un campo `*ById`/`*UserId`/`actorId`/`ownerId` que no esté en `USER_REFERENCE_FIELDS` ni en la lista de borrado personal.

**Notas técnicas**
- `apps/api/test/me/me-delete.int.spec.ts`; el guardián lee el DMMF de Prisma (`Prisma.dmmf`).

**Tests**
- Integración: el propio ticket.

---

### HOG-812 · Escribir el e2e de exportar y borrar cuenta (E2E-14)

- **Épica:** E16 · **Fase:** 6 · **Prioridad:** P1 · **Puntos:** 2
- **Capa:** full-stack
- **Depende de:** HOG-807, HOG-809, HOG-810, HOG-011
- **Spec:** `docs/specs/16-perfil-rgpd.md#11-tests`

**Descripción**
Flujo e2e de RGPD: descargar datos, borrar la cuenta y comprobar el rastro "Usuario eliminado" desde otro miembro.

**Criterios de aceptación**
- [ ] `apps/web/e2e/gdpr.e2e.ts` con los pasos de la spec §11 (descarga validada, borrado, login fallido con error genérico, "Usuario eliminado" visto por el otro miembro).
- [ ] Incluye la visita sin sesión a `/legal/privacidad` y `/legal/terminos`.
- [ ] Pasa en Pixel 7 y iPhone 14.

**Tests**
- E2E: **E2E-14**.
