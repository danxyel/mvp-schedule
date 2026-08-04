# PROMPT J — Método de envío de correo: SMTP o API (Resend), toggle por tenant

## Contexto

Render bloquea tráfico saliente a puertos SMTP (25/465/587) en sus **free web
services** desde septiembre 2025. El fix de resolución IPv4 (`_forzar_resolucion_ipv4`,
ya en producción) descartó el problema de IPv6, pero el timeout real confirmado en
logs es el firewall de Render descartando el paquete — confirmado con Daniel: el
backend está en plan **Free** de Render y el tenant afectado usa puerto 587 (Gmail).

Daniel no quiere subir de plan todavía (cuesta dinero) ni perder la configuración
SMTP por tenant que ya existe (`Tenant.smtp_config`, EncryptedJSON) — varios tenants
en producción sí tendrán su propio SMTP funcionando normalmente (planes pagados o
providers que no usan esos puertos bloqueados). Lo que se necesita es una alternativa
gratuita **para pruebas / tenants sin SMTP propio**, sin descartar el modelo actual.

**Limitación aceptada explícitamente por Daniel:** la cuenta de Resend ya existe
pero **no tiene dominio propio verificado** (decisión: seguir sin comprar dominio
por ahora). Esto activa el modo *sandbox* de Resend, con dos restricciones que no
se pueden evitar desde el código:
1. El remitente (`from`) solo puede ser la dirección fija `onboarding@resend.dev`
   — no se puede usar una dirección propia hasta verificar un dominio.
2. El destinatario (`to`) solo puede ser el correo con el que se registró la
   cuenta de Resend (el Gmail de Daniel) — cualquier otro destinatario lo
   rechaza la API. Esto significa que, mientras siga en sandbox, `metodo="api"`
   **no puede entregar correos reales a clientes de un tenant** — solo sirve
   para probar que el flujo de código funciona (el correo llegará siempre al
   Gmail de Daniel, sin importar a quién iba dirigido realmente). No es un bug
   a corregir en este prompt — es una limitación de cuenta, aceptada para esta
   fase de pruebas. El día que se verifique un dominio, ambas restricciones se
   levantan solas sin tocar código (Resend las quita automáticamente al
   verificar).

## Decisión de arquitectura (ya tomada, no discutir de nuevo)

1. **No hay migración de base de datos.** `smtp_config` sigue siendo el mismo
   `EncryptedJSON` en `Tenant`. Gana una clave nueva dentro del mismo dict:
   `metodo: "smtp" | "api"` (default `"smtp"` si no viene, para no romper tenants
   ya configurados).
