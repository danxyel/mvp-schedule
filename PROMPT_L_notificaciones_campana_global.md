# PROMPT L — Campana de notificaciones global (pasos pendientes)

## Contexto

Extiende `PROMPT_K_ux_panel_admin_conectado.md` (independiente, se puede
correr en cualquier orden respecto a ese — K toca badges dentro de
`PanelAdmin.jsx` + CTAs entre pantallas; L agrega un endpoint nuevo + un
componente de campana visible en toda la app). Decisión de Daniel:

1. La campana vive en el **header, visible desde cualquier pantalla** — no
   solo dentro del panel admin.
2. Categorías: las 2 ya cubiertas por los badges de PROMPT_K (reservas
   pendientes de asesor, solicitudes sin confirmar) **más** pagos por vencer,
   series con precio de paquete sin configurar, e invitaciones a serie sin
   aceptar.

**Hallazgo importante que cambia el plan original:** hoy `App.jsx` no tiene
ningún header/layout compartido — cada pantalla (`PanelAdmin`, `GestionTenants`,
`MisReservas`, etc.) es dueña de su propio header. Meter la campana en cada
pantalla por separado sería un cambio grande y repetitivo. En cambio,
`ProtectedRoute.jsx` (18 líneas, `frontend/src/components/ProtectedRoute.jsx`)
envuelve **todas** las rutas protegidas y hoy solo hace el gate de auth/rol,
renderizando `children` sin nada más — es el punto de inyección correcto:
agregar la campana ahí es un solo archivo tocado, no un refactor de layout.

## Decisiones de arquitectura (ya tomadas)

1. **Nuevo endpoint backend**, staff-only, tenant-scoped:
   `GET /admin/notificaciones-resumen` (mismo patrón de auth que el resto de
   `/admin/*` — `requiere_staff`). No es viable armar esto en el frontend
   reusando endpoints existentes: "pagos por vencer" necesita un filtro por
   ventana de fecha + estado_pago que `GET /admin/reservas` no soporta hoy, e
   "invitaciones sin aceptar" necesita agregar por tenant a través de todas
   las series, no por serie individual. A diferencia de PROMPT_K (cero
   backend), este sí requiere un endpoint nuevo — confirmarlo con Daniel si
   prefiere evitarlo, pero no hay forma limpia de calcular estas 2 categorías
   solo en el cliente.
2. **Respuesta del endpoint** — 5 categorías, cada una con `total` +
   hasta 5 `items` (para el preview del dropdown, no una lista completa):

   ```python
   class NotificacionItemOut(BaseModel):
       id: int
       titulo: str          # texto corto, ej. "Folio #A3F2 — Yoga matutino"
       subtitulo: str | None = None   # ej. "Mié 6 ago, 9:00 am"
       tab_destino: str      # "pendientes" | "solicitudes" | "servicios" | "series"

   class NotificacionCategoriaOut(BaseModel):
       total: int
       items: list[NotificacionItemOut]

   class NotificacionesResumenOut(BaseModel):
       pendientes_asesor: NotificacionCategoriaOut
       solicitudes_sin_confirmar: NotificacionCategoriaOut
       pagos_por_vencer: NotificacionCategoriaOut
       series_sin_precio_configurado: NotificacionCategoriaOut
       invitaciones_sin_aceptar: NotificacionCategoriaOut
   ```

