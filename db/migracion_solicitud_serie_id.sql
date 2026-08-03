-- Migración: trazabilidad de solicitud convertida en serie recurrente
-- Agrega serie_id a solicitudes_reserva para saber que una solicitud
-- generó una serie completa, no una sola reserva.
-- Ejecutar con la app detenida. Revisar antes de aplicar a Neon.

BEGIN;

ALTER TABLE solicitudes_reserva
  ADD COLUMN IF NOT EXISTS serie_id INTEGER REFERENCES series_reservas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_serie
  ON solicitudes_reserva (tenant_id, serie_id);

COMMIT;
