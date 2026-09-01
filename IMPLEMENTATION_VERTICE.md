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

## Pantallas (Screens) Implementadas

### BookingFlow (3-step flujo)
- `BookingFlow.jsx` — Componente completo con gestión de estado local
- Paso 1: Selección de servicio con filtros (chips)
- Paso 2: Calendario + selección de horario
- Paso 3: Planes de pago con resumen
- Stepper navegable, ActionBar con resumen
- Mock data incluido para pruebas

### ConfirmationScreen
- `ConfirmationScreen.jsx` — Pantalla de éxito post-reserva
- Animación `riseIn` en título (fade + 6px arriba)
- Código de reserva en monospace grande
- Dos acciones ghost (Mis reservas, Inicio)

### MyReservations
- `MyReservations.jsx` — Historial de reservas del usuario
- Listado adaptativo con BookingRow
- Filtros (Todas/Próximas/Pasadas)
- Detalles de código, actions por reserva
- Estado visual de cada reserva (Confirmada/Pendiente/Completada)

## Próximos Pasos Opcionales

- **Pantalla de Equipo** — Agenda del profesional con grid semanal
- **Pantalla de Bonos** — StatCard + MovementRow para saldo
- **Navegación adaptativa** — NavItem en bar/rail/sidebar por breakpoint
- **Integración API** — Conectar BookingFlow a backend real
- **Validación de formularios** — Añadir reglas y feedback visual

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
