-- ==============================================================================
-- 20261013000004_storage_and_realtime.sql
-- STORAGE BUCKETS, REALTIME PUBLICATION & PERFORMANCE INDEXES
-- ==============================================================================

-- 1. Storage Buckets Setup
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'zen_sync_images',
    'zen_sync_images',
    true,
    10485760, -- 10 MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Storage Policies: church_documents
DROP POLICY IF EXISTS "Public Read Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Documents" ON storage.objects;

CREATE POLICY "Public Read Documents" ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'church_documents');

CREATE POLICY "Authenticated Upload Documents" ON storage.objects 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        bucket_id = 'church_documents' AND
        public.is_admin()
    );

CREATE POLICY "Authenticated Delete Documents" ON storage.objects 
    FOR DELETE 
    TO authenticated 
    USING (
        bucket_id = 'church_documents' AND
        public.is_admin()
    );

-- Storage Policies: zen_sync_images
DROP POLICY IF EXISTS "Public Read zen_sync_images" ON storage.objects;
DROP POLICY IF EXISTS "Validated Upload zen_sync_images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete zen_sync_images" ON storage.objects;

CREATE POLICY "Public Read zen_sync_images" ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'zen_sync_images');

CREATE POLICY "Validated Upload zen_sync_images" ON storage.objects 
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'zen_sync_images' AND
        (LOWER(storage.extension(name)) = ANY(ARRAY['png', 'jpg', 'jpeg', 'webp', 'gif']))
    );

CREATE POLICY "Admin Delete zen_sync_images" ON storage.objects 
    FOR DELETE 
    TO authenticated 
    USING (
        bucket_id = 'zen_sync_images' AND
        public.is_admin()
    );

-- 2. Performance Indexes
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

-- 3. Idempotent Realtime Publication Setup
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
        'church_documents',
        'sessions'
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