3. **Criterio de cada categoría** (defaults propuestos, ajustables — dejarlos
   como constantes al inicio del archivo, no hardcodeados en la query, para
   que cambiar el número no sea buscar en medio del código):
   - `pendientes_asesor`: `Reserva.estado == PENDIENTE` (mismo criterio que ya
     usa `PendientesTab` hoy).
   - `solicitudes_sin_confirmar`: `SolicitudReserva.estado == PENDIENTE`.
   - `pagos_por_vencer`: `Reserva.estado_pago == PENDIENTE` AND
     `Reserva.estado != CANCELADA` AND `Sesion.fecha_hora_inicio` entre
     **(ahora − 7 días)** y **(ahora + 48 horas)** — cubre tanto "está por
     pasar y no ha pagado" como "ya pasó y se nos olvidó cobrarle" sin
     arrastrar todo el historial viejo. Constantes sugeridas:
     `VENTANA_PAGO_ATRAS_DIAS = 7`, `VENTANA_PAGO_ADELANTE_HORAS = 48`.
   - `series_sin_precio_configurado`: `Servicio.activo == True` AND
     `Servicio.cobro_por_paquete_habilitado == True` AND
     `Servicio.precio_paquete IS NULL`.
   - `invitaciones_sin_aceptar`: `InscripcionSerie.estado == INVITADA` AND
     `InscripcionSerie.creado_en < (ahora − 3 días)`. Constante sugerida:
     `DIAS_INVITACION_SIN_ACEPTAR = 3`.
4. **Frontend — nuevo componente compartido**
   `frontend/src/components/common/CampanaNotificaciones.jsx`:
   - Ícono de campana (SVG inline — el proyecto no usa una librería de
     íconos hoy, no agregar una nueva) con punto rojo/contador si
     `total general > 0`.
   - Al hacer click abre un dropdown con las 5 categorías (nombre + total),
     cada una expandible mostrando sus `items` (título/subtítulo).
   - Cada item es clickeable: navega a `/admin` pasando
     `state: { tab: item.tab_destino }` (React Router `navigate(path, { state })`).
   - Fetch al montar + refresco cada 3 minutos (`setInterval`, limpiar en
     `useEffect` cleanup) — sin polling agresivo ni websockets, es MVP.
5. **`ProtectedRoute.jsx`**: renderiza `<CampanaNotificaciones />` (fijo,
   posición sticky/fixed arriba a la derecha o donde tenga sentido visual)
   **antes de** `children`, pero **solo si** `usuario.rol` está en
   `{'admin', 'asesor', 'superadmin'}` — un cliente (rol `cliente`) nunca ve
   la campana, es una herramienta de staff.
6. **`PanelAdmin.jsx`**: el estado inicial de `tab` (hoy siempre
   `useState('sesiones')`, línea ~1878) debe leer
   `location.state?.tab ?? 'sesiones'` (usa `useLocation()` de
   `react-router-dom`) para que un click desde la campana aterrice
   directamente en la pestaña correcta.
7. **Convive con PROMPT_K, no lo reemplaza**: los badges `Pendientes (N)` /
   `Solicitudes (N)` en la barra de tabs siguen existiendo — dan contexto
   inmediato dentro del panel; la campana da visibilidad desde cualquier
   pantalla y cubre 3 categorías más que los badges no cubren.

## Fuera de alcance

- No se construye un centro de notificaciones persistente/histórico (marcar
  como leído, notificaciones pasadas, etc.) — es un resumen en vivo de "qué
  necesita tu atención ahora", se recalcula cada vez, no se guarda estado de
  "vista/no vista" en DB.
- No se agrega ninguna librería de iconos ni de UI nueva.
- No se toca `MisReservas.jsx` / `MisSeries.jsx` (rutas de cliente) — la
  campana no aplica a ese rol.

## Orden sugerido

1. Backend: schemas (`NotificacionItemOut`, `NotificacionCategoriaOut`,
   `NotificacionesResumenOut`) + endpoint `GET /admin/notificaciones-resumen`
   con las 5 queries (constantes de umbral al inicio del archivo).
2. Regenerar `docs/openapi.json` / `frontend/src/api/schema.ts`.
3. Frontend: `CampanaNotificaciones.jsx`.
4. `ProtectedRoute.jsx`: montar la campana con el gate de rol.
5. `PanelAdmin.jsx`: leer `location.state?.tab` como estado inicial.
6. Avisar a Daniel si algún umbral (7 días / 48h / 3 días) conviene ajustar
   antes de darlo por cerrado — son valores de negocio, no técnicos, elegidos
   por default razonable, no confirmados uno por uno con él.
