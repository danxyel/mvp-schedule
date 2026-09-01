Calendario de mes del paso 02, navegable hacia adelante sin límite y con el pasado bloqueado.

```jsx
<CalendarMonth month={mes} selected={fecha} minDate={HOY}
  onSelect={setFecha} onMonthChange={setMes}
  availability={(d) => slotsDe(servicio, d).filter(s => s.libre).length}
  footer="Matemáticas · Grupal · Presencial · 55 min · $320" />
```

- La semana empieza en **lunes** (`Lu Ma Mi Ju Vi Sá Do`).
- La disponibilidad NO es un punto: es un guion de 2px cuya longitud crece con las plazas libres (4px por hueco, tope 4). Sin disponibilidad no se dibuja nada.
- El día activo **invierte** (fondo `--color-text`, texto `--color-bg`) en lugar de tintarse de indigo.
- En móvil va apilado sobre la rejilla de horarios; desde escritorio a la izquierda en un panel de 340px máx.
