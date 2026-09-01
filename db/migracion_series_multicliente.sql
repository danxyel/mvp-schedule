-- Migración: series de reservas multicliente
-- Separa SerieReserva (patrón de horario) de InscripcionSerie (cliente inscrito).
-- Hace backfill de series existentes (un solo cliente por serie) hacia inscripciones_serie.
-- Ejecutar con la app detenida. Revisar antes de aplicar a Neon.

BEGIN;

-- 1. Tabla de inscripciones ---------------------------------------------------
CREATE TABLE IF NOT EXISTS inscripciones_serie (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    serie_id INTEGER NOT NULL REFERENCES series_reservas(id) ON DELETE CASCADE,
    cliente_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    modalidad_cobro VARCHAR(20) NOT NULL,
    precio_paquete NUMERIC(12, 2),
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_inscripcion_modalidad CHECK (modalidad_cobro IN ('sesion', 'paquete')),
    CONSTRAINT ck_inscripcion_precio_no_negativo CHECK (precio_paquete IS NULL OR precio_paquete >= 0),
    CONSTRAINT uq_inscripcion_serie_cliente UNIQUE (serie_id, cliente_usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_inscripciones_serie_serie ON inscripciones_serie(serie_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_serie_cliente ON inscripciones_serie(tenant_id, cliente_usuario_id);

-- 2. Backfill: una inscripción por cada serie existente -----------------------
-- La modalidad se toma de las reservas hijas con modalidad_cobro no nula;
-- si no hay ninguna, default a 'sesion'.
INSERT INTO inscripciones_serie (
    tenant_id,
    serie_id,
    cliente_usuario_id,
    modalidad_cobro,
    precio_paquete,
    creado_en
)
SELECT
    s.tenant_id,
    s.id AS serie_id,
    s.cliente_usuario_id,
    COALESCE(
        (SELECT r.modalidad_cobro
         FROM reservas r
         WHERE r.serie_id = s.id
           AND r.modalidad_cobro IS NOT NULL
         LIMIT 1),
        'sesion'
    ) AS modalidad_cobro,
    s.precio_paquete,
    s.creado_en
FROM series_reservas s
ON CONFLICT (serie_id, cliente_usuario_id) DO NOTHING;

-- 3. Agregar inscripcion_id a reservas ----------------------------------------
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS inscripcion_id INTEGER
    REFERENCES inscripciones_serie(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_inscripcion ON reservas(inscripcion_id);

-- 4. Vincular reservas existentes con sus inscripciones -----------------------
-- Se basa en que crear_serie_reservas() siempre guardó creado_por_usuario_id
-- igual al cliente de la serie (verificación previa confirmada).
UPDATE reservas r
SET inscripcion_id = i.id
FROM inscripciones_serie i
WHERE r.serie_id = i.serie_id
  AND r.creado_por_usuario_id = i.cliente_usuario_id
  AND r.inscripcion_id IS NULL;

-- 5. Quitar campos que migraron a inscripciones --------------------------------
ALTER TABLE series_reservas DROP COLUMN IF EXISTS cliente_usuario_id;
ALTER TABLE series_reservas DROP COLUMN IF EXISTS precio_paquete;

-- 6. Ajustar índices obsoletos de series_reservas ----------------------------
DROP INDEX IF EXISTS idx_series_cliente;

COMMIT;
