# DESIGN.md — Hogaria · "Piscina municipal"

> Sistema visual de Hogaria. Los tokens exactos están en [`docs/design/tokens.css`](docs/design/tokens.css), que es la fuente de verdad de los valores. Logo en [`docs/design/`](docs/design/).
> **Estado:** propuesta previa a la construcción, definida con la skill *impeccable*. Cuando estén construidas las primeras pantallas reales (Inicio, Compra), hay que revisar este documento a partir de lo implementado y corregir lo que no haya funcionado. Se puede hacer a mano o, si está disponible, con la skill `/impeccable document`, que es **opcional**: ningún ticket la necesita.

## 1. Contrato de dirección

- **TESIS.** Hogaria organiza la casa como una piscina municipal organiza a los nadadores: **cada persona tiene su calle**, separada por corcheras, y todo el mundo ve a la vez el agua entera. Rechaza el panel por defecto de la categoría (rejilla de tarjetas blancas con un acento de color) y deja que el día se lea **por personas en paralelo**.
- **MUNDO PROPIO.** Agua turquesa como lámina de color en la cabecera (shell). Suelo de azulejo blanco frío con juntas finas (grout). Tinta azul petróleo muy oscura. Corchera roja y blanca **solo para marcar límites** (vencido, presupuesto superado). Amarillo socorrista para la atención. Cifras rotuladas en Barlow Condensed como las marcas de profundidad del borde ("1,20 m" → "64,20 €", "QUEDAN 4"). De noche, la piscina iluminada: fondo petróleo profundo con agua encendida.
- **HISTORIA.** Al abrir la app sabes de un vistazo qué le toca hoy a cada uno (turno, tarea, evento), qué falta en la compra y qué vence. Actúas con dos toques. Cuando otro cambia algo, una onda recorre esa fila y sabes que ha sido otra persona.
- **PRIMERA VISTA (Inicio).** Cabecera de agua (56 px) con el nombre del hogar y el avatar. Debajo, la fecha en rotulación ("MIÉ 11 NOV"). Después **las calles**, una por miembro (≥ 56 px cada una), separadas por corcheras: color del miembro en el borde izquierdo, nombre en versalitas condensadas y, en línea, turno de trabajo, tareas de hoy y próximo evento. Bajo las calles, una fila de **cifras de profundidad** (Compra, Facturas próximas). Barra inferior con 5 pestañas. La acción principal de cada pantalla es un botón flotante agua en la esquina inferior derecha, por encima de la barra.
- **FORMA.** Candidata 7 de la lista propia (piscina municipal), asignada por la tirada · seed:88c20585fcab6dc4. Refuerzos tomados de los mundos descartados:
  - *De la pizarra de salidas (split-flap):* los cambios en tiempo real **actualizan la fila en su sitio, sin recolocar la rejilla**. El estado cambia el estilo de la fila, no su posición.
  - *Del plano de metro:* **cada miembro tiene un único color fijo en todos los módulos** (calles, puntos, gráficas, calendario), como una línea de metro.
  - *Del horario de bolsillo:* **la jerarquía la marcan el peso y las mayúsculas, no una escala de tamaños creciente.** Seis tamaños como máximo.
- **ACABADO.** Sin revisión ni documentación no está terminado: el build termina con la revisión final, el veredicto, el DESIGN.md actualizado y todos los raster entregados con su procedencia.

## 2. Principios

1. **Primero la calle.** Lo que pertenece a una persona se muestra en su calle o con su color. Lo compartido va en el "agua común" (superficie sin color de miembro).
2. **La corchera roja es un límite, no decoración.** Solo aparece cuando algo cruza una línea: vencido, superado o fuera de plazo.
3. **Rotulación para las cifras, Barlow para leer.** Los números clave van en Barlow Condensed seminegrita y con cifras tabulares. Todo lo demás, en Barlow normal.
4. **Esquinas de azulejo.** Radios pequeños (4–10 px). Nada de píldoras enormes salvo los chips.
5. **Sombras casi nulas.** La profundidad la dan el agua y las juntas, no las sombras flotantes.
6. **Controles estándar.** Botones, inputs, checkboxes, tabs y sheets de toda la vida. El mundo de la piscina aporta color, tipografía, densidad y la calle. **Nunca** se disfrazan los controles (nada de "botones con forma de flotador").

