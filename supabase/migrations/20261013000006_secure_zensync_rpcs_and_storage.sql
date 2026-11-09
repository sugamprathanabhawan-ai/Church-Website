-- ==============================================================================
-- 20261013000006_secure_zensync_rpcs_and_storage.sql
-- SECURE ZENSYNC RPC FUNCTIONS, SESSION TOKEN VERIFICATION & STRICT STORAGE
-- Replaces ineffective "host_token_hash IS NOT NULL" with cryptographic token verification.
-- ==============================================================================

-- 1. Ensure pgcrypto extension for server-side SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Clean up old permissive policies on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Session read" ON public.sessions;
DROP POLICY IF EXISTS "Session insert" ON public.sessions;
DROP POLICY IF EXISTS "Session update" ON public.sessions;
DROP POLICY IF EXISTS "Session delete" ON public.sessions;
DROP POLICY IF EXISTS "Public Read Active Sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admin Full Access to Sessions" ON public.sessions;

-- Read: Only non-expired sessions are visible publicly
CREATE POLICY "Public Read Active Sessions" ON public.sessions 
    FOR SELECT USING (expires_at > timezone('utc'::text, now()));

-- Modifications: Direct mutations restricted to authenticated admins only.
-- All other mutations must proceed through the verified Security Definer RPCs below.
CREATE POLICY "Admin Full Access to Sessions" ON public.sessions 
    FOR ALL TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- 3. ZenSync RPC: Create or Replace Session
