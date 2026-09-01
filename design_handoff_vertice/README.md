# Handoff: Vértice — agenda y reserva de servicios

## Overview

App de agenda y reserva de servicios por cita: clases con plazas limitadas, sesiones clínicas 1:1 y
tutorías recurrentes. Dos roles en la misma interfaz — el **cliente** que reserva y el **profesional**
que consulta la agenda del equipo.

Este paquete no es una pantalla suelta: es un **design system completo** derivado del producto, más el
prototipo funcional del que salió. El orden de implementación importa — primero la capa de tokens,
después los componentes, después las pantallas.

## About the design files

Todo lo que hay aquí son **referencias de diseño escritas en HTML**: prototipos que muestran el aspecto
y el comportamiento previstos, **no código de producción para copiar y pegar**. Los `.jsx` de
`components/` son recreaciones de referencia con estilos inline — sirven para leer valores exactos y
comportamiento, no para instalarlos tal cual.

La tarea es **recrear estos diseños en el entorno del codebase de destino** (React, Vue, SwiftUI,
Flutter, nativo…) con sus patrones y librerías establecidos. Si todavía no hay codebase, elige el
framework que mejor encaje y monta ahí la capa de tokens primero.

**La única excepción**: `styles.css` y `tokens/*.css` sí son producción. Son variables CSS puras, sin
dependencias, y son la fuente de verdad del sistema. Cópialas literalmente (o traduce los mismos
valores al formato de tokens del codebase — Tailwind config, Style Dictionary, `.xcassets`, lo que sea).

## Fidelity

**Alta fidelidad.** Colores, tipografía, espaciado, radios, estados y comportamiento responsive son
definitivos. Recrea la UI con precisión usando las librerías del codebase.

Dos cosas están marcadas como sustituciones pendientes en `readme.md` y **no son definitivas**:

- **Tipografía.** Plus Jakarta Sans desde Google Fonts. Se eligió por el encargo "sans geométrica de
  alta legibilidad"; no hay fuente licenciada. Si el cliente aporta una, se sustituye en
  `tokens/fonts.css` y `tokens/typography.css` y nada más cambia.
- **Marca.** No hay logotipo. La marca se compone en tipo: cuadro de 26 px con la V en blanco sobre
  `--color-text`, más "Vértice" en peso 700. El nombre es de la maqueta — **confírmalo antes de
  hardcodearlo**.

## Empieza por aquí

Abre `index.html` en un navegador: es la portada del sistema y enlaza las 17 fichas de fundamentos,
las 4 de componentes y el UI kit interactivo. Después lee `readme.md` completo — lleva las reglas de
contenido, los fundamentos visuales y las decisiones que no se ven en el código.

## Design tokens

Fuente de verdad: `styles.css` → `tokens/`. Nunca escribas un hex, un nombre de fuente o un px que ya
tenga token.

### Color — cada color con un solo trabajo

| Rol | Token | Valor | Uso |
| --- | --- | --- | --- |
| Interacción | `--color-accent` | `#4F46E5` | Botón primario, selección, día activo, disponibilidad |
| Positivo | `--color-accent-2` | `#14B8A6` | Reserva confirmada, servicios clínicos |
| Aviso | `--color-warn` | `#F59E0B` | Pago pendiente, sesiones por confirmar. **Solo aviso, nunca decoración** |
| Superficie | `--color-surface` | `#FFFFFF` | Nav, tarjetas, barra de acción |
| Lienzo | `--color-bg` | `#F8FAFC` | Fondo de la app |
| Texto | `--color-text` | `#334155` | Cuerpo y títulos |
| Texto secundario | `--color-text-muted` | `#64748B` | Meta, descripciones |
| Borde | `--color-border` | `#E2E8F0` | Separadores y bordes de tarjeta |
| Borde de control | `--color-border-strong` | `#CBD5E1` | Chips, flechas |

Cada acento tiene rampa 100–900 generada en **OKLCH sobre un tono fijo** (indigo 272, turquesa 180,
ámbar 70), así el paso 100 de cualquier rampa pesa lo mismo. Usa 100–300 para rellenos tintados y
bordes, 500 como base, 700–900 para texto sobre relleno tintado.

Los neutrales son la escala Slate: `--color-neutral-100` `#F8FAFC` … `--color-neutral-900` `#1E293B`.

