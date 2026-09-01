Barra de avance pegada al fondo del flujo de reserva; el resumen de la izquierda explica el estado y la derecha lleva la única acción primaria.

```jsx
<ActionBar
  summary={slot ? `${fecha} · ${slot.rango}` : 'Elige un horario disponible'}
  action={<Button variant="primary" size="lg" disabled={!slot}>Continuar al pago</Button>}
/>
```

- Cuando la acción está bloqueada, el `summary` dice qué falta. Nunca un botón gris sin explicación.
- Va dentro del contenedor con scroll, con `margin-top:auto` — no fija sobre el viewport.
- Una sola por pantalla, y solo en el flujo de reserva: las vistas de consulta no la llevan.
