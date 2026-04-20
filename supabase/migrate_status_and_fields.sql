-- ============================================================
-- Migration: underscore status values + column renames/adds
-- Old statuses (hyphen): 'for-sale', 'not-available', etc.
-- New statuses (underscore): 'for_sale', 'not_available'
-- Column: rental_link → external_sale_url
-- Column: existing_structures TEXT (new)
--
-- Run once in: Supabase Dashboard → SQL Editor
-- Safe to re-run: all steps are idempotent.
-- ============================================================


-- ── Step 1: Migrate existing rows to underscore values ──
-- All non-for-sale statuses collapse to not_available.

UPDATE lot_listings SET status = 'for_sale'
  WHERE status = 'for-sale';

UPDATE lot_listings SET status = 'not_available'
  WHERE status IN ('not-available', 'owner-occupied', 'for-rent', 'available');


-- ── Step 2: Update column default ──

ALTER TABLE lot_listings
  ALTER COLUMN status SET DEFAULT 'not_available';


-- ── Step 3: Replace CHECK constraint ──

ALTER TABLE lot_listings
  DROP CONSTRAINT IF EXISTS lot_listings_status_check;

ALTER TABLE lot_listings
  ADD CONSTRAINT lot_listings_status_check
  CHECK (status IN ('for_sale', 'not_available'));


-- ── Step 4: Rename rental_link → external_sale_url ──

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lot_listings' AND column_name = 'rental_link'
  ) THEN
    ALTER TABLE lot_listings RENAME COLUMN rental_link TO external_sale_url;
  END IF;
END $$;


-- ── Step 5: Add existing_structures column ──

ALTER TABLE lot_listings
  ADD COLUMN IF NOT EXISTS existing_structures TEXT;


-- ── Verification queries ──

-- Should show only 'for_sale' or 'not_available':
-- SELECT DISTINCT status FROM lot_listings;

-- Should show external_sale_url and existing_structures, no rental_link:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'lot_listings' ORDER BY ordinal_position;
