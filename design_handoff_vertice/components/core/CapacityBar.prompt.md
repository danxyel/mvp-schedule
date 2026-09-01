Barra de ocupación de una sesión con plazas limitadas, con el conteo en tabular al lado.

```jsx
<CapacityBar ocupados={4} cupo={6} tone="accent" />
<CapacityBar cupo={1} tone="accent2" />   {/* individual → "Agenda abierta" */}
```

- El `tone` debe ser el mismo color que el punto del servicio: la barra y el punto son el mismo código de color.
- Con `cupo <= 1` (servicio individual) la pista queda vacía y el texto pasa a "Agenda abierta" — no muestres 0/1.
- Nunca añadas urgencia al conteo ("¡Solo 2 plazas!"). El dato basta.