**Regla no negociable: nunca dos acentos en el mismo componente pequeño.**

### Tipografía

Una sola familia: Plus Jakarta Sans (`--font-heading` y `--font-body` apuntan a la misma). La jerarquía
la hace la escala, no la mezcla de familias.

| Token | px | Uso |
| --- | --- | --- |
| `--text-display` / `--text-display-sm` | 52 / 38 | Confirmación y portadas |
| `--text-h1` / `--text-h1-sm` | 33 / 27 | Título de pantalla (el `-sm` es móvil) |
| `--text-h2` | 20 | Fecha seleccionada |
| `--text-h3` | 18 | Nombre de servicio, plan, hora |
| `--text-title` | 16 | Título de fila y tarjeta |
| `--text-body` | 15 | Prosa |
| `--text-body-sm` | 14 | Nav, controles |
| `--text-meta` | 13 | Descripciones, lugar |
| `--text-caption` | 12 | Condiciones, conteos |
| `--text-micro` | 11 | Pie de usuario |
| `--text-eyebrow` | 10 | Etiquetas de estructura, siempre en versalitas |

Pesos 300/400/500/600/700. Tracking negativo en títulos (`--track-h1` −0.025em, `--track-display`
−0.04em) y abierto en versalitas (`--track-eyebrow` 0.18em).

**`font-variant-numeric: tabular-nums` en toda cifra que pueda cambiar** — saldos, plazas, precios,
horas, cuentas atrás. Sin tabular las cifras bailan al actualizarse.

### Espaciado, radios, elevación

Escala de 4 con densidad amplia: `--space-1` 4px … `--space-12` 44px. Gutters por breakpoint
(16 / 24 / 32). Toque mínimo 44px, nav inferior 52px.

Radios **escalonados por tamaño de bloque, nunca uniformes**: `--radius-pill` 999px (botones, chips,
etiquetas, flechas) · `--radius-sm` 10px (eventos de agenda) · `--radius-lg` 14px (celdas de calendario,
ítems de menú) · `--radius-xl` 16px (horarios, planes) · `--radius-2xl` 18px (tarjetas y paneles) ·
`--radius-frame` 24px (marco de dispositivo).

Elevación casi ausente: las superficies se separan con `--border-hairline` (1px sobre `--color-border`),
no con sombra. Las tres sombras que existen son frías (tintadas de slate, nunca negro) y se reservan a
diálogos y al marco de maqueta.

### Movimiento

`--ease-out` `cubic-bezier(.2,.8,.3,1)`. 120ms hover, 220ms transición de panel, 300ms entrada.
Una sola animación con nombre: `riseIn` (6px arriba + fade) en la confirmación. Sin rebotes, sin
escalados, sin skeletons animados.

## Componentes

15 componentes en 4 grupos. **Cada uno lleva tres archivos: `.jsx` (referencia), `.d.ts` (contrato de
props) y `.prompt.md` (reglas de uso).** Lee el `.prompt.md` antes de implementar — lleva las decisiones
que la API no expresa.

### `components/core/`
- **`Button`** — `primary` / `secondary` / `ghost`, tamaños `sm` 30px / `md` 38px / `lg` 46px. Píldora
  completa. Hover sube a `accent-600`, pressed a `accent-700`. Nunca opacidad ni escalado.
- **`Chip`** — filtro de un solo valor. El grupo se comporta como radio, siempre con uno activo.
- **`Badge`** — estado. Tonos `accent` (disponibilidad) / `positive` (confirmado) / `warn` (requiere
  acción) / `idle` (neutro o bloqueado). El tono ES el significado.
- **`CapacityBar`** — ocupación de una sesión con plazas. Con `cupo <= 1` no dibuja relleno y escribe
  "Agenda abierta".

### `components/navigation/`
- **`NavItem`** — un destino en tres formas: `bar` (barra inferior móvil), `rail` (columna 84px),
  `sidebar` (columna 244px con etiquetas y badges). Máximo cuatro destinos.
- **`Stepper`** — el progreso del único flujo de reserva. Tres pasos, se puede volver atrás a un paso
  alcanzado, nunca saltar adelante.
- **`StepArrow`** — paginación de periodo (mes, semana). Siempre en pareja, siempre con `aria-label`.
- **`ActionBar`** — barra pegada al fondo del flujo. Resumen a la izquierda, única acción primaria a la
  derecha. **Cuando la acción está bloqueada, el resumen dice qué falta.**

