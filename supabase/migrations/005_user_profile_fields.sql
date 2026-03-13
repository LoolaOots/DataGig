-- Add optional personal info fields to user_profiles
-- Run in the Supabase SQL editor

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS age          INTEGER,
  ADD COLUMN IF NOT EXISTS state_country TEXT;
