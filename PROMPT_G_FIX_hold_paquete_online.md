Antes de nada, lee HANDOFF.md (fila "PROMPT_G — propuesta técnica de opencode
aprobada tras 5 correcciones") y este archivo completo.

BUG encontrado en la revisión de PROMPT_G (commits `682f385`, `74aa04b`,
`5164437`) — corregir solo esto, no tocar nada más de lo ya implementado.

## El problema

`_generar_reservas_de_inscripcion()` (`app/services_v2_2.py`, ~línea 1350)
reutiliza `crear_reserva()` para crear cada sesión del paquete, pasándole el
`metodo_pago` que eligió el cliente sin modificar:

```python
reserva_payload = ReservaCreate(
    servicio_id=serie.servicio_id,
    fecha_hora_inicio=fecha_hora,
    asesor_id=serie.asesor_id,
    metodo_pago=MetodoPago(metodo_pago.value),   # <- aquí el bug
    canal=Canal.ADMIN,
)
```

Cuando `metodo_pago == ONLINE`, `crear_reserva()` entra a su rama existente:

```python
elif metodo == MetodoPago.ONLINE.value:
    estado = EstadoReserva.EN_ESPERA
    estado_pago = EstadoPagoReserva.PENDIENTE
    hold_expira = utcnow() + timedelta(minutes=tenant.hold_minutos)  # default 15 min
```

Esa rama es correcta para el flujo normal de reservar-y-pagar-de-inmediato,
pero **no** para el paquete: la decisión ya tomada (ver HANDOFF, fila
"El pago de paquete... se dispara desde Mis Series... con un botón 'Pagar
ahora' — decisión deliberada para no mezclar 'elegir modalidad' con 'pagar'
en una misma transacción") es que el cliente puede tardar horas o días en
pagar el paquete después de confirmar la invitación.

El job que ya existe, `limpiar_holds_expirados()`, cancela automáticamente
cualquier reserva `EN_ESPERA` cuyo `hold_expira_en` venció. Con el bug
actual: el cliente confirma la invitación eligiendo paquete + online, se
crean N reservas `EN_ESPERA` con hold de 15 minutos, y si no entra a pagar
en esos 15 minutos (lo normal, dado que el diseño asume que puede tardar),
**todas se cancelan solas**. `InscripcionSerie.estado` se queda en
`CONFIRMADA` para siempre (no hay forma de revertirlo — `cancelar_invitacion_serie()`
solo aplica a estado `INVITADA`), y el botón "Pagar paquete" en `MisSeries.jsx`
queda apuntando a reservas que ya no existen.

Este bug **no afecta** el pago de reserva suelta (`POST /reservas/{folio}/checkout`)
— esa reserva ya nace `CONFIRMADA` antes de que exista cualquier intento de
pago, nunca pasa por `EN_ESPERA`. Es exclusivo del camino de paquete.

## El fix

En `_generar_reservas_de_inscripcion()`, la llamada interna a `crear_reserva()`
debe pasar siempre `metodo_pago=MetodoPago.LOCAL`, **sin importar** qué
`metodo_pago` haya elegido el cliente en la inscripción. Confirmado: `metodo_pago`
no se persiste en `Reserva` (el modelo solo tiene `metodo_pago_usado`, que se
llena hasta que el pago se confirma de verdad) — hardcodear `LOCAL` aquí no
pierde ningún dato, solo evita que `crear_reserva()` entre a la rama de hold.

Con `LOCAL`, `crear_reserva()` cae en su rama `else` normal
(`estado = CONFIRMADA`, `estado_pago = PENDIENTE`, sin hold) — exactamente
el comportamiento que ya funciona hoy quando el cliente elige pagar el
paquete localmente, y el que necesitamos también cuando elige pagar online
(la diferencia entre LOCAL y ONLINE para un paquete ya no está en cómo se
crean las reservas — está solo en qué botón/flujo de pago usa el cliente
después, vía el checkout de MercadoPago o el registro manual de staff).

No cambiar nada más: el `metodo_pago` real que eligió el cliente sigue
disponible en `InscripcionSerie` (o donde ya se esté guardando) para que
`MisSeries.jsx` sepa si debe mostrar el botón "Pagar paquete" — no depende
de esta llamada interna.

## Verificación esperada antes de dar por cerrado

- Un cliente confirma invitación con `modalidad_cobro=paquete` +
  `metodo_pago=online` → las N reservas creadas quedan `CONFIRMADA` +
  `estado_pago=PENDIENTE`, `hold_expira_en=NULL` (no `EN_ESPERA`).
- Esperar (o forzar) que corra `limpiar_holds_expirados()` — esas reservas
  **no** deben cancelarse, porque no están en `EN_ESPERA`.
- El botón "Pagar paquete" en Mis Series sigue funcionando igual que antes
  de este fix (no cambia nada del lado de checkout/webhook).
- El camino de reserva suelta (`POST /reservas/{folio}/checkout`) no se
  toca y sigue funcionando igual.

Un solo commit, mensaje descriptivo (ej. `fix(pagos): paquete online ya no
crea reservas EN_ESPERA con hold, evita cancelacion automatica`). Si al
revisar encuentras que el mismo problema aplica en algún otro lugar que
también reutilice `crear_reserva()` para generar reservas en lote, señálalo
antes de asumir que solo es este.
