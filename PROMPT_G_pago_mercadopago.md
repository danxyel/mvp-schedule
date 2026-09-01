Antes de nada, lee HANDOFF.md completo.

CONTEXTO: hoy el pago en línea no existe de verdad en ningún lado útil.
`svc.iniciar_checkout()` es un stub (`NotImplementedError`), y el único
webhook que existe (`POST /webhooks/stripe`) queda sin usar — Stripe no se
va a activar por ahora. Lo que sí funciona hoy es el pago **local**
registrado por staff: `registrar_pago_local()` marca una sola reserva por
folio (modalidad sesión) y `registrar_pago_inscripcion_local()` marca todas
las reservas de una inscripción vía `inscripcion_id` (modalidad paquete) —
esta parte no se toca, sigue siendo el camino para efectivo/transferencia.

Esta tarea agrega el camino de **pago en línea vía MercadoPago**, por
tenant (cada tenant conecta su propia cuenta — el dinero es 100% del
tenant, DANIEL Consultoría no cobra comisión). El primer tenant que lo va a
usar ya existe en la plataforma (no es SIMAL, es otro tenant — trátalo como
uno más, sin trato especial).

**ACTUALIZACIÓN 2026-08-04 — releer esta sección, cambia el alcance real:**
Daniel pidió explícitamente el flujo de **auto-compra** (el cliente paga
solo, sin que staff intervenga) para dos casos que hoy no tienen ningún
camino, ni siquiera un botón:
1. **Sesión ya CONFIRMADA con asesor asignado, pago pendiente** — pasa en
   servicios con `requiere_confirmacion=True` (Solicitud → Pendientes →
   `asignar_asesor_reserva()`): esa reserva nunca pasa por `EN_ESPERA` (va
   directo de `PENDIENTE` a `CONFIRMADA`, `estado_pago` se queda en
   `PENDIENTE`), así que **nunca dispara `tareas["checkout"]`** — eso solo
   pasa en `crear_reserva()` para servicios sin confirmación manual. Hoy el
   único camino para que esa reserva se marque pagada es que el staff
   registre el pago local — no existe forma de que el cliente pague en
   línea después de que le asignaron asesor. Confirmado con grep: ni
   `confirmar_pago_por_folio()` (exige `estado == EN_ESPERA`, la rechazaría)
   ni `MisReservas.jsx` (solo muestra el estado de pago como texto, cero
   botón) resuelven esto hoy.
2. **Paquete / series** — como ya estaba planteado abajo, pero el diseño de
   la invitación cambió (ver Prompt I, ya implementado): el precio ya no
   vive en `Inscripcion`/`Serie`, vive en `Servicio.precio_paquete`, y
   `confirmar_inscripcion_serie()` (el cliente elige modalidad + método al
   aceptar la invitación) hoy **hard-rechaza** `metodo_pago=ONLINE` con
   `ReservaError("...", codigo="pago_en_linea_no_disponible")` —
   `app/services_v2_2.py:1440-1444`. Eso es lo que hay que reemplazar.

La pieza de "reclamar cuenta" que bloqueaba el pago de paquete en la versión
original de este prompt **ya no bloquea nada — se construyó** (Prompt F,
implementado). No hace falta volver a confirmar que el tenant tiene clientes
que pueden loguearse antes de empezar esta tarea.

Nota aparte, NO bloqueante para esta tarea: `POST /webhooks/stripe` hoy no
verifica firma si el paquete `stripe` no está instalado (cae a
`json.loads(payload)` sin validar). Como Stripe no se va a usar de entrada,
queda documentado como deuda técnica en HANDOFF — si algún día se activa
Stripe, hay que cerrar ese hueco antes de que pase dinero real por ahí.

DECISIONES YA TOMADAS (no las reabras):
- Modelo de cobro: **OAuth Connect / marketplace de MercadoPago**, cada
  tenant conecta su propia cuenta (no una cuenta centralizada de DANIEL).
  El dinero llega directo al tenant. `marketplace_fee` en 0 / omitido — sin
  comisión de plataforma.
- Tipo de checkout: **Checkout Pro** (preferencia + redirect a la página
  hospedada por MercadoPago). Nada de Checkout API/Bricks embebido en esta
  tarea — es más trabajo del que se justifica para el MVP.
- Credenciales por tenant se guardan en `Tenant.pago_config`
  (`EncryptedJSON`, mismo patrón que `smtp_config`): `access_token`,
  `refresh_token`, `mp_user_id` (id del vendedor en MercadoPago), fecha de
  vencimiento del token. Necesita refresh cuando expire — MercadoPago usa
  tokens de vida corta con `refresh_token` de larga duración.
