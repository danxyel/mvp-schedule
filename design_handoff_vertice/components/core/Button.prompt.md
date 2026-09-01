Botón de acción: úsalo para cualquier acción explícita del usuario, con el primario reservado a la acción de avance del flujo (una sola por pantalla).

```jsx
<Button variant="primary" size="lg" onClick={confirmar}>Confirmar reserva</Button>
<Button variant="ghost" onClick={otra}>Reservar otra</Button>
```

- `variant`: `primary` (relleno indigo, una por pantalla), `secondary` (borde indigo, acción alternativa), `ghost` (sin caja, acción terciaria).
- `size`: `lg` para el CTA de la barra de acción, `md` por defecto, `sm` en barras de herramientas.
- Hover sube a `accent-600`, pressed a `accent-700`. Nunca opacidad ni escalado.
- Deshabilitado: opacidad .5. Escribe el motivo en la barra de acción, no dejes el botón mudo.
