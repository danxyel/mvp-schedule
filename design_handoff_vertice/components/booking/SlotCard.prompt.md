Horario reservable del paso 02, en rejilla auto-fill; solo lleva la hora y el estado.

```jsx
<SlotCard rango="12:00 – 12:55" estado="4 lugares" selected={slot===id} onClick={pick} />
<SlotCard rango="16:00 – 16:55" estado="Lleno" disponible={false} />
```

- Rejilla `repeat(auto-fill, minmax(190px, 1fr))` con `gap: var(--space-3)`; en 390px cae a una columna.
- Cuando no está disponible, el badge dice el motivo ("Lleno", "Ocupado", "No disponible") — nunca un hueco mudo.
- **No muestres el nombre del docente o profesional**: se retiró del producto a propósito.
- Si el día no tiene horarios, sustituye la rejilla por "No hay horarios este día. Elige otra fecha del mes."
