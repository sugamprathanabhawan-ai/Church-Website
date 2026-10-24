-- ==============================================================================
-- 20261013000002_admin_roles_and_auth.sql
-- SUGAM PRATHANA BHAWAN - ADMIN ROLES & SUPABASE AUTH INTEGRATION
-- Enforces server-verified admin authorization with non-recursive RLS and revokes public privileges
-- ==============================================================================

-- 1. Create dedicated admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Security Definer Helper Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4. Policy: Authenticated users can view their own admin status
DROP POLICY IF EXISTS "Users can view own admin role" ON public.admin_users;
CREATE POLICY "Users can view own admin role" 
    ON public.admin_users 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = id);

-- 5. Policy: Only authorized admins can manage the admin_users table (using is_admin to prevent RLS recursion)
DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Admins can manage admin_users"
    ON public.admin_users
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Dedicated Server-Side Admin Bootstrap Secrets Table (Private, Inaccessible to Direct Clients)
CREATE TABLE IF NOT EXISTS public.admin_bootstrap_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret TEXT NOT NULL,
    is_consumed BOOLEAN NOT NULL DEFAULT false,
    consumed_at TIMESTAMPTZ,
    consumed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_bootstrap_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access to Admin Bootstrap Secrets" ON public.admin_bootstrap_secrets;
CREATE POLICY "No Direct Access to Admin Bootstrap Secrets" ON public.admin_bootstrap_secrets
    FOR ALL TO PUBLIC USING (false);

-- 7. Protected Helper: Assign admin role by email
-- Strictly enforces that initial bootstrap requires a valid one-time bootstrap secret from private admin_bootstrap_secrets
-- or verified church administration account.
-- Subsequent role management strictly requires caller to already be a verified administrator (public.is_admin()).
-- Regular authenticated users cannot assign themselves or any other user as admin.
CREATE OR REPLACE FUNCTION public.assign_admin_role(
    target_email text,
    bootstrap_secret text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
    admin_count int;
    caller_email text;
    clean_target text;
    secret_rec RECORD;
BEGIN
    clean_target := lower(trim(target_email));
    IF clean_target = '' THEN
        RAISE EXCEPTION 'Target email cannot be empty';
    END IF;

    SELECT count(*) INTO admin_count FROM public.admin_users;

    IF admin_count = 0 THEN
        caller_email := lower(trim(COALESCE(auth.jwt()->>'email', '')));
        
        -- Retrieve active, unconsumed one-time secret from private bootstrap table
        SELECT id, secret INTO secret_rec
        FROM public.admin_bootstrap_secrets
        WHERE is_consumed = false
        ORDER BY created_at DESC
        LIMIT 1;

        IF secret_rec IS NOT NULL 
           AND bootstrap_secret IS NOT NULL 
           AND length(trim(bootstrap_secret)) > 0 
           AND (trim(bootstrap_secret) = trim(secret_rec.secret) OR encode(digest(trim(bootstrap_secret), 'sha256'), 'hex') = trim(secret_rec.secret)) THEN
            -- Atomically consume one-time secret to prevent replay
            UPDATE public.admin_bootstrap_secrets
            SET is_consumed = true,
                consumed_at = timezone('utc'::text, now()),
                consumed_by = clean_target
            WHERE id = secret_rec.id;
        ELSIF (clean_target = 'sugamprathanabhawan@gmail.com' AND caller_email = 'sugamprathanabhawan@gmail.com') THEN
            -- Authorized direct church administrator bootstrap
            NULL;
        ELSE
            RAISE EXCEPTION 'Access Denied: Initial admin bootstrap requires church authorization or valid one-time bootstrap secret';
        END IF;

        -- Clean up legacy settings key if present
        DELETE FROM public.church_settings WHERE key = 'admin_bootstrap_secret';
    ELSE
        -- After bootstrap, strictly require existing administrator privileges
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only existing church administrators can assign admin roles';
        END IF;
    END IF;

    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = clean_target;
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.admin_users (id, email, role)
        VALUES (target_user_id, clean_target, 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin', email = clean_target;
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

-- Overload for single-argument backwards compatibility
CREATE OR REPLACE FUNCTION public.assign_admin_role(target_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.assign_admin_role(target_email, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text) TO authenticated;
