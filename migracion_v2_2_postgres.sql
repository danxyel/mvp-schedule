-- ============================================================
-- Migración v2.1 → v2.2.1 · PostgreSQL 14+
-- Ejecutar con la aplicación detenida.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Timezone
ALTER TABLE sesiones
  ALTER COLUMN fecha_hora_inicio TYPE TIMESTAMPTZ
    USING fecha_hora_inicio AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN fecha_hora_fin TYPE TIMESTAMPTZ
    USING fecha_hora_fin AT TIME ZONE 'America/Mexico_City';

ALTER TABLE reservas
  ALTER COLUMN hold_expira_en TYPE TIMESTAMPTZ
    USING hold_expira_en AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN pagado_en TYPE TIMESTAMPTZ
    USING pagado_en AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN cancelado_en TYPE TIMESTAMPTZ
    USING cancelado_en AT TIME ZONE 'America/Mexico_City';

ALTER TABLE horario_bloqueos
  ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ
    USING fecha_inicio AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN fecha_fin TYPE TIMESTAMPTZ
    USING fecha_fin AT TIME ZONE 'America/Mexico_City';

-- 2. Columnas nuevas
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS hold_minutos INTEGER NOT NULL DEFAULT 15;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_invitado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS version_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NULL;

UPDATE usuarios SET es_invitado = TRUE, password_hash = NULL
  WHERE password_hash = '' OR password_hash IS NULL;

UPDATE reservas
  SET codigo_confirmacion = upper(substr(md5(random()::text || id::text), 1, 8))
  WHERE codigo_confirmacion IS NULL OR codigo_confirmacion = '';

ALTER TABLE reservas ALTER COLUMN codigo_confirmacion SET NOT NULL;

-- 3. Reconciliar inscritos
UPDATE sesiones s SET inscritos = COALESCE(sub.n, 0)
FROM (
  SELECT sesion_id, COUNT(*) AS n FROM reservas
  WHERE estado IN ('PENDIENTE', 'EN_ESPERA', 'CONFIRMADA') GROUP BY sesion_id
) sub WHERE s.id = sub.sesion_id;

UPDATE sesiones SET inscritos = 0 WHERE id NOT IN (
  SELECT DISTINCT sesion_id FROM reservas
  WHERE estado IN ('PENDIENTE', 'EN_ESPERA', 'CONFIRMADA')
);

DO $$
DECLARE sobreventa INTEGER;
BEGIN
  SELECT COUNT(*) INTO sobreventa FROM sesiones WHERE inscritos > cupo_maximo;
  IF sobreventa > 0 THEN
    RAISE EXCEPTION 'Hay % sesiones con sobreventa. Resolver antes de migrar.', sobreventa;
  END IF;
END $$;

-- 4. EXCLUDE traslape asesor
ALTER TABLE sesiones
  ADD CONSTRAINT ex_sesion_asesor_sin_traslape
  EXCLUDE USING gist (
    tenant_id WITH =,
    asesor_id WITH =,
    tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)') WITH &&
  )
  WHERE (asesor_id IS NOT NULL AND estado IN ('ABIERTA', 'CONFIRMADA', 'LLENA'));

-- 5. Defensa del cupo
ALTER TABLE sesiones
  ADD CONSTRAINT ck_sesion_inscritos_cupo CHECK (inscritos >= 0 AND inscritos <= cupo_maximo),
  ADD CONSTRAINT ck_sesion_rango_valido CHECK (fecha_hora_fin > fecha_hora_inicio),
  ADD CONSTRAINT ck_sesion_cupo_min CHECK (cupo_minimo >= 1),
  ADD CONSTRAINT ck_sesion_cupo_coherente CHECK (cupo_maximo >= cupo_minimo);

-- 6. Reserva activa única por usuario
WITH duplicadas AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY sesion_id, creado_por_usuario_id ORDER BY creado_en
  ) AS rn
  FROM reservas WHERE estado IN ('PENDIENTE', 'EN_ESPERA', 'CONFIRMADA')
)
UPDATE reservas SET estado = 'CANCELADA', cancelado_en = NOW(),
  motivo_cancelacion = 'Duplicado resuelto en migración v2.2'
