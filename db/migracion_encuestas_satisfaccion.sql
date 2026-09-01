-- Migración: encuestas de satisfacción (PROMPT_AA)
-- Crea el enum tipoformulario, agrega tipo a formularios, grupo_matriz a campos,
-- encuesta_satisfaccion_formulario_id a servicios, y la tabla encuesta_envios.

BEGIN;

-- 1. Enum para distinguir intake vs satisfacción
-- Labels en MAYÚSCULA: SQLAlchemy graba enums Python por su .name (no .value)
-- por default (ver EstadoReserva, RolUsuario, etc. — mismo patrón en todo el
-- proyecto). Con labels en minúscula el driver manda "SATISFACCION" contra un
-- tipo que solo conoce "satisfaccion" -> error nativo de Postgres.
CREATE TYPE tipoformulario AS ENUM ('INTAKE', 'SATISFACCION');

-- 2. Columna tipo en formularios (default intake preserva el significado previo)
ALTER TABLE formularios
    ADD COLUMN tipo tipoformulario NOT NULL DEFAULT 'INTAKE';

-- 3. Columna grupo_matriz en campos de formulario (para agrupar filas de una matriz)
ALTER TABLE campo_formularios
    ADD COLUMN grupo_matriz VARCHAR(255) NULL;

-- 4. Servicio apunta a la plantilla de encuesta de satisfacción que le corresponde
ALTER TABLE servicios
    ADD COLUMN encuesta_satisfaccion_formulario_id INTEGER NULL,
    ADD CONSTRAINT fk_servicio_encuesta_satisfaccion
        FOREIGN KEY (encuesta_satisfaccion_formulario_id)
        REFERENCES formularios(id)
        ON DELETE SET NULL;

-- 5. Tabla de envíos de encuesta con token de un solo uso
CREATE TABLE encuesta_envios (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    formulario_id INTEGER NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
    reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    respondido_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_encuesta_envios_token_hash ON encuesta_envios(token_hash);
CREATE INDEX idx_encuesta_envios_reserva ON encuesta_envios(reserva_id);
CREATE INDEX idx_encuesta_envios_formulario ON encuesta_envios(formulario_id);

COMMIT;
