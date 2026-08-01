# Validación funcional — Sprint 1
> Generado 2026-07-31. Correr manualmente contra `localhost:8000` (Swagger) y `localhost:5173` (frontend) antes de dar Sprint 1 por cerrado.

Marca cada casilla solo después de probarlo en vivo, no por lectura de código.

## 1.1 / 1.2 — Registro de usuario

- [ ] `POST /auth/register` con email nuevo → 201/200, devuelve token, usuario puede loguearse después con esas credenciales.
- [ ] Repetir el mismo email → 409 "Ya existe una cuenta con ese email".
- [ ] Frontend: Registro.jsx → llenar formulario, passwords no coinciden → error visible sin llamar al backend.
- [ ] Frontend: registro exitoso → navega según rol (cliente → SeleccionServicio).
- [ ] **Caso roto conocido:** invitar un asesor desde el panel admin y luego intentar registrarse con ese mismo email → hoy da 409 y la persona nunca puede entrar. Confirmar que sigue roto (para verificar el fix después).

## 1.9 / 1.10 — Gestión de usuarios

- [ ] Admin invita usuario nuevo (rol asesor) → aparece en la tabla de Usuarios.
- [ ] Admin cambia rol de un usuario existente → refleja el nuevo rol al instante.
- [ ] Admin desvincula un usuario → desaparece de la lista activa (o se marca inactivo).
- [ ] **Caso a probar:** como único admin del tenant, intenta cambiarte tu propio rol a "cliente" o desvincularte a ti mismo. Hoy el sistema lo permite sin avisar — confirmar que es un problema real antes/después del fix.
- [ ] Cliente o asesor (no admin) intenta pegarle a `/admin/usuarios` directamente → 403.

## 5.1 / 5.2 — Horarios y servicios del asesor

- [ ] Crear horario para un asesor (día + hora inicio/fin) → aparece en su panel.
- [ ] Crear un horario que se traslapa con uno existente del mismo asesor/día → hoy no hay validación, se crea igual. Confirmar.
- [ ] Eliminar un horario → desaparece.
- [ ] Asignar un servicio a un asesor con precio/duración custom → se refleja en disponibilidad de ese servicio.
- [ ] Desasignar servicio → el asesor deja de aparecer como opción para ese servicio.
- [ ] Intentar asignar el mismo servicio dos veces al mismo asesor → 409.

## 5.3 — Bloqueos/vacaciones del asesor

- [ ] Crear bloqueo con `fecha_fin` anterior a `fecha_inicio` → 422 (esto ya está validado en el schema, confirmar que el error se ve bien en frontend).
- [ ] Crear bloqueo de tipo "global" con `entidad_id` → 422.
- [ ] **Caso a probar:** con una sesión ya confirmada en el calendario de un asesor, créale un bloqueo que cubra esa fecha. Hoy no se cancela ni se avisa a los clientes con reserva — confirmar que el cliente sigue viendo su reserva como si nada, y anota si eso es aceptable para el piloto con SIMAL o hay que resolverlo antes.

## 11.1 — Email de confirmación SMTP

### Paso 0 — Cómo llegar (configurar SMTP desde la pantalla nueva)

> Pantalla agregada 2026-07-31 (commit `9b92a56`): configuración SMTP por tenant, separada del modal "Editar tenant". Antes no había forma de configurarlo y por eso el checklist de abajo no se podía probar.

- [ ] Loguea como superadmin (`mail@mail.com`) → Gestión de Tenants.
- [ ] Junto a cada fila hay un botón **Email** con un punto indicador: verde = "Email configurado", gris = "Email sin configurar". Antes de configurar nada, SIMAL debe verse con punto gris.
- [ ] Click en **Email** → abre un modal nuevo (no el de "Editar") con campos: host*, port (default 587), user, password (placeholder "Dejar vacío para no cambiar la contraseña guardada"), from_email, from_name, TLS (default on), SSL (default off), Modo prueba (console).
- [ ] Llena host + los demás y guarda → el modal se cierra y el punto pasa a verde en esa fila (viene de `smtp_configurado` en la respuesta del PATCH).
- [ ] **Write-only:** vuelve a abrir el modal → el campo password aparece vacío (nunca se prellena). Guarda solo cambiando `from_name` → no se pierde la contraseña guardada (el backend hace merge).
- [ ] **Editar solo un campo sin re-ingresar el resto:** abre el modal de un tenant ya configurado → el formulario viene precargado con host, port, user, from_email, from_name y los checkboxes tls/ssl/console tal como estaban guardados. Cambia únicamente `from_name`, guarda sin tocar nada más → los demás valores (incluyendo tls/ssl/console) se conservan tal como estaban.
- [ ] Con "Modo prueba" activado, el correo solo se registra en los logs del backend (`[EMAIL (console)]`), no se envía de verdad.
- [ ] La respuesta del GET/PATCH de tenants devuelve `smtp_config` con todos sus campos excepto `password` (sigue siendo write-only) — revisa en la pestaña Network de DevTools que `password` nunca aparezca.

