# MVP Schedule — Documento Maestro de Contexto
> Versión: 2.2 · Última actualización: 2026-07-31
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
- **Variables de entorno:** .env con DATABASE_URL, JWT_SECRET_KEY, TENANT_SECRETS_KEY (Fernet base64)

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

### Frontend ✅
- Login con persistencia en sessionStorage
- Registro de usuario (Registro.jsx)
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
