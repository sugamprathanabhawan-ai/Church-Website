-- ==============================================================================
-- SUGAM PRATHANA BHAWAN (CHURCH WEBSITE) & ZEN SYNC - CONSOLIDATED SUPABASE SCHEMA
-- PostgreSQL schema with Strict Row Level Security (RLS), Realtime & Storage
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ADMIN USERS & ROLE MANAGEMENT
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Security Definer function to verify admin authorization
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

DROP POLICY IF EXISTS "Users can view own admin role" ON public.admin_users;
CREATE POLICY "Users can view own admin role" 
    ON public.admin_users FOR SELECT TO authenticated 
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Admins can manage admin_users"
    ON public.admin_users FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Dedicated Server-Side Admin Bootstrap Secrets Table (Private, Inaccessible to Direct Clients)
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

-- Protected Helper: Assign admin role by email
-- Strictly enforces that initial bootstrap requires a valid one-time bootstrap secret from private admin_bootstrap_secrets
-- or verified church administration account.
-- Subsequent role management strictly requires caller to already be a verified administrator (public.is_admin()).
-- Regular authenticated users cannot assign themselves or any other user as admin.
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

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text) TO authenticated;

-- 3. CONTENT TABLES
CREATE TABLE IF NOT EXISTS public.youth_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.youth_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_title TEXT NOT NULL,
    date_str TEXT NOT NULL,
    activity TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.youth_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_name TEXT NOT NULL DEFAULT '',
    captain_name TEXT NOT NULL DEFAULT '',
    members TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.choir_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.choir_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_name TEXT NOT NULL,
    date_str TEXT NOT NULL,
    time_str TEXT NOT NULL,
    work_str TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.choir_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_title TEXT NOT NULL,
    saturday_title TEXT NOT NULL,
    activities TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.youtube_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    video_id TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- ["Opt1", "Opt2", "Opt3", "Opt4"]
    correct INT NOT NULL DEFAULT 0,    -- 0 to 3
    verse TEXT DEFAULT '',
    explanation TEXT DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quiz_questions 
    ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS correct INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS answer INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS verse TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS explanation TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Keep answer and correct in sync if either exists
UPDATE public.quiz_questions SET correct = answer WHERE (correct IS NULL OR correct = 0) AND answer IS NOT NULL AND answer > 0;
UPDATE public.quiz_questions SET answer = correct WHERE (answer IS NULL OR answer = 0) AND correct IS NOT NULL AND correct > 0;
UPDATE public.quiz_questions SET verse = reference WHERE (verse IS NULL OR verse = '') AND reference IS NOT NULL AND reference <> '';

CREATE TABLE IF NOT EXISTS public.quiz_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name TEXT NOT NULL,
    score INT NOT NULL,
    streak INT NOT NULL DEFAULT 0,
    time_taken INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT quiz_score_range CHECK (score >= 0 AND score <= 2500),
    CONSTRAINT quiz_streak_range CHECK (streak >= 0 AND streak <= 10)
);

ALTER TABLE public.quiz_leaderboard 
    ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT 'Anonymous',
    ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS streak INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_taken INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.faq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    keywords TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.faq_items 
    ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS answer TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.church_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.church_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section TEXT NOT NULL, -- 'calendar', 'laws', 'choir'
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_size INT DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.church_documents 
    ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'calendar',
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS file_size INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.audio_sermons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    speaker TEXT NOT NULL DEFAULT 'पास्टर (Pastor)',
    category TEXT NOT NULL DEFAULT 'Sermon',
    scripture TEXT DEFAULT '',
    audio_url TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_size BIGINT DEFAULT 0,
    duration TEXT DEFAULT '00:00',
    cover_image TEXT DEFAULT '',
    description TEXT DEFAULT '',
    date_preached DATE DEFAULT CURRENT_DATE,
    is_featured BOOLEAN DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audio_sermons 
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS speaker TEXT NOT NULL DEFAULT 'पास्टर (Pastor)',
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Sermon',
    ADD COLUMN IF NOT EXISTS scripture TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '00:00',
    ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS date_preached DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

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

