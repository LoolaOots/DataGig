-- Make the auth trigger a silent fallback that NEVER blocks signup.
-- The Next.js auth callback now handles user creation reliably.
-- Run this in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val user_role;
BEGIN
  -- Best-effort: attempt to create the user record.
  -- If anything fails, log a warning but NEVER raise — auth must not be blocked.
  BEGIN
    user_role_val := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'user'::user_role
    );

    INSERT INTO public.users (id, email, role, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_role_val, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    IF user_role_val = 'company'::user_role THEN
      INSERT INTO public.company_profiles (user_id, company_name, created_at, updated_at)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
        NOW(), NOW()
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
        NOW(), NOW()
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Never block auth — the Next.js callback will create the records instead.
    RAISE WARNING 'handle_new_auth_user skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