### `components/booking/`
- **`ServiceRow`** — fila del catálogo (paso 01). Sin caja: separación por `border-top` de 1px.
- **`SlotCard`** — horario reservable (paso 02). **Solo hora y estado; sin nombre de profesional** — se
  retiró del producto a propósito.
- **`PlanCard`** — opción de pago (paso 03). Precios calculados sobre el precio del servicio elegido
  (×1, ×4.5, ×8.5).
- **`CalendarMonth`** — calendario navegable. Semana desde **lunes**, pasado bloqueado, futuro abierto.
  La disponibilidad es un **guion de 2px cuya longitud crece con las plazas libres** (4px por hueco,
  tope 4), no un punto. El día activo **invierte** (fondo `--color-text`, texto `--color-bg`).

### `components/records/`
- **`StatCard`** — cifra de consulta (saldo, gasto). Solo lectura, **nunca una acción de gasto aquí**.
- **`BookingRow`** — reserva en "Mis reservas". No clicable, sin botones.
- **`MovementRow`** — línea de historial. Un importe que empieza por `-` se detecta como reembolso y se
  tinta de turquesa automáticamente.

## Pantallas y flujo

**Un solo journey de reserva**, y las vistas de consulta no lo tocan. Es la regla de arquitectura más
importante del producto: *"Mis reservas", "Bonos" y "Equipo" no llevan acciones de reserva.*

| Pantalla | Propósito | Layout |
| --- | --- | --- |
| **01 Servicio** | Elegir del catálogo completo | Título + `Stepper` + fila de `Chip` + rejilla de `ServiceRow`. Móvil: una columna y chips en fila deslizable. Tablet+: `repeat(auto-fill, minmax(320px,1fr))`, `gap: 0 28px` |
| **02 Fecha y hora** | Elegir día y horario | `CalendarMonth` + rejilla de `SlotCard` + `ActionBar`. **Móvil: apilados en columna. Escritorio: dos paneles**, calendario a la izquierda con máx 340px |
| **03 Pago** | Elegir plan y confirmar | Tres `PlanCard` + panel de resumen + `ActionBar`. Mismo apilado que el paso 02 |
| **Confirmación** | Cierre | Display "Lugar asegurado." con `riseIn`, código de reserva, dos acciones ghost |
| **Mis reservas** | Consulta | Rejilla de `BookingRow`. Una columna en móvil |
| **Bonos** | Consulta de saldo | Dos `StatCard` + lista de `MovementRow` bajo la etiqueta `MOVIMIENTOS` |
| **Equipo** | Consulta del profesional | Rejilla semanal con scroll horizontal (min-width 760px) desde tablet; lista por día en móvil |

## Estado

El estado real del prototipo es pequeño. Lo relevante para implementar:

- **`bono`** (número, arranca en 7) — **una sola fuente de verdad**. El badge del menú, la pantalla
  Bonos y el saldo derivan de él. Al confirmar el paso 03: Paquete de 10 → 10, Paquete de 5 → 5, sesión
  suelta → resta 1 con tope en 0. La pantalla Bonos **solo lo lee**.
- **`paso`** (1–3) · **`servicio`** (id) · **`fecha`** (Date) · **`mes`** (Date, día 1) ·
  **`slot`** (id, se resetea al cambiar de fecha o de servicio).
- **`filtro`** (Todos / Individual / Grupal / Recurrente).
- **`seccion`** — reservar / reservas / bonos / equipo.
- **`semana`** (offset entero) — solo en la vista Equipo.
- **modo responsive** — derivado de medir el ancho del contenedor, **no de un estado que el usuario
  elige**. Ver abajo.

Los horarios se generan de forma determinista a partir de la fecha y el servicio. En producción vienen
de la API: modela `slot` como `{ id, inicio, fin, libre, plazasLibres, motivoNoDisponible }`.

## Responsive

Mobile-first con tres modos derivados del **ancho medido del contenedor** (ResizeObserver), no de
media queries sobre el viewport — así el sistema funciona igual embebido que a pantalla completa:

- **< 640px** — una columna, navegación en barra inferior de 52px, pasos apilados, chips deslizables.
- **640–1023px** — rail de iconos de 84px a la izquierda.
- **≥ 1024px** — sidebar de 244px con etiquetas, badges y pie de usuario.

