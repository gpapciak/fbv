-- ============================================================
-- Finca Buena Vida — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: owners
-- One row per property owner (linked to Supabase auth user)
-- ============================================================
CREATE TABLE IF NOT EXISTS owners (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  lot_numbers       INTEGER[] NOT NULL DEFAULT '{}',
  bio               TEXT,
  photo_url         TEXT,
  directory_opt_in  BOOLEAN NOT NULL DEFAULT false,
  member_since      INTEGER,
  fbv_pics_url      TEXT,
  origin            TEXT,
  property_goals    TEXT,
  months_ideal      INTEGER CHECK (months_ideal BETWEEN 0 AND 12),
  months_actual     INTEGER CHECK (months_actual BETWEEN 0 AND 12),
  is_admin          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS owners_user_id_idx ON owners(user_id);
CREATE INDEX IF NOT EXISTS owners_email_idx ON owners(email);

CREATE TRIGGER owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: dues
-- Annual HOA dues invoices and payment tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS dues (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                  UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  year                      INTEGER NOT NULL,
  amount_cents              INTEGER NOT NULL,
  due_date                  DATE NOT NULL,
  paid_at                   TIMESTAMPTZ,
  payment_method            TEXT CHECK (payment_method IN ('stripe_card','stripe_ach','wire','check','other')),
  stripe_payment_intent_id  TEXT UNIQUE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, year)
);

CREATE INDEX IF NOT EXISTS dues_owner_id_idx ON dues(owner_id);
CREATE INDEX IF NOT EXISTS dues_year_idx ON dues(year);
CREATE INDEX IF NOT EXISTS dues_paid_at_idx ON dues(paid_at);
CREATE INDEX IF NOT EXISTS dues_due_date_idx ON dues(due_date);

CREATE TRIGGER dues_updated_at
  BEFORE UPDATE ON dues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: documents
