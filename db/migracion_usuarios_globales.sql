-- Migración: gestión global de usuarios (superadmin)
-- Agrega estado de cuenta a Usuario para poder desactivar/purgar desde
-- cualquier tenant. NO toca reservas/sesiones/solicitudes_reserva/
-- inscripciones_serie (decisión explícita: son datos operativos de tablas
-- core, no se migran sus FKs hacia usuarios).

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS desactivado_en TIMESTAMP WITH TIME ZONE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS purgado_en TIMESTAMP WITH TIME ZONE;

COMMIT;