Además, en una ventana real de **< 720px** la app ocupa el 100% de la pantalla (`100dvh`) y desaparece
el marco de dispositivo de la maqueta.

Contenido tope 1180px, prosa tope 620px, alineado a la izquierda. El único elemento fijo es la
`ActionBar`: `position: sticky; bottom: 0` dentro del contenedor con scroll — no fija sobre el viewport.

## Estados de interacción

- **Hover** — un paso de rampa arriba: `accent-100` en lo transparente, `accent-600` en lo relleno.
- **Pressed** — un paso más (`accent-700`). Sin escalado ni desplazamiento.
- **Selected** — relleno `accent-100` + borde `accent` de 1px. En el calendario el día activo invierte.
- **Focus** — `outline: 2px solid var(--color-accent); outline-offset: 2px`. **Nunca el azul del navegador.**
- **Disabled** — `opacity: .5` y `cursor: not-allowed`, y **el texto secundario dice el motivo**
  ("Lleno", "Ocupado", "No disponible", "Elige un horario disponible").

## Contenido y copy

Español de México, tuteo. Reglas completas en `readme.md` → CONTENT FUNDAMENTALS. Las que más se
incumplen al implementar:

- **Sin mayúsculas de título.** "Mis reservas", no "Mis Reservas".
- **Las fechas se capitalizan a mano**: `Intl` devuelve "miércoles 12 de agosto" en minúscula y el
  producto muestra "Miércoles 12 de agosto".
- **Sin emoji. Sin signos de exclamación.** La escasez se enuncia, no se dramatiza: "Completo",
  "En lista de espera · nº 2" — nunca "¡Solo quedan 2 plazas!".
- **Vacíos con salida**: "No hay horarios este día. Elige otra fecha del mes." Nunca "Sin resultados".

## Assets

**Ninguno que copiar.** El producto no usa fotografía ni ilustración, y no hay logotipo.

Los iconos son **glifos Unicode** a tamaño de texto heredando `currentColor`: ＋ (U+FF0B) reservar ·
▤ (U+25A4) mis reservas · ◇ (U+25C7) bonos · ▦ (U+25A6) equipo · ‹ › (U+2039/203A) navegación de
periodo. Es deliberado: cuatro destinos no justifican una dependencia de icon font.

Si el set crece por encima de ~8 iconos, la sustitución recomendada es **Phosphor** en peso regular —
es la más cercana en grosor a la sans geométrica. **Nunca emoji, nunca SVG dibujado a mano.**

## Files

| Ruta | Qué es |
| --- | --- |
| `index.html` | Portada del sistema — **empieza aquí** |
| `readme.md` | Guía completa: contenido, fundamentos visuales, iconografía, sustituciones |
| `styles.css` + `tokens/` | **Producción.** La capa de tokens, sin dependencias |
| `components/<grupo>/*.jsx` | Referencia de cada componente |
| `components/<grupo>/*.d.ts` | Contrato de props |
| `components/<grupo>/*.prompt.md` | **Reglas de uso — léelas** |
| `components/<grupo>/*.card.html` | Ficha viva del grupo |
| `guidelines/*.card.html` | 17 fichas de fundamentos (color, tipo, espacio, radios, elevación, marca) |
| `ui_kits/agenda/` | App completa e interactiva, compuesta solo con los primitivos |
| `_ds_bundle.jsx` | Todos los componentes en `window.DS`. Generado — no editar a mano |
| `ds-loader.js` | Carga y transpila el bundle en las fichas |
| `prototipo/Agenda Responsive.dc.html` | El prototipo original del que salió el sistema |

Para ver las fichas y el UI kit hace falta servirlos por HTTP (usan `fetch`), no abrirlos con
`file://`. Por ejemplo: `python3 -m http.server` en la raíz del paquete.

## Preguntas abiertas para el equipo

1. **¿"Vértice" es el nombre real?** Está inventado en la maqueta.
2. **¿Hay fuente licenciada?** Si sí, sustituir Plus Jakarta Sans.
3. **¿Hay logotipo?** Si sí, reemplaza el cuadro con la V.
4. **¿Faltan componentes?** El sistema solo contiene lo que esta app usa. Si el producto real tiene
   inputs, selects, diálogos o toasts, hay que diseñarlos — no están inventados por si acaso.
