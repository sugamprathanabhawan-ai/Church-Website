-- ==============================================================================
-- SUGAM PRATHANA BHAWAN (CHURCH WEBSITE) - SUPABASE DATABASE SCHEMA
-- PostgreSQL schema with Row Level Security (RLS) and Realtime Enabled
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. YOUTH NOTICES TABLE
CREATE TABLE IF NOT EXISTS public.youth_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. YOUTH SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS public.youth_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_title TEXT NOT NULL,
    date_str TEXT NOT NULL,
    activity TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. YOUTH GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.youth_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_name TEXT NOT NULL DEFAULT '',
    captain_name TEXT NOT NULL DEFAULT '',
    members TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CHOIR NOTICES TABLE
CREATE TABLE IF NOT EXISTS public.choir_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CHOIR SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS public.choir_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_name TEXT NOT NULL,
    date_str TEXT NOT NULL,
    time_str TEXT DEFAULT '',
    work_str TEXT DEFAULT '',
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CHOIR LAYOUTS TABLE
CREATE TABLE IF NOT EXISTS public.choir_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_title TEXT NOT NULL,
    saturday_title TEXT NOT NULL,
    activities TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. YOUTUBE WORSHIP SONGS TABLE
CREATE TABLE IF NOT EXISTS public.youtube_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    video_id TEXT DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. BIBLE QUIZ QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer INT NOT NULL DEFAULT 0,
    reference TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. BIBLE QUIZ LEADERBOARD TABLE
CREATE TABLE IF NOT EXISTS public.quiz_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. FAQ ITEMS TABLE (FOR CHATBOT & SEARCH)
CREATE TABLE IF NOT EXISTS public.faq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. CHURCH GENERAL SETTINGS & METADATA
CREATE TABLE IF NOT EXISTS public.church_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. CHURCH DOCUMENTS & PDF REPOSITORY (CALENDAR, LAWS, CHOIR)
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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

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
        'church_settings',
        'church_documents'
    ];
BEGIN
    -- 1. Secure Content Tables (Public Read, Authenticated Write/Delete)
    FOREACH tbl IN ARRAY content_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Clean up existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Delete Access" ON public.%I;', tbl);

        -- Public Read
        EXECUTE format('CREATE POLICY "Public Read Access" ON public.%I FOR SELECT USING (true);', tbl);

        -- Authenticated-only modifications (Admins)
        EXECUTE format('CREATE POLICY "Authenticated Insert Access" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);', tbl);
        EXECUTE format('CREATE POLICY "Authenticated Update Access" ON public.%I FOR UPDATE TO authenticated USING (true);', tbl);
        EXECUTE format('CREATE POLICY "Authenticated Delete Access" ON public.%I FOR DELETE TO authenticated USING (true);', tbl);
    END LOOP;

    -- 2. Quiz Leaderboard Policies (Public Read, Validated Public Insert, Authenticated Delete/Reset)
    ALTER TABLE public.quiz_leaderboard ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public Read Access" ON public.quiz_leaderboard;
    DROP POLICY IF EXISTS "Public Insert Access" ON public.quiz_leaderboard;
    DROP POLICY IF EXISTS "Public Update Access" ON public.quiz_leaderboard;
    DROP POLICY IF EXISTS "Public Delete Access" ON public.quiz_leaderboard;
    DROP POLICY IF EXISTS "Authenticated Delete Access" ON public.quiz_leaderboard;

    CREATE POLICY "Public Read Access" ON public.quiz_leaderboard FOR SELECT USING (true);
    CREATE POLICY "Public Insert Access" ON public.quiz_leaderboard FOR INSERT WITH CHECK (
        length(player_name) > 0 AND length(player_name) <= 50 AND score >= 0
    );
    CREATE POLICY "Authenticated Delete Access" ON public.quiz_leaderboard FOR DELETE TO authenticated USING (true);
END $$;

-- ==============================================================================
-- REALTIME PUBLICATION SETUP
-- ==============================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'youth_notices', 
        'youth_schedules', 
        'youth_groups', 
        'choir_notices', 
        'choir_schedules', 
        'choir_layouts', 
        'youtube_songs', 
        'quiz_questions', 
        'quiz_leaderboard', 
        'faq_items',
        'church_settings',
        'church_documents'
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

-- ==============================================================================
-- STORAGE BUCKET SETUP (CHURCH DOCUMENTS & PDFS)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'church_documents',
    'church_documents',
    true,
    26214400, -- 25 MB max limit
    ARRAY['application/pdf', 'application/x-pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'application/x-pdf', 'image/png', 'image/jpeg', 'image/webp'];

-- Storage Policies for church_documents
DROP POLICY IF EXISTS "Public Read Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Documents" ON storage.objects;

CREATE POLICY "Public Read Documents" ON storage.objects 
    FOR SELECT USING (bucket_id = 'church_documents');

CREATE POLICY "Authenticated Upload Documents" ON storage.objects 
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'church_documents');

CREATE POLICY "Authenticated Delete Documents" ON storage.objects 
    FOR DELETE TO authenticated 
    USING (bucket_id = 'church_documents');

