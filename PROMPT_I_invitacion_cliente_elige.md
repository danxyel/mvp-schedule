Antes de nada, lee HANDOFF.md completo. **Este prompt se corre DESPUÉS de
`PROMPT_H_precio_paquete_por_serie.md`** — asume que `precio_paquete` ya
vive en `SerieReserva`, no en `InscripcionSerie`. Si `PROMPT_H` no está
aplicado todavía, detente y avísalo.

CONTEXTO: hoy (incluso después de `PROMPT_H`) cuando un admin "inscribe" a
un cliente en una serie, el admin elige la modalidad de cobro y el método
de pago **por el cliente**. Eso está mal: la decisión de cómo pagar es del
cliente, no del admin. El acuerdo, confirmado varias veces por Daniel a lo
largo del proyecto: el admin **invita** a un cliente a la serie (o el
cliente llega por su cuenta vía una `SolicitudReserva`), y es el **cliente,
desde su propio portal**, quien elige si paga por sesión o por paquete
(con el beneficio de precio que tenga el paquete) y con qué método paga.
Esto aplica igual en ambos caminos de inscripción — no hay un camino donde
el admin decide por el cliente.

Esto ya no está bloqueado: `reclamar/activar cuenta` (ver HANDOFF
2026-08-03) ya existe, así que un cliente invitado sin contraseña puede
loguearse y llegar a su portal. Antes de esta tarea eso no era posible y
por eso se pospuso.

DECISIONES YA TOMADAS (no las reabras):
- `InscripcionSerie.modalidad_cobro` pasa de `NOT NULL` a **nullable** —
  representa "todavía no elegida" mientras la invitación está pendiente.
- `InscripcionSerie` gana un campo de estado nuevo, ej.
  `estado: invitada | confirmada | cancelada` (nombre y tipo exacto los
  propones tú, sigue el patrón de los enums ya existentes en el proyecto —
  `str, PyEnum`, valores en mayúsculas para el nombre del miembro, ver el
  hallazgo de `ck_inscripcion_modalidad` en HANDOFF sobre por qué). Default
  `invitada`.
- **Camino 1** (`InscribirClientesSerieModal.jsx` → `POST
  /admin/series/{id}/inscripciones`): el admin ya NO manda
  `modalidad_cobro` ni `metodo_pago`, solo `cliente_usuario_id` (o una
  lista, si sigue siendo multi-select). El backend crea la
  `InscripcionSerie` en estado `invitada`, con `modalidad_cobro=NULL`, y
  **no genera ninguna reserva todavía** — eso pasa hasta que el cliente
  confirma.
- **Camino 2** (`confirmar_solicitud_como_serie()`, solicitud → serie):
  se unifica con el camino 1. Al confirmar, se crea la serie Y una
  `InscripcionSerie` en estado `invitada` para el cliente de la solicitud
  — tampoco genera reservas de inmediato. El staff ya no elige modalidad
  ni método aquí tampoco (hoy `CrearSerieModal.jsx` sí se los pide cuando
  `esDesdeSolicitud` — quítalo).
- Nuevo endpoint **del lado del cliente** (autenticado, dueño de la
  inscripción): recibe `{modalidad_cobro, metodo_pago}`, valida contra
  `cobro_por_sesion_habilitado`/`cobro_por_paquete_habilitado` de la serie
  (reusa `validar_modalidad_cobro()`), setea `modalidad_cobro` en la
  inscripción, genera las N reservas (reusa la lógica de fechas +
  `crear_reserva()` que ya existe en `inscribir_cliente_en_serie()` —
  factorízala a un helper compartido en vez de duplicarla), pasa
  `estado=confirmada`.
- `metodo_pago` en ese endpoint acepta los valores que ya existen
  (`local`, `online`, ...). **`online` depende de que exista
  `PROMPT_G_pago_mercadopago.md` implementado** (todavía no, ver HANDOFF)
  — si el tenant no tiene `pago_config` de MercadoPago configurado y el
  cliente elige `online`, responde un error de negocio claro (ej. 409
  `pago_en_linea_no_disponible`), no un 500 ni un stub silencioso. No
  implementes el checkout de MercadoPago en esta tarea, solo deja el
  contrato listo para cuando exista.
- Al crear la invitación (camino 1 o 2), se manda un correo al cliente
  avisándole que tiene una invitación pendiente, con link a su portal —
  reusa el helper de plantilla con branding del tenant que ya existe
  (`PROMPT_F`). Si el cliente todavía no tiene contraseña, este correo
  necesita combinar el aviso de invitación con el link de activación
  (mismo criterio que ya se aplicó para el correo de confirmación de
  reserva de invitado en `PROMPT_F` — no mandes dos correos separados).
- El admin necesita poder **cancelar/retirar** una invitación que sigue en
  estado `invitada` (el cliente nunca respondió, o ya no aplica). No hace
  falta si ya está `confirmada` — para eso ya existe cancelar reservas.

ALCANCE — antes de codear, propón (y espera aprobación):
- Migración exacta: nullable en `modalidad_cobro`, columna/enum de
  `estado` en `InscripcionSerie`.
- Rutas exactas: el endpoint de confirmación del cliente (¿bajo
  `/mis-series/{inscripcion_id}/confirmar`? ¿otro prefijo? — revisa cómo
  están nombradas las rutas client-facing existentes, `/mis-reservas`,
  `/mis-solicitudes`, sigue ese patrón), el de cancelar invitación
  (admin), y cómo el cliente **ve** sus invitaciones pendientes (¿un
  `GET /mis-series` nuevo, o se integra a `GET /mis-reservas`?).
- Dónde vive esto en el frontend — ¿una sección nueva dentro de
  `MisReservas.jsx` (ya agrupa por `serie_id`, revisa esa lógica antes de
  proponer), o un componente aparte? Necesita mostrar: servicio, opciones
  de modalidad habilitadas con su precio (sesión = `servicio.precio`,
  paquete = `serie.precio_paquete`), selector de método de pago, botón de
  confirmar.
- Factorización del código de generación de reservas: hoy vive dentro de
  `inscribir_cliente_en_serie()` — decide si ese mismo función se
  reutiliza (llamándola desde el nuevo endpoint del cliente con los datos
  ya resueltos) o si se extrae un helper común. No dupliques la lógica de
  fechas/concurrencia.
- Qué pasa con `InscribirClientesSerieModal.jsx` si ya no hay nada que
  configurar por cliente más que "a quién invito" — ¿sigue teniendo
  sentido un modal separado, o se simplifica a un multi-select simple
  dentro de `SeriesTab.jsx`? Propón antes de decidir.

ORDEN: confirma que `PROMPT_H` ya está aplicado → propuesta (esperar
aprobación) → migración → backend (modelo, schemas, endpoint de
confirmación del cliente, endpoint de cancelar invitación, ajuste de
`inscribir_cliente_en_serie()`/`confirmar_solicitud_como_serie()` para ya
no generar reservas de inmediato, correo de invitación) → regenerar
openapi.json/schema.ts → frontend (ajuste de
`InscribirClientesSerieModal.jsx`/`CrearSerieModal.jsx`, nueva UI de
"invitaciones pendientes" del lado del cliente) → un commit por pieza,
mensajes descriptivos.

Antes de cada pieza, si algo no cuadra con esto o con HANDOFF.md, señálalo
antes de codear en vez de asumir.
