-- ==============================================================================
-- 20261013000005_transactional_rpcs.sql
-- TRANSACTIONAL RPC FUNCTIONS FOR ATOMIC SYNCHRONIZATION
-- Replaces fragile insert-then-delete client loops with single atomic transactions.
-- ==============================================================================

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
    -- Verify Admin Role
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only church administrators can update youth routine.';
    END IF;

    -- 1. Notices
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

    -- 2. Schedules
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

    -- 3. Groups / Teams
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

    -- 1. Choir Notices
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

    -- 2. Choir Schedules
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

    -- 3. Choir Layouts
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
SET search_path = public
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.sessions
    WHERE expires_at < timezone('utc'::text, now());
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 5. Explicit Function Execution Privileges
REVOKE EXECUTE ON FUNCTION public.sync_youth_routine(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_youth_routine(jsonb, jsonb, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_choir_routine(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_choir_routine(jsonb, jsonb, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_youtube_songs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_youtube_songs(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO postgres, service_role, authenticated;