### Checklist de envío (requiere el paso 0 hecho)

- [ ] Configurar `tenant.smtp_config` con credenciales reales (o `"console": true` para probar sin enviar de verdad) y crear una reserva → confirmar que llega el correo (o se loguea en consola) con folio, código, fecha y asesor correctos.
- [ ] Tenant sin `smtp_config` → la reserva se crea igual, sin error visible al cliente (el email se omite silenciosamente, solo queda en logs).
- [ ] Forzar un error SMTP (host inválido) → la reserva igual queda confirmada, el error solo aparece en logs del backend, nunca se le muestra al cliente ni revierte la reserva.
- [ ] Registrar un cliente con nombre `<b>test</b>` o similar y generar su confirmación → revisar si el HTML del correo lo interpreta como etiqueta (inyección) o lo muestra como texto plano. Hoy no hay escape, así que probablemente se rompe el layout — confirmar antes/después del fix.

## 9.6 — Pago local

- [ ] Registrar pago efectivo en una reserva pendiente → estado pasa a completado, aparece en bitácora.
- [ ] Registrar pago transferencia con referencia → se guarda la referencia.
- [ ] Intentar pagar una reserva ya pagada → 409.
- [ ] Cliente (no staff) intenta pegarle al endpoint → 403.
- [ ] Sin token → 401.

## Fix 2026-07-31 — Selección de tenant para clientes sin membresía

> Salido de validación manual: un cliente que se auto-registra vía `POST /auth/register` (sin invitación previa) queda con `tenant_slug=null` y `App.jsx` lo mandaba a `SeleccionServicio`, que llamaba `GET /api/v2/{tenant_slug}/servicios` con slug nulo → 404 "Tenant no encontrado". No existía pantalla para elegir tenant.

1. Registra un cliente nuevo por primera vez, sin invitación previa → debe aparecer la pantalla de selección de tenant, no un error.
2. Elige un tenant → debe cargar `SeleccionServicio` con los servicios de ese tenant.
3. Un admin/asesor que hace login normal (ya tiene membresía) NO debe ver esta pantalla — su `tenant_slug` ya viene resuelto, sigue directo a su panel.
4. Si no hay ningún tenant activo, la pantalla debe mostrar un estado vacío razonable, no un error feo.

## Fix 2026-07-31 — `utcToOffset` en FlujReserva (fecha_hora_inicio con offset correcto)

> Bug crítico: `utcToOffset()` tomaba los dígitos de `date.toISOString()` (siempre UTC) y les concatenaba el offset local sin desplazar el reloj. Cualquier slot en un timezone distinto a UTC+0 se enviaba desfasado por el valor del offset (ej. 6 horas y hasta un día distinto en timezones negativos). El fix convierte el reloj antes de generar el ISO.

- [ ] Elige un slot que se muestre a las **18:00 hora local**, confirma la reserva y verifica en el backend/BD que `Sesion.fecha_hora_inicio` corresponde exactamente a las 18:00 local (no a otra hora ni otro día).
- [ ] Con un slot que tiene `sesion_existente_id` (sesión del calendario): el POST ya no debe rechazar con `horario_incongruente` ni `franja_ocupada` — antes el desfase hacía que el horario enviado no coincidiera con el de la sesión.
- [ ] Con un slot sin `sesion_id` (el backend crea la sesión): la sesión creada debe quedar a la hora exacta que el cliente vio, no una hora desplazada.
- [ ] Probado desde un navegador en un timezone distinto a UTC-6: la reserva aterriza en el mismo instante que el slot mostrado (el reloj se desplaza con el offset real del navegador y el sufijo usa ese mismo offset).

## Fix 2026-07-31 — Reagendar sin offset hardcodeado (PanelAdmin.jsx)

