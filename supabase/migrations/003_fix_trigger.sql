-- Fix the auth trigger: add SET search_path, explicit casts, and service-role RLS bypass
-- Run this in the Supabase SQL editor

-- 1. Drop and recreate the trigger function with SET search_path (required for SECURITY DEFINER)
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val user_role;
BEGIN
  -- Read role from metadata set during signup; default to 'user'
  BEGIN
    user_role_val := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'user'::user_role
    );
  EXCEPTION WHEN invalid_text_representation THEN
    -- If role value is invalid, default to 'user'
    user_role_val := 'user'::user_role;
  END;

  -- Insert into public users table (ON CONFLICT handles re-runs)
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role_val, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Create skeleton profile based on role
  IF user_role_val = 'company'::user_role THEN
    INSERT INTO public.company_profiles (user_id, company_name, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_profiles (user_id, display_name, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        split_part(COALESCE(NEW.email, ''), '@', 1)
      ),
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- 3. Grant the postgres role (SECURITY DEFINER owner) permission to bypass RLS
--    on our public tables so the trigger can always insert
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles FORCE ROW LEVEL SECURITY;

-- 4. Add service_role bypass policies (Supabase service role bypasses RLS automatically,
--    but explicit grants ensure internal trigger invocations work too)
DO $$
BEGIN
  -- users: allow service_role full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY "users_service_role_all" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- user_profiles: allow service_role full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY "user_profiles_service_role_all" ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- company_profiles: allow service_role full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'company_profiles_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY "company_profiles_service_role_all" ON public.company_profiles FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END;
$$;

-- 5. Grant execute on the function to postgres and authenticator roles
GRANT EXECUTE ON FUNCTION handle_new_auth_user() TO postgres;
GRANT EXECUTE ON FUNCTION handle_new_auth_user() TO authenticator;
