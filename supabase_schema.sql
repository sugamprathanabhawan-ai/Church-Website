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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
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
        'church_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Drop existing policies if any to ensure idempotency
        EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I;', tbl);

        -- Create universal access policies (anon + authenticated)
        EXECUTE format('CREATE POLICY "Public Read Access" ON public.%I FOR SELECT USING (true);', tbl);
        EXECUTE format('CREATE POLICY "Public Insert Access" ON public.%I FOR INSERT WITH CHECK (true);', tbl);
        EXECUTE format('CREATE POLICY "Public Update Access" ON public.%I FOR UPDATE USING (true);', tbl);
        EXECUTE format('CREATE POLICY "Public Delete Access" ON public.%I FOR DELETE USING (true);', tbl);
    END LOOP;
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
        'church_settings'
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