-- HOA documents: minutes, covenants, financials, legal, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('minutes','covenants','financial','legal','other')),
  year            INTEGER,
  file_url        TEXT NOT NULL,
  storage_path    TEXT,
  reference_only  BOOLEAN NOT NULL DEFAULT false,
  reference_note  TEXT,
  uploaded_by     UUID REFERENCES owners(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_category_idx ON documents(category);
CREATE INDEX IF NOT EXISTS documents_year_idx ON documents(year);

-- ============================================================
-- TABLE: announcements
-- Board announcements and community posts
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  author_id   UUID REFERENCES owners(id) ON DELETE SET NULL,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcements_pinned_idx ON announcements(pinned);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON announcements(created_at DESC);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: comments
-- Comments on announcements
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  author_id        UUID REFERENCES owners(id) ON DELETE SET NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_announcement_id_idx ON comments(announcement_id);

-- ============================================================
-- TABLE: lot_listings
-- Public-facing listing info for each lot
-- ============================================================
-- lot_number encoding: Shore lots S1–S12 = 101–112, Inland lots I1–I12 = 201–212 (I8=208 included)
CREATE TABLE IF NOT EXISTS lot_listings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number          INTEGER NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'not_available'
                      CHECK (status IN ('for_sale','not_available','rental')),
  description         TEXT,
  price               TEXT,
  existing_structures TEXT,
  external_sale_url   TEXT,
  acreage             TEXT,
  email_contact       TEXT,
  availability_notes  TEXT,
  photos              JSONB NOT NULL DEFAULT '[]',
  updated_by          UUID REFERENCES owners(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lot_listings_lot_number_idx ON lot_listings(lot_number);
CREATE INDEX IF NOT EXISTS lot_listings_status_idx ON lot_listings(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE owners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues           ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_listings   ENABLE ROW LEVEL SECURITY;

-- Helper: return the owners.id for the current authenticated user
CREATE OR REPLACE FUNCTION current_owner_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM owners WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper: return true if the current user has is_admin = true
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM owners WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;

-- ---- owners policies ----

-- Members can read their own profile
CREATE POLICY "owners_read_own"
  ON owners FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "owners_read_admin"
  ON owners FOR SELECT
  TO authenticated
  USING (is_admin());

-- Directory: authenticated users can see opt-in profiles (limited columns handled in app)
CREATE POLICY "owners_directory_optin"
  ON owners FOR SELECT
  TO authenticated
  USING (directory_opt_in = true);

-- Members can update their own profile
CREATE POLICY "owners_update_own"
  ON owners FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can update any profile
CREATE POLICY "owners_update_admin"
  ON owners FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Admins can insert new owners
CREATE POLICY "owners_insert_admin"
  ON owners FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ---- dues policies ----

-- Members read own dues
CREATE POLICY "dues_read_own"
  ON dues FOR SELECT
  TO authenticated
  USING (owner_id = current_owner_id());

-- Admins read all dues
CREATE POLICY "dues_read_admin"
  ON dues FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins insert dues
CREATE POLICY "dues_insert_admin"
  ON dues FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins update dues (e.g. mark paid)
CREATE POLICY "dues_update_admin"
  ON dues FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Stripe webhook uses service role — no RLS policy needed for that path

-- ---- documents policies ----

-- All authenticated members can read documents
CREATE POLICY "documents_read_authenticated"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated owner can insert documents
CREATE POLICY "documents_insert_authenticated"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = current_owner_id());

-- Owners can delete their own documents; admins can delete any
CREATE POLICY "documents_delete_own_or_admin"
  ON documents FOR DELETE
  TO authenticated
  USING (uploaded_by IS NOT DISTINCT FROM current_owner_id() OR is_admin());

-- ---- announcements policies ----

-- All authenticated members can read announcements
CREATE POLICY "announcements_read_authenticated"
  ON announcements FOR SELECT
  TO authenticated
  USING (true);

-- Admins can insert announcements
CREATE POLICY "announcements_insert_admin"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can update announcements (pin/unpin, edit)
CREATE POLICY "announcements_update_admin"
  ON announcements FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Admins can delete announcements
CREATE POLICY "announcements_delete_admin"
  ON announcements FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---- comments policies ----

-- All authenticated members can read comments
CREATE POLICY "comments_read_authenticated"
  ON comments FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated members can post comments
CREATE POLICY "comments_insert_authenticated"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = current_owner_id());

-- Members delete own comments; admins delete any
CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  TO authenticated
  USING (author_id = current_owner_id() OR is_admin());

-- ---- lot_listings policies ----

-- All authenticated members can read listings
CREATE POLICY "lot_listings_read_authenticated"
  ON lot_listings FOR SELECT
  TO authenticated
  USING (true);

-- Members can upsert listings for lots they own
CREATE POLICY "lot_listings_upsert_own"
  ON lot_listings FOR INSERT
  TO authenticated
  WITH CHECK (
    updated_by = current_owner_id() AND
    lot_number = ANY(
      (SELECT lot_numbers FROM owners WHERE id = current_owner_id())::integer[]
    )
  );

CREATE POLICY "lot_listings_update_own"
  ON lot_listings FOR UPDATE
  TO authenticated
  USING (
    lot_number = ANY(
      (SELECT lot_numbers FROM owners WHERE id = current_owner_id())::integer[]
    )
  )
  WITH CHECK (
    updated_by = current_owner_id() AND
    lot_number = ANY(
      (SELECT lot_numbers FROM owners WHERE id = current_owner_id())::integer[]
    )
  );

-- Admins can upsert any listing
CREATE POLICY "lot_listings_upsert_admin"
  ON lot_listings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "lot_listings_update_admin"
  ON lot_listings FOR UPDATE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- SEED: Example lot_listings rows
-- Uncomment and adjust after your owners are set up.
-- ============================================================

-- Seed all 24 lots. S1–S12 = 101–112, I1–I12 = 201–212 (I8=208).
-- Only S6 (106) is currently for-sale; all others not-available.
INSERT INTO lot_listings (lot_number, status) VALUES
  (101, 'not_available'), (102, 'not_available'), (103, 'not_available'),
  (104, 'not_available'), (105, 'not_available'), (106, 'for_sale'),
  (107, 'not_available'), (108, 'not_available'), (109, 'not_available'),
  (110, 'not_available'), (111, 'not_available'), (112, 'not_available'),
  (201, 'not_available'), (202, 'not_available'), (203, 'not_available'),
  (204, 'not_available'), (205, 'not_available'), (206, 'not_available'),
  (207, 'not_available'), (208, 'not_available'), (209, 'not_available'),
  (210, 'not_available'), (211, 'not_available')
ON CONFLICT (lot_number) DO NOTHING;

-- ============================================================
-- MIGRATIONS: Run these in Supabase SQL Editor on existing DBs
-- ============================================================

-- Add new lot_listings columns (safe to run multiple times)
ALTER TABLE lot_listings ADD COLUMN IF NOT EXISTS acreage TEXT;
ALTER TABLE lot_listings ADD COLUMN IF NOT EXISTS email_contact TEXT;
ALTER TABLE lot_listings ADD COLUMN IF NOT EXISTS availability_notes TEXT;

-- Update status constraint to include 'rental'
ALTER TABLE lot_listings DROP CONSTRAINT IF EXISTS lot_listings_status_check;
ALTER TABLE lot_listings ADD CONSTRAINT lot_listings_status_check
  CHECK (status IN ('for_sale','not_available','rental'));