WHERE id IN (SELECT id FROM duplicadas WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_activa_por_usuario_sesion
  ON reservas (sesion_id, creado_por_usuario_id)
  WHERE estado IN ('PENDIENTE', 'EN_ESPERA', 'CONFIRMADA');

-- 7. Coherencia de estados
UPDATE reservas SET pagado_en = actualizado_en
  WHERE estado_pago = 'COMPLETADO' AND pagado_en IS NULL;
UPDATE reservas SET metodo_pago_usado = 'EFECTIVO'
  WHERE estado_pago = 'COMPLETADO' AND metodo_pago_usado IS NULL;
UPDATE reservas SET cancelado_en = actualizado_en
  WHERE estado = 'CANCELADA' AND cancelado_en IS NULL;
UPDATE reservas SET hold_expira_en = NULL
  WHERE hold_expira_en IS NOT NULL AND estado <> 'EN_ESPERA';

ALTER TABLE reservas
  ADD CONSTRAINT ck_reserva_pago_coherente
    CHECK (estado_pago <> 'COMPLETADO' OR (pagado_en IS NOT NULL AND metodo_pago_usado IS NOT NULL)),
  ADD CONSTRAINT ck_reserva_cancelacion_coherente
    CHECK (estado <> 'CANCELADA' OR cancelado_en IS NOT NULL),
  ADD CONSTRAINT ck_reserva_hold_solo_en_espera
    CHECK (hold_expira_en IS NULL OR estado = 'EN_ESPERA'),
  ADD CONSTRAINT ck_reserva_precio_no_negativo
    CHECK (precio_final IS NULL OR precio_final >= 0),
  ADD CONSTRAINT ck_reserva_descuento_no_negativo
    CHECK (descuento_aplicado >= 0),
  ADD CONSTRAINT uq_codigo_confirmacion_tenant
    UNIQUE (tenant_id, codigo_confirmacion);

-- 8. FK faltante
UPDATE servicios s SET formulario_id = NULL
WHERE formulario_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM formularios f WHERE f.id = s.formulario_id AND f.tenant_id = s.tenant_id);

ALTER TABLE servicios
  ADD CONSTRAINT fk_servicio_formulario
    FOREIGN KEY (formulario_id) REFERENCES formularios(id) ON DELETE SET NULL;

-- 9. Bloqueos explícitos
UPDATE horario_bloqueos SET entidad_tipo = 'global'
  WHERE entidad_id IS NULL AND (entidad_tipo IS NULL OR entidad_tipo = '');

ALTER TABLE horario_bloqueos
  ADD CONSTRAINT ck_hb_entidad_explicita
    CHECK ((entidad_tipo = 'global' AND entidad_id IS NULL)
           OR (entidad_tipo <> 'global' AND entidad_id IS NOT NULL)),
  ADD CONSTRAINT ck_hb_rango_valido CHECK (fecha_fin > fecha_inicio);

-- 10. Servicios y sedes
ALTER TABLE servicios
  ADD CONSTRAINT ck_servicio_duracion_positiva CHECK (duracion_minutos > 0),
  ADD CONSTRAINT ck_servicio_cupo_coherente CHECK (cupo_maximo >= cupo_minimo),
  ADD CONSTRAINT ck_servicio_precio_no_negativo CHECK (precio IS NULL OR precio >= 0),
  ADD CONSTRAINT ck_servicio_buffers CHECK (buffer_antes_min >= 0 AND buffer_despues_min >= 0),
  ADD CONSTRAINT ck_servicio_individual_cupo_uno
    CHECK (tipo_agenda <> 'INDIVIDUAL' OR cupo_maximo = 1);

ALTER TABLE sedes
  ADD CONSTRAINT ck_sede_coordenadas_par
    CHECK ((coordenadas_lat IS NULL) = (coordenadas_lng IS NULL)),
  ADD CONSTRAINT ck_sede_lat_rango
    CHECK (coordenadas_lat IS NULL OR (coordenadas_lat BETWEEN -90 AND 90)),
  ADD CONSTRAINT ck_sede_lng_rango
    CHECK (coordenadas_lng IS NULL OR (coordenadas_lng BETWEEN -180 AND 180));