CREATE OR REPLACE FUNCTION public.create_zen_session(
    p_code TEXT,
    p_host_token TEXT,
    p_content JSONB DEFAULT '{"sections": []}'::jsonb,
    p_device_name TEXT DEFAULT '',
    p_expires_hours INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_code TEXT;
    computed_hash TEXT;
    hours_to_expire INT;
    expiration TIMESTAMPTZ;
    existing_sess RECORD;
BEGIN
    clean_code := lower(trim(p_code));
    IF clean_code IS NULL OR clean_code !~ '^[a-z0-9-]{3,10}$' THEN
        RAISE EXCEPTION 'Session code must be between 3 and 10 characters and contain only lowercase letters, numbers, and hyphens.';
    END IF;

    IF p_host_token IS NULL OR length(trim(p_host_token)) < 8 THEN
        RAISE EXCEPTION 'Host token is required and must be at least 8 characters';
    END IF;

    IF length(p_content::text) > 524288 THEN
        RAISE EXCEPTION 'Slide content payload exceeds maximum allowed size of 500KB';
    END IF;

    hours_to_expire := LEAST(GREATEST(COALESCE(p_expires_hours, 12), 1), 72);
    expiration := timezone('utc'::text, now()) + (hours_to_expire || ' hours')::interval;
    computed_hash := encode(digest(p_host_token, 'sha256'), 'hex');

    -- Check if active session already exists under this code
    SELECT code, host_token_hash, expires_at INTO existing_sess
    FROM public.sessions
    WHERE code = clean_code;

    IF FOUND THEN
        -- Allow re-creation only if existing session is expired, host token matches, or user is admin
        IF existing_sess.expires_at > timezone('utc'::text, now()) 
           AND existing_sess.host_token_hash <> computed_hash 
           AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'An active presentation already exists with this code. Please choose another code.';
        END IF;

        UPDATE public.sessions
        SET
            updated_at = timezone('utc'::text, now()),
            expires_at = expiration,
            host_token_hash = computed_hash,
            device_name = COALESCE(p_device_name, ''),
            content = COALESCE(p_content, '{"sections": []}'::jsonb),
            current_slide = '{"section_id": "", "slide_index": 0, "global_index": 0}'::jsonb,
            helper_signature = '',
            helper_device_info = '{}'::jsonb
        WHERE code = clean_code;
    ELSE
        INSERT INTO public.sessions (
            code,
            created_at,
            updated_at,
            expires_at,
            host_token_hash,
            device_name,
            content,
            current_slide
        )
        VALUES (
            clean_code,
            timezone('utc'::text, now()),
            timezone('utc'::text, now()),
            expiration,
            computed_hash,
            COALESCE(p_device_name, ''),
            COALESCE(p_content, '{"sections": []}'::jsonb),
            '{"section_id": "", "slide_index": 0, "global_index": 0}'::jsonb
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'code', clean_code,
        'expires_at', expiration
    );
END;
$$;

-- 4. ZenSync RPC: Update Current Slide
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
DECLARE
    clean_code TEXT;
    computed_hash TEXT;
    sess RECORD;
BEGIN
    clean_code := lower(trim(p_code));
    computed_hash := encode(digest(COALESCE(p_host_token, ''), 'sha256'), 'hex');

    SELECT code, host_token_hash, expires_at INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF sess.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Session has expired';
    END IF;

    IF NOT (sess.host_token_hash = computed_hash OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid host token';
    END IF;

    UPDATE public.sessions
    SET 
        current_slide = p_current_slide,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code;

    RETURN jsonb_build_object('success', true, 'code', clean_code, 'current_slide', p_current_slide);
END;
$$;

-- 5. ZenSync RPC: Update Session Content (Slides)
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
    IF length(p_content::text) > 524288 THEN
        RAISE EXCEPTION 'Payload exceeds maximum limit of 500KB';
    END IF;

    computed_hash := encode(digest(COALESCE(p_host_token, ''), 'sha256'), 'hex');

    SELECT code, host_token_hash, expires_at INTO sess
    FROM public.sessions
    WHERE code = clean_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Presentation session not found';
    END IF;

    IF sess.expires_at < timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Session has expired';
    END IF;

    IF NOT (sess.host_token_hash = computed_hash OR public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid host token';
    END IF;

    UPDATE public.sessions
    SET 
        content = p_content,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code;

    RETURN jsonb_build_object('success', true, 'code', clean_code);
END;
$$;

-- 6. ZenSync RPC: Claim Helper Role
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

-- 7. ZenSync RPC: Release Helper Role
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

    UPDATE public.sessions
    SET 
        helper_signature = '',
        helper_device_info = '{}'::jsonb,
        updated_at = timezone('utc'::text, now())
    WHERE code = clean_code AND (helper_signature = clean_sig OR helper_signature = '' OR public.is_admin());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. ZenSync RPC: Force Release Helper Role (Host or Admin only)
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

-- 9. ZenSync RPC: Delete Session (Host or Admin only)
CREATE OR REPLACE FUNCTION public.delete_zen_session(
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

    DELETE FROM public.sessions WHERE code = clean_code;
    RETURN jsonb_build_object('success', true, 'deleted', clean_code);
END;
$$;

-- 10. ZenSync RPC: Admin Delete All Sessions (Admin Only)
CREATE OR REPLACE FUNCTION public.admin_delete_all_zen_sessions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Church administrator credentials required';
    END IF;

    DELETE FROM public.sessions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'deleted_count', deleted_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_all_zen_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_zen_sessions() TO authenticated;

-- 11. ZenSync RPC: Admin List All Sessions (Admin Only)
CREATE OR REPLACE FUNCTION public.admin_list_zen_sessions()
RETURNS TABLE (
    code VARCHAR,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    device_name TEXT,
    slide_count INT,
    has_helper BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Church administrator credentials required';
    END IF;

    RETURN QUERY
    SELECT 
        s.code,
        s.created_at,
        s.expires_at,
        s.device_name,
        COALESCE(jsonb_array_length(s.content->'sections'), 0)::INT AS slide_count,
        (s.helper_signature IS NOT NULL AND length(s.helper_signature) > 0) AS has_helper
    FROM public.sessions s
    ORDER BY s.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_zen_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_zen_sessions() TO authenticated;

-- 12. Storage Policies Hardening
-- Bucket: church_documents (Strict Admin writes)
DROP POLICY IF EXISTS "Public Read Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert Documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Documents" ON storage.objects;

CREATE POLICY "Public Read Documents" ON storage.objects 
    FOR SELECT USING (bucket_id = 'church_documents');

CREATE POLICY "Admin Insert Documents" ON storage.objects 
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'church_documents' AND public.is_admin());

CREATE POLICY "Admin Update Documents" ON storage.objects 
    FOR UPDATE TO authenticated 
    USING (bucket_id = 'church_documents' AND public.is_admin()) 
    WITH CHECK (bucket_id = 'church_documents' AND public.is_admin());

CREATE POLICY "Admin Delete Documents" ON storage.objects 
    FOR DELETE TO authenticated 
    USING (bucket_id = 'church_documents' AND public.is_admin());

-- Bucket: zen_sync_images (Active Session or Admin writes)
DROP POLICY IF EXISTS "Public Read Zen Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Uploads to zen_sync_images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Insert Zen Images" ON storage.objects;
DROP POLICY IF EXISTS "Authorized Delete Zen Images" ON storage.objects;

CREATE POLICY "Public Read Zen Images" ON storage.objects 
    FOR SELECT USING (bucket_id = 'zen_sync_images');

CREATE POLICY "Authorized Insert Zen Images" ON storage.objects 
    FOR INSERT WITH CHECK (
        bucket_id = 'zen_sync_images' AND (
            public.is_admin() OR
            EXISTS (
                SELECT 1 FROM public.sessions 
                WHERE code = split_part(name, '/', 1) 
                  AND expires_at > timezone('utc'::text, now())
            )
        )
    );

CREATE POLICY "Authorized Delete Zen Images" ON storage.objects 
    FOR DELETE USING (
        bucket_id = 'zen_sync_images' AND (
            public.is_admin() OR
            EXISTS (
                SELECT 1 FROM public.sessions 
                WHERE code = split_part(name, '/', 1) 
                  AND expires_at > timezone('utc'::text, now())
            )
        )
    );

-- 13. Quiz Leaderboard Scoring Integrity
ALTER TABLE public.quiz_leaderboard DROP CONSTRAINT IF EXISTS quiz_score_range;
ALTER TABLE public.quiz_leaderboard ADD CONSTRAINT quiz_score_range 
    CHECK (score >= 0 AND score <= 2500);

ALTER TABLE public.quiz_leaderboard DROP CONSTRAINT IF EXISTS quiz_streak_range;
ALTER TABLE public.quiz_leaderboard ADD CONSTRAINT quiz_streak_range 
    CHECK (streak >= 0 AND streak <= 10);

DROP POLICY IF EXISTS "Public Validated Insert" ON public.quiz_leaderboard;
CREATE POLICY "Public Validated Insert" ON public.quiz_leaderboard 
    FOR INSERT WITH CHECK (
        length(trim(player_name)) >= 2 AND length(trim(player_name)) <= 30 AND
        score >= 0 AND score <= 2500 AND
        streak >= 0 AND streak <= 10
    );
