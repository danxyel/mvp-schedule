Fila del catálogo de servicios: toda la fila es el área clicable que abre el paso 02.

```jsx
<ServiceRow nombre="Regularización de Matemáticas" desc="Grupo reducido · Academia Centro"
  precio="$320" tipo="Grupal" modalidad="Presencial" duracion="55 min"
  ocupados={4} cupo={6} tone="accent" onClick={() => abrir('sv1')} />
```

- Sin caja: la separación es `border-top` de 1px. En móvil una columna; desde tablet rejilla `minmax(320px,1fr)` con `gap: 0 28px`.
- El `tone` es el código de color del servicio y lo comparten punto, badge y barra de ocupación.
- Con precios ocultos pasa `precio="Con bono"` — el hueco no se deja vacío.
