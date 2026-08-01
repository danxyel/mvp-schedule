-- ============================================================
-- Migración: HorarioDisponibilidad entidad_tipo='servicio'
-- Franja general de propuesta para servicios con confirmación manual.
-- El horario de servicio define la VENTANA de propuesta del cliente;
-- la disponibilidad real del asesor se valida al asignarlo
-- (POST /admin/reservas/{reserva_id}/asignar-asesor). No agrega
-- columnas ni tablas: solo amplía el CHECK existente.
-- Ejecutar con la app detenida. Revisada antes de aplicar a Neon.
-- ============================================================

BEGIN;

ALTER TABLE horario_disponibilidad
  DROP CONSTRAINT IF EXISTS ck_hd_entidad_tipo;

ALTER TABLE horario_disponibilidad
  ADD CONSTRAINT ck_hd_entidad_tipo
    CHECK (entidad_tipo IN ('asesor','recurso','servicio'));

COMMIT;