- Credenciales de la "aplicación" MercadoPago (Client ID / Client Secret
  que identifican a la app de DANIEL Consultoría ante MercadoPago, usadas
  para iniciar el flujo OAuth) son **globales**, van en variables de
  entorno nuevas (`MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`),
  no por tenant. Daniel tiene que dar de alta esa aplicación en el panel de
  desarrolladores de MercadoPago antes de poder probar esto — señálalo como
  prerrequisito si no existe todavía.
- El pago de **paquete** (varias sesiones de una inscripción a serie) se
  dispara desde **Mis Series** (no Mis Reservas — ahí es donde vive hoy la
  pantalla de aceptar invitación/elegir modalidad, `MisSeries.jsx`), con el
  cliente ya logueado. La fuente del precio es **`Servicio.precio_paquete`**
  (movido ahí en Prompt H, ya no vive en `Serie` ni en `Inscripcion`).
  `confirmar_inscripcion_serie()` con `metodo_pago=ONLINE` **deja de
  hard-rechazar**: debe comportarse como el camino `LOCAL` ya lo hace hoy
  (genera las N reservas vía `_generar_reservas_de_inscripcion()`, cada una
  con `estado_pago=PENDIENTE`) — **no** dispara el checkout dentro de esa
  misma llamada. Pagar es un paso aparte, después, con un botón "Pagar
  ahora" en Mis Series/Mis Reservas — decisión deliberada para no mezclar
  "elegir modalidad" con "pagar" en una sola transacción/request. Propón el
  detalle exacto si ves una razón de peso para hacerlo distinto (ej. si el
  hold de cupo sin pago inmediato es un riesgo real para este tenant).
- El pago de **una sola sesión** (reserva suelta, no ligada a una serie)
  tiene **dos caminos distintos, no uno solo** — no los mezcles:
  1. **Al momento de reservar** (servicios con `requiere_confirmacion=False`):
     ya está planteado en `crear_reserva()` (`tareas["checkout"]`), no toca
     login, dispara el checkout dentro del mismo request de crear la
     reserva. Este camino ya existe, solo falta que `iniciar_checkout()`
     deje de ser un stub.
  2. **Auto-compra después de que le asignan asesor** (servicios con
     `requiere_confirmacion=True`, flujo Solicitud→Pendientes): la reserva
     llega a `CONFIRMADA` con `estado_pago=PENDIENTE` sin haber pasado nunca
     por `EN_ESPERA` ni por checkout. Hoy no hay ningún endpoint ni botón
     para esto — es trabajo nuevo, no wiring de algo que ya existe. Necesita
     un endpoint nuevo (cliente logueado, dueño de la reserva por
     `creado_por_usuario_id`) que dispare `iniciar_checkout()` sobre esa
     reserva puntual, y un botón "Pagar ahora" en `MisReservas.jsx` (hoy esa
     pantalla **solo muestra el estado de pago como texto, cero botón** —
     confirmado, no asumas que ya existe algo que solo falta conectar).
- La confirmación de pago tiene que cubrir **dos estados de entrada válidos**,
  no solo uno: `confirmar_pago_por_folio()` hoy exige
  `reserva.estado == EN_ESPERA` (línea ~1659 de `services_v2_2.py`) — sirve
  para el camino 1 de arriba (hold al reservar), pero **rechazaría** el
  camino 2 (la reserva ya está `CONFIRMADA`, nunca pasa por `EN_ESPERA`).
  Extiende la función para aceptar ambos casos: `EN_ESPERA` (pasa a
  `CONFIRMADA` + pago `COMPLETADO`, comportamiento actual sin cambios) o ya
  `CONFIRMADA` con `estado_pago == PENDIENTE` (se queda `CONFIRMADA`, solo
  cambia `estado_pago` a `COMPLETADO` — no hay transición de estado de
  reserva que hacer, ya estaba confirmada). Cualquier otro estado de entrada
  sigue siendo error, como hoy. Además, si la referencia del pago apunta a
  una **inscripción de paquete**, tiene que marcar **todas** las reservas de
  esa inscripción (mismo criterio que ya usa
  `registrar_pago_inscripcion_local()`), no solo una.
- El webhook de MercadoPago **no debe confiar en el payload de la
  notificación**. MercadoPago manda solo un aviso (`topic=payment`,
  `id=<payment_id>`); hay que volver a consultar el pago directo a la API
  de MercadoPago usando el `access_token` del tenant correspondiente antes
  de marcar nada como pagado. El `user_id` que viene en la notificación
  sirve para encontrar a qué tenant pertenece (buscar por `mp_user_id`
  guardado). Este patrón evita el problema que sí tiene hoy el webhook de
  Stripe (confiar en el payload sin re-verificar).

