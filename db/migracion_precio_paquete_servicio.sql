-- Migración: configuración de pago por sesión/paquete pasa de SerieReserva a Servicio
-- Decisión 2026-08-04 (PROMPT_H): los servicios recurrentes heredan la config de pago
-- desde el servicio; la serie ya no tiene campos propios de cobro/precio.
--
-- Verificado en Neon antes de aplicar:
--   - servicios: sin columnas cobro_* ni precio_paquete
--   - series_reservas: con cobro_*, precio_paquete
--   - 2 series con cobro_por_paquete_habilitado=true, ambas servicio_id=5:
--     id=1 precio_paquete=NULL, id=6 precio_paquete=15000.00
-- Backfill: flag a servicios; precio se copia cuando todas las series del servicio
-- comparten el mismo precio no nulo (aquí servicio 5 recibe 15000.00).

BEGIN;

-- 1. Columnas nuevas en servicios
ALTER TABLE servicios
    ADD COLUMN cobro_por_sesion_habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN cobro_por_paquete_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN precio_paquete NUMERIC(12,2);

ALTER TABLE servicios
    ADD CONSTRAINT ck_servicio_precio_paquete_no_negativo
    CHECK (precio_paquete IS NULL OR precio_paquete >= 0);

-- 2. Backfill del flag de paquete desde las series existentes
UPDATE servicios s
SET cobro_por_paquete_habilitado = true
FROM series_reservas sr
WHERE sr.servicio_id = s.id
  AND sr.cobro_por_paquete_habilitado = true;

-- 3. Backfill del precio de paquete SOLO cuando no hay ambigüedad
--    (único precio no nulo entre todas las series del servicio)
WITH precios_por_servicio AS (
    SELECT servicio_id,
           COUNT(DISTINCT precio_paquete) AS num_distintos,
           MAX(precio_paquete) AS un_precio
    FROM series_reservas
    WHERE precio_paquete IS NOT NULL
    GROUP BY servicio_id
)
UPDATE servicios s
SET precio_paquete = pps.un_precio
FROM precios_por_servicio pps
WHERE s.id = pps.servicio_id
  AND pps.num_distintos = 1;

-- 4. Eliminar constraints y columnas de series_reservas
ALTER TABLE series_reservas DROP CONSTRAINT IF EXISTS ck_serie_precio_no_negativo;
ALTER TABLE series_reservas
    DROP COLUMN cobro_por_sesion_habilitado,
    DROP COLUMN cobro_por_paquete_habilitado,
    DROP COLUMN precio_paquete;

COMMIT;
