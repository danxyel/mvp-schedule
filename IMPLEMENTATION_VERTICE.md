# Implementación del Sistema Vértice

## Estado Actual

Se ha implementado la **capa de tokens y componentes core** del design system Vértice en el proyecto MVPSchedule.

### ✅ Implementado

#### Tokens (CSS Variables)
- `frontend/src/design-system/tokens/`
  - `colors.css` — Rampas de color (accent indigo, accent-2 turquesa, warn ámbar, neutrales slate)
  - `typography.css` — Escala de texto y pesos
  - `spacing.css` — Espaciado, gutters, breakpoints, anchos
  - `radii.css` — Redondeos escalonados por tamaño
  - `elevation.css` — Sombras frías y bordes
  - `motion.css` — Animaciones y duraciones

#### Componentes Core (React)
- `Button` — primary / secondary / ghost, tamaños sm/md/lg
- `Badge` — tonos accent/positive/warn/idle
- `Chip` — filtro de selección única
- `CapacityBar` — indicador de ocupación con plazas libres

#### Integración
- `frontend/src/design-system/index.js` — Exporta tokens y componentes
- `frontend/src/design-system/tokens.css` — Maestro que importa todos los tokens

## Próximos Pasos

### Componentes Navigation (2-3 horas)
- `NavItem` — Destino en barra/rail/sidebar
- `Stepper` — Progreso del flujo de reserva (3 pasos)
- `StepArrow` — Navegación de periodo
- `ActionBar` — Barra pegada al fondo con resumen + acción

### Componentes Booking (3-4 horas)
- `ServiceRow` — Fila de catálogo sin caja
- `SlotCard` — Horario reservable
- `PlanCard` — Opción de pago con precios
- `CalendarMonth` — Calendario navegable con disponibilidad

### Componentes Records (2 horas)
- `StatCard` — Cifra de consulta (saldo, gasto)
- `BookingRow` — Reserva en "Mis reservas"
- `MovementRow` — Línea de historial con tintado automático

### Pantallas y Vistas (8-10 horas)
1. **Paso 1: Servicio** — Selección de catálogo
2. **Paso 2: Fecha y hora** — Calendario + horarios
3. **Paso 3: Pago** — Planes y confirmación
4. **Confirmación** — Display "Lugar asegurado"
5. **Mis reservas** — Consulta de reservas
6. **Bonos** — Consulta de saldo y movimientos
7. **Equipo** — Consulta de disponibilidad del profesional

## Importación en Componentes

```jsx
import { Button, Badge, Chip, CapacityBar } from '../design-system'

export function MyComponent() {
  return (
    <>
      <Button variant="primary" size="md">Reservar</Button>
      <Badge tone="positive">Confirmada</Badge>
      <Chip selected>Individual</Chip>
      <CapacityBar libre={3} cupo={10} />
    </>
  )
}
```

## Archivos Origen

Referencia del handoff: `design_handoff_vertice/`
- `components/` — Implementaciones de referencia en JSX
- `guidelines/` — 17 fichas de fundamentos visuales
- `tokens/` — Variables CSS de producción
- `ui_kits/agenda/` — App completa e interactiva
- `readme.md` — Guía completa del sistema

## Notas de Arquitectura

- **Mobile-first:** Breakpoints en 640px (tablet), 1024px (desktop)
- **Responsive:** Medido por ancho de contenedor, no viewport
- **Colores semánticos:** Un solo trabajo por color, nunca dos acentos en el mismo componente pequeño
- **Tipografía:** Plus Jakarta Sans (una sola familia, jerarquía por escala)
- **Sin sombras:** Separación por borde de 1px (hairline), elevación reservada para diálogos
- **Animaciones:** Solo `riseIn` (fade + 6px arriba), 120ms hover, 220ms normal, 300ms entrada

## Pasos para Integración

1. Importar `design-system/index.js` en `main.jsx` o `App.jsx`
2. Los tokens CSS se cargan automáticamente
3. Usar componentes directamente: `<Button>`, `<Badge>`, etc.
4. Para custom styling: usar variables CSS (`var(--color-accent)`, etc.)
