# API CONTRACT — MVP Schedule v2.2
> Generado desde `/openapi.json`. Este archivo es la fuente de verdad para el frontend y para Stitch.
> **No inventar campos. No usar estados que no estén en esta lista.**

---

## BASE URL
```
http://localhost:8000/api/v2/{tenant_slug}
```
En producción: `https://tu-dominio.com/api/v2/{tenant_slug}`

## AUTENTICACIÓN
JWT Bearer Token en el header:
```
Authorization: Bearer <token>
```
- Endpoints marcados con 🔒 requieren token obligatorio
- Endpoints marcados con 👤 aceptan token opcional (más info si viene)
- Endpoints sin marca son públicos

---

## ENUMS — ESTADOS POSIBLES
El frontend SOLO puede renderizar estos valores. Cualquier otro es un bug.

### Estado de Sesión
| Valor | Qué significa | Qué puede hacer el cliente |
|-------|--------------|---------------------------|
| `abierta` | Acepta reservas | Puede reservar |
| `confirmada` | Tiene cupo mínimo cubierto | Puede reservar si hay lugar |
| `llena` | Sin lugares disponibles | Mostrar "Lleno", ofrecer lista de espera |
| `cancelada` | Cancelada por admin | No se puede reservar |
| `completada` | Ya ocurrió | Solo lectura histórica |

### Estado de Reserva
| Valor | Qué significa | Qué mostrar |
|-------|--------------|-------------|
| `pendiente` | Recién creada | "Procesando..." |
| `en_espera` | Esperando pago online | Timer de hold + botón de pago |
| `confirmada` | Pagada y confirmada | "Confirmada ✓" + meet_url si aplica |
| `cancelada` | Cancelada | "Cancelada" + motivo si existe |
| `no_show` | No se presentó | Badge rojo |
| `completada` | Asistió y terminó | "Completada ✓" |

### Estado de Pago
| Valor | Qué mostrar |
|-------|-------------|
| `pendiente` | "Pago pendiente" |
| `completado` | "Pagado ✓" |
| `reembolsado` | "Reembolsado" |
| `exento` | "Sin costo" |

### Otros enums
- **Modalidad:** `presencial` · `virtual` · `hibrida`
- **Método de pago:** `online` · `local` · `registro`
- **Canal:** `web` · `admin` · `whatsapp` · `api`

---

## ERRORES DE NEGOCIO
Estos errores tienen HTTP 4xx con este formato:
```json
{ "codigo": "cupo_agotado", "mensaje": "La sesión ya no tiene lugares disponibles" }
```

| Código | HTTP | Qué mostrar al usuario |
|--------|------|----------------------|
| `cupo_agotado` | 409 | "Este lugar ya no está disponible. Elige otro horario." |
| `franja_ocupada` | 409 | "El horario ya no está disponible." |
| `reserva_duplicada` | 409 | "Ya tienes una reserva activa en esta sesión." |
| `conflicto_concurrencia` | 409 | "Alguien más reservó al mismo tiempo. Intenta de nuevo." |
| `sesion_cerrada` | 409 | "Esta sesión ya no acepta inscripciones." |
| `sesion_no_encontrada` | 404 | "La sesión no existe." |
| `fuera_de_politica` | 400 | "El plazo para cancelar ya venció." |
| `estado_no_cancelable` | 400 | "Esta reserva no se puede cancelar." |
| `identidad_requerida` | 401 | Redirigir a login |
| `permiso_denegado` | 403 | "No tienes permiso para esta acción." |

---

## ENDPOINTS

---

### 1. Disponibilidad del día
**`GET /servicios/{servicio_id}/disponibilidad`** — Público

Carga el calendario de slots para un día. El frontend llama esto cada vez que el usuario cambia de fecha.

**Query params:**
- `fecha` (requerido): datetime con offset — `2026-08-01T00:00:00-06:00`
- `asesor_id` (opcional): filtrar por asesor específico