CREATE TABLE IF NOT EXISTS public.zen_upload_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code VARCHAR(16) NOT NULL REFERENCES public.sessions(code) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.zen_upload_tickets 
    ADD COLUMN IF NOT EXISTS session_code VARCHAR(16),
    ADD COLUMN IF NOT EXISTS file_path TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.zen_upload_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access to Zen Tickets" ON public.zen_upload_tickets;
CREATE POLICY "No Direct Access to Zen Tickets" ON public.zen_upload_tickets
    FOR ALL TO PUBLIC USING (false);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
DO $$ 
DECLARE
    tbl text;
    content_tables text[] := ARRAY[
        'youth_notices', 
        'youth_schedules', 
        'youth_groups', 
        'choir_notices', 
        'choir_schedules', 
        'choir_layouts', 
        'youtube_songs', 
        'quiz_questions', 
        'faq_items',
        'church_documents',
        'audio_sermons'
    ];
BEGIN
    FOREACH tbl IN ARRAY content_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin Delete Access" ON public.%I;', tbl);

        -- Public Read
        EXECUTE format('CREATE POLICY "Public Read Access" ON public.%I FOR SELECT USING (true);', tbl);

        -- Authenticated Admin Modifications Only
        EXECUTE format('CREATE POLICY "Admin Insert Access" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin());', tbl);
        EXECUTE format('CREATE POLICY "Admin Update Access" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());', tbl);
        EXECUTE format('CREATE POLICY "Admin Delete Access" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());', tbl);
    END LOOP;
END $$;

-- Church Settings: Public Read strictly restricted to explicitly approved public keys; Admin full access
ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON public.church_settings;
DROP POLICY IF EXISTS "Public Read Approved Church Settings" ON public.church_settings;
DROP POLICY IF EXISTS "Admin Insert Access" ON public.church_settings;
DROP POLICY IF EXISTS "Admin Update Access" ON public.church_settings;
DROP POLICY IF EXISTS "Admin Delete Access" ON public.church_settings;

CREATE POLICY "Public Read Approved Church Settings" 
    ON public.church_settings 
    FOR SELECT 
    USING (
        public.is_admin() OR 
        key IN ('gemini_ai_config', 'website_pictures', 'church_documents')
    );

CREATE POLICY "Admin Insert Access" ON public.church_settings 
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Access" ON public.church_settings 
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Access" ON public.church_settings 
    FOR DELETE TO authenticated USING (public.is_admin());

-- Leaderboard: Public Read, Validated Public Insert, Admin Reset
ALTER TABLE public.quiz_leaderboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Public Validated Insert" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Admin Delete Access" ON public.quiz_leaderboard;

CREATE POLICY "Public Read Access" ON public.quiz_leaderboard FOR SELECT USING (true);
CREATE POLICY "Public Validated Insert" ON public.quiz_leaderboard FOR INSERT WITH CHECK (
    length(trim(player_name)) >= 2 AND length(trim(player_name)) <= 30 AND
    score >= 0 AND score <= 2500 AND
    streak >= 0 AND streak <= 10
);
CREATE POLICY "Admin Delete Access" ON public.quiz_leaderboard FOR DELETE TO authenticated USING (public.is_admin());

-- ZenSync Sessions RLS (Direct mutations restricted; callers use verified RPCs)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Session read" ON public.sessions;
DROP POLICY IF EXISTS "Session insert" ON public.sessions;
DROP POLICY IF EXISTS "Session update" ON public.sessions;
DROP POLICY IF EXISTS "Session delete" ON public.sessions;
DROP POLICY IF EXISTS "Public Read Active Sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admin Full Access to Sessions" ON public.sessions;

CREATE POLICY "Public Read Active Sessions" ON public.sessions 
    FOR SELECT USING (expires_at > timezone('utc'::text, now()));

CREATE POLICY "Admin Full Access to Sessions" ON public.sessions 
    FOR ALL TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_youth_notices_sort ON public.youth_notices(sort_order);
