Destino de navegación adaptable: el mismo ítem se dibuja como pestaña inferior, icono de rail o fila de sidebar según el ancho.

```jsx
<NavItem mode="sidebar" icon="◇" label="Bonos" badge={7} active={seccion==='bonos'} onClick={ir} />
```

- Cuatro destinos como máximo en `bar`: por encima de eso la barra inferior no cabe en 390px.
- El `badge` es un contador vivo y solo aparece en `sidebar`; en `bar` y `rail` se omite porque no hay sitio.
- El activo lleva `aria-current="page"`. En `bar` se marca con color indigo, en `rail`/`sidebar` con relleno neutral-200.
