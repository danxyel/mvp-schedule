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
- El pago de **paquete** (varias sesiones) solo se dispara desde **Mis
  Reservas**, con el cliente ya logueado — no se construye una página
  pública nueva para esto. Antes de empezar, confirma que el tenant que va
  a usar esto realmente tiene clientes que pueden loguearse (con
  `password_hash` no nulo) — si todos sus clientes son invitados sin
  contraseña, esta pieza queda bloqueada hasta que exista "reclamar cuenta"
  (no construida, fuera de alcance de esta tarea) y hay que decírselo a
  Daniel antes de codear, no asumir que se puede seguir.
- El pago de **una sola sesión** (reserva suelta, no ligada a una serie)
  sigue funcionando como ya está planteado en `crear_reserva()`
  (`tareas["checkout"]`) — no toca login, es parte del flujo de reserva
  normal.
- La confirmación de pago tiene que ser **consciente de inscripción**:
  reemplaza o extiende `confirmar_pago_por_folio()` para que, si la
  referencia del pago apunta a una inscripción con `modalidad_cobro =
  'paquete'`, marque **todas** las reservas de esa inscripción como
  pagadas/confirmadas (mismo criterio que ya usa
  `registrar_pago_inscripcion_local()`) — no solo la primera. Si la
  referencia es una reserva suelta o modalidad `sesion`, se comporta como
  hoy (solo esa reserva).
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
  endpoint(s) de crear checkout (uno para reserva suelta si no se
  reutiliza el existente, uno para inscripción/paquete), `POST
  /webhooks/mercadopago`.
- Dónde vive la pantalla de "Conectar MercadoPago" — ¿junto a
  `ConfigSmtpModal` en `GestionTenants` (superadmin), o en el panel del
  propio tenant (admin)? Ten en cuenta que quien tiene que autorizar en
  MercadoPago es el dueño de la cuenta del tenant, no necesariamente
  superadmin — propone el flujo completo (quién hace click en "Conectar",
  a dónde regresa después de autorizar en MercadoPago).
- Manejo de refresh token: ¿se refresca perezoso (al fallar una llamada por
  token vencido) o hay que agregar un job en `tasks.py`? Revisa cuánto dura
  un access_token de MercadoPago antes de proponer.
- Botón "Pagar" en Mis Reservas: cómo se distingue entre una reserva suelta
  pendiente de pago y una inscripción de paquete pendiente de pago en la UI
  actual de `MisReservas.jsx` (ya agrupa por `serie_id`, revisa esa lógica
  antes de proponer dónde entra el botón).

ORDEN: propuesta primero (esperar aprobación) → migración
(`Tenant.pago_config`) → backend (OAuth connect/callback, checkout,
webhook, confirmación consciente de inscripción) → regenerar
openapi.json/schema.ts → frontend (pantalla de conexión + botón "Pagar" en
Mis Reservas) → un commit por pieza, mensajes descriptivos.

Antes de cada pieza, si algo no cuadra con esto o con HANDOFF.md,
señálalo antes de codear en vez de asumir — sobre todo el prerrequisito de
que el tenant ya dio de alta su cuenta MercadoPago y de que Daniel ya tiene
la aplicación MercadoPago (Client ID/Secret) lista, porque sin eso no hay
forma de probar nada en vivo.