> Bug: `guardarReagendar()` armaba `nueva_fecha_hora_inicio` con `-06:00` fijo en vez del offset real del navegador. En un navegador fuera de UTC-6 el reagendamiento aterrizaba desfasado respecto a lo seleccionado en el formulario. Fix: usa `getLocalOffset()` (helper compartido en `src/utils/fechas.js`, se migraron las copias duplicadas de `CalendarioDisponibilidad` y `HorariosAsesor`).

- [ ] Reagenda una sesión y confirma que la fecha/hora que queda en `Sesion.fecha_hora_inicio` corresponde **exactamente** a lo que se seleccionó en el formulario (fecha + hora del modal), no desfasada ni en otro día.
- [ ] Probado desde un navegador con timezone distinto a UTC-6: reagendar un slot a las 10:00 local → en DB queda exactamente 10:00 local (el offset real del navegador acompaña el reloj local del `<input type="date">`/`<input type="time">`).
- [ ] El campo `Sesion.fecha_hora_inicio` en la tabla de sesiones del panel muestra la nueva fecha/hora correcta tras reagendar, y la reserva asociada conserva su folio/estado.

## Notas de Daniel (mobile) — 4 fixes 2026-07-31

> Salieron de probar la app en pantallas chicas (375px/390px) y del flujo de invitar usuarios. Cada uno con su commit: `bafe3fa` (header), `531e56f` (modal común), `f00e990` (contraseña inicial), `3fe9190` (min-w-0 tablas).

### Tarea 1 — Header responsive

- [ ] A 375px y 390px, con el nav del cliente ("← Servicios", "Calendario", "Mis Reservas") y del admin ("Panel", "Calendario"), el header no se desborda horizontalmente; si no cabe, el grupo usuario+logout baja a segunda fila.
- [ ] En mobile se ve un círculo con la inicial del usuario en vez del nombre completo; en desktop sigue el nombre completo.
- [ ] En desktop (> 640px) el header se ve igual que antes (nombre visible, una sola fila).

### Tarea 2 — Modal compartido `common/Modal.jsx`

- [ ] Abrir cualquier modal en mobile (nuevo/editar servicio, invitar usuario, horarios del asesor, nuevo/editar tenant, cancelar reserva, registrar pago local, reagendar): sale como bottom sheet a ancho completo, con esquinas redondeadas arriba y scroll interno si el contenido es más alto que la pantalla. Ningún botón de la parte inferior queda fuera de alcance.
- [ ] En desktop el mismo modal se ve centrado como antes (los 7 modales).
- [ ] El botón ✕ del header cierra el modal (equivale a "Cancelar"/"No, volver").
- [ ] En el formulario de Nuevo/Editar servicio, los campos Duración/Cupo mínimo/Cupo máximo/Moneda apilados en mobile (1 columna), 2 columnas en `sm`, 4 en `md`.
- [ ] En Reagendar, fecha y hora en columna en mobile, en fila en `sm+`.

### Tarea 3 — Contraseña inicial al invitar

- [ ] Admin abre Usuarios → Invitar usuario: aparece el campo "Contraseña inicial (opcional)" con ayuda "mínimo 8 caracteres".
- [ ] Invitar **con** contraseña → el invitado puede loguearse de inmediato con ese email+contraseña y entra a su rol (sin pasar por registro).
- [ ] Invitar **sin** contraseña → comportamiento anterior: el invitado se registra solo con su email.
- [ ] Invitar con contraseña a un email que ya se registró por su cuenta → error claro (422), no se sobrescribe su contraseña.
- [ ] Invitar el mismo email dos veces en el mismo tenant → 409 "ya está vinculado".

### Tarea 0 — Tablas no desbordan la página (min-w-0)

- [ ] A 375px, la tabla de Tenants (superadmin) scrollea horizontalmente dentro de su tarjeta; la página completa no se desplaza y las columnas Nombre/Slug no quedan cortadas sin scroll posible.
- [ ] Igual en Usuarios, Servicios y Panel admin (Sesiones y Reservas): scroll interno, página estática.
- [ ] En desktop (> 1024px) las mismas tablas se ven exactamente igual que antes (ancho completo, sin scroll interno visible).

## Regresión general

- [ ] `npm run build` en `frontend/` corre limpio en tu máquina (no lo pude confirmar desde el sandbox — ver nota de la sesión anterior).
- [ ] Login de los 3 usuarios de prueba (superadmin, admin SIMAL, y un asesor si ya existe) sigue funcionando después de todos los cambios de Sprint 1.
- [ ] `git status` limpio, sin diffs fantasma de line endings.
