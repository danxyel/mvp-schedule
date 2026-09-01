Opción de pago del paso 03; siempre tres, apiladas, con una seleccionada.

```jsx
<PlanCard nombre="Paquete de 10" precio="$2,720" nota="$272 por sesión · el más contratado."
  selected={plan==='bono10'} onClick={() => setPlan('bono10')} />
```

- Los precios se calculan sobre el precio del servicio elegido (×1, ×4.5, ×8.5), así que cambian por servicio.
- La `nota` lleva el precio unitario y la vigencia. "el más contratado" es la única señal social que usa el sistema.
- Van bajo la etiqueta `PAQUETE` en versalitas, no bajo un H2.
