Reserva en la lista "Mis reservas": consulta pura, con la hora en columna fija de 64px a la izquierda.

```jsx
<BookingRow hora="10:30" dia="Vie 14" titulo="Fisioterapia deportiva"
  lugar="Clínica Pau Ferrer" estado="Pago pendiente · 08:42" tone="warn" />
```

- No es clicable y no lleva botones: esta vista consulta, no reserva. Mezclar aquí acciones de reserva rompe la separación de flujos del producto.
- El `tone` sigue la semántica de `Badge`: ámbar solo cuando el usuario tiene que hacer algo.
- Una columna en móvil; desde tablet `minmax(320px,1fr)` con `gap: 0 28px`.
