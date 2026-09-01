-- Fix: ck_inscripcion_modalidad usaba valores en minúsculas ('sesion',
-- 'paquete'), pero SQLAlchemy serializa el enum Python ModalidadCobro por
-- su .name (mayúsculas: 'SESION', 'PAQUETE') salvo que se configure
-- values_callable — que no está configurado aquí, igual que en el resto
-- del proyecto (ver estadosolicitud, que sí usa mayúsculas). Cada INSERT a
-- inscripciones_serie truena con IntegrityError/CheckViolation desde que
-- existe esta tabla (confirmado: sqlalchemy.exc.IntegrityError ...
-- CheckViolation ... ck_inscripcion_modalidad, en producción). Como todo
-- INSERT ha fallado, no hay filas existentes que limpiar.

BEGIN;

ALTER TABLE inscripciones_serie DROP CONSTRAINT IF EXISTS ck_inscripcion_modalidad;
ALTER TABLE inscripciones_serie ADD CONSTRAINT ck_inscripcion_modalidad
    CHECK (modalidad_cobro IN ('SESION', 'PAQUETE'));

COMMIT;