CREATE INDEX IF NOT EXISTS idx_youth_schedules_sort ON public.youth_schedules(sort_order);
CREATE INDEX IF NOT EXISTS idx_youth_groups_sort ON public.youth_groups(sort_order);
CREATE INDEX IF NOT EXISTS idx_choir_notices_sort ON public.choir_notices(sort_order);
CREATE INDEX IF NOT EXISTS idx_choir_schedules_sort ON public.choir_schedules(sort_order);
CREATE INDEX IF NOT EXISTS idx_choir_layouts_sort ON public.choir_layouts(sort_order);
CREATE INDEX IF NOT EXISTS idx_youtube_songs_sort ON public.youtube_songs(sort_order);
CREATE INDEX IF NOT EXISTS idx_church_docs_section_sort ON public.church_documents(section, sort_order);
CREATE INDEX IF NOT EXISTS idx_quiz_leaderboard_score ON public.quiz_leaderboard(score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON public.sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- 6. STORAGE BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('church_documents', 'church_documents', true, 26214400, ARRAY['application/pdf', 'application/x-pdf', 'image/png', 'image/jpeg', 'image/webp']),
    ('zen_sync_images', 'zen_sync_images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    ('church_audio', 'church_audio', true, 104857600, ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/webm'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket: church_documents
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

-- Bucket: church_audio
DROP POLICY IF EXISTS "Public Read Audio Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert Audio Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Audio Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Audio Bucket" ON storage.objects;

CREATE POLICY "Public Read Audio Bucket" ON storage.objects 
    FOR SELECT USING (bucket_id = 'church_audio');

CREATE POLICY "Admin Insert Audio Bucket" ON storage.objects 
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'church_audio' AND public.is_admin());

CREATE POLICY "Admin Update Audio Bucket" ON storage.objects 
    FOR UPDATE TO authenticated 
    USING (bucket_id = 'church_audio' AND public.is_admin()) 
    WITH CHECK (bucket_id = 'church_audio' AND public.is_admin());

CREATE POLICY "Admin Delete Audio Bucket" ON storage.objects 
    FOR DELETE TO authenticated 
    USING (bucket_id = 'church_audio' AND public.is_admin());

-- ZenSync Upload Ticket Validation Helper (SECURITY DEFINER to safely check tickets)
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

-- Bucket: zen_sync_images
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

-- 7. REALTIME PUBLICATION
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'youth_notices', 'youth_schedules', 'youth_groups', 
        'choir_notices', 'choir_schedules', 'choir_layouts', 
        'youtube_songs', 'quiz_questions', 'quiz_leaderboard', 
        'faq_items', 'church_settings', 'church_documents', 'sessions'
    ];
BEGIN
    FOR tbl IN SELECT unnest(tables) LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        EXCEPTION WHEN duplicate_object THEN
            -- Table already in publication, safe to ignore
        END;
    END LOOP;
END $$;

-- 8. TRANSACTIONAL RPC FUNCTIONS FOR ATOMIC CLIENT SYNCHRONIZATION

-- 1. Atomic Sync Youth Routine
CREATE OR REPLACE FUNCTION public.sync_youth_routine(
    p_notices JSONB,
    p_schedules JSONB,
    p_groups JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item JSONB;
    idx INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only church administrators can update youth routine.';
    END IF;

    DELETE FROM public.youth_notices;
    IF p_notices IS NOT NULL AND jsonb_array_length(p_notices) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_notices) LOOP
            IF length(trim(COALESCE(item->>'text', item->>0, ''))) > 0 THEN
                INSERT INTO public.youth_notices (text, sort_order)
                VALUES (trim(COALESCE(item->>'text', item->>0)), idx);
                idx := idx + 1;
            END IF;
        END LOOP;
    END IF;

    DELETE FROM public.youth_schedules;
    idx := 0;
    IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_schedules) LOOP
            INSERT INTO public.youth_schedules (month_title, date_str, activity, sort_order)
            VALUES (
                COALESCE(item->>'month_title', 'Routine'),
                COALESCE(item->>'date_str', ''),
                COALESCE(item->>'activity', ''),
                idx
            );
            idx := idx + 1;
        END LOOP;
    END IF;

    DELETE FROM public.youth_groups;
    idx := 0;
    IF p_groups IS NOT NULL AND jsonb_array_length(p_groups) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
            INSERT INTO public.youth_groups (leader_name, captain_name, members, sort_order)
            VALUES (
                COALESCE(item->>'leader_name', ''),
                COALESCE(item->>'captain_name', ''),
                ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'members', '[]'::jsonb))),
                idx
            );
            idx := idx + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