**Respuesta `200`:**
```json
{
  "fecha": "2026-08-01T06:00:00Z",
  "servicio_id": 1,
  "timezone": "America/Mexico_City",
  "slots": [
    {
      "fecha_hora_inicio": "2026-08-01T16:00:00Z",
      "fecha_hora_fin": "2026-08-01T17:00:00Z",
      "disponible": true,
      "sesion_existente_id": 42,
      "cupo_disponible": 3,
      "asesor": { "id": 1, "nombre": "Ana López", "avatar_url": null, "bio": null },
      "motivo_no_disponible": null
    },
    {
      "fecha_hora_inicio": "2026-08-01T17:00:00Z",
      "fecha_hora_fin": "2026-08-01T18:00:00Z",
      "disponible": false,
      "sesion_existente_id": null,
      "cupo_disponible": null,
      "asesor": null,
      "motivo_no_disponible": "bloqueado"
    }
  ]
}
```

**Reglas de UI:**
- `disponible: false` + `motivo_no_disponible: "cupo_lleno"` → botón deshabilitado "Lleno"
- `disponible: false` + `motivo_no_disponible: "bloqueado"` → slot gris sin botón
- `disponible: false` + `motivo_no_disponible: "ocupado"` → slot gris sin botón
- Mostrar las horas en el timezone de la respuesta, nunca en UTC

---

### 2. Listado de sesiones abiertas
**`GET /servicios/{servicio_id}/sesiones`** — Público

**Query params:**
- `desde` / `hasta`: rango de fechas con offset
- `limit` (1-200, default 50)
- `offset` (default 0)

**Respuesta `200`:**
```json
{
  "items": [
    {
      "id": 42,
      "servicio_id": 1,
      "fecha_hora_inicio": "2026-08-01T16:00:00Z",
      "fecha_hora_fin": "2026-08-01T17:00:00Z",
      "timezone": "America/Mexico_City",
      "estado": "abierta",
      "cupo_maximo": 10,
      "inscritos": 3,
      "lugares_disponibles": 7,
      "asesor": { "id": 1, "nombre": "Ana López", "avatar_url": null, "bio": null },
      "sede": { "id": 1, "nombre": "Sede Polanco", "direccion": "...", "timezone": "America/Mexico_City" }
    }
  ],
  "paginacion": { "total": 24, "limit": 50, "offset": 0 }
}
```

---

### 3. Detalle de sesión (público)
**`GET /sesiones/{sesion_id}`** — 👤 Opcional

Igual que el listado pero agrega: `modalidad`, `servicio_nombre`, `duracion_minutos`, `precio`, `moneda`.

`meet_url` solo viene si el usuario tiene una reserva confirmada en esa sesión.

---

### 4. Detalle de sesión (admin)
**`GET /sesiones/{sesion_id}/admin`** — 🔒 Staff

Igual que el detalle público más:
- `notas_internas`
- `google_event_id`
- `creado_por_tipo`
- `version_id`
- `reservas`: lista con folio, estado, estado_pago, nombre y email de cada inscrito

---

### 5. Crear reserva ⚠️ El más complejo
**`POST /reservas`** — 🔒 Autenticado

**Body:**
```json
{
  "servicio_id": 1,
  "fecha_hora_inicio": "2026-08-01T16:00:00-06:00",
  "sesion_id": 42,
  "asesor_id": null,
  "sede_id": null,
  "beneficiario_id": null,
  "notas_cliente": "Texto libre del cliente",
  "metodo_pago": "online",
  "canal": "web",
  "email_invitado": null,
  "nombre_invitado": null,
  "telefono_invitado": null,
  "respuestas_formulario": null
}
```

**Campos obligatorios:** `servicio_id`, `fecha_hora_inicio`

**Regla clave:** Si el usuario eligió una sesión del calendario, mandar `sesion_id`. Si no, el backend asigna.

**Respuesta `201`:**
```json
{
  "reserva": { "...": "ver ReservaOut abajo" },
  "checkout": {
    "url": "https://checkout.stripe.com/...",
    "proveedor": "stripe",
    "expira_en": "2026-08-01T16:15:00Z"
  },
  "mensaje": "Reserva en espera de pago",
  "sesion_asignada_id": 42,
  "sesion_creada": false
}
```

**Flujos posibles según respuesta:**
- `checkout` viene con URL → redirigir al usuario a pagar, mostrar timer si `hold_expira_en` existe
- `checkout` es null + `reserva.estado: "confirmada"` → mostrar pantalla de éxito
- Error `cupo_agotado` → mostrar mensaje y volver al calendario
- Error `conflicto_concurrencia` → mostrar mensaje y reintentar automáticamente (1 vez)

