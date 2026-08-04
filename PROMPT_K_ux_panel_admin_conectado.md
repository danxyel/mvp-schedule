# PROMPT K — Conectar las pestañas del panel admin (UX del flujo, sin wizard)

## Contexto

Daniel probó el flujo completo (servicio recurrente → serie → invitación →
cliente acepta → asignar asesor) y el problema no es que algo falle — es que
el panel admin no comunica el flujo. Hoy `PanelAdmin.jsx` tiene 7 pestañas
planas, sin jerarquía ni relación visible entre ellas: **Sesiones, Pendientes,
Solicitudes, Reservas del día, Series, Servicios, Usuarios** (línea ~1878 en
adelante). Nada indica cuántos ítems necesitan acción, y crear un servicio
recurrente no lleva a nada — el admin tiene que acordarse solo de ir a la
pestaña Series después, luego a invitar clientes por separado, y las reservas
que resultan de que un cliente acepte terminan en Pendientes sin ningún hilo
visible que las conecte con la serie de la que vinieron.

Decisión explícita de Daniel: **alcance = todo el panel admin**, pero
**enfoque = conectar lo que ya existe, no un wizard nuevo**. No se reemplazan
las pestañas por una pantalla de pasos — se le agrega navegación contextual,
contadores y confirmaciones que apunten al siguiente paso.

## Los dos flujos que hoy están desconectados

**Flujo A — servicio recurrente:**
`Servicios` (crear servicio, tipo_agenda=recurrente, config de cobro) →
`Series` (crear serie con ese servicio) → invitar clientes (modal dentro de
Series) → el cliente acepta desde su portal (Mis Series, **no se toca en este
prompt**) → las reservas resultantes aparecen en `Pendientes` para asignar
asesor.

**Flujo B — sesión suelta con confirmación manual:**
`Solicitudes` (cliente propone fecha/hora) → admin confirma → se convierte en
Reserva PENDIENTE → aparece en `Pendientes` para asignar asesor.

Los dos flujos convergen en `Pendientes`, pero hoy nada en `Series` ni en
`Solicitudes` te dice eso ni te lleva ahí.

## Decisiones ya tomadas (no rediscutir)

1. **Cero cambios de backend.** No hay endpoints nuevos, no hay migración.
   Todo lo necesario (conteos, estados) ya se puede sacar de los endpoints
   existentes (`GET /admin/reservas?estado=pendiente`,
   `GET /admin/solicitudes?estado=pendiente`).
2. **No mover los componentes de tab a archivos nuevos.** `SolicitudesTab` y
   `PendientesTab` viven definidos dentro de `PanelAdmin.jsx` (líneas ~1173 y
   ~1517); `SeriesTab`, `GestionServicios`, `ReservasTab`, `SesionesTab` ya
   están en archivos propios. **No refactorizar la ubicación de ninguno en
   este prompt** — mezclar ese refactor con la mejora de UX hace el diff
   imposible de revisar. Si a futuro `PanelAdmin.jsx` amerita partirse en
   archivos, es una tarea aparte.
3. **Agrupar visualmente la barra de pestañas** (mismo estado plano `tab`,
   sin cambiar rutas): un separador visual sutil (texto gris pequeño arriba
   de cada grupo, no un rediseño de navegación) en 3 clusters, en este orden:
   - **Operación diaria**: Sesiones, Pendientes, Solicitudes, Reservas del día
   - **Series recurrentes**: Servicios, Series (Servicios primero — la
     configuración va antes de crear series)
   - **Cuenta**: Usuarios
4. **Badges de conteo** en las pestañas que representan trabajo pendiente de
   acción: `Pendientes (N)` y `Solicitudes (N)`, con N = total de items en
   estado `pendiente` de cada endpoint. Se calculan con un fetch ligero desde
   `PanelAdmin.jsx` al montar el panel, y se refrescan cuando el admin sale de
   esas dos pestañas (no hace falta polling constante — es MVP, no un
   dashboard en vivo). Si el conteo es 0, no se muestra el badge (no
   `Pendientes (0)`, solo `Pendientes`).
5. **CTAs contextuales** que conectan los dos flujos (todos son
   navegación/props nuevos, ninguno cambia lógica de negocio existente):
   - `GestionServicios.jsx`: al guardar con éxito un servicio con
     `tipo_agenda=recurrente`, mostrar banner de éxito con botón **"Crear una
     serie para este servicio →"**. Requiere que `GestionServicios` reciba un
     callback nuevo (ej. `onIrACrearSerie(servicioId)`) que `PanelAdmin`
     resuelve haciendo `setTab('series')` + pasando el `servicioId` a
     `SeriesTab` para preseleccionarlo al abrir `CrearSerieModal`.
   - `SeriesTab.jsx` / `CrearSerieModal.jsx`: al crear una serie con éxito,
     banner con botón **"Invitar clientes ahora →"** que abre
     `InscribirClientesSerieModal` directo para la serie recién creada (hoy
     el admin tiene que cerrar el modal, buscar la fila en la lista y darle
     click a "Invitar" aparte — eliminar ese paso extra).
   - `InscribirClientesSerieModal.jsx`: después de invitar con éxito, agregar
     una nota informativa (no navegación automática, el cliente decide cuándo
     acepta): *"Cuando el cliente acepte la invitación, sus reservas van a
     aparecer en la pestaña Pendientes para asignarles asesor."*
   - `SolicitudesTab` (dentro de `PanelAdmin.jsx`): al confirmar una
     solicitud con éxito, banner con botón **"Ver en Pendientes →"** que hace
     `setTab('pendientes')`.
6. **Nada de esto oculta información existente** — son adiciones (banners,
   badges, botones), no se quita ningún dato ni funcionalidad que ya esté en
   pantalla.

## Fuera de alcance (no tocar en este prompt)

- La pantalla del cliente (`MisSeries.jsx`, portal de "Mis series") — el
  "aceptar" del que habló Daniel es el admin confirmando una Solicitud, no el
  cliente aceptando una invitación. Esa pantalla no se toca.
- Partir `PanelAdmin.jsx` en archivos separados.
- Cualquier endpoint nuevo o cambio de schema — todo el conteo se arma con los
  endpoints que ya existen.
- Un wizard/pantalla de pasos nueva — se descartó explícitamente a favor de
  conectar lo que ya existe.

## Orden sugerido

1. `PanelAdmin.jsx`: agrupar visualmente la barra de tabs + estado de
   conteos (`pendientesCount`, `solicitudesCount`) con su fetch ligero al
   montar y al cambiar de tab.
2. `GestionServicios.jsx` → `SeriesTab.jsx`: CTA "Crear serie para este
   servicio" (preselección de servicio).
3. `SeriesTab.jsx` / `CrearSerieModal.jsx` → `InscribirClientesSerieModal.jsx`:
   CTA "Invitar clientes ahora" abriendo el modal directo tras crear la serie.
4. `InscribirClientesSerieModal.jsx`: nota informativa post-invitación.
5. `SolicitudesTab` (en `PanelAdmin.jsx`): CTA "Ver en Pendientes" tras
   confirmar.
6. Avisar si algún paso resulta más grande de lo esperado (ej. si preseleccionar
   servicio en `CrearSerieModal` requiere tocar su lógica interna de forma no
   trivial) antes de seguir con el siguiente.
