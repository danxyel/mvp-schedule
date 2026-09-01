Progreso del flujo de reserva: tres pasos numerados con regla superior, donde solo los pasos ya alcanzados son clicables.

```jsx
<Stepper steps={['Servicio','Fecha y hora','Pago']} current={paso} onSelect={setPaso} />
```

- El número va en versalitas encima de la etiqueta: `01`, `02`, `03`.
- La regla superior de 2px es indigo en los pasos alcanzados y `border-strong` en los futuros.
- Acompáñalo de "Paso N de 3" a la derecha del título, en `--text-caption` con `white-space:nowrap`.
- No lo uses para navegación general: este producto tiene un solo flujo por pasos.
