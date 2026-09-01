**ESTE PROMPT REEMPLAZA por completo la versión anterior de
`PROMPT_H_precio_paquete_por_serie.md`.** Si ya recibiste la versión vieja
(precio de paquete en `SerieReserva`) y respondiste preguntas sobre ella
(incluyendo la de qué hacer con la serie #1), **descarta esas respuestas**
— la decisión cambió: la configuración de pago ya no vive en la serie,
vive en el **servicio**. Lo que sí sigue vigente de tu verificación en
Neon: `inscripciones_serie` tiene 1 fila, 0 con `precio_paquete NOT NULL`
(sigue sin haber nada que backfillear ahí), y el 4º call site que
encontraste en `registrar_pago_inscripcion_local()` (línea ~1490) sigue
aplicando — sigue haciendo falta ese fix, solo cambia a qué apunta.

Antes de nada, lee HANDOFF.md completo.

CONTEXTO: Daniel confirmó explícitamente: la configuración de modalidades
de cobro (por sesión / por paquete) y sus precios debe vivir en el
**servicio**, no en cada serie. Razón: un servicio recurrente
(`tipo_agenda=recurrente`) puede generar muchas series a lo largo del
tiempo (nuevos cohortes, reinicios), y todas deberían heredar
automáticamente la misma configuración de pago sin que el admin la vuelva
a capturar cada vez que crea una serie nueva. Hoy `CrearSerieModal.jsx` no
tiene ningún campo de precio en el camino normal de creación — por eso
Daniel no podía "poner el costo por sesión individual" al crear una serie:
no hace falta pedirlo ahí, ya está definido en el servicio.

DECISIONES YA TOMADAS (no las reabras):
- `Servicio` gana tres columnas: `cobro_por_sesion_habilitado: bool`
  (default `True`), `cobro_por_paquete_habilitado: bool` (default
  `False`), `precio_paquete: Optional[Decimal]`. Se configuran en la
  pantalla "Nuevo servicio" / "Editar servicio"
  (`GestionServicios.jsx`), junto a `precio` y `pago_requerido` que ya
  existen ahí.
- `SerieReserva` **pierde por completo** `cobro_por_sesion_habilitado` y
  `cobro_por_paquete_habilitado` (si ya los tenía de una migración
  anterior — revisa el estado real en Neon, no asumas). Una serie ya NO
  tiene ninguna configuración de pago propia: hereda siempre la del
  servicio al que pertenece (`serie.servicio_id` → `servicio`).
- `InscripcionSerie` sigue **sin** `precio_paquete` (esto no cambió) —
  sigue sin ser responsabilidad de la inscripción ni de la serie.
- `SerieReservaCreate` (schema de crear serie) **pierde** los campos
  `cobro_por_sesion_habilitado`/`cobro_por_paquete_habilitado` — ya no se
  capturan al crear la serie, no hay nada que validar ahí tampoco.
- `validar_modalidad_cobro()` ahora valida contra
  `servicio.cobro_por_sesion_habilitado` /
  `servicio.cobro_por_paquete_habilitado` / `servicio.precio_paquete` —
  revisa TODOS los call sites (inscribir cliente, confirmar solicitud como
  serie, y el 4º que ya encontraste en `registrar_pago_inscripcion_local`)
  y ajusta cada uno para resolver `servicio` (vía `serie.servicio_id`) en
  vez de leer directo de `serie`.
- Frontend:
  - `GestionServicios.jsx`: agrega los checkboxes "Ofrecer pago por
    sesión" / "Ofrecer pago por paquete" + campo condicional "Precio del
    paquete" (mismo patrón de validación que ya tenía `CrearSerieModal` en
    su versión vieja: obligatorio si `cobro_por_paquete_habilitado=True`).
    Sugerencia: mostrar estos campos solo cuando `tipo_agenda=recurrente`,
    ya que un paquete no tiene sentido para un servicio de sesión única —
    propón si hay una razón para no restringirlo así.
  - `CrearSerieModal.jsx`: **quita toda la sección de "modalidades de
    cobro"** (checkboxes + precio de paquete) — ya no hay nada que
    configurar al crear una serie. El modal se simplifica a: frecuencia,
    día, hora, duración, repeticiones, asesor.
  - `InscribirClientesSerieModal.jsx` / `SeriesTab.jsx`: donde antes
    leían `serie.precio_paquete`/`serie.cobro_por_*_habilitado`, ahora
    leen del servicio de esa serie.
- Migración de datos existentes: en Neon hoy existe una `SerieReserva`
  (id=1, la que ya encontraste) con `cobro_por_paquete_habilitado=true` a
  nivel serie. Al migrar, ese flag debe **backfillearse a su servicio**
  (`UPDATE servicios SET cobro_por_paquete_habilitado = true WHERE id = (SELECT servicio_id FROM series_reservas WHERE id = 1)` — ajusta si hay
  más de una serie en ese estado, no asumas que es solo la #1). El
  `precio_paquete` de ese servicio queda en `NULL` tras la migración —
  igual que antes, no hay dato que backfillear porque la columna nunca
  existió. Documenta en HANDOFF que ese servicio necesita que Daniel le
  ponga un precio manualmente desde "Editar servicio" antes de que alguien
  pueda inscribirse ahí como 'paquete'.

ALCANCE — antes de codear, propón (y espera aprobación):
- Migración exacta: columnas nuevas en `servicios`, el `UPDATE` de
  backfill descrito arriba (verifica tú mismo en Neon cuántas series están
  en ese estado antes de escribir el backfill, no confíes en que es solo
  la #1), y el `DROP COLUMN` de `cobro_por_sesion_habilitado`/
  `cobro_por_paquete_habilitado` en `series_reservas` si existen ahí.
- Si `tipo_agenda=recurrente` debe ser requisito para mostrar/aceptar
  `cobro_por_paquete_habilitado=True` en un servicio, o si se permite en
  cualquier tipo — propón y justifica.
- Todos los call sites de `validar_modalidad_cobro()` — no dejes ninguno
  leyendo de `serie` en vez de `servicio`.

ORDEN: propuesta primero (esperar aprobación) → confirmar en Neon cuántas
series tienen `cobro_por_paquete_habilitado=true` hoy → migración
(incluye backfill) → backend (modelo, schemas, `validar_modalidad_cobro`,
los 4 call sites) → regenerar openapi.json/schema.ts → frontend
(`GestionServicios.jsx`, `CrearSerieModal.jsx`, `InscribirClientesSerieModal.jsx`,
`SeriesTab.jsx`) → un commit por pieza, mensajes descriptivos.

Antes de cada pieza, si algo no cuadra con esto o con HANDOFF.md, señálalo
antes de codear en vez de asumir.