-- 2. Atomic Sync Choir Routine
CREATE OR REPLACE FUNCTION public.sync_choir_routine(
    p_notices JSONB,
    p_schedules JSONB,
    p_layouts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item JSONB;
    idx INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only church administrators can update choir routine.';
    END IF;

    DELETE FROM public.choir_notices;
    IF p_notices IS NOT NULL AND jsonb_array_length(p_notices) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_notices) LOOP
            IF length(trim(COALESCE(item->>'text', item->>0, ''))) > 0 THEN
                INSERT INTO public.choir_notices (text, sort_order)
                VALUES (trim(COALESCE(item->>'text', item->>0)), idx);
                idx := idx + 1;
            END IF;
        END LOOP;
    END IF;

    DELETE FROM public.choir_schedules;
    idx := 0;
    IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_schedules) LOOP
            INSERT INTO public.choir_schedules (month_name, date_str, time_str, work_str, items, sort_order)
            VALUES (
                COALESCE(item->>'month_name', ''),
                COALESCE(item->>'date_str', ''),
                COALESCE(item->>'time_str', ''),
                COALESCE(item->>'work_str', ''),
                COALESCE(item->'items', '[]'::jsonb),
                idx
            );
            idx := idx + 1;
        END LOOP;
    END IF;

    DELETE FROM public.choir_layouts;
    idx := 0;
    IF p_layouts IS NOT NULL AND jsonb_array_length(p_layouts) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_layouts) LOOP
            INSERT INTO public.choir_layouts (group_title, saturday_title, activities, sort_order)
            VALUES (
                COALESCE(item->>'group_title', ''),
                COALESCE(item->>'saturday_title', ''),
                ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'activities', '[]'::jsonb))),
                idx
            );
            idx := idx + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

-- 3. Atomic Sync YouTube Songs
CREATE OR REPLACE FUNCTION public.sync_youtube_songs(
    p_songs JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item JSONB;
    idx INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only church administrators can update songs.';
    END IF;

    DELETE FROM public.youtube_songs;
    IF p_songs IS NOT NULL AND jsonb_array_length(p_songs) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_songs) LOOP
            INSERT INTO public.youtube_songs (name, link, video_id, sort_order)
            VALUES (
                COALESCE(item->>'name', ''),
                COALESCE(item->>'link', ''),
                COALESCE(item->>'video_id', ''),
                idx
            );
            idx := idx + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

-- 4. ZenSync Automatic Session Cleanup
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

-- 5. ZenSync: Create Session with cryptographic token hash
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

    SELECT code, host_token_hash, expires_at INTO existing_sess
    FROM public.sessions
    WHERE code = clean_code;

    IF FOUND THEN
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

-- 6. ZenSync: Update Current Slide (Host, Helper, or Admin only)
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

-- Overload for backwards compatibility
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

-- 7. ZenSync: Update Session Content
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

-- 8. ZenSync: Claim Helper Role
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

-- 9. ZenSync: Release Helper Role
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

-- 10. ZenSync: Force Release Helper Role (Host or Admin only)
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

-- 11. ZenSync: Delete Session
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

-- 12. ZenSync: Admin Delete All Sessions
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

-- 13. ZenSync: Admin List All Sessions
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

