Etiqueta de estado: el tono comunica el significado, así que se elige por semántica y no por color.

```jsx
<Badge tone="positive">Confirmada</Badge>
<Badge tone="warn">Pago pendiente · 08:42</Badge>
<Badge tone="idle">En lista de espera · nº 2</Badge>
<Badge tone="accent">4 lugares</Badge>
```

- `accent` disponibilidad y tipo de servicio · `positive` confirmado · `warn` requiere acción del usuario · `idle` neutro, completo o bloqueado.
- Siempre versalitas, 10px, tracking 0.12em. El texto lleva el dato: "4 lugares", no "Disponible".
- Nunca dos badges de acento distinto en la misma fila.
