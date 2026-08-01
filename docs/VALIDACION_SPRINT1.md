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

## Notas de Daniel (mobile) — 3 fixes 2026-07-31

> Salieron de probar la app en pantallas chicas (375px/390px) y del flujo de invitar usuarios. Cada uno con su commit: `bafe3fa` (header), `531e56f` (modal común), `f00e990` (contraseña inicial).

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

## Regresión general

- [ ] `npm run build` en `frontend/` corre limpio en tu máquina (no lo pude confirmar desde el sandbox — ver nota de la sesión anterior).
- [ ] Login de los 3 usuarios de prueba (superadmin, admin SIMAL, y un asesor si ya existe) sigue funcionando después de todos los cambios de Sprint 1.
- [ ] `git status` limpio, sin diffs fantasma de line endings.