## 3. Color

Los valores están en `docs/design/tokens.css`. Los roles son estos:

| Rol | Token | Uso |
|---|---|---|
| Suelo | `--bg` | Fondo de la app (azulejo) |
| Superficie | `--surface` | Tarjetas, hojas, filas |
| Hundido | `--surface-sunken` | Inputs, filas alternas, zonas secundarias |
| Junta | `--grout` / `--grout-strong` | Bordes de 1 px, divisores, rejilla |
| Tinta | `--ink` / `--ink-muted` / `--ink-faint` | Texto principal, secundario y decorativo |
| Lámina de agua | `--shell` / `--on-shell` | Cabecera y fondos de héroe |
| Primario | `--primary` / `--on-primary` | Botón primario, FAB, enlaces, check marcado |
| Selección | `--primary-soft` / `--on-primary-soft` | Chip activo, pestaña activa, fila seleccionada |
| Corchera roja | `--rope-red` | **Solo límites:** vencido, superado, sin conexión |
| Socorrista | `--lifeguard` | Atención: "Quedan 2 análisis de IA hoy", aviso del 80 % del presupuesto |
| Estados | `--success`, `--warning-ink`, `--danger`, `--info` (+ `-soft`) | Toasts, validación, badges |
| Calles | `--lane-{coral,sea,sun,leaf,violet,rose,orange,slate}` | Identidad de cada miembro (`GroupMember.laneColor`) |

**Estrategia:** *Committed* en el shell (la lámina de agua ocupa la cabecera y los héroes de pantalla) y *Restrained* en las zonas de trabajo (azulejo + tinta + color de calle). El turquesa nunca se usa como texto pequeño sobre blanco: en ese caso se usa `--primary` (agua-600).

**Las calles en las gráficas:** en las gráficas de gastos por persona se usan los colores de calle. Por categoría se usa una rampa de agua (agua-300 → agua-800) + `--lifeguard` + `--lane-slate`, sin repetir los colores de las personas.

**Accesibilidad del color:** el color de calle **nunca va solo**: siempre acompaña al nombre o a las iniciales del miembro. Todos los pares texto/fondo cumplen ≥ 4,5:1 y los indicadores ≥ 3:1 (verificado en `tokens.css`).

## 4. Tipografía

| Familia | Uso | Pesos |
|---|---|---|
| **Barlow** (`--font-ui`) | Todo el texto de la interfaz | 400, 500, 600 |
| **Barlow Condensed** (`--font-sign`) | Rotulación: `DepthFigure`, etiquetas de calle, fecha de cabecera, pestañas de semana, encabezados de sección en VERSALITAS | 500, 600 |

Se autoalojan con `@fontsource/barlow` y `@fontsource/barlow-condensed` (subconjunto latin + latin-ext). Las dos tienen el ADN de la señalización vial, que es justo lo que transmiten los rótulos de una piscina.

**Escala (seis tamaños como máximo):** 12 · 14 · 16 · 18 · 22 · 28, más `--text-depth` 44 solo para `DepthFigure` grande.
- La jerarquía se marca con **peso y mayúsculas**: un encabezado de sección es 14 px Barlow Condensed 600 en MAYÚSCULAS con tracking de 0.06em y color `--ink-muted`, no un tamaño mayor.
- Los inputs son siempre de 16 px (para evitar el zoom de iOS).
- Las cifras usan `font-variant-numeric: tabular-nums`.
- Formato español: "12,34 €", "1.234,00 €", "mié 11 nov", "08:00–15:00".

## 5. Espacio, rejilla y forma