---

### 6. Consultar reserva
**`GET /reservas/{folio}`** — 🔒 Autenticado (solo el titular o staff)

**Respuesta `200` — ReservaOut:**
```json
{
  "id": 1,
  "folio": "R260801-AB12CD34",
  "codigo_confirmacion": "XK7MNPQ2",
  "estado": "confirmada",
  "estado_pago": "completado",
  "sesion_id": 42,
  "servicio_id": 1,
  "servicio_nombre": "Consultoría Individual",
  "fecha_hora_inicio": "2026-08-01T16:00:00Z",
  "fecha_hora_fin": "2026-08-01T17:00:00Z",
  "timezone": "America/Mexico_City",
  "modalidad": "virtual",
  "precio_final": "1500.00",
  "moneda": "MXN",
  "meet_url": "https://meet.google.com/...",
  "sede": null,
  "asesor": { "id": 1, "nombre": "Ana López", "avatar_url": null, "bio": null },
  "hold_expira_en": null,
  "notas_cliente": null,
  "creado_en": "2026-07-30T12:00:00Z"
}
```

`meet_url` solo viene cuando `estado: "confirmada"`.

---

### 7. Mis reservas
**`GET /mis-reservas`** — 🔒 Autenticado

**Query params:**
- `incluir_pasadas` (bool, default false)
- `limit` / `offset`

Devuelve array de ReservaOut.

---

### 8. Cancelar reserva
**`POST /reservas/{folio}/cancelar`** — 🔒 Autenticado

**Body:**
```json
{ "motivo": "No puedo asistir" }
```

**Respuesta `200`:**
```json
{ "ok": true, "mensaje": "Reserva cancelada", "detalle": { "folio": "R260801-AB12CD34" } }
```

---

### 9. Reagendar sesión
**`POST /sesiones/{sesion_id}/reagendar`** — 🔒 Staff

**Body:**
```json
{
  "nueva_fecha_hora_inicio": "2026-08-02T10:00:00-06:00",
  "nuevo_asesor_id": null,
  "nueva_sede_id": null,
  "motivo": "Cambio de agenda"
}
```

---

### 10. Check-in
**`POST /reservas/{folio}/checkin`** — 🔒 Staff

Sin body. Marca asistencia. Devuelve `OperacionOut`.

---

### 11. Completar sesión
**`POST /sesiones/{sesion_id}/completar`** — 🔒 Staff

Sin body. Cierra la sesión. Devuelve `OperacionOut`.

---

## PANTALLAS REQUERIDAS (en orden de construcción)

| # | Pantalla | Endpoint principal | Auth |
|---|----------|--------------------|------|
| 1 | Calendario de disponibilidad | `GET /disponibilidad` | No |
| 2 | Detalle de sesión | `GET /sesiones/{id}` | Opcional |
| 3 | Flujo de reserva | `POST /reservas` | Sí |
| 4 | Confirmación / pago pendiente | (estado de respuesta) | Sí |
| 5 | Mis reservas | `GET /mis-reservas` | Sí |
| 6 | Detalle de reserva | `GET /reservas/{folio}` | Sí |
| 7 | Cancelar reserva | `POST /cancelar` | Sí |
| 8 | Panel admin — sesiones | `GET /sesiones/{id}/admin` | Staff |
| 9 | Panel admin — reagendar | `POST /reagendar` | Staff |
| 10 | Panel admin — check-in | `POST /checkin` | Staff |

---

## REGLAS PARA EL AGENTE (opencode / Stitch)

1. **Nunca hacer fetch directo.** Usar el cliente generado desde `openapi.json`.
2. **Nunca inventar un estado.** Solo los de la tabla de enums.
3. **Siempre manejar los 8 errores de negocio** — tienen mensajes definidos arriba.
4. **Las fechas siempre tienen offset** — nunca mandar un datetime sin zona horaria.
5. **`sesion_id` en el POST /reservas** — si el usuario eligió del calendario, mandarlo. No omitirlo.
6. **`meet_url`** — solo mostrar cuando `estado === "confirmada"`.
7. **Timer de hold** — si `hold_expira_en` viene en la reserva, mostrar cuenta regresiva.
8. **Una pantalla por tarea.** No integrar varias pantallas en un solo prompt.
