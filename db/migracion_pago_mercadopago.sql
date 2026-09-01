-- Migración: pago en línea con MercadoPago por tenant
-- Fecha: 2026-08-04
--
-- Unifica la configuración de pago en un solo blob cifrado (pago_config, tipo JSON)
-- igual que smtp_config. Elimina las columnas mp_access_token/mp_public_key
-- antiguas que no se usaban.

BEGIN;

-- 1. Agregar columna para el blob cifrado de configuración de pago.
ALTER TABLE tenants
    ADD COLUMN pago_config JSON;

-- 2. Eliminar columnas individuales de MercadoPago ya obsoletas.
--    Están vacías y no tienen referencias en código; la eliminación es segura.
ALTER TABLE tenants
    DROP COLUMN IF EXISTS mp_access_token,
    DROP COLUMN IF EXISTS mp_public_key;

COMMIT;
