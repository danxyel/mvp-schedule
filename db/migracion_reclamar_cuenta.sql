-- Migración: reclamar/activar cuenta por email
-- Token genérico de acceso de un solo uso (activación hoy; reusable a
-- futuro para "olvidé mi contraseña" — de ahí el nombre genérico, no
-- "activacion_token"). Nunca se guarda el valor en claro, solo su hash.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acceso_token_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acceso_token_expira_en TIMESTAMP WITH TIME ZONE;

COMMIT;
