-- ==============================================================================
-- ZEN SYNC - SUPABASE DATABASE & REALTIME SETUP
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create the sessions table (with presenter device audit info)
CREATE TABLE IF NOT EXISTS public.sessions (
    code VARCHAR(10) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    device_name TEXT DEFAULT '',
    device_info JSONB DEFAULT '{}'::jsonb,
    content JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    current_slide JSONB NOT NULL DEFAULT '{"section_id": "", "slide_index": 0, "global_index": 0}'::jsonb
);

-- Upgrade existing tables if already created
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS main_signature TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS helper_signature TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS helper_device_info JSONB DEFAULT '{}'::jsonb;


-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 3. Create permissive policies for public access (No auth required)
DROP POLICY IF EXISTS "Public can read sessions" ON public.sessions;
CREATE POLICY "Public can read sessions"
    ON public.sessions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public can insert sessions" ON public.sessions;
CREATE POLICY "Public can insert sessions"
    ON public.sessions FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update sessions" ON public.sessions;
CREATE POLICY "Public can update sessions"
    ON public.sessions FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Public can delete sessions" ON public.sessions;
CREATE POLICY "Public can delete sessions"
    ON public.sessions FOR DELETE
    USING (true);

-- 4. Enable Supabase Realtime for the sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;

-- 5. Create storage bucket for uploaded presentation slides
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('zen_sync_images', 'zen_sync_images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- 6. Storage bucket policies
DROP POLICY IF EXISTS "Public Access to zen_sync_images" ON storage.objects;
CREATE POLICY "Public Access to zen_sync_images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'zen_sync_images');

DROP POLICY IF EXISTS "Public Uploads to zen_sync_images" ON storage.objects;
CREATE POLICY "Public Uploads to zen_sync_images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'zen_sync_images'
        AND (LOWER(storage.extension(name)) = ANY(ARRAY['png', 'jpg', 'jpeg', 'webp', 'gif']))
    );

DROP POLICY IF EXISTS "Public Deletes in zen_sync_images" ON storage.objects;
CREATE POLICY "Public Deletes in zen_sync_images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'zen_sync_images');
