Flecha de paginación de periodo, siempre en pareja alrededor del rótulo del mes o de la semana.

```jsx
<StepArrow direction="prev" disabled={!puedeRetroceder} onClick={mesAnterior} label="Mes anterior" />
<span>Agosto 2026</span>
<StepArrow direction="next" onClick={mesSiguiente} label="Mes siguiente" />
```

- Deshabilita `prev` cuando el periodo actual es el primero permitido — no dejes navegar al pasado.
- 40×40, círculo, borde de 1px. Siempre con `aria-label` explícito: el glifo solo no se lee.
