-- 003_work_order_evidence.sql
-- Migration: add the after-image (completion proof) evidence table for work orders.
--
-- Mirrors the incident image pattern: only the storage key lives in PostgreSQL;
-- raw image bytes are stored in the configured storage (Supabase).
--
-- Run via the Python runner (recommended):
--   python backend/migrations/apply_migration.py
-- (update MIGRATION_SQL_FILE in apply_migration.py to this file)

BEGIN;

CREATE TABLE IF NOT EXISTS work_order_evidence (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_key VARCHAR NOT NULL,
    original_filename VARCHAR,
    content_type VARCHAR,
    image_size INTEGER,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_work_order_evidence_work_order_id ON work_order_evidence (work_order_id);
CREATE INDEX IF NOT EXISTS ix_work_order_evidence_uploaded_by ON work_order_evidence (uploaded_by);
CREATE INDEX IF NOT EXISTS ix_work_order_evidence_id ON work_order_evidence (id);

COMMIT;