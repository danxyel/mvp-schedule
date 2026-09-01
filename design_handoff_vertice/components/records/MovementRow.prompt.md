Línea del historial de bonos y pagos: fecha, concepto, importe, en tres columnas de anchos fijos.

```jsx
<MovementRow fecha="12 ago" concepto="Paquete de 10 · Matemáticas" importe="$2,720" />
<MovementRow fecha="28 jul" concepto="Reembolso · clase cancelada" importe="- $320" />
```

- Un importe que empieza por `-` se detecta como reembolso y se tinta de turquesa. No pases el color a mano.
- Fecha en columna de 80px, importe alineado a la derecha, ambos en tabular.
- Va bajo la etiqueta `MOVIMIENTOS` en versalitas.
