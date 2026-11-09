-- ==============================================================================
-- 20261013000001_core_schema.sql
-- SUGAM PRATHANA BHAWAN & ZEN SYNC - UNIFIED CORE SCHEMA
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. YOUTH NOTICES
CREATE TABLE IF NOT EXISTS public.youth_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. YOUTH SCHEDULES
CREATE TABLE IF NOT EXISTS public.youth_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_title TEXT NOT NULL,
    date_str TEXT NOT NULL,
    activity TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. YOUTH GROUPS & TEAMS
CREATE TABLE IF NOT EXISTS public.youth_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_name TEXT NOT NULL DEFAULT '',
    captain_name TEXT NOT NULL DEFAULT '',
    members TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CHOIR NOTICES
CREATE TABLE IF NOT EXISTS public.choir_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CHOIR SCHEDULES
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

-- 7. CHOIR LAYOUTS
CREATE TABLE IF NOT EXISTS public.choir_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_title TEXT NOT NULL,
    saturday_title TEXT NOT NULL,
    activities TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. YOUTUBE WORSHIP SONGS
CREATE TABLE IF NOT EXISTS public.youtube_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    video_id TEXT DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. BIBLE QUIZ QUESTIONS
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

-- 10. BIBLE QUIZ LEADERBOARD
CREATE TABLE IF NOT EXISTS public.quiz_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. FAQ ITEMS (FOR CHATBOT & SEARCH)
CREATE TABLE IF NOT EXISTS public.faq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. CHURCH SETTINGS & METADATA
CREATE TABLE IF NOT EXISTS public.church_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. CHURCH DOCUMENTS (CALENDAR, LAWS, CHOIR PDFS)
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

-- 14. ZEN SYNC PRESENTATION SESSIONS
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

-- Safe upgrades if sessions table existed earlier without new lifecycle columns
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '12 hours');
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS host_token_hash TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS helper_signature TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS helper_device_info JSONB DEFAULT '{}'::jsonb;
