-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('user', 'company', 'admin');
CREATE TYPE gig_status AS ENUM ('draft', 'open', 'paused', 'completed', 'cancelled');
CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'denied', 'withdrawn');
CREATE TYPE submission_status AS ENUM ('pending_review', 'accepted', 'rejected');
CREATE TYPE ledger_entry_type AS ENUM ('deposit', 'escrow_hold', 'escrow_release', 'payout', 'refund', 'platform_fee');
CREATE TYPE device_type AS ENUM ('apple_watch', 'generic_android', 'generic_ios');
CREATE TYPE notification_type AS ENUM ('application_accepted', 'application_denied', 'submission_accepted', 'submission_rejected', 'payout_sent', 'gig_paused', 'gig_cancelled', 'low_balance_warning');
CREATE TYPE payout_status AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'cancelled');

-- Users table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles (data collectors)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id                    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name               TEXT,
  bio                        TEXT,
  avatar_url                 TEXT,
  stripe_account_id          TEXT,
  stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  credits_balance_cents      INTEGER NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company profiles (buyers)
CREATE TABLE IF NOT EXISTS company_profiles (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name     TEXT NOT NULL,
  logo_url         TEXT,
  website_url      TEXT,
  description      TEXT,
  stripe_customer_id TEXT,
  balance_cents    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gigs
CREATE TABLE IF NOT EXISTS gigs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id           UUID NOT NULL REFERENCES company_profiles(user_id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  activity_type        TEXT NOT NULL,
  status               gig_status NOT NULL DEFAULT 'draft',
  total_slots          INTEGER NOT NULL,
  filled_slots         INTEGER NOT NULL DEFAULT 0,
  application_deadline TIMESTAMPTZ,
  data_deadline        TIMESTAMPTZ,
  published_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gig labels
CREATE TABLE IF NOT EXISTS gig_labels (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id             UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  label_name         TEXT NOT NULL,
  description        TEXT,
  duration_seconds   INTEGER NOT NULL,
  rate_cents         INTEGER NOT NULL,
  quantity_needed    INTEGER NOT NULL,
  quantity_fulfilled INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gig_id, label_name)
);

-- Gig device requirements
CREATE TABLE IF NOT EXISTS gig_device_requirements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id      UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  device_type device_type NOT NULL,
  UNIQUE (gig_id, device_type)
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id           UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           application_status NOT NULL DEFAULT 'pending',
  assignment_code  TEXT UNIQUE,
  device_type      device_type NOT NULL,
  note_from_user   TEXT,
  note_from_company TEXT,
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gig_id, user_id)
);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id      UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  gig_label_id        UUID NOT NULL REFERENCES gig_labels(id) ON DELETE CASCADE,
  assignment_code     TEXT NOT NULL,
  status              submission_status NOT NULL DEFAULT 'pending_review',
  storage_path        TEXT,
  file_size_bytes     BIGINT,
  duration_seconds    INTEGER,
  device_type         device_type NOT NULL,
  device_metadata     JSONB,
  verification_result JSONB,
  verified_at         TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger entries (append-only)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                    ledger_entry_type NOT NULL,
  amount_cents            INTEGER NOT NULL,
  company_id              UUID REFERENCES company_profiles(user_id) ON DELETE SET NULL,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  submission_id           UUID REFERENCES submissions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id      TEXT,
  description             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ledger_party CHECK (company_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Gig escrow holds
CREATE TABLE IF NOT EXISTS gig_escrow_holds (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id           UUID UNIQUE NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES company_profiles(user_id) ON DELETE CASCADE,
  total_held_cents INTEGER NOT NULL,
  released_cents   INTEGER NOT NULL DEFAULT 0,
  refunded_cents   INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payout requests
CREATE TABLE IF NOT EXISTS payout_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL,
  status            payout_status NOT NULL DEFAULT 'pending',
  stripe_transfer_id TEXT UNIQUE,
  stripe_payout_id  TEXT,
  failure_reason    TEXT,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe webhook events (idempotency log)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  error           TEXT,
  raw_payload     JSONB NOT NULL,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Trigger: auto-create user row + profile on auth signup
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_val user_role;
BEGIN
  -- Read role from metadata (set during signup)
  user_role_val := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'user'
  );

  -- Insert into public users table
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role_val, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Create skeleton profile based on role
  IF user_role_val = 'company' THEN
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
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_device_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Users: read own row
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);

-- User profiles: read own, update own
CREATE POLICY "user_profiles_read_own" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_profiles_update_own" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Company profiles: read own, update own
CREATE POLICY "company_profiles_read_own" ON company_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "company_profiles_update_own" ON company_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Gigs: public read for open gigs; company CRUD own gigs
CREATE POLICY "gigs_public_read" ON gigs FOR SELECT USING (status = 'open' OR company_id = auth.uid());
CREATE POLICY "gigs_company_insert" ON gigs FOR INSERT WITH CHECK (company_id = auth.uid());
CREATE POLICY "gigs_company_update" ON gigs FOR UPDATE USING (company_id = auth.uid());
CREATE POLICY "gigs_company_delete" ON gigs FOR DELETE USING (company_id = auth.uid());

-- Gig labels: public read for open gigs; company manages own
CREATE POLICY "gig_labels_public_read" ON gig_labels FOR SELECT
  USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = gig_labels.gig_id AND (gigs.status = 'open' OR gigs.company_id = auth.uid())));
CREATE POLICY "gig_labels_company_write" ON gig_labels FOR ALL
  USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = gig_labels.gig_id AND gigs.company_id = auth.uid()));

-- Gig device requirements: same as labels
CREATE POLICY "gig_device_req_public_read" ON gig_device_requirements FOR SELECT
  USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = gig_device_requirements.gig_id AND (gigs.status = 'open' OR gigs.company_id = auth.uid())));
CREATE POLICY "gig_device_req_company_write" ON gig_device_requirements FOR ALL
  USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = gig_device_requirements.gig_id AND gigs.company_id = auth.uid()));

-- Applications: user reads own; company reads for their gigs
CREATE POLICY "applications_user_read" ON applications FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM gigs WHERE gigs.id = applications.gig_id AND gigs.company_id = auth.uid()));
CREATE POLICY "applications_user_insert" ON applications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "applications_user_update" ON applications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "applications_company_update" ON applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM gigs WHERE gigs.id = applications.gig_id AND gigs.company_id = auth.uid()));

-- Submissions: user reads own; company reads for their gigs
CREATE POLICY "submissions_user_read" ON submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM applications WHERE applications.id = submissions.application_id AND applications.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM applications a JOIN gigs g ON g.id = a.gig_id WHERE a.id = submissions.application_id AND g.company_id = auth.uid()));
CREATE POLICY "submissions_user_insert" ON submissions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM applications WHERE applications.id = submissions.application_id AND applications.user_id = auth.uid()));

-- Ledger entries: read own
CREATE POLICY "ledger_user_read" ON ledger_entries FOR SELECT USING (user_id = auth.uid() OR company_id = auth.uid());

-- Escrow holds: company reads own
CREATE POLICY "escrow_company_read" ON gig_escrow_holds FOR SELECT USING (company_id = auth.uid());

-- Payout requests: user reads own
CREATE POLICY "payout_user_read" ON payout_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payout_user_insert" ON payout_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- Notifications: user reads own, updates own
CREATE POLICY "notifications_user_read" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_user_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Stripe webhook events: service role only (no user policies)