-- 11. Usuarios y tenant
ALTER TABLE usuarios
  ADD CONSTRAINT ck_usuario_password_o_invitado
    CHECK ((es_invitado = true) OR (password_hash IS NOT NULL AND length(password_hash) > 0));

ALTER TABLE usuario_tenants
  ADD CONSTRAINT ck_comision_rango
    CHECK (comision_porcentaje IS NULL OR (comision_porcentaje >= 0 AND comision_porcentaje <= 100));

ALTER TABLE tenants
  ADD CONSTRAINT ck_tenant_cancelacion_no_negativa CHECK (politica_cancelacion_hs >= 0),
  ADD CONSTRAINT ck_tenant_hold_positivo CHECK (hold_minutos > 0);

-- 12. Auxiliares
ALTER TABLE beneficiarios
  ADD CONSTRAINT ck_beneficiario_tipo CHECK (tipo IN ('self','tercero','otro'));

ALTER TABLE horario_disponibilidad
  ADD CONSTRAINT ck_dia_semana CHECK (dia_semana BETWEEN 0 AND 6),
  ADD CONSTRAINT ck_hd_rango_valido CHECK (hora_fin > hora_inicio),
  ADD CONSTRAINT ck_hd_entidad_tipo CHECK (entidad_tipo IN ('asesor','recurso'));

ALTER TABLE servicio_variantes
  ADD CONSTRAINT ck_variante_duracion CHECK (duracion_minutos > 0),
  ADD CONSTRAINT ck_variante_precio CHECK (precio IS NULL OR precio >= 0);

ALTER TABLE asesor_servicios
  ADD CONSTRAINT ck_as_precio CHECK (precio_custom IS NULL OR precio_custom >= 0),
  ADD CONSTRAINT ck_as_duracion CHECK (duracion_custom_min IS NULL OR duracion_custom_min > 0);

ALTER TABLE servicio_recursos
  ADD CONSTRAINT ck_sr_cantidad CHECK (cantidad_requerida >= 1);

ALTER TABLE recursos
  ADD CONSTRAINT ck_recurso_capacidad CHECK (capacidad >= 1);

ALTER TABLE reserva_integrantes
  ADD CONSTRAINT ck_integrante_identificado
    CHECK (usuario_id IS NOT NULL OR (nombre_externo IS NOT NULL AND email_externo IS NOT NULL));

-- 13. Índices calientes
CREATE INDEX IF NOT EXISTS idx_sesiones_asesor_fecha
  ON sesiones (tenant_id, asesor_id, fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_sesiones_servicio_fecha
  ON sesiones (tenant_id, servicio_id, fecha_hora_inicio)
  WHERE estado IN ('ABIERTA', 'CONFIRMADA', 'LLENA');
CREATE INDEX IF NOT EXISTS idx_reservas_hold
  ON reservas (hold_expira_en)
  WHERE estado = 'EN_ESPERA' AND hold_expira_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservas_cliente
  ON reservas (tenant_id, creado_por_usuario_id);

CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON servicios (categoria);
CREATE INDEX IF NOT EXISTS idx_servicios_visible ON servicios (tenant_id, visible_web, activo);
CREATE INDEX IF NOT EXISTS idx_hd_entidad ON horario_disponibilidad (tenant_id, entidad_tipo, entidad_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_hd_dia ON horario_disponibilidad (dia_semana, activo);
CREATE INDEX IF NOT EXISTS idx_hb_rango ON horario_bloqueos (tenant_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_bitacoras_entidad ON bitacoras (tenant_id, entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_bitacoras_fecha ON bitacoras (tenant_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_cf_formulario ON campo_formularios (formulario_id, orden);
CREATE INDEX IF NOT EXISTS idx_ut_rol ON usuario_tenants (tenant_id, rol);
CREATE INDEX IF NOT EXISTS idx_reservas_pago ON reservas (tenant_id, estado_pago);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_reservas_folio ON reservas (tenant_id, folio);
CREATE INDEX IF NOT EXISTS idx_reservas_sesion ON reservas (sesion_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_servicio ON sesiones (servicio_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha ON sesiones (tenant_id, fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_sesiones_estado ON sesiones (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_sesiones_asesor ON sesiones (tenant_id, asesor_id, fecha_hora_inicio);

COMMIT;
