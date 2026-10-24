-- ==============================================================================
-- SUGAM LYRICS BOOK SCHEMA & VERSION CONTROL MIGRATION
-- Migration: 20261022000001_sugam_lyrics_book.sql
-- ==============================================================================

-- 1. Create Song Library Table
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

-- Indexing for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_lyrics_songs_status ON public.lyrics_songs(status);
CREATE INDEX IF NOT EXISTS idx_lyrics_songs_category ON public.lyrics_songs(category);
CREATE INDEX IF NOT EXISTS idx_lyrics_songs_title ON public.lyrics_songs(title);
CREATE INDEX IF NOT EXISTS idx_lyrics_songs_search ON public.lyrics_songs USING gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(search_text, '')));

-- 2. Create Song Version History Table
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

-- 3. Row Level Security (RLS)
ALTER TABLE public.lyrics_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics_song_versions ENABLE ROW LEVEL SECURITY;

-- Regular users can only read published songs
DROP POLICY IF EXISTS "Public can view published lyrics songs" ON public.lyrics_songs;
CREATE POLICY "Public can view published lyrics songs"
    ON public.lyrics_songs FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

-- Authorized administrators can perform all actions on songs
DROP POLICY IF EXISTS "Admins have full access to lyrics songs" ON public.lyrics_songs;
CREATE POLICY "Admins have full access to lyrics songs"
    ON public.lyrics_songs FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Only administrators can read and manage song version history
DROP POLICY IF EXISTS "Admins have full access to song versions" ON public.lyrics_song_versions;
CREATE POLICY "Admins have full access to song versions"
    ON public.lyrics_song_versions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Atomic Save & Version Snapshot RPC
