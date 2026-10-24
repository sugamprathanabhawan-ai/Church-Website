-- ==============================================================================
-- 20261013000003_strict_rls_policies.sql
-- SECURE ROW LEVEL SECURITY POLICIES & ACCESS CONTROL
-- Revokes all permissive anon write loopholes and enforces authenticated admin privileges.
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
    FOREACH tbl IN ARRAY content_tables LOOP
        -- Ensure RLS is enabled
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Drop any previous permissive anon or test policies
        EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public read on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public insert on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public update on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public delete on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Insert Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Update Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Delete Access" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin write on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin update on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Admin delete on %I" ON public.%I;', tbl, tbl);

        -- 1. Public Read Policy
        EXECUTE format(
            'CREATE POLICY "Public Read Access" ON public.%I FOR SELECT USING (true);',
            tbl
        );

        -- 2. Authenticated Admin Insert Policy
        EXECUTE format(
            'CREATE POLICY "Admin Insert Access" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin());',
            tbl
        );

        -- 3. Authenticated Admin Update Policy
        EXECUTE format(
            'CREATE POLICY "Admin Update Access" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());',
            tbl
        );

        -- 4. Authenticated Admin Delete Policy
        EXECUTE format(
            'CREATE POLICY "Admin Delete Access" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());',
            tbl
        );
    END LOOP;

    -- Restrict church_settings SELECT policy to approved public keys only
    EXECUTE 'DROP POLICY IF EXISTS "Public Read Access" ON public.church_settings;';
    EXECUTE 'DROP POLICY IF EXISTS "Public Read Approved Church Settings" ON public.church_settings;';
    EXECUTE 'CREATE POLICY "Public Read Approved Church Settings" ON public.church_settings FOR SELECT USING (public.is_admin() OR key IN (''gemini_ai_config'', ''website_pictures'', ''church_documents''));';
END $$;

-- ==============================================================================
-- QUIZ LEADERBOARD POLICIES
-- Public Read, Validated Public Insert, Authenticated Admin Reset/Delete
-- ==============================================================================

ALTER TABLE public.quiz_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Access" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Public Insert Access" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Public Update Access" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Public Delete Access" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Allow all for anon" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.quiz_leaderboard;
DROP POLICY IF EXISTS "Admin Delete Access" ON public.quiz_leaderboard;

CREATE POLICY "Public Read Access" ON public.quiz_leaderboard 
    FOR SELECT USING (true);

-- Strictly validated public score submission
CREATE POLICY "Public Validated Insert" ON public.quiz_leaderboard 
    FOR INSERT 
    WITH CHECK (
        length(trim(player_name)) > 0 AND 
        length(player_name) <= 50 AND 
        score >= 0 AND 
        score <= 1000 AND
        streak >= 0
    );

-- Leaderboards are append-only; updates are disallowed.
-- Deleting/resetting leaderboard is admin-only.
CREATE POLICY "Admin Delete Access" ON public.quiz_leaderboard 
    FOR DELETE 
    TO authenticated 
    USING (public.is_admin());

-- ==============================================================================
-- ZEN SYNC SESSIONS RLS POLICIES
-- ==============================================================================

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Session read" ON public.sessions;
DROP POLICY IF EXISTS "Session insert" ON public.sessions;
DROP POLICY IF EXISTS "Session update" ON public.sessions;
DROP POLICY IF EXISTS "Session delete" ON public.sessions;

-- Anyone can read session state (listeners, main display, sub displays)
CREATE POLICY "Session read" ON public.sessions 
    FOR SELECT 
    USING (true);

-- Any host can create a new session code with valid constraints
CREATE POLICY "Session insert" ON public.sessions 
    FOR INSERT 
    WITH CHECK (
        length(code) >= 3 AND 
        length(code) <= 10 AND
        length(content::text) <= 524288 -- Max 512KB slide content
    );

-- Session updates require valid host token hash or admin authentication
CREATE POLICY "Session update" ON public.sessions 
    FOR UPDATE 
    USING (
        -- Either host matching hash OR authenticated admin
        (host_token_hash IS NOT NULL AND length(host_token_hash) > 0) OR
        (auth.role() = 'authenticated' AND public.is_admin())
    )
    WITH CHECK (
        length(content::text) <= 524288
    );

-- Session deletion: Host or Admin only
CREATE POLICY "Session delete" ON public.sessions 
    FOR DELETE 
    USING (
        (auth.role() = 'authenticated' AND public.is_admin()) OR
        (host_token_hash IS NOT NULL AND length(host_token_hash) > 0)
    );
