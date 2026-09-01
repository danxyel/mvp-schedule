Cifra de consulta en tarjeta: saldo de bonos, gasto del mes, cualquier número que el usuario solo lee.

```jsx
<StatCard label="Saldo disponible" value="7 clases" nota="Academia Vértice · vence el 30 nov" />
```

- El saldo de bonos deriva de un único número de estado que el flujo de reserva modifica; la tarjeta solo lo lee. **Nunca pongas una acción de gasto aquí.**
- Rejilla `repeat(auto-fill, minmax(260px,1fr))` con `gap: var(--space-5)`.
- La unidad va dentro del `value` ("7 clases", no "7" con "clases" en la nota).
