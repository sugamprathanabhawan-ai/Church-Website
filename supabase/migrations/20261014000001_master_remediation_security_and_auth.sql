-- ==============================================================================
-- Migration: 20261014000001_master_remediation_security_and_auth.sql
-- Description:
-- 1. Secure ZenSync image uploads & deletions via ticketed host/helper verification
-- 2. Restrict first-admin bootstrap to verified church administrative account
-- 3. Explicitly revoke public execution & grant role-based execution on all SECURITY DEFINER functions
-- 4. Clean up ZenSync storage on session deletion
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Prerequisites: Extensions, admin_users Table & is_admin() Function
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Ensure sessions table exists and has all required columns
CREATE TABLE IF NOT EXISTS public.sessions (
    code VARCHAR(10) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '12 hours') NOT NULL,
    host_token_hash TEXT DEFAULT '',
    device_name TEXT DEFAULT '',
    device_info JSONB DEFAULT '{}'::jsonb,
    content JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    current_slide JSONB NOT NULL DEFAULT '{"section_id": "", "slide_index": 0, "global_index": 0}'::jsonb,
    helper_signature TEXT DEFAULT '',
    helper_device_info JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.sessions 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '12 hours'),
    ADD COLUMN IF NOT EXISTS host_token_hash TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    ADD COLUMN IF NOT EXISTS current_slide JSONB NOT NULL DEFAULT '{"section_id": "", "slide_index": 0, "global_index": 0}'::jsonb,
    ADD COLUMN IF NOT EXISTS helper_signature TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS helper_device_info JSONB DEFAULT '{}'::jsonb;

UPDATE public.sessions SET expires_at = timezone('utc'::text, now()) + INTERVAL '12 hours' WHERE expires_at IS NULL;
ALTER TABLE public.sessions ALTER COLUMN expires_at SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 1. ZenSync Upload Authorization Tickets Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zen_upload_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code VARCHAR(16) NOT NULL REFERENCES public.sessions(code) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.zen_upload_tickets ENABLE ROW LEVEL SECURITY;

-- Deny direct client queries to tickets table; all interaction via Security Definer RPCs
DROP POLICY IF EXISTS "No Direct Access to Zen Tickets" ON public.zen_upload_tickets;
CREATE POLICY "No Direct Access to Zen Tickets" ON public.zen_upload_tickets
    FOR ALL TO PUBLIC USING (false);

