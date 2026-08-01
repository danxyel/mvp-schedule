-- Migración: Series de Reservas (reservas recurrentes)
-- Crea tabla series_reservas y agrega campos a reservas y tenants

BEGIN;

-- 1. Crear tabla series_reservas
CREATE TABLE series_reservas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    cliente_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    asesor_id INTEGER REFERENCES usuario_tenants(id) ON DELETE SET NULL,

    -- Patrón de recurrencia
    frecuencia VARCHAR(20) NOT NULL,
    dia_semana INTEGER,
    hora_inicio TIME NOT NULL,
    duracion_minutos INTEGER NOT NULL DEFAULT 60,
    num_repeticiones INTEGER NOT NULL DEFAULT 1,
    fecha_inicio DATE NOT NULL,

    -- Modalidades de cobro
    cobro_por_sesion_habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    cobro_por_paquete_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
    precio_paquete NUMERIC(12, 2),

    -- Estado
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_serie_repeticiones_minimo CHECK (num_repeticiones >= 1),
    CONSTRAINT ck_serie_repeticiones_maximo CHECK (num_repeticiones <= 50),
    CONSTRAINT ck_serie_dia_semana_rango CHECK (dia_semana IS NULL OR (dia_semana >= 0 AND dia_semana <= 6)),
    CONSTRAINT ck_serie_duracion_positiva CHECK (duracion_minutos > 0),
    CONSTRAINT ck_serie_precio_no_negativo CHECK (precio_paquete IS NULL OR precio_paquete >= 0)
);

-- Índices
CREATE INDEX idx_series_cliente ON series_reservas(tenant_id, cliente_usuario_id);
CREATE INDEX idx_series_estado ON series_reservas(tenant_id, estado);

-- 2. Agregar columnas a tabla reservas
ALTER TABLE reservas ADD COLUMN serie_id INTEGER REFERENCES series_reservas(id) ON DELETE SET NULL;
ALTER TABLE reservas ADD COLUMN modalidad_cobro VARCHAR(20);

-- Índices para consultas frecuentes
CREATE INDEX idx_reservas_serie ON reservas(serie_id);

-- 3. Agregar columna a tabla tenants
ALTER TABLE tenants ADD COLUMN max_reservas_serie INTEGER NOT NULL DEFAULT 20;

COMMIT;