-- 14. ZenSync RPC: Authorize Image Upload (Host, Helper, or Admin only)
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

-- 15. ZenSync RPC: Delete Slide Image (Host, Helper, or Admin only)
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

-- 16. Explicit Function Execution Privileges on All SECURITY DEFINER Functions
REVOKE EXECUTE ON FUNCTION public.assign_admin_role(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_all_zen_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_zen_sessions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_zen_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_zen_sessions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_youth_routine(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_youth_routine(jsonb, jsonb, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_choir_routine(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_choir_routine(jsonb, jsonb, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_youtube_songs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_youtube_songs(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO postgres, service_role, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

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

-- ==============================================================================
-- SUGAM LYRICS BOOK SCHEMA & VERSION CONTROL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.lyrics_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    key_signature TEXT DEFAULT 'G',
    time_signature TEXT DEFAULT '4/4',
    category TEXT DEFAULT 'Worship',
    language TEXT DEFAULT 'Nepali',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_text TEXT DEFAULT '',
    source_file_url TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lyrics_songs_status ON public.lyrics_songs(status);
CREATE INDEX IF NOT EXISTS idx_lyrics_songs_category ON public.lyrics_songs(category);
CREATE INDEX IF NOT EXISTS idx_lyrics_songs_title ON public.lyrics_songs(title);

CREATE TABLE IF NOT EXISTS public.lyrics_song_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id UUID NOT NULL REFERENCES public.lyrics_songs(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    published_at TIMESTAMPTZ,
    note TEXT DEFAULT 'Published version snapshot'
);

CREATE INDEX IF NOT EXISTS idx_lyrics_versions_song ON public.lyrics_song_versions(song_id, version_number DESC);

ALTER TABLE public.lyrics_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics_song_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published lyrics songs" ON public.lyrics_songs;
CREATE POLICY "Public can view published lyrics songs"
    ON public.lyrics_songs FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

DROP POLICY IF EXISTS "Admins have full access to lyrics songs" ON public.lyrics_songs;
CREATE POLICY "Admins have full access to lyrics songs"
    ON public.lyrics_songs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins have full access to song versions" ON public.lyrics_song_versions;
CREATE POLICY "Admins have full access to song versions"
    ON public.lyrics_song_versions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==============================================================================
-- 15. AUDIO SERMONS & BIBLE STREAMING RECORDINGS (ARCHIVE.ORG / SUPABASE)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audio_sermons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    speaker TEXT NOT NULL DEFAULT 'पास्टर किरण थापा (Senior Pastor Kiran Thapa)',
    category TEXT NOT NULL DEFAULT 'Sermon',
    scripture TEXT DEFAULT '',
    audio_url TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_size BIGINT DEFAULT 0,
    duration TEXT DEFAULT '04:00',
    cover_image TEXT DEFAULT '/images/img1.webp',
    description TEXT DEFAULT '',
    date_preached DATE DEFAULT CURRENT_DATE,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audio_sermons_category ON public.audio_sermons(category);
CREATE INDEX IF NOT EXISTS idx_audio_sermons_date ON public.audio_sermons(date_preached DESC);
CREATE INDEX IF NOT EXISTS idx_audio_sermons_featured ON public.audio_sermons(is_featured);

ALTER TABLE public.audio_sermons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view audio sermons" ON public.audio_sermons;
CREATE POLICY "Public can view audio sermons"
    ON public.audio_sermons FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins have full access to audio sermons" ON public.audio_sermons;
CREATE POLICY "Admins have full access to audio sermons"
    ON public.audio_sermons FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Storage Bucket Setup for church_audio (optional local uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('church_audio', 'church_audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view church audio files" ON storage.objects;
CREATE POLICY "Public can view church audio files"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'church_audio');

DROP POLICY IF EXISTS "Admins can upload church audio files" ON storage.objects;
CREATE POLICY "Admins can upload church audio files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'church_audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete church audio files" ON storage.objects;
CREATE POLICY "Admins can delete church audio files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'church_audio' AND public.is_admin());