- Base 4 px. Margen lateral de 16 px. Objetivo táctil ≥ 44 px. Altura mínima de una calle: 56 px.
- **Rejilla de azulejo:** el fondo `--bg` puede llevar, **solo en estados vacíos y en la cabecera de héroe**, una rejilla de juntas de 24 px al 50 % de opacidad de `--grout`. Nunca detrás de contenido denso.
- Radios: 4 (chips, checkbox) · 6 (inputs, botones) · 10 (tarjetas) · 16 (sheets).
- Listas densas: filas de 48–56 px con divisor de junta de 1 px. Sin tarjetas por fila.

## 6. Movimiento

- **Onda (`ripple`)**, el movimiento firma: cuando llega un cambio de **otro** miembro por tiempo real, la fila afectada recibe un barrido horizontal de `--primary-soft` de izquierda a derecha con el color de calle del autor en el borde izquierdo durante 700 ms (`--ease-water`). La fila no se mueve de sitio. Con `prefers-reduced-motion`, solo cambia el fondo 1 s, sin barrido.
- Marcar un producto: el check se rellena en 120 ms y la fila baja a "Comprados" tras 600 ms (para poder deshacer con el toast).
- Sheets: suben 200 ms. Transiciones de ruta: fundido de 120 ms. Nada rebota.
- Prohibido: parallax, animaciones en bucle y spinners decorativos. Los estados de carga usan *skeletons* con el color de las juntas.

## 7. Componentes firma

### `Lane` (calle)
Fila por miembro en Inicio, Tareas (vista por persona), Horarios (semana) y Calendario (semana).
```
┃▌ ANA        Turno 08:00–15:00 · Fregar · Dentista 17:30   ›
```
- Borde izquierdo de 4 px con el color de calle y fondo con un tinte del 10 % (`color-mix`).
- Etiqueta: nombre visible en Barlow Condensed 600, MAYÚSCULAS, 14 px.
- Contenido: chips en línea que pasan a una segunda línea si no caben (nunca scroll horizontal dentro de una calle).
- Props: `member`, `children`, `onPress?`, `highlight?: 'ripple'`.
- Accesibilidad: `role="group"` con `aria-label="Calle de Ana"`.

### `LaneRope` (corchera)
Separador entre calles: línea de puntos alternos (bolas de 6 px cada 12 px) en `--rope-bead` y blanco.
- Variante `limit`: rojo y blanco (`--rope-red` / `--rope-white`). Marca el límite: separa "Vencidas" de "Hoy", o pinta la línea del presupuesto en la barra de progreso.
- Es decorativa (`aria-hidden`). El significado del límite **siempre** se acompaña de texto.

### `DepthFigure` (cifra de profundidad)
Número clave rotulado, como las marcas de profundidad del borde de la piscina.
```
 64,20 €        QUEDAN 4
 LUZ · VENCE VIE  EN MERCADONA
```
- Cifra en Barlow Condensed 600, `--text-2xl` (s) o `--text-depth` (l), tabular. Etiqueta en Barlow Condensed 500 de 12 px, MAYÚSCULAS, `--ink-muted`.
- Variante `limit` (cifra en `--rope-red`) para importes superados o vencidos.
- Se usa en Inicio, en el resumen de gastos, en las facturas y en la cuota de IA.

### `MemberDot` / `MemberAvatar`
Círculo con el color de calle y las iniciales (o la foto de Google). Tamaños de 20, 28 y 36 px. Se usa en "le toca a", en el autor de la actividad y en los comensales.

## 8. Componentes base (shadcn adaptados)

