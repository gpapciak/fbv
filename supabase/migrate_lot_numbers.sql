-- ============================================================
-- Migration: lot number system  →  S/I integer encoding
-- Old: plain integers 1–26 (schematic, SVG map era)
-- New: Shore S1–S12 = 101–112, Inland I1–I12 = 201–212 (I8=208)
--
-- Run once in: Supabase Dashboard → SQL Editor
-- Safe to re-run: all steps are idempotent.
-- ============================================================


-- ── Step 1: Add 'not-available' to the lot_listings status constraint ──
-- The old constraint only allowed: owner-occupied, for-sale, for-rent, available.

ALTER TABLE lot_listings
  DROP CONSTRAINT IF EXISTS lot_listings_status_check;

ALTER TABLE lot_listings
  ADD CONSTRAINT lot_listings_status_check
  CHECK (status IN ('owner-occupied','for-sale','for-rent','available','not-available'));

-- Also update the column default to match the new system's neutral state.
ALTER TABLE lot_listings
  ALTER COLUMN status SET DEFAULT 'not-available';


-- ── Step 2: Remove lot_listings rows using old integers (1–26) ──
-- These were schematic rows tied to the replaced SVG map.

DELETE FROM lot_listings
  WHERE lot_number BETWEEN 1 AND 26;


-- ── Step 3: Scrub old integers from owners.lot_numbers arrays ──
-- Any owner assigned lot numbers 1–26 has placeholder data; strip those values.
-- If all of an owner's numbers fall in 1–26 the array becomes empty ({}),
-- which is the correct state until real lot numbers are assigned by an admin.

UPDATE owners
  SET lot_numbers = COALESCE(
    (SELECT array_agg(n)
     FROM unnest(lot_numbers) AS n
     WHERE n NOT BETWEEN 1 AND 26),
    '{}'::INTEGER[]
  )
  WHERE lot_numbers && (
    SELECT array_agg(n) FROM generate_series(1, 26) AS n
  );


-- ── Step 4: Seed lot_listings with the 24 real lots ──
-- Runs cleanly whether or not Step 2 left any rows.
-- ON CONFLICT DO UPDATE ensures status is correct even if rows already exist.

INSERT INTO lot_listings (lot_number, status) VALUES
  (101, 'not-available'), (102, 'not-available'), (103, 'not-available'),
  (104, 'not-available'), (105, 'not-available'), (106, 'for-sale'),
  (107, 'not-available'), (108, 'not-available'), (109, 'not-available'),
  (110, 'not-available'), (111, 'not-available'), (112, 'not-available'),
  (201, 'not-available'), (202, 'not-available'), (203, 'not-available'),
  (204, 'not-available'), (205, 'not-available'), (206, 'not-available'),
  (207, 'not-available'), (208, 'not-available'), (209, 'not-available'),
  (210, 'not-available'), (211, 'not-available')
ON CONFLICT (lot_number) DO UPDATE
  SET status = EXCLUDED.status;


-- ── Verification queries (run after to confirm) ──

-- Should return exactly 23 rows, all with lot_number >= 100.
-- SELECT lot_number, status FROM lot_listings ORDER BY lot_number;

-- Should return 0 rows (no old integers remaining).
-- SELECT lot_number FROM lot_listings WHERE lot_number BETWEEN 1 AND 26;

-- Should return no arrays containing integers in 1–26.
-- SELECT id, lot_numbers FROM owners WHERE lot_numbers && (SELECT array_agg(n) FROM generate_series(1,26) n);
