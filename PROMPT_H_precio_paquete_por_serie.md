Antes de nada, lee HANDOFF.md completo.

CONTEXTO: hoy el precio por sesión ya está bien — vive en `servicio.precio`,
fijo, lo define el admin una sola vez. Pero el precio de **paquete** no
vive en ningún lado fijo: `InscripcionSerie.precio_paquete` se escribe **a
mano, por cada cliente**, cada vez que se le inscribe
(`InscribirClientesSerieModal.jsx`). Nada impide que dos clientes de la
misma serie terminen con precios de paquete distintos, y el admin tiene que
volver a teclear el mismo número cada vez que inscribe a alguien nuevo.
Daniel confirmó: el precio del paquete debe estar **relacionado a la
serie/asignatura** (definirse una sola vez, como ya pasa con el precio por
sesión), no re-capturarse por cliente. Al inscribir a alguien, el admin ya
no debe pedir ni escribir un precio — solo elige la modalidad.

Dato a favor: la tabla `inscripciones_serie` está vacía en producción hasta
este momento (todo `INSERT` fallaba por el bug de
`ck_inscripcion_modalidad` recién corregido — ver HANDOFF 2026-08-04). Aun
así, **no asumas esto ciegamente**: antes de dropear la columna, corre un
`SELECT COUNT(*) FROM inscripciones_serie WHERE precio_paquete IS NOT
NULL` contra Neon y confírmalo tú mismo. Si hay filas con datos reales,
detente y avisa — hay que backfillear a `series_reservas.precio_paquete`
antes de dropear, no perder el dato.

DECISIONES YA TOMADAS (no las reabras):
- `SerieReserva` recupera la columna `precio_paquete: Optional[Decimal]`
  (existía en el diseño v1 de un solo cliente, se quitó en la migración
  multicliente porque en ese momento el precio se pensó por-inscripción —
  ahora vuelve, pero como precio único de la serie, no por cliente).
- `InscripcionSerie` **pierde** la columna `precio_paquete` — se elimina
  por completo, ya no es responsabilidad de la inscripción.
- `SerieReservaCreate` (schema de crear serie) gana el campo
  `precio_paquete: Optional[Decimal]`, obligatorio cuando
  `cobro_por_paquete_habilitado=True` (mismo criterio de validación que ya
  existe en `validar_modalidad_cobro()`, pero aplicado en el momento de
  crear la serie, no de inscribir).
- `InscripcionSerieCreate` (schema de inscribir cliente) **pierde** el
  campo `precio_paquete` — el payload de inscripción solo trae
  `cliente_usuario_id`, `modalidad_cobro`, `metodo_pago`.
- `validar_modalidad_cobro()` se usa en dos momentos distintos ahora y el
  origen de `precio_paquete` cambia según cuál: al crear/editar la serie,
  viene del payload de creación de la serie; al inscribir a un cliente, ya
  no se valida contra un precio del payload (no existe) sino contra
  `serie.precio_paquete` (que la serie ya debe tener si
  `cobro_por_paquete_habilitado=True` — si no lo tiene, es un estado
  inconsistente de la serie, no un error del cliente inscribiéndose).
  Revisa los tres call sites (creación de serie, `inscribir_cliente_en_serie()`,
  `confirmar_solicitud_como_serie()`) y ajusta la función o sus llamadas
  según haga falta — no le cambies el comportamiento a la validación de
  modalidad por-sesión, que ya funciona bien.
- El cálculo `precio_por_reserva = precio_paquete / num_fechas` en
  `inscribir_cliente_en_serie()` y `confirmar_solicitud_como_serie()` ahora
  lee `serie.precio_paquete`, no `payload.precio_paquete` (que ya no
  existe en el payload de inscripción).
- Frontend:
  - `CrearSerieModal.jsx`: el campo "Precio del paquete" hoy solo se
    muestra dentro del bloque `esDesdeSolicitud` (revisa el JSX actual,
    líneas ~344-380) — muévelo fuera de ese bloque, debe aparecer siempre
    que `cobro_por_paquete_habilitado` esté marcado, tanto en el camino
    normal de "Crear Serie" como en el de "Confirmar solicitud como
    serie". El payload del camino normal (`POST /admin/series`) hoy NO
    manda `precio_paquete` en absoluto — agrégalo.
  - `InscribirClientesSerieModal.jsx`: quita el input de precio por
    cliente y su validación (`if (!cfg.precio_paquete...)`). El admin solo
    elige modalidad + método de pago por cliente; el precio ya viene fijo
    de la serie y se puede mostrar de solo lectura si quieres (no es
    obligatorio, pero ayuda a que el admin vea qué le va a cobrar a cada
    quien antes de confirmar).
  - `SeriesTab.jsx`: hoy muestra `ins.precio_paquete` por cada inscripción
    — cámbialo para mostrar el precio de la serie (uniforme), no por
    inscripción individual.

ALCANCE — antes de codear, propón (y espera aprobación):
- Migración exacta: `ALTER TABLE series_reservas ADD COLUMN
  precio_paquete NUMERIC(12,2)` + el `DROP COLUMN` de
  `inscripciones_serie` (después de confirmar que está vacía como se pidió
  arriba) + cómo se re-arma el `CHECK` de precio no-negativo si aplica
  (revisa si `series_reservas` ya tenía ese constraint del diseño v1 antes
  de que se quitara, o si hay que crearlo de nuevo).
- Cómo queda exactamente `validar_modalidad_cobro()` — si cambia su firma,
  revisa TODOS los call sites antes de tocarla, no solo los de esta tarea.
- Si al enriquecer `_serie_admin_out()` o el detalle de serie hay que
  exponer `precio_paquete` en la respuesta de `GET /admin/series` (hoy
  puede que no lo tenga, revisa el schema `SerieReservaOut` actual).

ORDEN: propuesta primero (esperar aprobación) → confirmar en Neon que
`inscripciones_serie` está vacía → migración → backend (modelo, schemas,
`validar_modalidad_cobro`, `inscribir_cliente_en_serie`,
`confirmar_solicitud_como_serie`) → regenerar openapi.json/schema.ts →
frontend (`CrearSerieModal.jsx`, `InscribirClientesSerieModal.jsx`,
`SeriesTab.jsx`) → un commit por pieza, mensajes descriptivos.

Antes de cada pieza, si algo no cuadra con esto o con HANDOFF.md, señálalo
antes de codear en vez de asumir.
