-- ==============================================================================
-- 20261014000002_harden_zensync_auth_and_storage.sql
-- SECURE ZENSYNC SESSION & STORAGE AUTHORIZATION HARDENING
--
-- 1. Eliminates authorization relying on mere presence of active session code.
-- 2. Host operations strictly verify stored SHA-256 host token hash.
-- 3. Helper operations strictly verify claimed helper signature and ownership.
-- 4. Image upload and deletion authorized via ticketed RPCs and restricted storage policies.
-- 5. Prevents cross-session and cross-user tampering of images and slide contents.
-- 6. Preserves public image reads for viewers (Sub and Choir screens).
-- 7. Explicitly revokes execution from PUBLIC on all SECURITY DEFINER functions and grants to intended roles.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

    -- Ensure file path strictly belongs to the session directory: e.g. "code/..."
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

    -- 1. Check Church Admin
    IF public.is_admin() THEN
        is_authorized := true;
    END IF;

    -- 2. Check Presenter Host Token (SHA-256 hash comparison)
    IF NOT is_authorized AND p_host_token IS NOT NULL AND length(trim(p_host_token)) > 0 THEN
        computed_hash := encode(digest(p_host_token, 'sha256'), 'hex');
        IF sess.host_token_hash = computed_hash THEN
            is_authorized := true;
        END IF;
    END IF;

    -- 3. Check Claimed Helper Signature
    IF NOT is_authorized AND p_helper_sig IS NOT NULL AND length(trim(p_helper_sig)) > 0 THEN
        IF sess.helper_signature IS NOT NULL AND length(sess.helper_signature) > 0 AND sess.helper_signature = trim(p_helper_sig) THEN
            is_authorized := true;
        END IF;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Valid presenter host token, claimed helper signature, or church admin required';
    END IF;

    -- Housekeeping: remove expired tickets
    DELETE FROM public.zen_upload_tickets WHERE expires_at < timezone('utc'::text, now());

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
        IF sess.helper_signature IS NOT NULL AND length(sess.helper_signature) > 0 AND sess.helper_signature = trim(p_helper_sig) THEN
            is_authorized := true;
        END IF;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Valid host token, helper signature, or church admin required';
    END IF;

    DELETE FROM storage.objects
    WHERE bucket_id = 'zen_sync_images' AND name = clean_path;

    DELETE FROM public.zen_upload_tickets
    WHERE file_path = clean_path;

    RETURN jsonb_build_object('success', true, 'deleted_path', clean_path);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. ZenSync RPC: Update Current Slide (Host, Helper, or Admin only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_zen_current_slide(
    p_code TEXT,
    p_current_slide JSONB,
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
    computed_hash TEXT;
    sess RECORD;
    is_authorized BOOLEAN := false;
BEGIN
    clean_code := lower(trim(p_code));
    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Invalid session code format';
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
        IF sess.helper_signature IS NOT NULL AND length(sess.helper_signature) > 0 AND sess.helper_signature = trim(p_helper_sig) THEN
            is_authorized := true;
        END IF;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Valid host token, claimed helper signature, or church admin required';
    END IF;

    UPDATE public.sessions
    SET 
        current_slide = p_current_slide,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code;

    RETURN jsonb_build_object('success', true, 'code', clean_code, 'current_slide', p_current_slide);
END;
$$;

-- Overload for backwards compatibility with (p_code, p_host_token, p_current_slide)
CREATE OR REPLACE FUNCTION public.update_zen_current_slide(
    p_code TEXT,
    p_host_token TEXT,
    p_current_slide JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.update_zen_current_slide(p_code, p_current_slide, p_host_token, NULL);
END;
$$;

-- Compatibility alias for update_zen_slide_position
CREATE OR REPLACE FUNCTION public.update_zen_slide_position(
    p_code TEXT,
    p_host_token TEXT,
    p_current_slide JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.update_zen_current_slide(p_code, p_current_slide, p_host_token, NULL);
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. ZenSync RPC: Update Presentation Content (Host Presenter or Admin Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_zen_session_content(
    p_code TEXT,
    p_host_token TEXT,
    p_content JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    IF length(p_content::text) > 524288 THEN
        RAISE EXCEPTION 'Slide content payload exceeds maximum limit of 500KB';
    END IF;

    SELECT code, host_token_hash, expires_at INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF sess.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Session has expired';
    END IF;

    computed_hash := encode(digest(COALESCE(p_host_token, ''), 'sha256'), 'hex');

    IF NOT (sess.host_token_hash = computed_hash OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Valid host token required to update presentation content';
    END IF;

    UPDATE public.sessions
    SET 
        content = p_content,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code;

    RETURN jsonb_build_object('success', true, 'code', clean_code);
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. ZenSync RPC: Claim Helper Role (Exclusive 1-Helper Rule)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_zen_helper(
    p_code TEXT,
    p_helper_signature TEXT,
    p_helper_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code TEXT;
    clean_sig TEXT;
    sess RECORD;
BEGIN
    clean_code := lower(trim(p_code));
    clean_sig := trim(p_helper_signature);

    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Invalid session code format';
    END IF;

    IF length(clean_sig) < 3 THEN
        RAISE EXCEPTION 'Helper signature must be at least 3 characters';
    END IF;

    SELECT code, expires_at, helper_signature INTO sess
    FROM public.sessions
    WHERE code = clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF sess.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Session has expired';
    END IF;

    IF sess.helper_signature IS NOT NULL AND length(sess.helper_signature) > 0 AND sess.helper_signature <> clean_sig THEN
        RAISE EXCEPTION 'Helper role is already claimed by another controller';
    END IF;

    UPDATE public.sessions
    SET 
        helper_signature = clean_sig,
        helper_device_info = COALESCE(p_helper_device_info, '{}'::jsonb),
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code;

    RETURN jsonb_build_object('success', true, 'claimed_by', clean_sig);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ZenSync RPC: Release Helper Role
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_zen_helper(
    p_code TEXT,
    p_helper_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code TEXT;
    clean_sig TEXT;
BEGIN
    clean_code := lower(trim(p_code));
    clean_sig := trim(p_helper_signature);

    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Invalid session code format';
    END IF;

    UPDATE public.sessions
    SET 
        helper_signature = '',
        helper_device_info = '{}'::jsonb,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code AND (helper_signature = clean_sig OR helper_signature = '' OR public.is_admin());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. ZenSync RPC: Force Release Helper Role (Host or Admin only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_release_zen_helper(
    p_code TEXT,
    p_host_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    SELECT code, host_token_hash, expires_at INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF NOT (sess.host_token_hash = computed_hash OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid host token';
    END IF;

    UPDATE public.sessions
    SET 
        helper_signature = '',
        helper_device_info = '{}'::jsonb,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. ZenSync RPC: Delete Session (Host or Admin only) with Cascade Cleanup
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

    -- Clean up storage objects associated with this session folder
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
-- 10. ZenSync RPC: Cleanup Expired Sessions and Orphaned Images
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    deleted_count INT;
    expired_code RECORD;
BEGIN
    FOR expired_code IN 
        SELECT code FROM public.sessions WHERE expires_at < timezone('utc'::text, now())
    LOOP
        DELETE FROM storage.objects 
        WHERE bucket_id = 'zen_sync_images' 
          AND (name = expired_code.code OR name LIKE expired_code.code || '/%');
        DELETE FROM public.zen_upload_tickets WHERE session_code = expired_code.code;
    END LOOP;

    DELETE FROM public.zen_upload_tickets WHERE expires_at < timezone('utc'::text, now());

    DELETE FROM public.sessions
    WHERE expires_at < timezone('utc'::text, now());
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Storage Policies Hardening & Upload Ticket Validation Function
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

DROP POLICY IF EXISTS "Public Read Zen Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Uploads to zen_sync_images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Insert Zen Images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Delete Zen Images" ON storage.objects;

-- 1. Read: Public read is preserved for presentation screens (Main, Sub, Helper, Choir)
CREATE POLICY "Public Read Zen Images" ON storage.objects 
    FOR SELECT USING (bucket_id = 'zen_sync_images');

-- 2. Insert: Strictly requires church admin OR valid single-use upload ticket validated via SECURITY DEFINER
CREATE POLICY "Authorized Insert Zen Images" ON storage.objects 
    FOR INSERT WITH CHECK (
        bucket_id = 'zen_sync_images' AND (
            public.is_admin() OR
            public.validate_and_consume_zen_upload_ticket(bucket_id, name)
        )
    );

-- 3. Delete: Direct client deletions denied to general users; restricted to church admins.
-- Non-admin presenters and helpers delete via verified delete_zen_image RPC.
CREATE POLICY "Authorized Delete Zen Images" ON storage.objects 
    FOR DELETE USING (
        bucket_id = 'zen_sync_images' AND public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- 12. Explicit Function Execution Privileges on All SECURITY DEFINER Functions
-- ------------------------------------------------------------------------------

-- Admin-only functions
REVOKE EXECUTE ON FUNCTION public.admin_delete_all_zen_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_zen_sessions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_zen_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_zen_sessions() TO authenticated;

-- Maintenance / internal cron
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO postgres, service_role, authenticated;

-- Public-facing functions with internal token, signature, and RLS checks
REVOKE EXECUTE ON FUNCTION public.create_zen_session(text, text, jsonb, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_zen_session(text, text, jsonb, text, int) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_zen_current_slide(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_zen_current_slide(text, jsonb, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_zen_current_slide(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_zen_current_slide(text, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_zen_slide_position(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_zen_slide_position(text, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_zen_session_content(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_zen_session_content(text, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_zen_helper(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_zen_helper(text, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.release_zen_helper(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_zen_helper(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.force_release_zen_helper(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.force_release_zen_helper(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_zen_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_zen_session(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.authorize_zen_upload(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_zen_upload(text, text, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_zen_image(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_zen_image(text, text, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_and_consume_zen_upload_ticket(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_and_consume_zen_upload_ticket(text, text) TO anon, authenticated;
