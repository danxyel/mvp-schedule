-- ============================================================
-- Migración: desacoplar "permite solicitudes" de "requiere confirmación"
-- Espejo exacto de app/models_v2_2.py -> Servicio.permite_solicitudes
-- Ejecutar con la app detenida.
-- ============================================================

BEGIN;

ALTER TABLE servicios
    ADD COLUMN permite_solicitudes BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
