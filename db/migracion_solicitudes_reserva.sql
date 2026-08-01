-- ============================================================
-- Migración: SolicitudReserva — confirmación manual (Sprint 2 #10)
-- Tabla NUEVA, separada de Reserva/Sesion (decisión con Daniel).
-- Solo se convierte en Reserva/Sesion real al aceptarla (Tarea 3).
-- Espejo exacto de app/models_v2_2.py -> class SolicitudReserva
-- Ejecutar con la app detenida. Revisada antes de aplicar a Neon.
-- ============================================================

BEGIN;

CREATE TYPE estadosolicitud AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA');

CREATE TABLE solicitudes_reserva (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    cliente_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_hora_propuesta TIMESTAMPTZ NOT NULL,
    duracion_minutos INTEGER NOT NULL,
    notas_cliente TEXT,
    estado estadosolicitud NOT NULL DEFAULT 'PENDIENTE',
    asesor_id INTEGER REFERENCES usuario_tenants(id) ON DELETE SET NULL,
    motivo_rechazo VARCHAR(500),
    reserva_id INTEGER REFERENCES reservas(id) ON DELETE SET NULL,
    resuelto_por_id INTEGER REFERENCES usuario_tenants(id) ON DELETE SET NULL,
    resuelto_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitudes_estado ON solicitudes_reserva (tenant_id, estado);
CREATE INDEX idx_solicitudes_cliente ON solicitudes_reserva (tenant_id, cliente_usuario_id, creado_en);

COMMIT;