CREATE OR REPLACE FUNCTION public.save_lyrics_song_with_version(
    p_id UUID,
    p_title TEXT,
    p_author TEXT,
    p_key TEXT,
    p_time_sig TEXT,
    p_category TEXT,
    p_language TEXT,
    p_status TEXT,
    p_sections JSONB,
    p_search_text TEXT,
    p_source_file_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_song_id UUID;
    v_old_status TEXT;
    v_old_version INT := 0;
    v_old_title TEXT;
    v_old_metadata JSONB;
    v_old_sections JSONB;
    v_new_version INT := 1;
    v_result JSONB;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated church administrators can save songs';
    END IF;

    -- Check if updating existing song
    IF p_id IS NOT NULL THEN
        SELECT id, status, version, title, 
               jsonb_build_object('author', author, 'key_signature', key_signature, 'time_signature', time_signature, 'category', category, 'language', language),
               sections
        INTO v_song_id, v_old_status, v_old_version, v_old_title, v_old_metadata, v_old_sections
        FROM public.lyrics_songs
        WHERE id = p_id;
    END IF;

    IF v_song_id IS NOT NULL THEN
        -- If currently being published, or already published and an edit is published:
        -- archive previous published snapshot
        IF p_status = 'published' AND v_old_status = 'published' THEN
            v_new_version := v_old_version + 1;

            -- Record previous published version snapshot
            INSERT INTO public.lyrics_song_versions (
                song_id, version_number, title, metadata, sections, created_by, created_at, published_at, note
            ) VALUES (
                v_song_id, v_old_version, v_old_title, v_old_metadata, v_old_sections, auth.uid(), v_now, v_now, 'Rollback snapshot before version ' || v_new_version
            );

            -- Enforce retention policy: keep current and 1 previous rollback version
            DELETE FROM public.lyrics_song_versions
            WHERE song_id = v_song_id
              AND id NOT IN (
                  SELECT id FROM public.lyrics_song_versions
                  WHERE song_id = v_song_id
                  ORDER BY version_number DESC
                  LIMIT 1
              );
        ELSE
            v_new_version := GREATEST(v_old_version, 1);
        END IF;

        UPDATE public.lyrics_songs
        SET title = p_title,
            author = COALESCE(p_author, ''),
            key_signature = COALESCE(p_key, 'G'),
            time_signature = COALESCE(p_time_sig, '4/4'),
            category = COALESCE(p_category, 'Worship'),
            language = COALESCE(p_language, 'Nepali'),
            status = p_status,
            sections = p_sections,
            search_text = COALESCE(p_search_text, ''),
            source_file_url = COALESCE(p_source_file_url, source_file_url),
            version = v_new_version,
            updated_at = v_now,
            published_at = CASE WHEN p_status = 'published' AND published_at IS NULL THEN v_now ELSE published_at END
        WHERE id = v_song_id
        RETURNING to_jsonb(public.lyrics_songs.*) INTO v_result;

    ELSE
        -- Insert new song
        INSERT INTO public.lyrics_songs (
            title, author, key_signature, time_signature, category, language,
            status, sections, search_text, source_file_url, version, created_by,
            created_at, updated_at, published_at
        ) VALUES (
            p_title, COALESCE(p_author, ''), COALESCE(p_key, 'G'), COALESCE(p_time_sig, '4/4'),
            COALESCE(p_category, 'Worship'), COALESCE(p_language, 'Nepali'),
            p_status, p_sections, COALESCE(p_search_text, ''), p_source_file_url, 1, auth.uid(),
            v_now, v_now, CASE WHEN p_status = 'published' THEN v_now ELSE NULL END
        )
        RETURNING to_jsonb(public.lyrics_songs.*) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

-- 5. Rollback RPC
CREATE OR REPLACE FUNCTION public.rollback_lyrics_song(
    p_song_id UUID,
    p_target_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version_rec RECORD;
    v_current_rec RECORD;
    v_result JSONB;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated church administrators can rollback songs';
    END IF;

    SELECT * INTO v_version_rec
    FROM public.lyrics_song_versions
    WHERE song_id = p_song_id AND version_number = p_target_version;

    IF v_version_rec IS NULL THEN
        RAISE EXCEPTION 'Specified song version % not found for rollback', p_target_version;
    END IF;

    SELECT * INTO v_current_rec
    FROM public.lyrics_songs
    WHERE id = p_song_id;

    IF v_current_rec IS NULL THEN
        RAISE EXCEPTION 'Song % not found', p_song_id;
    END IF;

    -- Save current state as version before rolling back
    INSERT INTO public.lyrics_song_versions (
        song_id, version_number, title, metadata, sections, created_by, created_at, published_at, note
    ) VALUES (
        p_song_id, v_current_rec.version, v_current_rec.title, 
        jsonb_build_object(
            'author', v_current_rec.author, 
            'key_signature', v_current_rec.key_signature, 
            'time_signature', v_current_rec.time_signature, 
            'category', v_current_rec.category, 
            'language', v_current_rec.language
        ), 
        v_current_rec.sections, auth.uid(), v_now, v_current_rec.published_at, 'Pre-rollback snapshot'
    );

    -- Apply rollback data
    UPDATE public.lyrics_songs
    SET title = v_version_rec.title,
        author = COALESCE(v_version_rec.metadata->>'author', author),
        key_signature = COALESCE(v_version_rec.metadata->>'key_signature', key_signature),
        time_signature = COALESCE(v_version_rec.metadata->>'time_signature', time_signature),
        category = COALESCE(v_version_rec.metadata->>'category', category),
        language = COALESCE(v_version_rec.metadata->>'language', language),
        sections = v_version_rec.sections,
        version = v_current_rec.version + 1,
        updated_at = v_now
    WHERE id = p_song_id
    RETURNING to_jsonb(public.lyrics_songs.*) INTO v_result;

    -- Prune versions to keep current + 1 rollback version
    DELETE FROM public.lyrics_song_versions
    WHERE song_id = p_song_id
      AND id NOT IN (
          SELECT id FROM public.lyrics_song_versions
          WHERE song_id = p_song_id
          ORDER BY version_number DESC
          LIMIT 1
      );

    RETURN v_result;
END;
$$;
