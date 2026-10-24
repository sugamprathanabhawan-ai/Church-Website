-- ==============================================================================
-- DEPRECATED: DO NOT USE THIS INSECURE SCRIPT
-- ==============================================================================
-- This script previously disabled Row Level Security (RLS) protections by granting
-- unrestricted public write/delete permissions across the database.
--
-- For the authoritative, secure database schema with proper role-based authorization:
-- Run: "supabase_schema.sql" OR the versioned files in "supabase/migrations/"
--
-- To assign an administrator:
-- 1. Sign in or create a user in Supabase Auth (Dashboard -> Authentication -> Users).
-- 2. In SQL Editor, run:
--    SELECT public.assign_admin_role('your-admin-email@domain.com');
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Notice: fix_database_rls.sql is deprecated. Please apply supabase_schema.sql instead.';
END $$;
