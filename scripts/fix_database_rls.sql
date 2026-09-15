-- ==============================================================================
-- SUGAM PRATHANA BHAWAN & ZEN SYNC - DATABASE RLS & STORAGE FIX SCRIPT
-- ==============================================================================
-- Run this entire script in your Supabase SQL Editor:
-- Supabase Dashboard -> Project (aiufpdabglxhojmmkedp) -> SQL Editor -> New query -> Paste & Run
--
-- What this script fixes:
-- 1. Unlocks church_settings so admin photo edits (Hero Slider, Gallery, Leaders) save directly to Supabase.
-- 2. Unlocks youth & choir routines, schedules, groups, notices, and worship songs so admin writing syncs live.
-- 3. Unlocks church_documents and zen_sync_images storage buckets for photo and PDF uploads.
-- 4. Upgrades sessions table with device_name and device_info columns for Zen Sync presentation tracking.
-- ==============================================================================

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Upgrade sessions table for Zen Sync
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb;

-- Ensure sessions table has public RLS policies
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can delete sessions" ON public.sessions;

CREATE POLICY "Public can read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Public can insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update sessions" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "Public can delete sessions" ON public.sessions FOR DELETE USING (true);

-- 3. Fix Row Level Security (RLS) on all content tables
DO $$ 
DECLARE
    tbl text;
    content_tables text[] := ARRAY[
        'church_settings',
        'youth_notices', 
        'youth_schedules', 
        'youth_groups', 
        'choir_notices', 
        'choir_schedules', 
        'choir_layouts', 
        'youtube_songs', 
        'church_documents',
        'quiz_questions', 
        'quiz_leaderboard',
        'faq_items'
    ];
BEGIN
    FOREACH tbl IN ARRAY content_tables LOOP
        -- Ensure table exists before modifying
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            
            -- Clean up old restrictive policies
            EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated Insert Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated Update Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated Delete Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I;', tbl);

            -- Create unified permissive policies for admin console operations
            EXECUTE format('CREATE POLICY "Allow public read on %I" ON public.%I FOR SELECT USING (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public insert on %I" ON public.%I FOR INSERT WITH CHECK (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public update on %I" ON public.%I FOR UPDATE USING (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public delete on %I" ON public.%I FOR DELETE USING (true);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 4. Ensure Realtime publication includes all tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'sessions',
        'church_settings',
        'youth_notices', 
        'youth_schedules', 
        'youth_groups', 
        'choir_notices', 
        'choir_schedules', 
        'choir_layouts', 
        'youtube_songs', 
        'church_documents', 
        'quiz_questions', 
        'quiz_leaderboard', 
        'faq_items'
    ];
BEGIN
    FOR tbl IN SELECT unnest(tables) LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            BEGIN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
            EXCEPTION WHEN duplicate_object THEN
                -- Already subscribed, safe to ignore
            END;
        END IF;
    END LOOP;
END $$;

-- 5. Storage Buckets Configuration (church_documents and zen_sync_images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'church_documents',
    'church_documents',
    true,
    26214400, -- 25MB limit
    ARRAY['application/pdf', 'application/x-pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'application/x-pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'zen_sync_images',
    'zen_sync_images',
    true,
    26214400,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Storage Policies for church_documents
DROP POLICY IF EXISTS "Public Read Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Documents" ON storage.objects;

CREATE POLICY "Public Read Documents" ON storage.objects 
    FOR SELECT USING (bucket_id = 'church_documents');

CREATE POLICY "Public Upload Documents" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'church_documents');

CREATE POLICY "Public Update Documents" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'church_documents');

CREATE POLICY "Public Delete Documents" ON storage.objects 
    FOR DELETE USING (bucket_id = 'church_documents');

-- Storage Policies for zen_sync_images
DROP POLICY IF EXISTS "Public Access to zen_sync_images" ON storage.objects;
DROP POLICY IF EXISTS "Public Uploads to zen_sync_images" ON storage.objects;
DROP POLICY IF EXISTS "Public Deletes in zen_sync_images" ON storage.objects;

CREATE POLICY "Public Access to zen_sync_images" ON storage.objects 
    FOR SELECT USING (bucket_id = 'zen_sync_images');

CREATE POLICY "Public Uploads to zen_sync_images" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'zen_sync_images');

CREATE POLICY "Public Updates to zen_sync_images" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'zen_sync_images');

CREATE POLICY "Public Deletes in zen_sync_images" ON storage.objects 
    FOR DELETE USING (bucket_id = 'zen_sync_images');

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