-- ------------------------------------------------------------------------------
-- 2. ZenSync RPC: Authorize Image Upload (Host, Helper, or Admin only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authorize_zen_upload(
    p_code TEXT,
    p_file_path TEXT,
    p_host_token TEXT DEFAULT NULL,
    p_helper_sig TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code TEXT;
    clean_path TEXT;
    sess RECORD;
    computed_hash TEXT;
    is_authorized BOOLEAN := false;
BEGIN
    clean_code := lower(trim(p_code));
    clean_path := trim(p_file_path);

    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Invalid session code. Must be between 3 and 10 characters and contain only lowercase letters, numbers, and hyphens.';
    END IF;

    -- Ensure file path strictly belongs to the session directory
    IF NOT (clean_path LIKE clean_code || '/%') THEN
        RAISE EXCEPTION 'Invalid file path. Path must begin with session code: %/', clean_code;
    END IF;

    -- Reject path traversal or malformed directory paths
    IF clean_path LIKE '%..%' OR clean_path LIKE '%//%' OR clean_path ~ '[^a-zA-Z0-9_\-\./]' THEN
        RAISE EXCEPTION 'Invalid file path characters or traversal detected';
    END IF;

    SELECT code, host_token_hash, helper_signature, expires_at INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF sess.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Session has expired';
    END IF;

    -- 1. Check if caller is authenticated Church Administrator
    IF public.is_admin() THEN
        is_authorized := true;
    END IF;

    -- 2. Check if caller possesses valid Host Token
    IF NOT is_authorized AND p_host_token IS NOT NULL AND length(trim(p_host_token)) > 0 THEN
        computed_hash := encode(digest(p_host_token, 'sha256'), 'hex');
        IF sess.host_token_hash = computed_hash THEN
            is_authorized := true;
        END IF;
    END IF;

    -- 3. Check if caller possesses claimed Helper Signature
    IF NOT is_authorized AND p_helper_sig IS NOT NULL AND length(trim(p_helper_sig)) > 0 THEN
        IF sess.helper_signature IS NOT NULL AND sess.helper_signature = trim(p_helper_sig) THEN
            is_authorized := true;
        END IF;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Valid presenter host token, claimed helper signature, or church admin required';
    END IF;

    -- Issue an authorized upload ticket valid for 5 minutes
    INSERT INTO public.zen_upload_tickets (session_code, file_path, expires_at)
    VALUES (clean_code, clean_path, timezone('utc'::text, now()) + interval '5 minutes');

    RETURN jsonb_build_object(
        'success', true, 
        'code', clean_code, 
        'file_path', clean_path,
        'expires_in_seconds', 300
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. ZenSync RPC: Delete Slide Image (Host, Helper, or Admin only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_zen_image(
    p_code TEXT,
    p_image_path TEXT,
    p_host_token TEXT DEFAULT NULL,
    p_helper_sig TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    clean_code TEXT;
    clean_path TEXT;
    sess RECORD;
    computed_hash TEXT;
    is_authorized BOOLEAN := false;
BEGIN
    clean_code := lower(trim(p_code));
    clean_path := trim(p_image_path);

    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Invalid session code format';
    END IF;

    IF NOT (clean_path LIKE clean_code || '/%') THEN
        RAISE EXCEPTION 'Image path does not belong to session %', clean_code;
    END IF;

    IF clean_path LIKE '%..%' OR clean_path LIKE '%//%' OR clean_path ~ '[^a-zA-Z0-9_\-\./]' THEN
        RAISE EXCEPTION 'Invalid file path characters or traversal detected';
    END IF;

    SELECT code, host_token_hash, helper_signature, expires_at INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF sess.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Session has expired';
    END IF;

    -- 1. Check Admin
    IF public.is_admin() THEN
        is_authorized := true;
    END IF;

    -- 2. Check Host
    IF NOT is_authorized AND p_host_token IS NOT NULL AND length(trim(p_host_token)) > 0 THEN
        computed_hash := encode(digest(p_host_token, 'sha256'), 'hex');
        IF sess.host_token_hash = computed_hash THEN
            is_authorized := true;
        END IF;
    END IF;

    -- 3. Check Helper
    IF NOT is_authorized AND p_helper_sig IS NOT NULL AND length(trim(p_helper_sig)) > 0 THEN
        IF sess.helper_signature IS NOT NULL AND sess.helper_signature = trim(p_helper_sig) THEN
            is_authorized := true;
        END IF;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Valid host token, helper signature, or church admin required';
    END IF;

    DELETE FROM storage.objects
    WHERE bucket_id = 'zen_sync_images' AND name = clean_path;

    RETURN jsonb_build_object('success', true, 'deleted_path', clean_path);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. ZenSync Upload Ticket Validation (SECURITY DEFINER to safely check tickets)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_consume_zen_upload_ticket(
    p_bucket_id TEXT,
    p_file_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_ticket_id UUID;
BEGIN
    IF p_bucket_id <> 'zen_sync_images' THEN
        RETURN false;
    END IF;

    IF p_file_path IS NULL OR length(trim(p_file_path)) = 0 THEN
        RETURN false;
    END IF;

    -- Look up active unexpired ticket for matching active session
    SELECT t.id INTO v_ticket_id
    FROM public.zen_upload_tickets t
    JOIN public.sessions s ON s.code = t.session_code
    WHERE t.file_path = trim(p_file_path)
      AND t.expires_at > timezone('utc'::text, now())
      AND s.expires_at > timezone('utc'::text, now())
    LIMIT 1;

    IF v_ticket_id IS NOT NULL THEN
        -- Prevent ticket reuse by atomically deleting the single-use ticket upon validation
        DELETE FROM public.zen_upload_tickets WHERE id = v_ticket_id;
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Authorized Insert Zen Images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Delete Zen Images" ON storage.objects;

-- Image insertion strictly requires admin role OR valid single-use upload ticket validated via SECURITY DEFINER
CREATE POLICY "Authorized Insert Zen Images" ON storage.objects 
    FOR INSERT WITH CHECK (
        bucket_id = 'zen_sync_images' AND (
            public.is_admin() OR
            public.validate_and_consume_zen_upload_ticket(bucket_id, name)
        )
    );

-- Direct deletion on storage bucket restricted to authenticated church admins;
-- non-admin host/helpers delete via verified delete_zen_image RPC
CREATE POLICY "Authorized Delete Zen Images" ON storage.objects 
    FOR DELETE USING (
        bucket_id = 'zen_sync_images' AND public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- 5. Cascade Storage Cleanup in delete_zen_session
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_zen_session(
    p_code TEXT,
    p_host_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    clean_code TEXT;
    computed_hash TEXT;
    sess RECORD;
BEGIN
    clean_code := lower(trim(p_code));

    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Invalid session code format';
    END IF;

    computed_hash := encode(digest(COALESCE(p_host_token, ''), 'sha256'), 'hex');

    SELECT code, host_token_hash INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'message', 'Session does not exist');
    END IF;

    IF NOT (sess.host_token_hash = computed_hash OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid host token';
    END IF;

    -- Clean up storage files associated with session
    DELETE FROM storage.objects 
    WHERE bucket_id = 'zen_sync_images' 
      AND (name = clean_code OR name LIKE clean_code || '/%');

    -- Delete upload tickets
    DELETE FROM public.zen_upload_tickets WHERE session_code = clean_code;

    -- Delete session row
    DELETE FROM public.sessions WHERE code = clean_code;

    RETURN jsonb_build_object('success', true, 'deleted', clean_code);
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Dedicated Server-Side Admin Bootstrap Secrets Table & assign_admin_role
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_bootstrap_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret TEXT NOT NULL,
    is_consumed BOOLEAN NOT NULL DEFAULT false,
    consumed_at TIMESTAMPTZ,
    consumed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_bootstrap_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access to Admin Bootstrap Secrets" ON public.admin_bootstrap_secrets;
CREATE POLICY "No Direct Access to Admin Bootstrap Secrets" ON public.admin_bootstrap_secrets
    FOR ALL TO PUBLIC USING (false);

CREATE OR REPLACE FUNCTION public.assign_admin_role(
    target_email text,
    bootstrap_secret text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
    admin_count int;
    caller_email text;
    clean_target text;
    secret_rec RECORD;
BEGIN
    clean_target := lower(trim(target_email));
    IF clean_target = '' THEN
        RAISE EXCEPTION 'Target email cannot be empty';
    END IF;

    SELECT count(*) INTO admin_count FROM public.admin_users;

    IF admin_count = 0 THEN
        caller_email := lower(trim(COALESCE(auth.jwt()->>'email', '')));
        
        -- Retrieve active, unconsumed one-time secret from private bootstrap table
        SELECT id, secret INTO secret_rec
        FROM public.admin_bootstrap_secrets
        WHERE is_consumed = false
        ORDER BY created_at DESC
        LIMIT 1;

        IF secret_rec IS NOT NULL 
           AND bootstrap_secret IS NOT NULL 
           AND length(trim(bootstrap_secret)) > 0 
           AND (trim(bootstrap_secret) = trim(secret_rec.secret) OR encode(digest(trim(bootstrap_secret), 'sha256'), 'hex') = trim(secret_rec.secret)) THEN
            -- Atomically consume one-time secret to prevent replay
            UPDATE public.admin_bootstrap_secrets
            SET is_consumed = true,
                consumed_at = timezone('utc'::text, now()),
                consumed_by = clean_target
            WHERE id = secret_rec.id;
        ELSIF (clean_target = 'sugamprathanabhawan@gmail.com' AND caller_email = 'sugamprathanabhawan@gmail.com') THEN
            -- Authorized direct church administrator bootstrap
            NULL;
        ELSE
            RAISE EXCEPTION 'Access Denied: Initial admin bootstrap requires church authorization or valid one-time bootstrap secret';
        END IF;

        -- Clean up legacy settings key if present
        DELETE FROM public.church_settings WHERE key = 'admin_bootstrap_secret';
    ELSE
        -- After bootstrap, strictly require existing administrator privileges
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only existing church administrators can assign admin roles';
        END IF;
    END IF;

    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_target;
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.admin_users (id, email, role)
        VALUES (target_user_id, clean_target, 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin', email = clean_target;
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

-- Overload for single-argument backwards compatibility
CREATE OR REPLACE FUNCTION public.assign_admin_role(target_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.assign_admin_role(target_email, NULL);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Explicit Function Execution Privileges on All SECURITY DEFINER Functions
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    fn_name TEXT;
    fn_args TEXT;
    fn_role TEXT;
    auth_funcs TEXT[][] := ARRAY[
        ARRAY['assign_admin_role', 'text, text', 'authenticated'],
        ARRAY['assign_admin_role', 'text', 'authenticated'],
        ARRAY['admin_delete_all_zen_sessions', '', 'authenticated'],
        ARRAY['admin_list_zen_sessions', '', 'authenticated'],
        ARRAY['sync_youth_routine', 'jsonb, jsonb, jsonb', 'authenticated'],
        ARRAY['sync_choir_routine', 'jsonb, jsonb, jsonb', 'authenticated'],
        ARRAY['sync_youtube_songs', 'jsonb', 'authenticated'],
        ARRAY['cleanup_expired_sessions', '', 'postgres, service_role, authenticated'],
        ARRAY['is_admin', '', 'anon, authenticated'],
        ARRAY['create_zen_session', 'text, text, jsonb, text, int', 'anon, authenticated'],
        ARRAY['update_zen_slide_position', 'text, text, jsonb', 'anon, authenticated'],
        ARRAY['update_zen_session_content', 'text, text, jsonb', 'anon, authenticated'],
        ARRAY['claim_zen_helper', 'text, text, jsonb', 'anon, authenticated'],
        ARRAY['release_zen_helper', 'text, text', 'anon, authenticated'],
        ARRAY['force_release_zen_helper', 'text, text', 'anon, authenticated'],
        ARRAY['delete_zen_session', 'text, text', 'anon, authenticated'],
        ARRAY['authorize_zen_upload', 'text, text, text, text', 'anon, authenticated'],
        ARRAY['delete_zen_image', 'text, text, text, text', 'anon, authenticated'],
        ARRAY['validate_and_consume_zen_upload_ticket', 'text, text', 'anon, authenticated']
    ];
    i INT;
BEGIN
    FOR i IN 1..array_length(auth_funcs, 1) LOOP
        fn_name := auth_funcs[i][1];
        fn_args := auth_funcs[i][2];
        fn_role := auth_funcs[i][3];
        
        IF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname = fn_name
        ) THEN
            BEGIN
                IF fn_args = '' THEN
                    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC;', fn_name);
                    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I() TO %s;', fn_name, fn_role);
                ELSE
                    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC;', fn_name, fn_args);
                    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO %s;', fn_name, fn_args, fn_role);
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Gracefully continue if overload signature differs
                NULL;
            END;
        END IF;
    END LOOP;
END $$;


