Filtro seleccionable de un solo valor: el grupo se comporta como radio, siempre con una opción activa.

```jsx
{['Todos','Individual','Grupal','Recurrente'].map(f =>
  <Chip key={f} selected={f === filtro} onClick={() => setFiltro(f)}>{f}</Chip>)}
```

- Envuélvelos en `display:flex; gap: var(--space-3)` y en móvil añade `overflow-x:auto` — no `flex-wrap`.
- Siempre uno seleccionado; "Todos" es el valor por defecto.
- Acompaña el grupo con el conteo a la derecha ("6 de 6") en `--text-caption` tabular.
