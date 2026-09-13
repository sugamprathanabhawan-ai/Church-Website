-- ==============================================================================
-- ZEN SYNC - SUPABASE DATABASE & REALTIME SETUP
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create the sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    code VARCHAR(10) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    content JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    current_slide JSONB NOT NULL DEFAULT '{"section_id": "", "slide_index": 0, "global_index": 0}'::jsonb
);

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
INSERT INTO storage.buckets (id, name, public)
VALUES ('zen_sync_images', 'zen_sync_images', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage bucket policies for public access
DROP POLICY IF EXISTS "Public Access to zen_sync_images" ON storage.objects;
CREATE POLICY "Public Access to zen_sync_images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'zen_sync_images');

DROP POLICY IF EXISTS "Public Uploads to zen_sync_images" ON storage.objects;
CREATE POLICY "Public Uploads to zen_sync_images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'zen_sync_images');

DROP POLICY IF EXISTS "Public Deletes in zen_sync_images" ON storage.objects;
CREATE POLICY "Public Deletes in zen_sync_images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'zen_sync_images');