| Componente | Reglas |
|---|---|
| `AppHeader` | Lámina de agua (`--shell`) de 56 px. Título del hogar a la izquierda (con selector si hay varios grupos) y avatar a la derecha. En el modo oscuro, `--agua-800` |
| `BottomNav` | Superficie con junta superior. 5 pestañas: Inicio, Compra, Comidas, Tareas, Más. Icono lucide de 24 px + etiqueta de 12 px. Activa: icono `--primary` + pastilla `--primary-soft`. Respeta `safe-area-inset-bottom` |
| `Fab` | 56 px, `--primary`, radio 16, icono `+`. Encima de la barra inferior, a 16 px del borde |
| `Button` | `primary` (relleno), `secondary` (borde de junta), `ghost`, `danger`. Altura de 44 px y radio de 6 |
| `Input`/`Textarea`/`Select` | Fondo `--surface-sunken`, junta de 1 px, foco con anillo de 2 px `--focus-ring`. Label siempre visible encima |
| `Checkbox` (compra y tareas) | 24 px, radio 4. Marcado en `--primary` con check blanco. Área táctil de toda la fila |
| `Sheet` | Hoja inferior para crear o editar en el móvil (radio 16 arriba). Es el patrón principal de formulario |
| `Dialog` | Solo para confirmaciones destructivas |
| `Tabs` / `SegmentedControl` | Para vistas (Mis tareas / Todas; Semana / Mes) |
| `Chip` | Filtros y etiquetas, radio 4, 32 px de alto |
| `Toast` | Abajo, encima de la navegación. "Deshacer" en las acciones reversibles (5 s) |
| `Skeleton` | Bloques con el color de las juntas y un pulso suave (sin pulso con reduced-motion) |
| `EmptyState` | Rejilla de azulejo, ilustración lineal simple, una frase y una acción: "Aún no hay listas. Crea la primera" |
| `ErrorState` | Mensaje en español + "Reintentar" |
| `OfflineBanner` | Franja de corchera roja bajo la cabecera: "Sin conexión. Los cambios no se guardarán" |

## 9. Patrones de pantalla

- **Lista + FAB + Sheet:** compra, tareas, recetas, gastos y facturas.
- **Semana por calles:** horarios y calendario (vista semana). Días como columnas en horizontal **solo** en pantallas ≥ 600 px. En el móvil, un día cada vez con selector de día en Barlow Condensed (L M X J V S D).
- **Héroe de agua:** pantallas con un número protagonista (Gastos, Facturas, Nevera) que abren con una franja `--shell` y una `DepthFigure` grande.
- **Estados obligatorios:** cargando (skeleton), vacío (EmptyState), error (ErrorState) y sin conexión (OfflineBanner + controles deshabilitados).

## 10. Iconografía

lucide-react, trazo de 1.75 y tamaño de 20/24 px. Pestañas (spec 15 §7.1): `Home`, `ShoppingCart`, `CookingPot`, `ListChecks`, `Menu`. IA: `Sparkles` **solo** en las funciones de IA. Los emojis los eligen los usuarios (listas, grupos, categorías) y nunca se usan como iconos del sistema.

## 11. Logo

- `docs/design/logo.svg`: marca cuadrada. Tejado + escalera de piscina cuyos peldaños forman la **H**, entrando en el agua. Se usa como icono de la PWA (incluida la versión *maskable*, que cabe en la zona segura del 80 %) y como favicon.
- `docs/design/logo-horizontal.svg` y `logo-horizontal-dark.svg`: marca + "HOGARIA" en Barlow Condensed 600 tracking 0.04em. **HOG-007** convierte el texto a trazados.
- Tamaños de los iconos PWA: 192, 512, 512 maskable y apple-touch-icon de 180 (fondo opaco `--agua-500`).
- `theme_color`: `#14A19E`. `background_color`: `#F4FAFA`.

## 12. Maqueta de referencia

`docs/design/mock-inicio.html`: HTML estático que usa `tokens.css` para la pantalla de Inicio (calles, corcheras, cifras de profundidad, barra inferior y FAB). Sirve de referencia visual para HOG-009 y E15. **No es código de producción.**

## 13. Lo que no se hace

- Fondos crema, serifas decorativas, degradados o glassmorphism.
- Tarjetas con sombra flotante para cada elemento de una lista.
- Usar la corchera roja como adorno.
- Iconos dentro de cuadrados de colores (tiles genéricos).
- Texto turquesa `--agua-500` sobre blanco.
- Más de seis tamaños de texto en una pantalla.
- Disfrazar los controles con motivos de piscina (flotadores, olas en los botones).
