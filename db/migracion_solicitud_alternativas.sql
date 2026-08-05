-- ============================================================
-- Migración: alternativas al rechazar una SolicitudReserva
-- Espejo exacto de app/models_v2_2.py -> SolicitudAlternativa
-- y del campo SolicitudReserva.alternativa_aceptada_id
-- Ejecutar con la app detenida.
-- ============================================================

BEGIN;

CREATE TABLE solicitud_alternativas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes_reserva(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitud_alternativas_solicitud ON solicitud_alternativas (solicitud_id);

ALTER TABLE solicitudes_reserva
    ADD COLUMN alternativa_aceptada_id INTEGER
    REFERENCES solicitud_alternativas(id) ON DELETE SET NULL;

COMMIT;
