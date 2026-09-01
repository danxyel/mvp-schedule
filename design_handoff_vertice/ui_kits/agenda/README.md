# UI kit — Agenda Vértice

Recreación del producto real (`Agenda Responsive.dc.html`) compuesta **solo** con los primitivos de
`components/`. No reimplementa ninguno: importa `Button`, `Chip`, `Badge`, `CapacityBar`, `NavItem`,
`Stepper`, `ActionBar`, `ServiceRow`, `SlotCard`, `PlanCard`, `CalendarMonth`, `StatCard`,
`BookingRow` y `MovementRow` desde el bundle.

## Pantallas

| Archivo | Pantalla | De dónde sale |
| --- | --- | --- |
| `AppShell.jsx` | Marco: navegación adaptable + área de contenido con scroll | Estructura responsive del producto |
| `CatalogScreen.jsx` | Paso 01 · Servicio — filtros y catálogo | `esReservar` + `paso1` |
| `ScheduleScreen.jsx` | Paso 02 · Fecha y hora — calendario y horarios | `paso2` |
| `PassesScreen.jsx` | Bonos y pagos — saldo y movimientos | `esBonos` |

## Qué se abrevia

Cuatro servicios en lugar de seis, tres movimientos en lugar de cuatro. La generación de horarios es
una función determinista simple, no la del producto. El paso 03 (Pago) y las vistas *Mis reservas* y
*Agenda del equipo* no están como pantalla propia: sus componentes se demuestran en las fichas de
`components/booking` y `components/records`.

## Interacción real

Filtrar el catálogo, abrir un servicio, navegar meses, elegir día y horario, avanzar de paso, y
cambiar de sección por la navegación. El modo (barra inferior / rail / sidebar) se decide midiendo el
ancho del contenedor, igual que en el producto.