2. Cuando `metodo == "api"`, el correo se manda por **Resend** (HTTP API,
   `https://api.resend.com/emails`) usando credenciales **globales** por variable
   de entorno — **no** por tenant:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` — **por ahora, mientras no haya dominio verificado, debe
     ser literalmente `onboarding@resend.dev`** (es la única dirección que Resend
     permite sin dominio propio; usar cualquier otra devuelve error de la API).
     El día que Daniel verifique un dominio, este valor cambia a una dirección
     propia (ej. `notificaciones@dominio-daniel.com`) — sin tocar código, es
     solo la variable de entorno en Render.
   - Un solo dominio verificado por Daniel Consultoría (cuando exista); ningún tenant necesita su
     propia cuenta Resend ni verificar DNS. Esto es intencional: verificar dominio
     propio por tenant no es viable para tenants sin equipo técnico (caso real:
     "students"). Motivo explícito de Daniel: sirve para pruebas ahora; en
     producción cada cliente configurará su propio SMTP, o en su defecto
     "se le renta el servicio" (Daniel sigue mandando por su cuenta Resend con el
     toggle en `api`, como servicio adicional) — el toggle existe justo para
     cubrir ambos casos sin tener que rediseñar nada después.
   - `From`: `f'{tenant.nombre} <{RESEND_FROM_EMAIL}>'`
   - `Reply-To`: `cfg.get("from_email")` del tenant si está configurado (así el
     cliente final puede responder directo al tenant aunque el correo salga
     técnicamente por el dominio de Daniel).
3. **No se borra ni se oculta nada del config SMTP existente** al cambiar a
   `api`. `host/port/user/password/tls/ssl` se conservan tal cual en el JSON;
   el toggle solo decide cuál rama de envío se usa. Volver a `smtp` no debe
   requerir volver a capturar credenciales.
4. `console: true` sigue ganando sobre ambos métodos — si está activo, solo
   loguea, sin importar `metodo`. No cambia esa regla.
5. Fallo al mandar por Resend (API key faltante, error HTTP, etc.) se maneja
   igual que cualquier fallo de `_enviar_smtp` hoy: log + no rompe la
   transacción que lo disparó (ya está post-commit en un try/except en cada
   call site — no tocar esa parte).

## Alcance técnico sugerido (opencode decide el detalle de implementación)

### Backend (`app/services_v2_2.py`)
- Nueva función `_enviar_resend(tenant, destinatario_email, asunto, texto_plano, cuerpo_html)`
  usando `httpx` (ya es dependencia del proyecto, no agregar SDK nuevo —
  `requirements.txt` línea 39). Llamada síncrona (`httpx.post(...)`, no async —
  el resto de `_enviar_smtp` tampoco lo es), timeout sugerido 15s (mismo valor
  que SMTP).
- Payload Resend (ver su API — `POST /emails` con header
  `Authorization: Bearer {RESEND_API_KEY}`): `from`, `to`, `reply_to` (opcional),
  `subject`, `html`, `text`.
- La función pública que ya llaman `enviar_email_confirmacion`,
  `enviar_email_invitacion_serie`, `enviar_email_activacion` (y cualquier otra)
  **no cambia de firma** — mismo nombre, mismos argumentos. El branching por
  `metodo` va adentro, antes de armar el `MIMEMultipart` (Resend no usa MIME,
  espera JSON), así los callers no se enteran del cambio.
- Si `metodo == "api"` pero falta `RESEND_API_KEY` en el entorno: log de error
  claro (`"RESEND_API_KEY no configurado, correo omitido"`) y `return`, mismo
  patrón que el `if not host: return` que ya existe para SMTP sin configurar.

### Backend — schemas
- Repasar si `TenantAdminOut`/`TenantAdminUpdate` en `schemas_v2_2.py` tratan
  `smtp_config` como `dict` genérico (así se dejó documentado en HANDOFF, fila
  "Regenerados docs/openapi.json..." 2026-07-31) — si es así, `metodo` no
  requiere cambio de schema. Si en algún punto se volvió tipado, avisar antes
  de tocarlo.

### Frontend (`frontend/src/components/superadmin/ConfigSmtpModal.jsx`)
- Selector de método arriba del formulario (radio o `<select>`, 2 opciones:
  "SMTP propio" / "API centralizada (Resend) — pruebas"). Cambia `form.metodo`.
- Los campos SMTP (host/port/user/password/tls/ssl) se mantienen **visibles**
  cuando `metodo="api"` (no se ocultan) pero se pueden deshabilitar visualmente
  para dejar claro que no se están usando mientras el método sea `api` — no
  perder lo ya capturado.
- `from_email`/`from_name` siguen aplicando en ambos métodos (Reply-To / nombre
  visible del remitente).
- Guardar sigue mandando `smtp_config` completo por `PATCH
  /superadmin/tenants/{tenant_id}` (mismo endpoint, mismo merge en
  `actualizar_tenant()` que ya conserva lo no enviado).

## Variables de entorno nuevas (Daniel las agrega en Render, no en código)

```
RESEND_API_KEY=...
RESEND_FROM_EMAIL=onboarding@resend.dev   # cambiar cuando exista dominio verificado
```

Sin estas dos variables, cualquier tenant con `metodo="api"` simplemente no
manda correo (mismo comportamiento silencioso ya documentado, con log). Con
`onboarding@resend.dev` y sin dominio, recuerda que solo entrega al Gmail de
Daniel — ver limitación de sandbox arriba.

## Fuera de alcance (no tocar en este prompt)

- No se sube el plan de Render.
- No se migra ningún tenant existente de `smtp` a `api` automáticamente —
  default siempre `smtp` si `metodo` no viene en el JSON guardado.
- No se agrega el SDK oficial `resend` de PyPI — usar `httpx` directo contra
  la API REST.

## Orden sugerido

1. Backend: `_enviar_resend()` + branching en la función pública de envío.
2. Regenerar `docs/openapi.json` / `frontend/src/api/schema.ts` (probablemente
   sin cambios reales si `smtp_config` sigue siendo `dict` genérico — confirmar).
3. Frontend: toggle en `ConfigSmtpModal.jsx`.
4. Avisar a Daniel qué variables de entorno faltan por agregar en Render antes
   de poder probar `metodo="api"` en producción.
