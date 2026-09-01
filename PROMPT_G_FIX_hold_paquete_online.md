Antes de nada, lee HANDOFF.md (fila "PROMPT_G — propuesta técnica de opencode
aprobada tras 5 correcciones") y este archivo completo.

**REEMPLAZA la versión anterior de este archivo.** El diagnóstico original
("hardcodear metodo_pago=LOCAL") estaba incompleto — el problema real es más
profundo. No apliques el fix viejo si ya lo empezaste; el de abajo lo cubre
completo.

BUG encontrado en la revisión de PROMPT_G (commits `682f385`, `74aa04b`,
`5164437`) — corregir solo esto, no tocar nada más de lo ya implementado.

## El problema real

`_generar_reservas_de_inscripcion()` (`app/services_v2_2.py`, ~línea 1350)
crea cada sesión del paquete/serie reutilizando `crear_reserva()` tal cual.
Dentro de `crear_reserva()` (líneas 922-943), la decisión de `estado` /
`estado_pago` / `hold_expira_en` se calcula así:

```python
metodo = payload.metodo_pago.value if payload.metodo_pago else (...)
precio = servicio.precio or Decimal("0.00")          # <- precio POR SESIÓN
requiere_pago = servicio.pago_requerido and precio > 0

if servicio.requiere_confirmacion:
    estado, estado_pago, hold_expira = PENDIENTE, PENDIENTE, None
elif not requiere_pago:
    estado, estado_pago, hold_expira = CONFIRMADA, EXENTO, None
elif metodo == MetodoPago.ONLINE.value:
    estado, estado_pago, hold_expira = EN_ESPERA, PENDIENTE, (ahora + hold_minutos)
else:
    estado, estado_pago, hold_expira = CONFIRMADA, PENDIENTE, None
```

Esa decisión usa **`servicio.precio`** — el precio por sesión suelta — pero
`_generar_reservas_de_inscripcion()` recién **después** de llamar a
`crear_reserva()` calcula el precio real de cada reserva del paquete
(`precio_por_reserva = servicio.precio_paquete / len(fechas)`) y lo asigna a
`reserva.precio_final`. Es decir: **la rama que decide si hay hold, si queda
pendiente o si queda exenta corre con el precio equivocado** — nunca mira
`servicio.precio_paquete`.

Consecuencia concreta, y por qué el resultado observado varía según el
servicio: si ese servicio tiene `servicio.precio` (por sesión) en 0/null
porque solo vende por paquete, `requiere_pago` da `False` y **toda reserva
de paquete queda `EXENTO`** sin importar el precio del paquete — el cliente
nunca paga nada y el sistema nunca se lo pide. Si en cambio `servicio.precio`
sí tiene un valor (porque el mismo servicio también admite "por sesión"), la
rama que se dispara depende del `metodo` elegido: con `online` cae en
`EN_ESPERA` + hold de `tenant.hold_minutos` (15 min default) — y el job que
ya existe, `limpiar_holds_expirados()`, cancela esas reservas solas si el
cliente no paga en esos 15 minutos, aunque el diseño ya acordado (ver
HANDOFF, fila del pago de paquete) asume que puede tardar horas o días.
`InscripcionSerie.estado` se queda en `CONFIRMADA` para siempre en ese caso
(no hay forma de revertirlo, `cancelar_invitacion_serie()` solo aplica a
`INVITADA`), y el botón "Pagar paquete" en `MisSeries.jsx` termina apuntando
a reservas que ya no existen.

En resumen: el resultado hoy es **no determinístico respecto al precio real
del paquete** — puede ser exento sin querer, o puede tener un hold que se
autocancela sin querer. Ninguno de los dos es el comportamiento correcto.

Esto **no afecta** el pago de reserva suelta (`POST /reservas/{folio}/checkout`)
— esa reserva usa `servicio.precio` correctamente porque sí es una reserva
individual real, no generada en lote desde una invitación.

## El fix

Dentro del loop de `_generar_reservas_de_inscripcion()`, **después** de que
`crear_reserva()` regresa y **después** de calcular `precio_por_reserva`
(o el precio de sesión si la modalidad es `sesion`, no `paquete`),
sobreescribe explícitamente el estado de pago de la reserva en vez de
confiar en lo que decidió `crear_reserva()` con el precio equivocado:

```python
precio_real = precio_por_reserva if inscripcion.modalidad_cobro == ModalidadCobro.PAQUETE else servicio.precio

reserva.estado = EstadoReserva.CONFIRMADA
reserva.estado_pago = (
    EstadoPagoReserva.EXENTO
    if (not servicio.pago_requerido or not precio_real or precio_real <= 0)
    else EstadoPagoReserva.PENDIENTE
)
reserva.hold_expira_en = None
```

Aplica igual para modalidad `sesion` y `paquete` — ninguna reserva generada
desde una invitación de serie ya confirmada debería nacer `EN_ESPERA` con
hold (el cliente ya no está "reservando ahora", ya confirmó su lugar en la
serie; pagar es un paso aparte, después) ni depender del precio por-sesión
del servicio para decidir si está exenta cuando la modalidad es paquete.

No toques la rama `if servicio.requiere_confirmacion` de `crear_reserva()`
en sí — esta sobreescritura pasa fuera de esa función, después de que ya
regresó, y solo aplica a las reservas generadas por esta función específica.
No cambies nada del checkout de reserva suelta ni del webhook.

## Verificación esperada antes de dar por cerrado

Probar con AL MENOS dos configuraciones de servicio distintas (para cubrir
los dos síntomas encontrados, no solo uno):

1. Servicio con `precio` (por sesión) en 0/null y `precio_paquete` > 0,
   `cobro_por_paquete_habilitado=True`: confirmar paquete con `metodo_pago`
   cualquiera → reservas deben quedar `PENDIENTE`, no `EXENTO`.
2. Servicio con `precio` > 0 (además del paquete): confirmar invitación con
   `modalidad_cobro=paquete` + `metodo_pago=online` → reservas deben quedar
   `CONFIRMADA` + `PENDIENTE` + `hold_expira_en=NULL` (nunca `EN_ESPERA`).
3. Forzar (o esperar) que corra `limpiar_holds_expirados()` después del caso
   2 — esas reservas no deben cancelarse.
4. El botón "Pagar paquete" en Mis Series y el checkout de reserva suelta
   siguen funcionando igual que antes de este fix.

Un solo commit, mensaje descriptivo (ej. `fix(pagos): reservas de
inscripcion de serie ya no heredan estado/hold del precio por-sesion`). Si
al revisar encuentras que el mismo problema aplica en algún otro lugar que
también reutilice `crear_reserva()` para generar reservas en lote con un
precio distinto al de `servicio.precio`, señálalo antes de asumir que solo
es este.