ALCANCE — antes de codear, propón (y espera aprobación):
- Migración exacta: columna `Tenant.pago_config` (`EncryptedJSON`,
  nullable) — revisa cómo está definida `smtp_config` para seguir el mismo
  patrón de tipo de columna y cifrado (`TENANT_SECRETS_KEY`).
- Formato de `external_reference` en la preferencia de MercadoPago: necesita
  distinguir sin ambigüedad "reserva suelta por folio" de "inscripción por
  id" (ej. `reserva:{folio}` vs `inscripcion:{id}`) — propone el formato
  exacto y cómo lo parsea el webhook.
- Rutas nuevas exactas: flujo de conexión OAuth (ej. iniciar conexión,
  callback que intercambia `code` por tokens — necesita parámetro `state`
  para evitar CSRF, valida que corresponda al tenant que inició el flujo),
  `POST /webhooks/mercadopago`, y **dos endpoints de auto-compra que hoy no
  existen en ninguna forma** (no es reusar algo parecido, es nuevo):
  - `POST .../reservas/{folio}/checkout` (o el nombre que propongas) —
    cliente logueado, dueño de la reserva, `estado=CONFIRMADA` +
    `estado_pago=PENDIENTE` → genera la preferencia de MercadoPago para esa
    reserva puntual y regresa la URL de checkout. Cubre el caso "auto-compra
    después de asignar asesor" de arriba.
  - `POST .../inscripciones/{id}/checkout` (o el nombre que propongas) —
    cliente logueado, dueño de la inscripción, `modalidad_cobro=PAQUETE`,
    todas sus reservas con `estado_pago=PENDIENTE` → una sola preferencia
    de MercadoPago por el total (`Servicio.precio_paquete`), no N
    preferencias separadas. Cubre el pago de paquete desde Mis Series.
  - El endpoint de crear reserva (`POST /reservas`) ya dispara
    `iniciar_checkout()` solo cuando corresponde — no necesita ruta nueva,
    solo que `iniciar_checkout()` deje de ser stub.
- Dónde vive la pantalla de "Conectar MercadoPago" — ¿junto a
  `ConfigSmtpModal` en `GestionTenants` (superadmin), o en el panel del
  propio tenant (admin)? Ten en cuenta que quien tiene que autorizar en
  MercadoPago es el dueño de la cuenta del tenant, no necesariamente
  superadmin — propone el flujo completo (quién hace click en "Conectar",
  a dónde regresa después de autorizar en MercadoPago).
- Manejo de refresh token: ¿se refresca perezoso (al fallar una llamada por
  token vencido) o hay que agregar un job en `tasks.py`? Revisa cuánto dura
  un access_token de MercadoPago antes de proponer.
- Botón "Pagar ahora": dos pantallas distintas, ninguna lo tiene hoy
  (verificado, `MisReservas.jsx` solo pinta el estado de pago como texto).
  `MisReservas.jsx` ya agrupa por `serie_id` — revisa esa lógica antes de
  proponer dónde entra el botón de reserva suelta (`estado=CONFIRMADA` +
  `estado_pago=PENDIENTE`, sin `inscripcion_id`, dispara el endpoint de
  reserva). El de paquete probablemente tiene más sentido en `MisSeries.jsx`
  (donde ya vive el resto de la lógica de inscripción/modalidad) que en
  `MisReservas.jsx` — propón dónde, con justificación.

ORDEN: propuesta primero (esperar aprobación) → migración
(`Tenant.pago_config`) → backend (OAuth connect/callback, `iniciar_checkout()`
real, los 2 endpoints nuevos de auto-compra, `confirmar_pago_por_folio()`
extendida, `confirmar_inscripcion_serie()` sin el hard-reject de ONLINE,
webhook) → regenerar openapi.json/schema.ts → frontend (pantalla de
"Conectar MercadoPago", botón "Pagar ahora" en `MisReservas.jsx`, botón
"Pagar ahora" en `MisSeries.jsx`) → un commit por pieza, mensajes
descriptivos.

Antes de cada pieza, si algo no cuadra con esto o con HANDOFF.md,
señálalo antes de codear en vez de asumir — sobre todo el prerrequisito de
que el tenant ya dio de alta su cuenta MercadoPago y de que Daniel ya tiene
la aplicación MercadoPago (Client ID/Secret) lista, porque sin eso no hay
forma de probar nada en vivo.
