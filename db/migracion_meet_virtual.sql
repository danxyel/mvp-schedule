-- ============================================================
-- Migración: campos para Google Meet virtual, grabaciones y Drive
-- Espejo exacto de:
--   Tenant.google_meet_config
--   Servicio.drive_folder_id
--   Sesion.meet_space_name, drive_recording_link, drive_transcript_link, contenido_enviado_en
--   SerieReserva.drive_folder_id
-- Ejecutar con la app detenida.
-- ============================================================

BEGIN;

ALTER TABLE tenants
    ADD COLUMN google_meet_config JSONB;

ALTER TABLE servicios
    ADD COLUMN drive_folder_id VARCHAR(255);

ALTER TABLE sesiones
    ADD COLUMN meet_space_name VARCHAR(255),
    ADD COLUMN drive_recording_link VARCHAR(500),
    ADD COLUMN drive_transcript_link VARCHAR(500),
    ADD COLUMN contenido_enviado_en TIMESTAMPTZ;

ALTER TABLE series_reservas
    ADD COLUMN drive_folder_id VARCHAR(255);

COMMIT;
