# MVP Schedule — Documento Maestro de Contexto
> Versión: 2.2 · Última actualización: 2026-08-04
> Este archivo es la fuente de verdad para cualquier agente, sesión de Claude, o desarrollador que tome el proyecto.
> **Leer antes de tocar cualquier archivo.**

---

## 1. QUÉ ES ESTE PROYECTO

Sistema de agendamiento multitenant construido para **SIMAL Corporativo** (cliente activo de DANIEL. Consultoría Boutique) como MVP comercial. El sistema permite a empresas de servicios gestionar asesores, sesiones, reservas y pagos desde una sola plataforma.

**Propietario del producto:** Daniel Vázquez (DANIEL. Consultoría Boutique)
**Cliente piloto:** SIMAL Corporativo — firma B2B de seguridad y cumplimiento laboral, Polanco CDMX
**Repositorio:** https://github.com/danxyel/mvp-schedule
**Base de datos:** PostgreSQL en Neon (cloud)

---

## 2. STACK TÉCNICO

### Backend
- **Framework:** FastAPI 0.115 + Uvicorn
- **ORM:** SQLAlchemy 2.0 (mapped_column, Mapped)
- **DB:** PostgreSQL 18 en Neon · driver psycopg2
- **Auth:** JWT HS256 via PyJWT + bcrypt
- **Encriptación:** Fernet (cryptography) para secrets del tenant
- **Jobs:** APScheduler (NO Celery — decisión deliberada para MVP)
- **Timezone:** zoneinfo + tzdata · todas las fechas UTC aware internamente
- **Validación:** Pydantic v2

### Frontend
- **Framework:** React + Vite
- **Estilos:** Tailwind CSS v4 (via @tailwindcss/vite)
- **Cliente HTTP:** openapi-fetch tipado desde docs/openapi.json
- **Auth:** JWT en sessionStorage (no localStorage)

### Infraestructura
- **DB:** Neon PostgreSQL (connection pooling habilitado)
- **Deploy pendiente:** Railway o Render
- **Variables de entorno:** .env con DATABASE_URL, JWT_SECRET_KEY, TENANT_SECRETS_KEY (Fernet base64), CORS_ORIGINS, ENV (ver sección 11); frontend con VITE_API_URL

---

## 3. ESTRUCTURA DE ARCHIVOS

```
mvp-schedule/
├── app/
│   ├── main.py              # Punto de entrada FastAPI + endpoint /auth/login
│   ├── database.py          # Engine SQLAlchemy + get_db()
│   ├── dependencies.py      # get_current_user, get_current_tenant, crear_token
│   ├── models_v2_2.py       # Todos los modelos SQLAlchemy
│   ├── schemas_v2_2.py      # Todos los schemas Pydantic
│   ├── services_v2_2.py     # Lógica de negocio (concurrencia, reservas, etc.)
│   ├── router_v2_2.py       # Todos los endpoints FastAPI
│   └── tasks.py             # Jobs APScheduler
├── db/
│   └── migracion_v2_2_postgres.sql  # Migración con constraints y EXCLUDE
├── docs/
│   ├── openapi.json         # Spec exportado (regenerar con curl después de cambios)
│   └── API-CONTRACT.md      # Contrato de API para Stitch y opencode
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Navegación por rol, estado global
│   │   ├── api/schema.ts    # Cliente tipado (regenerar con npx openapi-typescript)
│   │   └── components/
│   │       ├── Login.jsx
│   │       ├── SeleccionServicio.jsx
│   │       ├── CalendarioDisponibilidad.jsx
│   │       ├── FlujReserva.jsx
│   │       ├── MisReservas.jsx
│   │       ├── DetalleReserva.jsx
│   │       ├── admin/
│   │       │   ├── PanelAdmin.jsx      # Tabs: Sesiones, Reservas del día, Servicios
│   │       │   └── GestionServicios.jsx
│   │       └── superadmin/
│   │           └── GestionTenants.jsx
├── AGENTS.md                # Instrucciones para opencode
├── HANDOFF.md               # Este archivo
├── requirements.txt
└── .env                     # NO commitear
```

---

## 4. MODELOS CLAVE

### Jerarquía de datos
```
Tenant (empresa cliente)
  └── Servicio (tipo de servicio: consultoría, capacitación, etc.)
        └── Sesion (instancia: "consultoría del lunes 10am")
              └── Reserva (inscripción de un cliente a esa sesión)

Tenant
  └── UsuarioTenant (vincula Usuario con Tenant + rol)
        └── HorarioDisponibilidad (horario laboral del asesor)
        └── AsesorServicio (servicios que atiende el asesor)
```

### Enums críticos (NO inventar valores fuera de estos)
```python
EstadoReserva: pendiente | en_espera | confirmada | cancelada | no_show | completada
EstadoSesion:  abierta | confirmada | llena | cancelada | completada
EstadoPago:    pendiente | completado | reembolsado | exento
RolUsuario:    cliente | asesor | admin | superadmin
TipoAgenda:    individual | grupal | recurrente
Modalidad:     presencial | virtual | hibrida
MetodoPago:    online | local | registro
```

---

## 5. REGLAS DE ARQUITECTURA (NO violar)

1. **Una transacción por operación.** `services_v2_2.py` nunca hace commit. El router hace commit y rollback.
2. **Efectos externos fuera de la transacción.** Email, Google Calendar y Stripe van DESPUÉS del commit, nunca dentro.
3. **Tres capas de concurrencia:**
   - `pg_advisory_xact_lock` al inicio de crear_reserva
   - `SELECT ... FOR UPDATE` antes de tocar cupo
   - `UPDATE ... WHERE inscritos < cupo_maximo` atómico
4. **`inscritos` es fuente de verdad.** No hacer COUNT(*) para verificar cupo — usar el campo directamente.
5. **Todas las fechas UTC aware.** Usar `utcnow()` del modelo, nunca `datetime.utcnow()`. Rechazar datetimes sin offset en la frontera de entrada.
6. **Timezone se resuelve con precedencia:** sede > tenant > "America/Mexico_City"
7. **Sin inferencias ambiguas.** Si un campo puede significar dos cosas, agregar un campo explícito.
8. **Bitácora en la misma transacción.** `registrar_bitacora()` no hace commit.
9. **Aprobación de schema antes de implementar.** Cualquier cambio a modelos se propone aquí antes de codificar.

---

## 6. AUTENTICACIÓN Y ROLES

### Endpoint de login
```
POST /auth/login
Body: { email, password }
Respuesta: { token, usuario_id, nombre, rol, tenant_slug, tenant_nombre }
```

### Jerarquía de roles
```
superadmin > admin > asesor > cliente
```

### Navegación por rol (App.jsx)
- `superadmin` → GestionTenants → puede entrar a cualquier tenant como admin
- `admin` → PanelAdmin de su tenant
- `asesor` → PanelAdmin de su tenant (misma vista que admin)
- `cliente` → SeleccionServicio → CalendarioDisponibilidad

### Token
- JWT HS256 firmado con `JWT_SECRET_KEY`
- Guardado en `sessionStorage` (no localStorage)
- Incluye `sub` = usuario_id como string

---

## 7. ERRORES DE NEGOCIO

El router traduce `ReservaError` a 4xx con este formato:
```json
{ "codigo": "cupo_agotado", "mensaje": "La sesión ya no tiene lugares disponibles" }
```

| Código | HTTP | Cuándo |
|--------|------|--------|
| `cupo_agotado` | 409 | UPDATE atómico no afectó filas |
| `franja_ocupada` | 409 | Asesor no disponible en ese horario |
| `reserva_duplicada` | 409 | Índice único parcial disparado |
| `conflicto_concurrencia` | 409 | StaleDataError de optimistic locking |
| `sesion_cerrada` | 409 | Estado no acepta inscripciones |
| `sesion_no_encontrada` | 404 | |
| `fuera_de_politica` | 400 | Cancelación fuera de ventana |
| `estado_no_cancelable` | 400 | |
| `identidad_requerida` | 401 | |
| `permiso_denegado` | 403 | |

---

## 8. ESTADO ACTUAL — LO QUE FUNCIONA

