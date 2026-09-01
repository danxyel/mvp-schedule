-- Migración: la inscripción a serie pasa a ser una invitación
-- El cliente elige modalidad_cobro/metodo_pago desde su portal, no el
-- admin al inscribirlo. modalidad_cobro pasa a nullable (NULL = todavía
-- no elegida) y se agrega estado (invitada/confirmada/cancelada).
--
-- inscripciones_serie tiene 1 sola fila real hoy (id=4), con reservas ya
-- generadas bajo el modelo viejo — se backfillea como CONFIRMADA (default
-- de la columna), que es su estado real.
--
-- Valores del CHECK en MAYÚSCULAS: SQLEnum sin values_callable serializa
-- por el .name del enum de Python, no por .value (mismo motivo del fix de
-- ck_inscripcion_modalidad, ver HANDOFF 2026-08-04).

BEGIN;

ALTER TABLE inscripciones_serie ALTER COLUMN modalidad_cobro DROP NOT NULL;

ALTER TABLE inscripciones_serie ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA';
ALTER TABLE inscripciones_serie ADD CONSTRAINT ck_inscripcion_estado
    CHECK (estado IN ('INVITADA', 'CONFIRMADA', 'CANCELADA'));

COMMIT;
