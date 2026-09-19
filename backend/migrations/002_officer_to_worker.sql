-- 002_officer_to_worker.sql
-- Migration: rename the "officer" system role to "worker".
--
-- Existing data is preserved:
--   role              officer -> worker
--   specialization    values unchanged; enum type officerspecialization -> workerspecialization
--
-- Run via the Python runner (recommended):
--   python backend/migrations/apply_migration.py

BEGIN;

-- Guards: only migrate if the users table exists (fresh installs use create_all at startup)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION 'users table not found - skip this migration for fresh installs';
  END IF;
END $$;

-- 1. Rebuild the role enum to admin|worker.
--    Steps: drop any leftover temp type -> rename existing -> create new -> recast -> drop old.
DO $$
BEGIN
  DROP TYPE IF EXISTS userrole_old;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole' AND typtype = 'e') THEN
    ALTER TYPE userrole RENAME TO userrole_old;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole' AND typtype = 'e') THEN
    CREATE TYPE userrole AS ENUM ('admin', 'worker');
  END IF;
END $$;

-- 2. Recast data through text, mapping officer -> worker.
ALTER TABLE users
  ALTER COLUMN role TYPE userrole
  USING (CASE role::text
           WHEN 'officer' THEN 'worker'::userrole
           ELSE role::text::userrole
         END);

-- 3. Role is required and has no default under the new model
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT NULL;

DROP TYPE IF EXISTS userrole_old;

-- 4. Rename the specialization enum type (labels unchanged, column data preserved).
--    Skip if the legacy type is absent (fresh install created with the new model).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'officerspecialization' AND typtype = 'e') THEN
    DROP TYPE IF EXISTS workerspecialization;
    ALTER TYPE officerspecialization RENAME TO workerspecialization;
  END IF;
END $$;

COMMIT;