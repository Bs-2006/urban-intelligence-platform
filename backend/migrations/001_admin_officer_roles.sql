-- 001_admin_officer_roles.sql
-- Migration: Registration roles changed from citizen/admin/worker/transport_officer
--            to admin/officer with an optional officer specialization.
--
-- Existing data is preserved:
--   role admin               -> admin
--   role citizen|worker|transport_officer -> officer  (specialization LEFT NULL)
--
-- Run once via psql:
--   psql "postgresql://urban_user:urban_password@localhost:5433/urban_intelligence" -f migrations/001_admin_officer_roles.sql
-- or via the Python runner (recommended):
--   python migrations/apply_migration.py

BEGIN;

-- Guards: only migrate if the users table exists (fresh installs use create_all at startup)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION 'users table not found - skip this migration for fresh installs';
  END IF;
END $$;

-- 1. Create OfficerSpecialization enum type (matches SQLAlchemy Enum(OfficerSpecialization))
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'officerspecialization') THEN
    CREATE TYPE officerspecialization AS ENUM (
      'road_maintenance',
      'drainage_waterlogging',
      'infrastructure',
      'traffic_management',
      'traffic_enforcement',
      'road_safety',
      'traffic_sign_maintenance'
    );
  END IF;
END $$;

-- 2. Add nullable specialization column (Admin has no specialization)
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization officerspecialization;

-- 3. Rebuild the role enum to admin|officer only.
--    Steps: drop any leftover temp type -> rename existing -> create new -> recast -> drop old.
DO $$
BEGIN
  DROP TYPE IF EXISTS userrole_old;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
    ALTER TYPE userrole RENAME TO userrole_old;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
    CREATE TYPE userrole AS ENUM ('admin', 'officer');
  END IF;
END $$;

-- 4. Recast data through text, mapping legacy roles onto the new enum
ALTER TABLE users
  ALTER COLUMN role TYPE userrole
  USING (CASE role::text
           WHEN 'admin' THEN 'admin'::userrole
           ELSE 'officer'::userrole
         END);

-- 5. Role is required and has no default under the new model
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT NULL;

-- 6. Drop the legacy enum type once users no longer reference it
DROP TYPE IF EXISTS userrole_old;

COMMIT;