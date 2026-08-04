Antes de nada, lee HANDOFF.md completo.

CONTEXTO: hoy todo usuario creado sin contraseña (`password_hash=NULL`) —
invitado de reserva (`obtener_o_crear_usuario_invitado`), vinculado por un
admin/superadmin sin password (`_vincular_usuario_a_tenant`), o inscrito en
una serie recurrente por un admin — no tiene ninguna forma de entrar a su
cuenta. No existe registro global (se quitó a propósito, ver HANDOFF). Esta
tarea construye el único camino que les queda: reclamar/activar su cuenta
por email, con la identidad visual del tenant correspondiente (logo/color),
no una pantalla ni un correo genérico de plataforma.

DECISIONES YA TOMADAS (no las reabras):
- `Usuario.email` sigue siendo único a nivel global — esto NO cambia. Un
  usuario puede pertenecer a varios tenants con la misma cuenta/contraseña.
- Nuevas columnas en `Usuario`: `acceso_token_hash: Optional[str]` (nunca
  se guarda el token en claro, solo su hash) y
  `acceso_token_expira_en: Optional[datetime]`. Nómbralas genéricas (no
  "activacion_token") porque este mismo mecanismo debería poder reusarse
  el día que se construya "olvidé mi contraseña" — no es parte de esta
  tarea, pero no lo bloquees con un nombre demasiado específico.
- Token: `secrets.token_urlsafe(32)` generado en el backend, se manda el
  valor en claro por URL/email, se guarda solo su hash (sha256) en
  `acceso_token_hash`. Expira a las 48h. Uso único — al activarse
  exitosamente se limpian ambas columnas.
- Al activar la cuenta: `password_hash` se setea (bcrypt, mismo patrón que
  `/auth/register`), `email_verificado=True` (clickear el link ya prueba
  dueño del correo), `es_invitado=False`. La respuesta del endpoint de
  activación debe tener la misma forma que `POST /auth/login`
  (`{token, usuario_id, nombre, rol, tenant_slug, tenant_nombre}`,
  reusa `_resolver_membresia()`) — auto-login inmediato, sin pedir que el
  cliente vuelva a loguearse a mano.
- Puntos que disparan el envío del email de activación (después del
  commit, nunca dentro de la transacción — regla ya existente):
  1. `_vincular_usuario_a_tenant()` (usado por `POST /admin/usuarios/invitar`
     y `POST /superadmin/usuarios/vincular`) — si el usuario resultante
     tiene `password_hash is None` después de la operación, se manda el
     email con el branding del tenant al que se está vinculando. Si el
     usuario YA tenía contraseña (de antes), NO se manda nada — ya puede
     entrar.
  2. `crear_reserva()` cuando el usuario que reserva es invitado nuevo
     (`password_hash is None`). **No mandes un segundo correo aparte** —
     extiende `enviar_email_confirmacion()` para que incluya la sección/CTA
     de activación dentro del mismo correo de confirmación cuando aplique,
     en vez de duplicar envíos.
  3. `inscribir_cliente_en_serie()` cuando el cliente inscrito no tiene
     contraseña — mismo criterio que el punto 1.
- Además de los disparadores automáticos, hay un punto de entrada de
  autoservicio, público y **por tenant**:
  `POST /t/{tenant_slug}/reclamar-cuenta` body `{email}`. Responde
  **siempre el mismo mensaje genérico** sin importar si el email existe,
  si pertenece a ese tenant, o si ya tiene contraseña — solo manda el
  correo cuando las tres condiciones se cumplen (existe + está vinculado
  activo a ESE tenant + `password_hash is None`). Anti-enumeración: no debe
  ser posible distinguir por la respuesta si un email existe o no, ni a
  qué tenant pertenece. Aplica rate limit (mismo patrón `slowapi` que ya
  usa `/reservas/{folio}/publica`).
- Branding: se construye **un solo helper compartido** para renderizar
  correos con logo/color del tenant (usa `tenant.logo_url` /
  `tenant.color_primario`, ya expuestos en `TenantPublicOut`), y se aplica
  a AMBOS correos en esta misma tarea: el nuevo de activación Y el
  retrofit de `enviar_email_confirmacion()` (hoy genérico, sin branding —
  hallazgo ya documentado en HANDOFF). No construyas el helper solo para
  uno y dejes el otro sin tocar.
- Frontend: páginas nuevas bajo la ruta pública del tenant (mismo patrón
  que `/t/:tenantSlug`, no bajo `/login` que hoy es global sin contexto de
  tenant):
  - `/t/:tenantSlug/reclamar` — formulario de un campo (email), branding
    del tenant, mensaje genérico tras enviar (nunca confirma si existía).
  - `/t/:tenantSlug/activar?token=...` — formulario de nueva
    contraseña + confirmar, branding del tenant. Token inválido/expirado
    → mensaje claro con opción de volver a `/reclamar` para pedir uno
    nuevo. Al activarse: guarda el token JWT en `sessionStorage` igual que
    `Login.jsx` y navega por rol (misma lógica ya existente en `App.jsx`).

ALCANCE — antes de codear, propón (y espera aprobación):
- Migración exacta de las 2 columnas nuevas en `Usuario`.
- Rutas exactas de los 3 endpoints nuevos (`reclamar-cuenta`, `activar-cuenta`,
  y si hace falta un `GET` de validación previa del token antes de mostrar
  el formulario, o si el `POST` de activar ya maneja el caso de token
  inválido/expirado con un error claro sin necesitar un endpoint aparte).
- Forma exacta del helper de plantilla de email con branding — revisa cómo
  está armado `enviar_email_confirmacion()` hoy (`_smtp_cfg`, sección de
  services_v2_2.py) antes de proponer la firma del helper nuevo, para no
  duplicar la lógica de conexión SMTP que ya existe.
- Cómo se referencia el link de reclamar cuenta desde `Login.jsx` — hoy esa
  pantalla no tiene contexto de tenant (`/login` es global). Si el usuario
  llega directo a `/login` sin haber pasado por `/t/:tenantSlug` antes, no
  hay forma de saber qué tenant mostrarle en el link de reclamar/activar.
  Propone cómo resolver esto (¿usar `sessionStorage.tenantSlug` si existe
  y ocultar el link si no hay ninguno guardado? ¿otra idea?) — no lo dejes
  sin resolver ni asumas un default.
- Qué pasa si `inscribir_cliente_en_serie()` o `_vincular_usuario_a_tenant()`
  fallan en enviar el correo (SMTP caído, etc.) — mismo criterio que ya
  existe para otros efectos externos: no debe tumbar la operación principal
  (la reserva/inscripción/vinculación ya se guardó), solo logear el error.

ORDEN: propuesta primero (esperar aprobación) → migración (columnas en
`Usuario`) → backend (helper de email con branding + retrofit de
`enviar_email_confirmacion` + endpoints de reclamar/activar + triggers en
los 3 puntos ya listados) → regenerar openapi.json/schema.ts → frontend
(`/t/:tenantSlug/reclamar`, `/t/:tenantSlug/activar`, link desde `Login.jsx`)
→ un commit por pieza, mensajes descriptivos.

Antes de cada pieza, si algo no cuadra con esto o con HANDOFF.md, señálalo
antes de codear en vez de asumir.
