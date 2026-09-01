-- Migración: soporte para logo_public_id de Cloudinary por tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_public_id VARCHAR(255);