### Backend ✅
- Login con JWT y roles
- Registro de usuario (`POST /auth/register`)
- Resolución de tenant por slug
- Gestión de tenants (superadmin)
- CRUD de servicios
- Disponibilidad de slots (3 queries + cruce en memoria)
- Crear reserva con 3 capas de concurrencia
- Cancelar reserva con política de cancelación
- Check-in
- Completar sesión
- Reagendar sesión
- Listado de sesiones (admin)
- Listado de reservas del día (admin, con timeline)
- Solicitudes de reserva (confirmación manual): crear solicitud (`POST /solicitudes`, solo servicios con `requiere_confirmacion`) y listar mis solicitudes (`GET /mis-solicitudes`)
- Bitácora en todas las operaciones críticas
- Job de limpieza de holds expirados
- Gestión de usuarios del tenant (admin): listar, invitar (con contraseña inicial opcional), cambiar rol, desvincular
- Horarios y servicios del asesor (admin)
- Bloqueos/vacaciones del asesor (admin)
- Email de confirmación SMTP real (`services_v2_2.enviar_email_confirmacion`)
- Selección de tenant para clientes sin membresía (`GET /tenants/publicos` + `SeleccionTenant`)
- Gestión global de usuarios (superadmin, cross-tenant): buscar/listar (`GET /superadmin/usuarios`), detalle con membresías (`GET .../{id}`), vincular a cualquier tenant (`POST .../vincular`, reusa `_vincular_usuario_a_tenant()`), desvincular (`POST .../{id}/desvincular/{tenant_id}`), desactivar cuenta completa (`POST .../{id}/desactivar` — cancela reservas activas y solicitudes pendientes en cascada) y purgar (`POST .../{id}/purgar` — anonimiza, no borra la fila). `get_current_user()` y `POST /auth/login` rechazan cuentas con `activo=False`.
- Reclamar/activar cuenta por email, con branding del tenant: token genérico de un solo uso en `Usuario` (`acceso_token_hash`/`acceso_token_expira_en`, 48h, reusable a futuro para "olvidé mi contraseña"). Dispara automático en 3 puntos (`_vincular_usuario_a_tenant()`, `crear_reserva()` de invitado nuevo integrado al correo de confirmación, `inscribir_cliente_en_serie()`) y por autoservicio público `POST /api/v2/{tenant_slug}/reclamar-cuenta` (anti-enumeración, rate limited). Activación global (`GET /auth/activar-cuenta/validar`, `POST /auth/activar-cuenta`, auto-login). `_email_shell()`/`_enviar_smtp()` nuevos en `services_v2_2.py` — branding compartido por `enviar_email_confirmacion()` y `enviar_email_activacion()`. Cierra el hueco de `POST /auth/register` que dejaba "completar registro" de un invitado sin verificar el email.
- Precio de paquete fijo por serie (`SerieReserva.precio_paquete`), definido una sola vez al crear/configurar la serie — ya no se re-captura por cada cliente inscrito.
- Inscripción a serie como invitación: `InscripcionSerie` gana `estado` (invitada/confirmada/cancelada); el admin solo invita (`POST /admin/series/{id}/inscripciones`, sin reservas todavía) o retira una invitación pendiente (`POST .../cancelar`); el cliente elige modalidad + método de pago desde su portal (`GET /mis-series`, `POST /mis-series/{id}/confirmar`), lo que genera las N reservas. Reinvitar a alguien con una invitación `cancelada` la reactiva en vez de bloquear. `metodo_pago=online` responde `pago_en_linea_no_disponible` hasta que exista pago en línea real.

### Frontend ✅
- Login con persistencia en sessionStorage
- Selección de servicio dinámica (sin hardcode)
- Calendario de disponibilidad
- Flujo de reserva (3 pasos + manejo de 8 errores)
- Mis reservas con paginación
- Detalle de reserva + cancelar
- Panel admin: sesiones, timeline con check-in, servicios
- Gestión de usuarios (tab Usuarios + panel de horarios/bloqueos del asesor)
- Selección de tenant para clientes sin membresía (SeleccionTenant)
- Gestión de tenants (superadmin)
- Configuración SMTP por tenant (pantalla separada "Email" + `smtp_configurado` en TenantAdminOut)
- Header responsive (flex-wrap + iniciales del usuario en mobile)
- Modal compartido `common/Modal.jsx` (bottom sheet en mobile, diálogo centrado en desktop)
- Navegación por rol
- Gestión global de usuarios (`superadmin/GestionUsuariosGlobal.jsx`, ruta `/superadmin/usuarios`, botón "Usuarios" en `GestionTenants.jsx`): tabla con buscador + paginación, botón fijo "+ Vincular usuario", modal de detalle con membresías por tenant, confirmación por texto para desactivar (email completo) y purgar (`PURGAR`)
- Reclamar/activar cuenta con branding del tenant: `Reclamar.jsx` (`/t/:tenantSlug/reclamar`) y `Activar.jsx` (`/t/:tenantSlug/activar?token=...`), logo/color del tenant vía `GET /tenants/publicos` filtrado por slug. Link condicional "Reclama tu cuenta" en `Login.jsx` (solo si hay `tenantSlug` en sessionStorage).
- `MisSeries.jsx` (ruta `/mis-series`, link desde `MisReservas.jsx`): el cliente ve sus invitaciones a series pendientes con las opciones de precio (sesión vs. paquete) y confirma eligiendo modalidad + método de pago. `InscribirClientesSerieModal.jsx` (admin) se redujo a un multi-select de "a quién invito"; `SeriesTab.jsx` muestra el estado de cada inscripción (invitada/confirmada/cancelada) con botón de cancelar invitación.

---

## 9. STUBS — PENDIENTES

```python
svc.iniciar_checkout()          # Stripe / MercadoPago (Sprint 4)
svc.sincronizar_calendario()    # Google Calendar API (Sprint 4)
```

`enviar_email_confirmacion()` se implementó en Sprint 1 (SMTP vía `tenant.smtp_config`).

---

## 10. PLAN DE SPRINTS

### Sprint 1 — Gestión de usuarios y email (COMPLETADO)
| # | Tarea | Estado |
|---|-------|--------|
| 1.1 | Registro de usuario (POST /auth/register) | ✅ |
| 1.2 | Pantalla de registro en frontend | ✅ |
| 1.9 | Cambiar rol de usuario desde UI | ✅ |
| 1.10 | Desvincular usuario | ✅ |
| 5.1 | Crear asesor + definir horario desde UI | ✅ |
| 5.2 | Asignar asesor a servicio desde UI | ✅ |
| 5.3 | Bloqueos/vacaciones del asesor | ✅ |
| 11.1 | Email de confirmación real (SMTP) | ✅ |
| 9.6 | Registrar pago local (efectivo/transferencia) | ✅ |

### Sprint 2 — Dashboard, agenda y cancelación masiva
| # | Tarea |
|---|-------|
| 16.1 | Dashboard de métricas básico |
| 7.4 | Cancelar sesión completa (notifica a todos) |
| 5.x | Vista de agenda personal del asesor |
| 8.12 | Confirmar reserva manual (TipoFlujo.MANUAL) |
| 4.1 | Gestión de sedes desde UI |

### Sprint 3 — UX y conversión (antes de presentar a SIMAL)
| # | Tarea |
|---|-------|
| - | Link de reserva directa por servicio (URL pública) |
| - | Código QR para check-in |
| - | Vista pública de disponibilidad sin login |
| - | Página de confirmación pública por folio |
| - | Notas post-sesión del asesor |
| - | Límite de reservas por cliente por período |

### Sprint 4 — Integraciones (post primer cliente)
| # | Tarea |
|---|-------|
| 9.1 | Stripe / MercadoPago |
| 11.2 | Recordatorios por email 24h antes |
| 12.1 | Google Calendar sync |
| 7.7 | Sesiones recurrentes |
| 13.x | Formularios dinámicos |

---

## 11. CÓMO ARRANCAR EL PROYECTO

### Backend (PowerShell)
```powershell
cd C:\Users\dvazq\Documents\mvp-schedule
.\venv\Scripts\Activate.ps1
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#=][^=]*)=(.+)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}
uvicorn app.main:app --reload
```

### Frontend (otra ventana PowerShell)
```powershell
cd C:\Users\dvazq\Documents\mvp-schedule\frontend
npm run dev
```

### URLs de desarrollo
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- OpenAPI spec: http://localhost:8000/openapi.json

### Variables de entorno

**Backend** (`.env` en la raíz — ver `.env.example`):

| Variable | Default | Qué hace |
|----------|---------|----------|
| `DATABASE_URL` | — (requerida) | Cadena de conexión PostgreSQL (psycopg2) |
| `JWT_SECRET_KEY` | — (requerida) | Secreto de firma de tokens JWT |
| `TENANT_SECRETS_KEY` | — (requerida) | Fernet base64 para cifrar secrets de tenant |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Orígenes permitidos por CORS, separados por coma. En producción poner la URL real del frontend (ej. `https://tu-app.vercel.app`). *(nueva 2026-08-01)* |
| `ENV` | `development` | Si es `production`, se deshabilitan `/docs`, `/redoc` y `/openapi.json` (no se expone Swagger). *(nueva 2026-08-01)* |

**Frontend** (`frontend/.env` — ver `frontend/.env.example`):

| Variable | Default | Qué hace |
|----------|---------|----------|
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API. El cliente único `frontend/src/api/client.js` la lee; en producción apuntar a la URL del backend (ej. `https://tu-api.onrender.com`). En local no hace falta configurarla. *(nueva 2026-08-01)* |

### Usuarios de prueba
- `mail@mail.com` / `daniel123` → superadmin
- `ana@mail.com` / `admin123` → admin de SIMAL

### Regenerar cliente tipado (después de cambios en el backend)
```powershell
cd C:\Users\dvazq\Documents\mvp-schedule\frontend
npx openapi-typescript ..\docs\openapi.json -o src\api\schema.ts
```

---

## 12. REGLAS PARA OPENCODE / AGENTES

1. **Nunca modificar archivos en `app/` sin instrucción explícita**
2. **Nunca hacer fetch() directo en el frontend** — usar openapi-fetch con schema.ts
3. **Nunca inventar un estado** que no esté en la sección 4 de este documento
4. **Una tarea = un componente o un endpoint.** No integrar todo junto.
5. **Commit después de cada pantalla funcionando**
6. **Las fechas siempre con timezone offset** — nunca datetime naive
7. **Si un campo no existe en openapi.json, no inventarlo**
8. **Cualquier cambio a modelos SQLAlchemy** → proponer aquí antes de implementar
9. **Los efectos externos** (email, calendar, pago) van después del commit, nunca dentro
10. **Antes de desviarte de este documento**, señalarlo explícitamente

---

## 13. DECISIONES DE DISEÑO TOMADAS (no revertir sin discutir)

