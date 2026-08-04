-- Migración: precio de paquete vuelve a la serie, deja de capturarse por cliente
-- Confirmado en Neon antes de aplicar: inscripciones_serie tiene 1 fila,
-- precio_paquete NULL en todas — seguro dropear sin backfill.
-- Gap conocido (aceptado): la serie_reservas.id=1 ya existente tiene
-- cobro_por_paquete_habilitado=true y no tiene inscripciones 'paquete'
-- activas; quedará con precio_paquete=NULL tras esta migración. No hay
-- endpoint para editar una serie ya creada — queda documentado en
-- HANDOFF.md como deuda técnica, no se backfillea con un valor inventado.

BEGIN;

ALTER TABLE series_reservas ADD COLUMN precio_paquete NUMERIC(12,2);
ALTER TABLE series_reservas ADD CONSTRAINT ck_serie_precio_no_negativo
    CHECK (precio_paquete IS NULL OR precio_paquete >= 0);

ALTER TABLE inscripciones_serie DROP CONSTRAINT IF EXISTS ck_inscripcion_precio_no_negativo;
ALTER TABLE inscripciones_serie DROP COLUMN precio_paquete;

COMMIT;
