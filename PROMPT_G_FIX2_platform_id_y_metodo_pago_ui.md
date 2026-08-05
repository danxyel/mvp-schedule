Antes de nada, lee HANDOFF.md (filas de PROMPT_G y sus fixes) y este archivo
completo. Son dos fixes independientes, un commit por cada uno.

## Fix 1 — falta `platform_id=mp` en la URL de autorización OAuth

Daniel probó "Conectar con MercadoPago" desde el panel y MercadoPago le
respondió "la aplicación no está disponible para su uso" en la pantalla de
autorización.

Causa confirmada contra la documentación oficial de MercadoPago
(`docs/subscriptions/additional-content/security/oauth/creation`): la URL de
autorización esperada es

```
https://auth.mercadopago.com/authorization?client_id=APP_ID&response_type=code&platform_id=mp&state=RANDOM_ID&redirect_uri=...
```

Nuestro `_mp_url_autorizacion()` (`app/services_v2_2.py`) arma la URL sin el
parámetro `platform_id=mp`:

```python
def _mp_url_autorizacion(tenant_id: int) -> str:
    client_id, _, redirect_uri = _mp_app_credentials()
    state = generar_mp_state(tenant_id)
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return f"{_MP_AUTH_URL}?" + "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
```

Fix: agregar `"platform_id": "mp"` al diccionario `params`. No cambia nada
más de la función — mismo `state` firmado, mismo `redirect_uri`.

Verificación: después del fix, Daniel debe poder llegar a la pantalla real
de autorización de MercadoPago (login + consentimiento), no al error de "app
no disponible". Confirmar con él antes de dar por cerrado — no puedes
probarlo sin sus credenciales conectadas.

## Fix 2 — no existe forma de activar pago en línea para un servicio

Hueco real en el alcance original de PROMPT_G, no un bug de código: nunca se
agregó una forma de poner un servicio o tenant en método de pago `online`.

`crear_reserva()` decide el método así:
```python
metodo = payload.metodo_pago.value if payload.metodo_pago else (
    servicio.metodo_pago.value if servicio.metodo_pago else tenant.metodo_pago_default.value
)
```
- `FlujReserva.jsx` nunca manda `metodo_pago` en el payload (confirmado, cero
  referencias) — así que nunca depende del cliente.
- `GestionServicios.jsx` nunca expone un campo para `servicio.metodo_pago` —
  confirmado, el formulario de servicio solo tiene el checkbox
  `pago_requerido`, nada de método.
- `GestionTenants.jsx` tampoco expone `tenant.metodo_pago_default` en
  ninguna parte.

Resultado: `tenant.metodo_pago_default` se queda en su default de modelo
(`LOCAL`) para siempre, en todos los tenants, sin ninguna forma de
cambiarlo desde la UI. Todo el mecanismo de checkout que construyó PROMPT_G
nunca se activa para el flujo de reserva normal (sí funciona para el botón
de auto-compra post-asignación y para paquetes, porque esos endpoints nuevos
no dependen de este campo — usan `iniciar_checkout()`/`crear_preferencia_paquete()`
directo bajo demanda del cliente).

Fix: agregar el selector de `metodo_pago_default` al tenant, en el mismo tab
"Pagos" donde ya vive "Conectar con MercadoPago" (`MercadoPagoTab.jsx`) —
tiene sentido que viva ahí, junto al estado de conexión. Opciones del select:
`local` (default, como hoy) y `online`. Deshabilita la opción `online` en la
UI (o muestra una advertencia) si el tenant todavía no tiene MercadoPago
conectado (`pago_configurado=false`) — no tiene caso ofrecer `online` sin
cuenta conectada, el checkout fallaría en `_mp_access_token()` con
`mp_no_conectado`.

Backend: revisa si ya existe un endpoint PATCH que permita actualizar
`tenant.metodo_pago_default` (probablemente el genérico de actualizar tenant
en `superadmin_router`, o el de admin del propio tenant si existe uno
separado) — si no existe ninguno, agrégalo (`requiere_admin`, mismo patrón
que el resto de esta tarea). No agregues el campo `metodo_pago` a
`GestionServicios.jsx` en este prompt — el override por servicio existe en
el modelo pero no lo pidió Daniel; si algún día un tenant necesita mezclar
métodos por servicio, es una tarea aparte.

Verificación: cambiar `metodo_pago_default` a `online` en un tenant con
MercadoPago conectado, reservar un servicio simple con `pago_requerido=true`
sin pasar por invitación de serie ni auto-compra → la respuesta de
`POST /reservas` debe incluir un `checkout.url` de MercadoPago.

## Orden

1. Fix 1 primero (una línea, desbloquea que Daniel pueda seguir probando la
   conexión OAuth ahora mismo).
2. Fix 2 después — backend (endpoint si falta) → regenerar
   openapi.json/schema.ts → frontend (`MercadoPagoTab.jsx`).

Un commit por fix, mensajes descriptivos.