| Decisión | Razón |
|----------|-------|
| APScheduler en vez de Celery | Menor complejidad para MVP. Celery requiere Redis/RabbitMQ. |
| sessionStorage en vez de localStorage | El token muere al cerrar el tab — más seguro para MVP. |
| `inscritos` como contador atómico | COUNT(*) no defiende el cupo a nivel de motor. |
| Efectos externos fuera de transacción | Un fallo de SMTP no debe revertir una reserva pagada. |
| Sin Stripe en Sprint 1 | SIMAL cobra en efectivo. Complejidad sin caso de uso hoy. |
| `codigo_confirmacion` obligatorio | Segundo factor para identificar reservas sin login. |
| Timezone en frontera de entrada | Rechazar naive en vez de adivinar la zona. |
| EXCLUDE USING gist para traslape | Constraint en DB — no depende de que el código recuerde bloquear. |
| Superadmin sin membresía por tenant | Accede a cualquier tenant sin crear fila en usuario_tenants. |
| Navegación por rol en App.jsx | Una sola app, rutas protegidas por rol en frontend. |
| `.gitattributes` con `text=auto eol=lf` (CRLF solo en `.ps1`) | Los diffs de línea completa (CRLF/LF) en `main.py`, `AGENTS.md`, `openapi.json` estaban escondiendo cambios reales. Se normalizó todo a LF el 2026-07-31. |
| `PROMPT_MAESTRO.md` queda fuera de git a propósito | Es un snapshot local del prompt de sesión, se desactualiza rápido. Este HANDOFF.md es la única fuente de verdad — no confiar en `PROMPT_MAESTRO.md` para saber el estado del proyecto. |
| `GET /tenants/publicos` + pantalla `SeleccionTenant` (2026-07-31) | Fix salido de validación manual de Sprint 1: un cliente que se auto-registra sin invitación previa no tiene fila en `usuario_tenants`, así que su login devuelve `tenant_slug=null` y `SeleccionServicio` fallaba con 404. Se agregó un endpoint público (en `main.py`, no en `router_v2_2.py`, porque ese router tiene prefix `/{tenant_slug}` que no existe todavía en ese punto del flujo) con schema `TenantPublicOut` que expone solo `id/slug/nombre/logo_url/color_primario` — nunca secrets (`smtp_config`, Stripe, etc.). `App.jsx` manda al cliente nuevo a la vista `seleccion-tenant`; al elegir, persiste slug igual que `handleEntrarTenant` y sigue a `SeleccionServicio`. El estado inicial de `vista` y la navegación también detectan el caso (cliente + sin `tenantSlug` en sessionStorage) para no romper tras un refresh; durante `seleccion-tenant` se oculta el nav para no exponer links a pantallas que requieren slug. |
| Header responsive con `flex-wrap` + iniciales del usuario (2026-07-31) | Notas de Daniel probando en mobile: el header (marca + nav + nombre/logout) se desbordaba en 375px/390px. Ahora el contenedor hace wrap (el grupo usuario+logout baja a segunda fila si no cabe), el nombre completo se oculta en pantallas chicas y en su lugar se muestra un avatar circular con la inicial, y el nav puede hacer wrap internamente. Sin cambios de comportamiento en desktop. |
| `common/Modal.jsx` compartido (2026-07-31) | El patrón de modal `fixed inset-0` estaba duplicado en 7 lugares (6 archivos). Se extrajo a `frontend/src/components/common/Modal.jsx` con API `{ title, onClose, children, maxWidth }` y mobile-first: en pantallas chicas es bottom sheet a ancho completo (`items-end`, `rounded-t-2xl`, `max-h-dvh` con scroll interno) y en `sm+` vuelve al diálogo centrado con `max-h-[80vh]`. Refactor puro de UI, sin cambios de lógica. De paso, el grid de duración/cupo/moneda de servicios pasó de `grid-cols-2 sm:grid-cols-4` a `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`, y el de fecha/hora de Reagendar a `grid-cols-1 sm:grid-cols-2`. |
| Contraseña inicial opcional en `POST /admin/usuarios/invitar` (2026-07-31) | Notas de Daniel: un admin invitaba a alguien y esa persona no tenía forma de entrar (quedaba `es_invitado=True` esperando auto-registro). Ahora el body acepta `password` opcional (mínimo 8): si viene, se crea la cuenta completa con `es_invitado=False` + `password_hash` (bcrypt, mismo patrón que `/auth/register`) y el invitado puede loguearse de inmediato; si no viene, comportamiento anterior. Reglas de seguridad: si el email ya tiene una contraseña propia (auto-registrado), invitar con `password` devuelve 422 (nunca se sobrescriben credenciales); la regla de 409 "ya está vinculado" se mantiene. E2E: 10 checks verdes. |
| Config SMTP por tenant, pantalla separada (2026-07-31) | Pedido de Daniel para poder probar el checklist 11.1: no había endpoint ni UI para editar `tenant.smtp_config` (EncryptedJSON). Se agregó un botón **Email** junto a "Editar" en cada fila de GestionTenants (con punto verde/gris según `smtp_configurado`), que abre un modal propio (`ConfigSmtpModal.jsx`, con `common/Modal`) — NO mezclado con "Editar tenant". Decisiones de seguridad: (1) `TenantAdminOut` solo expone `smtp_configurado: bool`, nunca el `smtp_config` completo (contiene la contraseña); (2) el PATCH a `smtp_config` hace merge `{**(actual), **cambios}` en `actualizar_tenant()` en vez del `setattr` genérico, así omitir `password` en el payload conserva la guardada (write-only desde el frontend, el campo nunca se prellena); (3) `smtp_config: null` limpia la config. E2E: 18 checks verdes (incluye verificación del merge en DB y que la respuesta nunca filtra `password`). |
| Regla del repo: `GestionTenants.jsx` usa `fetch()` directo (código viejo, previo al cliente) | El archivo superadmin no migró a openapi-fetch. El código nuevo de T4 (`ConfigSmtpModal.jsx`) sí usa `createClient` + schema.ts para cumplir la regla del AGENTS.md. Migrar el resto de GestionTenants a openapi-fetch queda como deuda técnica. |
| Solicitudes de reserva (Sprint 2 #10) — tabla nueva y separada (2026-07-31) | Decisión con Daniel: una SolicitudReserva es una propuesta del cliente, NO una Reserva/Sesion. Se guarda en su propia tabla `solicitudes_reserva` y solo se convierte en reserva real al aceptarla (Tarea 3). El modelo, la migración SQL (aprobada y aplicada a Neon) y los schemas Pydantic (`SolicitudCreate`, `SolicitudOut`, `SolicitudAdminOut`) se crearon en el commit `e4299ac` (Tarea 1). |
| `GET /mis-solicitudes` sin paginación (2026-07-31) | Decisión aceptada por Daniel (Tarea 2): un cliente tiene pocas solicitudes activas y las resuelve el staff, así que el endpoint devuelve **todas** ordenadas por `creado_en` desc. Si algún día escala, se agrega `limit`/`offset` como en `/mis-reservas` sin romper el contrato. Queda registrada como decisión explícita, no implícita. |
| Duplicados permitidos en solicitudes pendientes (2026-07-31) | Decisión aceptada por Daniel (Tarea 2): un cliente PUEDE crear varias solicitudes `pendiente` para el mismo servicio+fecha. No se bloquea con 409 — el staff las resuelve y puede rechazar las que sobren. La validación lo deja explícito: `crear_solicitud_reserva()` cuenta `pendientes_previos` y lo registra en la bitácora (`detalles.pendientes_previos`), pero no rechaza. La solicitud NO valida disponibilidad de franja al crearse: es solo una propuesta y el staff decide al aceptar (Tarea 3), cuando la franja real se puede checar. |
| `POST /solicitudes` solo para servicios con `requiere_confirmacion=True` (2026-07-31) | Tarea 2. Si el servicio no requiere confirmación, responde 409 `no_requiere_confirmacion` ("Este servicio no requiere confirmación; reserva directamente."). Si el servicio no existe / está inactivo / no es visible en web → 404 `servicio_no_encontrado`. `fecha_hora_propuesta` debe ser futura y con offset (422 si no); `duracion_minutos` se toma del servicio. E2E: 8 checks verdes contra Neon. |
| `min-w-0` en la cadena flex de las tablas admin (2026-07-31) | Notas de Daniel: las tablas (Tenants, Usuarios, Servicios, Sesiones/Reservas del Panel) desbordaban la página entera en 375px en vez de scrollear dentro de su propio `overflow-x-auto`. Causa: `min-width: auto` por defecto en los flex items — ningún ancestro permitía encogerse, así que la tabla empujaba el ancho del `body` y las primeras columnas quedaban cortadas sin scroll posible. Fix: `min-w-0` en `<main className="flex justify-center p-4">` de `App.jsx` y en el div raíz de cada componente (`GestionTenants.jsx` y `PanelAdmin.jsx` con `mx-auto min-w-0 max-w-4xl`; `GestionUsuarios.jsx` y `GestionServicios.jsx` con `min-w-0`). Las tablas ahora scrollean horizontalmente dentro de su contenedor sin mover el resto de la página. `PanelAdmin` no necesitó `min-w-0` en los root de `SesionesTab`/`ReservasTab` (son bloques, no flex items); basta el de la raíz del Panel. Sin cambios en desktop. |
| Exponer `smtp_config` (sin `password`) en `TenantAdminOut` (2026-07-31) | Fix de bug real en ConfigSmtpModal: `TenantAdminOut` solo devolvía `smtp_configurado: bool`, así que al reabrir el modal el formulario arrancaba en blanco/defaults y el PATCH sobrescribía `tls`/`ssl`/`console` con los defaults en cada guardado (no era solo visual, se perdía configuración real). Ahora la respuesta incluye solo los campos no sensibles (`host`, `port`, `user`, `from_email`, `from_name`, `tls`, `ssl`, `console`) con sus defaults; `password` sigue siendo **write-only** y nunca sale en GET/PATCH — vive solo en el EncryptedJSON del tenant y el merge de `actualizar_tenant()` lo conserva si no viene en el payload. Alcance: **solo `superadmin_router`** en `router_v2_2.py` vía `_tenant_admin_out()`; ningún otro endpoint expone el `smtp_config`. Aplica a la **lista completa de `GET /superadmin/tenants`** (cada elemento trae su `smtp_config`), no solo al detalle/PATCH de un tenant — el frontend lo lee de esa misma respuesta ya cargada en `GestionTenants` para precargar el modal. **Actualiza** la decisión previa (2026-07-31) que decía que `TenantAdminOut` nunca expone `smtp_config` completo: ahora expone los no sensibles, la restricción se reduce a `password`. |
| Fix `utcToOffset` en `FlujReserva.jsx` (2026-07-31) | Bug crítico de fechas: `utcToOffset()` tomaba los dígitos de `date.toISOString()` (siempre UTC) y les concatenaba el offset local **sin desplazar el reloj** — solo relabeleaba. Cualquier slot en un timezone distinto a UTC+0 se enviaba a `POST /reservas` desfasado por el valor del offset (ej. 6 horas y hasta un día distinto en timezones negativos): el backend rechazaba slots válidos (`franja_ocupada`/`horario_incongruente` cuando venía `sesion_id`, ver `app/services_v2_2.py:700`) o, peor, reservaba/creaba la sesión a una hora distinta a la que el cliente vio (sin `sesion_id`). Fix: convertir el reloj antes de generar el ISO (`new Date(date.getTime() + offsetMin * 60000)`) y usar el offset de la **misma fecha** (no `new Date()`) para el sufijo, así evita también el desfase de 1h por DST entre el corrimiento y el sufijo. Revisé los demás armadores de fechas: `CalendarioDisponibilidad.jsx` (local midnight del date picker + offset) y `HorariosAsesor.jsx` (`datetime-local` + offset) son correctos porque parten de reloj local. |
| Hallazgo NO resuelto: `PanelAdmin.jsx:258` (Reagendar) usa offset hardcodeado `-06:00` (2026-07-31) | Mismo tipo de bug de fecha que el `utcToOffset` de FlujReserva pero causa distinta: `guardarReagendar()` arma `nueva_fecha_hora_inicio` con `${fecha}T${hora}-06:00` fijo, y además mezcla la fecha en timezone del navegador (`toDateInputValue(new Date(...))`) con la hora en timezone del tenant (`getHoraMin(..., sesion.timezone)`). En un navegador fuera de UTC-6 el reagendamiento aterriza en un instante distinto al mostrado. **Pendiente de fix en tarea aparte** (no tocar en el commit de utcToOffset). |
| Fix Reagendar con offset real — `PanelAdmin.jsx` (2026-07-31) | Resuelve el hallazgo de la fila anterior: `guardarReagendar()` ya no usa `-06:00` fijo, usa `getLocalOffset()` del helper compartido nuevo `frontend/src/utils/fechas.js` (se migraron las copias duplicadas que vivían en `CalendarioDisponibilidad.jsx` y `HorariosAsesor.jsx`). `FlujReserva.jsx` NO se tocó (su fix de `utcToOffset` quedó en commit propio). El fix de frontend quedó sin commit en su momento; se commitea aparte, previo al commit del nuevo diseño de reservas. |
| Nuevo diseño: reserva con confirmación manual (2026-07-31, reactivado Sprint 2 #10 2026-08-01) | Originalmente se descartó el flujo de `SolicitudReserva` en favor de que `crear_reserva()` deje la reserva PENDIENTE directamente. En Sprint 2 #10 se reactivó `SolicitudReserva` como **propuesta previa** que el staff revisa y acepta: endpoints `GET /admin/solicitudes` y `POST /admin/solicitudes/{id}/confirmar` (requieren staff). Confirmar convierte la solicitud en una Reserva PENDIENTE usando `crear_reserva()` sin tocar sus 3 capas de concurrencia; la Reserva queda con `creado_por_usuario_id` del cliente que propuso (así aparece en Mis Reservas). El cierre final (asignar asesor + email + calendario) sigue siendo `POST /admin/reservas/{id}/asignar-asesor`. La solicitud pasa a estado `aceptada` y guarda `reserva_id`, `resuelto_por_id`, `resuelto_en`. El flujo de cliente para crear solicitudes (`POST /solicitudes`) sigue sin pantalla; esta tarea solo implementó backend + admin UI. |
| Regenerados `docs/openapi.json` y `frontend/src/api/schema.ts` (2026-07-31) | Ambos se regeneraron desde el backend corriendo (`/openapi.json`); el diff de openapi.json es solo el endpoint nuevo + schema `AsignarAsesorIn`. Consecuencia: `TenantAdminOut.smtp_config` está declarado en Pydantic como `dict` genérico, así que el tipado detallado (host/port/user/tls/...) que se había añadido a mano a `schema.ts` en el commit SMTP quedó reemplazado por `Record<string, never>` — consistente con el contrato. El runtime sigue devolviendo los campos no sensibles (la fila anterior de `smtp_config` no cambia en comportamiento). Si se quiere tipado rico, definir un modelo Pydantic `SmtpConfigOut` (sin `password`) en el backend. |
| Pestaña "Pendientes" en PanelAdmin + filtro de listado sin fecha (2026-07-31) | Frontend del nuevo diseño de reservas con confirmación manual. `GET /admin/reservas` ahora omite el filtro de fecha cuando se pasa `estado` sin `fecha` (antes `fecha` default = hoy siempre); sin `estado` ni `fecha` conserva el default de hoy. Esto permite a la pestaña "Pendientes" listar reservas `pendiente` de todas las fechas (las pendientes suelen ser a futuro). El selector de asesor de cada fila usa el endpoint nuevo `GET /admin/servicios/{servicio_id}/asesores` (staff, reusa `_asesores_del_servicio` y responde con `UsuarioAdminOut`), y `asignar_asesor_reserva()` valida en backend que el asesor esté vinculado al servicio (409 `asesor_no_asignado_a_servicio`); `ReservaAdminListOut` ahora incluye `servicio_id`. El 409 `franja_ocupada` se muestra inline bajo la fila sin tumbar la lista; éxito = banner verde + refetch. `FlujReserva` muestra el estado `pendiente` como éxito azul "Solicitud recibida" (no es `errorReserva`). Commit 1 = backend (router + schemas + openapi.json), commit 2 = frontend (schema.ts + FlujReserva + PanelAdmin + VALIDACION). |
| Horario de servicio ≠ horario de asesor (2026-07-31) | Para servicios con `requiere_confirmacion=True` (ej. Fisio, sin asesor vinculado de antemano) el calendario solo generaba slots desde los horarios de asesores ya vinculados → el cliente no podía proponer nada. Ahora el servicio tiene **su propia franja general** (`horario_disponibilidad.entidad_tipo='servicio'`, `entidad_id=servicio_id`): define la **ventana de propuesta** del cliente y `listar_slots_disponibles()` genera sus slots desde ahí (asesor=None, bloqueos global/sede respetados, sesiones existentes del servicio marcan el slot como ocupado). El **horario de asesor** sigue siendo lo que **valida la asignación real**: `asignar_asesor_reserva()` (NO se tocó) llama `validar_disponibilidad_franja()` contra el horario/bloqueos del asesor al confirmar. Migración: CHECK `ck_hd_entidad_tipo` ampliado a `('asesor','recurso','servicio')` (solo CHECK, sin columnas ni tablas nuevas). Endpoints nuevos staff (mismo patrón que `/admin/asesores/{ut_id}/horarios`): `GET/POST /admin/servicios/{servicio_id}/horarios` + `DELETE .../{h_id}`, reusan `HorarioAsesorOut` tal cual (shape id/dia_semana/hora_inicio/hora_fin/activo/creado_en). `POST` valida 422 si el servicio no tiene `requiere_confirmacion=True` (en docstring explícito). Modelo SQLAlchemy sincronizado con la migración. Commit A = migración+endpoints+openapi/schema, commit B = `listar_slots_disponibles`+docs. |
| Widget de calendario: `@daypicker/react` v10 + `common/SelectorFecha.jsx` (2026-07-31) | Para reemplazar la navegación día-por-día del calendario público y los `<input type="date">` sueltos, se eligió **`@daypicker/react` v10** (el nombre nuevo de `react-day-picker`; `react-day-picker` queda como shim legacy) porque es el estándar Tailwind: ~57KB, peer `react>=16.8` (compatible React 19 del proyecto), API de `classNames` pensada para utilities. Se descartaron react-calendar (estilos inline difíciles de sobrescribir), react-datepicker (CSS pesado para Tailwind v4) y el wrapper de shadcn (Radix + wrapper innecesarios). **No se importa `style.css`** de la librería: no usa `@layer`, así que en Tailwind v4 (CSS-first, unlayered gana sobre utilities) pelearía con las clases. Todo el estilo vive en `classNames` del componente. Detalles de la integración: `es` viene de `@daypicker/react/locale` (la fecha/labels en español, semana inicia lunes); el estado `selected`/`today`/`disabled` de v10 se aplican al **`<td>`** (no al botón), así que el círculo azul se pinta en la celda y el botón transparente hereda el color — los estados combinados se resuelven con variantes arbitrarias `[.selected_&]` sobre `day_button` (Tailwind las emite después de las utilities base, no hay conflicto de cascada). `SelectorFecha` es controlado (`value`/`onChange`, ignora el `undefined` de unclick en día ya seleccionado) y opcionalmente `minDate` (deshabilita días pasados con `{ before }`). Se usa en: CalendarioDisponibilidad (vista de mes, quita flechas Anterior/Siguiente), Reagendar (sustituye el `type="date"`) y el filtro "Día" de ReservasTab (en un popover compacto con overlay para cerrar, sin `minDate` porque el admin agenda mira días pasados). La **serialización de fechas NO cambió**: el widget solo elige el día, el `yyyy-MM-dd` + offset sigue por `toDateInputValue`/`getLocalOffset`. Commits por pantalla: A1 librería+componente, A2 calendario, A3 reagendar, A4 filtro reservas. |
| Config del horario de servicio en GestionServicios (2026-07-31) | Frontend de la decisión "Horario de servicio ≠ horario de asesor". `ServicioAdminOut` ahora expone `requiere_confirmacion: bool` (venía en el modelo pero no en la API → el front no podía saber a qué servicios aplicar la config). Con eso, cada fila de GestionServicios muestra el botón **"Horario"** solo cuando `requiere_confirmacion=True`, que abre `common/../admin/HorarioServicio.jsx` (nuevo): mismo patrón visual que "Horario semanal" de `HorariosAsesor` (checkbox por día + `type="time"` inicio/fin + guardar hora = DELETE+POST cuando ya existe), pero contra `GET/POST/DELETE /admin/servicios/{servicio_id}/horarios`. El texto de ayuda aclara que la franja es la **ventana de propuesta** del cliente y que la disponibilidad real del asesor se valida al confirmar. El calendario público (`CalendarioDisponibilidad`) muestra los slots de estos servicios con `asesor=null` → aviso "Se te asignará un asesor al confirmar" (FlujReserva ya toleraba `slot.asesor &&`). El flujo de cliente para estos servicios (POST /solicitudes) sigue sin pantalla — tarea aparte. Regenerados `docs/openapi.json` + `schema.ts`. |
| Control de `requiere_confirmacion` en la UI de servicios (2026-08-01) | Cierre del bug bloqueante: `ServicioAdminIn`/`ServicioAdminUpdate` no exponían el campo y `extra="forbid"` rechazaba cualquier intento de escribirlo → no existía forma de activar confirmación manual desde la API/UI. Se agregó `requiere_confirmacion: bool = False` (In, mismo default del modelo) y `Optional[bool] = None` (Update), y `crear_servicio_admin()` lo pasa al construir `Servicio(...)`. `actualizar_servicio_admin()` no se tocó (setattr genérico). Frontend: checkbox **"Requiere confirmación manual"** en los formularios de crear/editar de GestionServicios. UX sin guardar/reabrir: en **editar**, al activar el checkbox aparece inline el bloque con el botón "Configurar horario de propuestas" que abre `HorarioServicio` con el servicio en edición (tiene id, funciona sin guardar); en **crear** no existe id todavía, así que `HorarioServicio` ganó dos modos para mostrarse **dentro del formulario antes de crear**: `pendiente` (no hace fetch; las franjas viven en estado local y se emiten vía `onCambio`) y `sinModal` (renderiza el editor inline sin el wrapper `Modal`). Al guardar, el servicio se crea y sus franjas se envían en POSTs `/horarios`; si una franja falla, el servicio ya creado se mantiene y se avisa con banner. E2E vía API (13 checks): crear con `true` → horario lunes 09-12 → disponibilidad pública con 3 slots `asesor=null` → PATCH `false` vacía el calendario → PATCH `true` lo restaura → cleanup. |
| Reprogramar fecha/hora de reserva pendiente sin disparar efectos (2026-08-01) | `PendientesTab` gana el botón **Reprogramar** que llama `POST /sesiones/{sesion_id}/reagendar`; la reserva sigue `pendiente` — no se confirma ni se manda email con la nueva fecha. Requisitos: `ReservaAdminListOut` ahora expone `sesion_id` (el reagendar es de sesión, no de reserva); el frontend arma `nueva_fecha_hora_inicio` con `getLocalOffset()` (nunca naive) y refresca la fila sin perder la página (offset actual). En backend, `reagendar_sesion_endpoint()` solo llama `sincronizar_calendario()` si la sesión ya tiene `asesor_id`: una sesión de confirmación manual (asesor=None) se mueve de fecha sin pisar Google Calendar. El email de confirmación se sigue mandando recién en "Asignar y confirmar" con la fecha vigente. E2E 12 checks (incluye `sesion_id` en el listado de pendientes, nueva fecha reflejada, sigue `pendiente`, fecha pasada → 422). |
| Asignar asesor sin exigir vinculación previa al servicio (2026-08-01) | Se revierte la validación del diseño de confirmación manual: `asignar_asesor_reserva()` ya NO rechaza con 409 `asesor_no_asignado_a_servicio` cuando el asesor no está en `AsesorServicio`. Razón: la vinculación sigue alimentando disponibilidad/auto-asignación (`_asesores_del_servicio` se conserva en services), pero la confirmación manual es una asignación ad-hoc por sesión y no debe bloquearse por un vínculo que a veces no existe (ej. servicio sin asesores vinculados). Se conservan: 404 si el asesor no es staff activo del tenant, `reserva_no_pendiente`, y `validar_disponibilidad_franja()` (horario/bloqueos/solapamiento reales del asesor → 409 `franja_ocupada`). `GET /admin/servicios/{servicio_id}/asesores` se **eliminó** (su único consumidor era el dropdown de PendientesTab); el selector ahora usa `GET /admin/usuarios` (todos los users del tenant) filtrado en frontend a `rol ∈ {asesor, admin}` activos. **Actualiza** la fila "Pestaña Pendientes" (2026-07-31) que describía el 409 y el endpoint por servicio. E2E 11 checks: asignar asesor no vinculado → 200; endpoint eliminado → 404; reserva queda `confirmada`. |
| Gate de pago en check-in (2026-08-01) | `checkin_reserva()` ahora exige `estado_pago ∈ {COMPLETADO, EXENTO}` para permitir check-in. Si es `PENDIENTE` o `REEMBOLSADO`, rechaza con 409 y código `pago_pendiente`. Razón: para método de pago local (efectivo/transferencia), `crear_reserva()` pone la reserva directamente en `CONFIRMADA` con `estado_pago=PENDIENTE`, permitiendo check-in sin haber pagado. Servicios sin costo (`pago_requerido=False` o `precio=0`) llegan a `estado_pago=EXENTO` por defecto, así que no se ven afectados. Frontend: tanto `SesionesTab` (modal inscritos) como `ReservasTab` muestran mensaje específico "Pago pendiente — regístralo antes de hacer check-in" cuando el backend responde `pago_pendiente`. E2E: check-in bloqueado → registrar pago local → check-in exitoso. |
| Agrupación de Mis Reservas por serie (2026-08-03) | `MisReservas.jsx` agrupa visualmente las reservas que comparten `serie_id`. Cada serie muestra la modalidad de cobro y, si es paquete, un badge "Paquete pagado" solo cuando **todas** las reservas de la serie están `completado`/`exento`. **Limitación conocida**: la agrupación ocurre sobre la página actual de `GET /mis-reservas` (`LIMIT = 10`), por lo que una serie con más de 10 sesiones podría aparecer fragmentada entre páginas. Para el caso de uso típico de SIMAL (series ≤ 8 sesiones) no afecta; si algún tenant configura series más largas, hay que paginar por servidor o cargar todas las reservas antes de agrupar. |
| Elección cliente sesión vs paquete queda registrada por inscripción (2026-08-03) | Decisión del MVP de reservas recurrentes rediseñado: una serie es solo un patrón de horario; cada cliente se inscribe a través de `InscripcionSerie` y elige (o el staff registra por él) su `modalidad_cobro` (`por_sesion` o `por_paquete`) dentro de las modalidades que la serie tenga habilitadas (`cobro_por_sesion_habilitado` / `cobro_por_paquete_habilitado`). Un cliente puede tener una sola inscripción por serie. El precio del paquete se guarda por inscripción (`InscripcionSerie.precio_paquete`), no por serie, y el pago de paquete cubre todas las reservas de esa inscripción (vía `reservas.inscripcion_id`). Como no existe checkout online real todavía (Sprint 4), en este MVP el staff registra la elección del cliente al inscribirlo (camino 1 desde `SeriesTab`, o al confirmar una solicitud como serie en camino 2). Cuando haya checkout online real, el cliente podrá elegir la modalidad antes de pagar y la inscripción se creará a partir de su selección. |
| Fix: header `Authorization` faltante en `GET /admin/usuarios` (2026-08-03) | `InscribirClientesSerieModal.jsx` y `CrearSerieModal.jsx` llamaban a `GET /admin/usuarios` sin mandar el header `Authorization`, así que la petición fallaba con 401 en silencio (`if (!fetchErr && data)` no mostraba el error) y los dropdowns de cliente/asesor se veían vacíos aunque sí hubiera usuarios vinculados al tenant. Fix: agregar el header en ambos `useEffect` (mismo patrón que ya usaban los `POST` de esos mismos archivos) + mostrar error visible en `InscribirClientesSerieModal` en vez de fallar callado. Commit `27afb0b`. |
| Superadmin — gestión global de usuarios: "purgar" anonimiza, no borra (2026-08-03) | Al diseñar Prompt E se encontró que 4 FKs hacia `usuarios.id` son `NOT NULL` + `RESTRICT` (`reservas.creado_por_usuario_id`, `sesiones.creado_por_usuario_id`, `solicitudes_reserva.cliente_usuario_id`, `inscripciones_serie.cliente_usuario_id`), así que un `DELETE FROM usuarios` real fallaría para cualquier usuario que alguna vez haya reservado o (si es staff) creado una sesión — prácticamente todos. Se evaluaron dos opciones: migrar esas 4 columnas a `nullable + SET NULL` (mismo patrón que ya usa `bitacoras.usuario_id`), o anonimizar la fila `Usuario` en vez de borrarla. **Se eligió anonimizar**: `purgar` pasa a ser un `UPDATE` sobre `Usuario` (limpia `nombre`, `apellido`, `telefono`, `password_hash`; `email` se reemplaza por un placeholder único tipo `purgado+{usuario_id}@eliminado.local` porque `email` es único y no-nulo, liberando el email real por si la persona vuelve a registrarse), no un `DELETE`. Cero cambios de esquema en las 4 tablas core — las reservas/sesiones/solicitudes/inscripciones históricas quedan intactas, solo pierden el vínculo a una identidad ya vacía. `Usuario` gana columna nueva `purgado_en` (nullable) para marcar que ya se purgó y bloquear un segundo purgado. Sigue aplicando la regla ya decidida: purgar solo se habilita si `desactivado_en` tiene 30+ días, validado en backend (no solo oculto en frontend). |
| Superadmin — "Vincular a tenant" sin campo de contraseña (2026-08-03) | El diseño original de Prompt E incluía un campo `password` opcional en el formulario de vincular usuario a tenant. Se quitó: no hay razón para que el superadmin le asigne una contraseña a mano a otra persona — rompe el patrón de activación propia que ya usan los clientes invitados (`password_hash=NULL` hasta que el usuario la define). Todo usuario nuevo creado vía "vincular" nace igual que un invitado de reserva: sin contraseña, pendiente de la futura pantalla de "reclamar cuenta" (no construida aún). No es una regresión: hoy tampoco pueden loguearse los invitados hasta que exista esa pantalla. El selector de rol de ese formulario solo ofrece `cliente`/`asesor`/`admin` — `superadmin` no aplica porque no es una membresía de `UsuarioTenant`. |
| Superadmin — vincular usuario con email nuevo (2026-08-03) | La pantalla global de usuarios permite buscar solo entre usuarios que ya tienen fila en `usuarios`. Para vincular un email que nunca ha existido en el sistema se agrega un botón fijo **"+ Vincular usuario"** en el header de `GestionUsuariosGlobal.jsx` (no depende de ningún resultado de búsqueda), que abre el mismo formulario de vincular con el email vacío. Mejora opcional no bloqueante: si la búsqueda da cero resultados, mostrar un CTA inline con el email precargado. |
| Hallazgo NO resuelto (deuda técnica, no bloqueante): `POST /webhooks/stripe` no verifica firma si falta el paquete `stripe` (2026-08-03) | `app/router_v2_2.py:513-548` — si `import stripe` falla (el paquete no está en `requirements.txt`), el handler cae a `json.loads(payload)` sin validar ninguna firma, así que cualquiera que sepa un folio en `en_espera` podría marcarlo como pagado con un POST directo. Se decidió no cerrarlo ahora porque Stripe no se va a usar de entrada (ver fila de MercadoPago abajo). **Si algún día se activa Stripe para algún tenant, hay que arreglar esto antes** — rechazar la petición si no se puede verificar la firma, en vez de procesar el payload sin validar. |
| Pago en línea: MercadoPago por tenant, OAuth Connect, sin comisión de plataforma (2026-08-03) | Decisión de arquitectura para construir el pago en línea real (hoy `iniciar_checkout()` es un stub). No es una pasarela centralizada: cada tenant conecta **su propia cuenta MercadoPago** vía OAuth Connect/marketplace — el dinero llega directo al tenant, `marketplace_fee` en 0 (DANIEL Consultoría no cobra comisión por transacción, cobra aparte vía suscripción SaaS). Checkout tipo **Checkout Pro** (preferencia + redirect), no Checkout API/Bricks embebido — suficiente para el MVP. Credenciales por tenant (`access_token`, `refresh_token`, `mp_user_id`) van en `Tenant.pago_config` (`EncryptedJSON`, mismo patrón que `smtp_config`); las credenciales de la aplicación MercadoPago de DANIEL (Client ID/Secret para iniciar el OAuth) son globales, por variables de entorno. El primer tenant que usará esto ya existe en la plataforma — no es SIMAL; a partir de esta decisión SIMAL se trata como un tenant más, sin trato especial en el diseño. |
| Pago de paquete solo desde cliente logueado, no hay página pública para eso (2026-08-03) | El pago de una reserva suelta sigue funcionando dentro del flujo normal de reserva (sin requerir login, como hoy). Pero el pago de un **paquete completo** (varias sesiones de una inscripción) solo se ofrece desde **Mis Reservas** con el cliente ya logueado — no se construye una página pública nueva equivalente a la de folio individual. Esto depende de que el tenant en cuestión tenga clientes que ya puedan loguearse (con contraseña); si no, esta pieza queda bloqueada por la falta de la pantalla de "reclamar cuenta" (Prompt F, aún no construido) y hay que confirmarlo antes de empezar, no asumir que ya funciona. |
| Confirmación de pago consciente de inscripción, reemplaza el criterio de solo-folio (2026-08-03) | `confirmar_pago_por_folio()` hoy solo toca una reserva por folio, sin ningún concepto de `inscripcion_id` — si se usara tal cual para pagar un paquete, solo confirmaría una sesión y dejaría el resto sin pagar. Se reemplaza/extiende por una versión que, si la referencia del pago apunta a una inscripción `paquete`, marca **todas** las reservas de esa inscripción (mismo criterio que `registrar_pago_inscripcion_local()`). El webhook de MercadoPago no debe confiar en el payload de la notificación — debe re-consultar el pago a la API de MercadoPago con el `access_token` del tenant antes de marcar nada como pagado (identificando al tenant por el `mp_user_id` que viene en la notificación). |
| Reclamar/activar cuenta: token genérico reusable, dispara en 3 puntos + autoservicio (2026-08-03) | Diseño para que usuarios sin contraseña (invitados de reserva, vinculados por admin/superadmin, inscritos en serie) puedan entrar. `Usuario` gana `acceso_token_hash`/`acceso_token_expira_en` (nombre genérico a propósito — reusable el día que exista "olvidé mi contraseña", no es parte de esta tarea). Token `secrets.token_urlsafe(32)`, se guarda solo el hash, expira a 48h, un solo uso. Activar cuenta = `password_hash` + `email_verificado=True` + `es_invitado=False` + respuesta con la misma forma que `POST /auth/login` (auto-login). Dispara el email automáticamente en 3 puntos: `_vincular_usuario_a_tenant()` (si el usuario queda sin password), `crear_reserva()` de un invitado nuevo (integrado al mismo correo de confirmación, no un segundo email aparte), e `inscribir_cliente_en_serie()`. Además existe autoservicio público `POST /t/{tenant_slug}/reclamar-cuenta` (anti-enumeración: mismo mensaje genérico siempre, rate-limited). Todo el flujo es por tenant — páginas nuevas bajo `/t/:tenantSlug/...`, no bajo `/login` (que hoy no tiene contexto de tenant). |
| Branding de email compartido: se corrige `enviar_email_confirmacion()` en la misma tarea (2026-08-03) | El helper de plantilla con logo/color del tenant (`TenantPublicOut.logo_url`/`color_primario`) se construye una sola vez y se aplica a ambos correos: el nuevo de activación de cuenta Y el retrofit de `enviar_email_confirmacion()`, que hoy es genérico (hallazgo documentado el 2026-08-03, se cierra aquí en vez de quedar como deuda técnica aparte). |
| Fix: `_vincular_usuario_a_tenant()` bloqueaba re-vincular a alguien previamente desvinculado (2026-08-03) | 409 "El usuario ya está vinculado a este tenant" al usar "Vincular usuario" desde `GestionUsuariosGlobal.jsx` contra un usuario que en realidad estaba **desvinculado** (`UsuarioTenant.activo=False`), no vinculado. Causa: la función solo checaba si existía *alguna* fila `UsuarioTenant` para ese usuario+tenant, sin filtrar por `activo` — y como "desvincular" es reversible (nunca borra la fila, `uq_usuario_tenant` no distingue estado), cualquier usuario alguna vez desvinculado de un tenant quedaba bloqueado para siempre, tanto desde el endpoint de superadmin como desde el de tenant (`POST /admin/usuarios/invitar`, misma función compartida). Fix: si la fila existente está `activo=False`, se reactiva (`activo=True`, `desvinculado_en=None`, actualiza `rol`) en vez de bloquear o intentar un INSERT duplicado. Bitácora nueva acción `"revincular"` para distinguir de un vínculo genuinamente nuevo (`"invitar"`). |
| Fix: `ck_inscripcion_modalidad` en minúsculas rompía todo INSERT a `inscripciones_serie` (2026-08-04) | 500 en `POST /admin/series/{id}/inscripciones` — confirmado por traceback de Render: `sqlalchemy.exc.IntegrityError ... CheckViolation ... ck_inscripcion_modalidad`. Causa: la migración `migracion_series_multicliente.sql` definió el CHECK con valores en minúsculas (`'sesion'`, `'paquete'`), pero `SQLEnum(ModalidadCobro)` sin `values_callable` serializa el **nombre** del enum de Python (mayúsculas: `'SESION'`, `'PAQUETE'`) — mismo patrón que ya usa `estadosolicitud` en todo el resto del proyecto (mayúsculas). Como todo INSERT a esta tabla fallaba con este error desde que existe, no había filas que migrar. Fix: `db/migracion_fix_ck_inscripcion_modalidad.sql` — DROP + re-CREATE del constraint con `'SESION'`/`'PAQUETE'`. No afecta al frontend ni a los schemas Pydantic: la conversión mayúsculas↔minúsculas ya la resuelven SQLAlchemy (lee por `.name`) y Pydantic (serializa por `.value`) de forma transparente en sus respectivas fronteras — esto solo corrige el texto que Postgres valida internamente. |
| Precio de paquete vuelve a ser único, deja de capturarse por cliente (2026-08-04, superseded más abajo) | Primera corrección: el precio de paquete se estaba escribiendo a mano por cada cliente al inscribirlo. Se decidió moverlo a `SerieReserva`. **Esta ubicación fue superseded el mismo día** — ver la fila siguiente. |
| Configuración de pago (sesión/paquete + precio) vive en el SERVICIO, no en la serie (2026-08-04) | Corrección sobre la fila anterior, confirmada explícitamente por Daniel: `cobro_por_sesion_habilitado`, `cobro_por_paquete_habilitado` y `precio_paquete` viven en `Servicio`, no en `SerieReserva`. Razón: un servicio recurrente genera muchas series a lo largo del tiempo y todas deben heredar la misma configuración de pago automáticamente, sin volver a capturarla cada vez. Se configuran una sola vez en "Nuevo/Editar servicio" (`GestionServicios.jsx`), junto a `precio`/`pago_requerido`; el checkbox de paquete solo se muestra cuando `tipo_agenda=recurrente` y el backend rechaza `cobro_por_paquete_habilitado=True` para servicios no recurrentes. `CrearSerieModal.jsx` pierde toda la sección de modalidades de cobro — ya no hay nada que configurar ahí. **Implementado:** migración `db/migracion_precio_paquete_servicio.sql` aplicada a Neon el 2026-08-04; backfilló el flag de paquete a `servicios` desde `series_reservas` y copió el precio no nulo único por servicio. Verificación en Neon: había 2 series con paquete habilitado (id=1 con `precio_paquete=NULL`, id=6 con `$15,000.00`), ambas del servicio id=5; el backfill dejó el servicio 5 con `cobro_por_paquete_habilitado=true` y `precio_paquete=15000.00`. Las columnas de cobro/precio se eliminaron de `series_reservas`. |
| Fix: `_enviar_smtp()` fallaba con `OSError: Network is unreachable` en Render (2026-08-04) | Reportado por Daniel al invitar a un cliente a una serie: `smtplib.SMTP(host, port)` usa la resolución DNS por default, que en Linux prueba direcciones IPv6 primero. Si el host SMTP del tenant tiene registro AAAA (común, ej. Gmail) y el contenedor de Render no tiene salida IPv6 funcional, la conexión truena de inmediato. **No rompió el flujo que lo disparó** — el envío de correo ya estaba en su propio `try/except` post-commit (arquitectura correcta, regla 2 de HANDOFF) — pero el correo nunca le llegaba al cliente, en silencio. Fix: nuevo context manager `_forzar_resolucion_ipv4()` que monkeypatchea `socket.getaddrinfo` para forzar `AF_INET` solo durante el envío — sigue pasando el hostname original a `smtplib`, así que la validación de certificado TLS no se ve afectada (no se resuelve a una IP cruda). Alcance: solo `_enviar_smtp()`, usada por todos los correos transaccionales de la app (confirmación, activación, invitación a serie). |
| Fix: `FlujReserva.jsx` siempre pedía nombre/email aunque el cliente ya tuviera sesión iniciada (2026-08-04) | Bug real reportado por Daniel: un cliente logueado que reservaba una sesión suelta veía el mismo formulario de "nombre + email" que un invitado nuevo — nada en el frontend distinguía el estado de sesión. El backend (`crear_reserva()`, `router_v2_2.py:812-813`) ya priorizaba correctamente al usuario autenticado sobre `email_invitado`/`nombre_invitado` cuando había token — el bug era puramente de UI, no de datos: parecía (y se sentía) un formulario de registro innecesario. Fix: si existe `sessionStorage.getItem('usuario')` (sesión activa), el paso 2 de `FlujReserva.jsx` reemplaza los campos de nombre/email por una confirmación de solo lectura ("Vas a reservar como {nombre}") y `validar()` ya no los exige. Teléfono/notas siguen siendo opcionales para cualquier caso, no están atados a la identidad. Sin cambios de backend — el problema nunca estuvo ahí. |
| Fix: calendario público mostraba "se te asignará un asesor" aunque la sesión ya tuviera uno (2026-08-04) | Bug real reportado por Daniel. `listar_slots_disponibles()`, branch de `servicio.requiere_confirmacion` (`services_v2_2.py`, generación de slots desde el horario del servicio), mandaba `"asesor": None` **hardcodeado** para todo slot, sin importar si `sesion_existente` ya tenía `asesor_id` asignado — por ejemplo una sesión que ya es parte de una serie recurrente confirmada por el admin, con asesor fijo desde su creación. El frontend (`CalendarioDisponibilidad`/`FlujReserva`) ya tenía la lógica correcta (`{slot.asesor && ...}` muestra el asesor real; si no, el aviso genérico) — el bug era 100% del backend, nunca mandaba el dato aunque existiera. Fix: nuevo helper `_asesor_de_sesion()` que arma el mismo shape de `asesor` que ya usa el branch normal (con asesor) a partir de `sesion_existente.asesor` (se agregó `joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario)` a la query de sesiones para no disparar lazy-loads). Sin cambios de frontend — ya sabía interpretar el dato correctamente, solo nunca le llegaba. |
| Inscripción pasa a ser invitación: el cliente elige modalidad y método de pago, no el admin (2026-08-04) | Corrección de diseño confirmada por Daniel — retoma el acuerdo de varias sesiones atrás ("el admin le ofrece 2 opciones al cliente... el cliente elige la modalidad según lo que más le convenga", pospuesto entonces porque no existía login de cliente). Ahora que `reclamar/activar cuenta` ya está construido, se puede implementar: `InscripcionSerie.modalidad_cobro` pasa a nullable y gana un `estado` (`invitada`/`confirmada`/`cancelada`). El admin (camino 1, inscribir a un cliente existente) o el propio flujo de confirmar una solicitud como serie (camino 2) ya NO capturan modalidad ni método de pago — solo crean la invitación. Un endpoint nuevo del lado del cliente, en su portal, es donde elige modalidad + método y ahí se generan las reservas. `metodo_pago=online` queda con el contrato listo pero depende de que `PROMPT_G_pago_mercadopago.md` esté implementado — mientras tanto responde un error de negocio claro, no lo intenta procesar. Ver `PROMPT_I_invitacion_cliente_elige.md`, que se corre después de `PROMPT_H` (asume que `precio_paquete` ya vive en la serie). `PROMPT_H` se ajustó para no fijar el resto del diseño de `InscribirClientesSerieModal.jsx` — eso lo resuelve `PROMPT_I`. |
| Reclamar/activar cuenta — implementado, con 4 decisiones que no estaban en el plan original (2026-08-03) | (1) **`POST /auth/activar-cuenta` quedó global** (`main.py`, junto a login/register), no bajo `/{tenant_slug}` como sugería el prompt original — el token ya identifica al usuario sin ambigüedad y la respuesta reusa `_resolver_membresia()` (tenant-agnóstica); meter el slug en la ruta hubiera sido decorativo. La ruta real de `reclamar-cuenta` tampoco es `/t/{tenant_slug}/...` (eso es solo el patrón de rutas del *frontend*) sino `/api/v2/{tenant_slug}/reclamar-cuenta`, en `router` (mismo prefijo que el resto de endpoints de tenant), no en `main.py`. (2) Se agregó `GET /auth/activar-cuenta/validar?token=...` (no estaba en el plan): sin él, el usuario llenaría el formulario de contraseña nueva antes de enterarse de que el link expiró; es de solo lectura, no consume el token, responde solo `{valido}`. (3) Se cerró el hueco de seguridad real en `POST /auth/register` (`app/main.py`): antes, cualquiera que supiera el email de un invitado (`es_invitado=True`, sin `password_hash`) podía "completar su registro" con una password nueva sin probar ser dueño del correo — ese branch se quitó, un email existente siempre es 409 ahora. (4) `inscribir_cliente_en_serie()` cambió su contrato de retorno de `InscripcionSerie` a `{"inscripcion","cliente","acceso_token_plano"}` (y `confirmar_solicitud_como_serie()` en cascada) para poder propagar el token de activación a los 2 routers que la llaman sin generarlo N veces (una por sesión creada) — `crear_reserva()` ganó el parámetro `generar_token_activacion` para que las llamadas internas de la serie no lo dupliquen. |
| Fix: `errorMensaje()` duplicado en ~13 archivos no manejaba errores de negocio `{codigo, mensaje}` — React error #31 (2026-08-04) | Reportado por Daniel: `Uncaught Error: Minified React error #31 ... object with keys {codigo, mensaje}` en el navegador. Causa: `_http_de()` envuelve `ReservaError` como `HTTPException(status, {"codigo","mensaje"})`, que FastAPI serializa como `{"detail": {"codigo","mensaje"}}`; `openapi-fetch` no desenvuelve ese `detail`, así que `fetchErr.detail` es un STRING en errores simples (`HTTPException(404, "texto")`) pero un OBJETO en errores de negocio. El helper local `function errorMensaje(err) { return err?.mensaje ?? err?.detail ?? err?.message ?? JSON.stringify(err) }`, duplicado copy-paste en ~12 componentes, no distinguía los dos casos — con `??` un objeto truthy nunca cae al fallback, así que el objeto crudo terminaba renderizado directo en JSX. Un archivo (`PanelAdmin.jsx`) ya lo había arreglado de forma independiente y correcta. Fix: se extrajo esa versión correcta a `frontend/src/utils/errores.js` (`if (typeof err.detail === 'string') return err.detail; return err?.mensaje ?? err?.detail?.mensaje ?? err?.message ?? JSON.stringify(err)`) y se reemplazaron las copias locales por el import compartido en 13 archivos (`MisSeries`, `SeleccionServicio`, `SeleccionTenant`, `PanelAdmin`, `CrearSerieModal`, `GestionUsuarios`, `HorariosAsesor`, `GestionServicios`, `SeriesTab`, `InscribirClientesSerieModal`, `HorarioServicio`, `GestionUsuariosGlobal`, `ConfigSmtpModal`) — estos dos últimos usaban el patrón sin ni siquiera una función (`fetchErr.detail ?? 'fallback'` inline), mismo bug. De paso se corrigió un bug relacionado (no un crash, pero silencioso) en `FlujReserva.jsx`: su `errorCodigo`/`errorMensaje` propios leían `errorReserva?.codigo`/`errorReserva?.mensaje` en el nivel superior — nunca existían ahí (viven en `errorReserva.detail`), así que el mapeo a `ERROR_MESSAGES` por código de negocio (ej. `cupo_agotado`) nunca disparaba y siempre caía al genérico "Ocurrió un error inesperado." Ahora lee `errorReserva?.detail?.codigo`/`errorReserva?.detail?.mensaje` con fallback al nivel superior por seguridad. |
| Correo: toggle SMTP/API (Resend) por tenant, cuenta centralizada solo para pruebas (2026-08-04) | Diagnóstico confirmado con Daniel: Render bloquea puertos SMTP (25/465/587) en plan **Free** desde sept. 2025 — el backend de MVP Schedule está en ese plan, y el tenant de prueba usa puerto 587 (Gmail), de ahí el `TimeoutError` (el fix de IPv4 ya está en prod y descartó el problema de IPv6, este es un problema de firewall del hosting, no de código). Se evaluó migrar todo a una API de email, pero se descartó **cuenta propia por tenant** (Resend/Postmark/SendGrid exigen verificar dominio propio por DNS — más fricción que SMTP para un tenant sin equipo técnico como "students") y se descartó reemplazar el modelo por completo. Decisión final: `Tenant.smtp_config` gana una clave nueva `metodo: "smtp" | "api"` (sin migración de DB, mismo EncryptedJSON) — default `"smtp"`, no se pierde ni se oculta ninguna credencial ya guardada al cambiar de método. `"api"` usa una cuenta **centralizada de Resend** (dominio verificado por Daniel Consultoría, credenciales globales por variable de entorno `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, no por tenant) vía `httpx` directo contra su REST API (ya es dependencia del proyecto, no se agrega el SDK `resend`). Uso previsto explícito de Daniel: `api` es para pruebas ahora; en producción cada cliente configura su propio SMTP, o si no tiene, Daniel le "renta" el servicio de correo (sigue usando `api` con la cuenta de Daniel como servicio adicional) — por eso el toggle es permanente, no una migración de una sola vía. Ver `PROMPT_J_email_api_resend_toggle.md`. **Actualización (2026-08-04, mismo día):** Daniel confirmó que no va a comprar dominio por ahora — la cuenta de Resend se queda en modo sandbox. Esto significa `RESEND_FROM_EMAIL` debe ser literalmente `onboarding@resend.dev` (única dirección permitida sin dominio) y que Resend solo entrega al Gmail de la cuenta de Daniel, nunca a un destinatario real — `metodo="api"` sirve solo para probar que el código manda el correo, no para el flujo real de invitar clientes de un tenant. El día que se verifique un dominio ambas restricciones se levantan solas cambiando `RESEND_FROM_EMAIL`, sin tocar código. |
| UX del panel admin: conectar pestañas en vez de wizard (2026-08-04) | Daniel probó el flujo completo end-to-end y confirmó que funciona, pero está "disperso por pestañas" sin flujo lineal claro: 7 pestañas planas en `PanelAdmin.jsx` sin jerarquía, sin contadores de trabajo pendiente, y sin ningún hilo que conecte crear un servicio recurrente → crear su serie → invitar clientes → las reservas resultantes en Pendientes. Decisión de alcance/enfoque explícita: **todo el panel admin**, pero **conectar lo existente con badges/CTAs contextuales, no un wizard nuevo** — cero cambios de backend, cero refactor de ubicación de componentes (`SolicitudesTab`/`PendientesTab` se quedan inline en `PanelAdmin.jsx`). Aclaración importante: "aceptar" en el flujo se refería al admin confirmando una `SolicitudReserva` (Flujo B: sesión suelta con confirmación manual), no al cliente aceptando una invitación de serie — `MisSeries.jsx` (portal del cliente) queda fuera de este prompt. Ver `PROMPT_K_ux_panel_admin_conectado.md`. |
| Campana de notificaciones global — nuevo endpoint, `ProtectedRoute` como punto de inyección (2026-08-04) | Extiende PROMPT_K: Daniel pidió que los pasos pendientes se muestren como "burbujas de notificación" visibles desde cualquier pantalla (no solo dentro del panel admin), y sumó 3 categorías nuevas (pagos por vencer, series sin precio de paquete configurado, invitaciones a serie sin aceptar) a las 2 ya cubiertas por los badges de tabs. Hallazgo que cambió el plan: `App.jsx` no tiene ningún header/layout compartido — cada pantalla es dueña del suyo — así que el punto de inyección correcto NO es `App.jsx` sino `ProtectedRoute.jsx` (18 líneas, envuelve toda ruta protegida, hoy solo hace gate de auth/rol): ahí se monta la campana una sola vez para toda la app, condicionada a `usuario.rol` staff (no clientes). A diferencia de PROMPT_K (cero backend), esta sí requiere un endpoint nuevo (`GET /admin/notificaciones-resumen`) porque 2 de las 5 categorías (pagos por vencer con ventana de fecha, invitaciones sin aceptar agregadas across-series) no se pueden calcular limpio solo con endpoints existentes. Umbrales default propuestos (ajustables, no confirmados con Daniel uno por uno): pagos por vencer = sesión entre -7 días y +48h con `estado_pago=PENDIENTE`; invitaciones sin aceptar = `INSCRIPCION.estado=INVITADA` con más de 3 días desde `creado_en`. Los badges de PROMPT_K no se reemplazan, conviven con la campana. Ver `PROMPT_L_notificaciones_campana_global.md`. |
| Precio de paquete por serie — implementado (2026-08-04) | `SerieReserva.precio_paquete` (NUMERIC(12,2) + CHECK no-negativo, `series_reservas` no tenía ninguno antes) reemplaza a `InscripcionSerie.precio_paquete` (columna eliminada). `SerieReservaCreate` gana su propio `model_validator` (no reutiliza `validar_modalidad_cobro()` — esa schema no tiene campo `modalidad_cobro` con qué comparar). `validar_modalidad_cobro()` no cambió de firma; su único call site real (`inscribir_cliente_en_serie()`) ahora le pasa `serie.precio_paquete`. Nuevo código `serie_sin_precio_paquete` (409) para cuando alguien intenta inscribirse como 'paquete' en una serie con `cobro_por_paquete_habilitado=true` pero sin precio configurado — es un estado inconsistente de la serie, no un error de quien se inscribe, así que no reutiliza `modalidad_no_permitida`. **Gap conocido aceptado**: `series_reservas.id=1` (tenant `students-in-trouble`) ya existía con `cobro_por_paquete_habilitado=true` antes de esta migración y quedó con `precio_paquete=NULL` — sin inscripciones 'paquete' activas, así que no hay dinero en juego, pero como no existe ningún endpoint para editar una serie ya creada, esa serie no podrá aceptar inscripciones 'paquete' hasta que exista una pantalla de edición (fuera de alcance de este prompt); si alguien lo intenta, recibe el 409 `serie_sin_precio_paquete`. Encontrado además un 4º call site no listado en el plan original: `registrar_pago_inscripcion_local()` (router) usaba `inscripcion.precio_paquete` como default del monto — se cambió a `serie.precio_paquete` (la función ya cargaba `serie` para otra validación). Fix incidental descubierto al probar en vivo: `_inscripcion_admin_out()` leía `bitacora.detalles` (el campo real del modelo `Bitacora` es `detalles_json`) — causaba un 500 en **cualquier** `POST /admin/series/{id}/inscripciones` exitoso; nunca se había detectado porque el bug de `ck_inscripcion_modalidad` (fila anterior) bloqueaba todo INSERT hasta el día anterior. `InscribirClientesSerieModal.jsx` deliberadamente NO se rediseñó más allá de quitar el input de precio — la selección de modalidad/método de pago por el admin sigue igual, ese rediseño es `PROMPT_I_invitacion_cliente_elige.md` (fila "Inscripción pasa a ser invitación" arriba), que además asume que `precio_paquete` ya vive en la serie. |
| Inscripción a serie como invitación — implementado, con 2 decisiones adicionales (2026-08-04) | `InscripcionSerie` gana `estado` (`invitada`/`confirmada`/`cancelada`, CHECK en mayúsculas — mismo motivo que `ck_inscripcion_modalidad`) y `modalidad_cobro` pasa a nullable. La generación de reservas se factorizó de `inscribir_cliente_en_serie()` a `_generar_reservas_de_inscripcion()`, compartida con el nuevo `confirmar_inscripcion_serie()` (service de `POST /mis-series/{id}/confirmar`, cliente autenticado dueño de la invitación). `SolicitudConfirmarSerieIn` pierde `modalidad_cobro`/`metodo_pago` — ni siquiera el camino de solicitud→serie deja que el staff elija por el cliente. (1) **Reinvitar a alguien con invitación `cancelada` la reactiva** (mismo `id`, vuelve a `invitada`) en vez de bloquear con `cliente_ya_inscrito` — no estaba pedido explícitamente, pero es la misma clase de bug que ya se corrigió para `_vincular_usuario_a_tenant()` (fila 2026-08-03 arriba): una fila vieja bloqueando un reintento legítimo para siempre. Se aplicó proactivamente en vez de esperar a que alguien lo reportara. (2) El selector de método de pago en `MisSeries.jsx` **no ofrece "online" en el dropdown** aunque el backend acepte el valor (y lo rechace con `pago_en_linea_no_disponible`) — no tiene sentido mostrarle al cliente una opción que hoy siempre falla; cuando exista pago en línea real (`PROMPT_G`) hay que agregar la opción de vuelta al frontend. `enviar_email_invitacion_serie()` nueva (branding compartido) combina el aviso de invitación con el CTA de activación en un solo correo cuando el cliente invitado no tiene contraseña, mismo criterio que `enviar_email_confirmacion()`. |
