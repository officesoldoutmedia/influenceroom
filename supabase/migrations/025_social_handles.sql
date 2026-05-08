-- Sprint 9 Faza 3c — replace `platforms` JSONB with structured `social_handles`
-- (per-platform handle + url + followers) and add `tier_manual_override` flag.
--
-- Old shape:  platforms  = {instagram: {handle, followers, engagement_rate}, ...}
-- New shape:  social_handles = {instagram: {handle, url, followers}, ...}
--
-- Migration steps (atomic, in one transaction):
--   1. Add social_handles + tier_manual_override columns.
--   2. Transform existing platforms data into social_handles by deriving the
--      URL from the handle (strip leading @, prepend the platform URL pattern).
--      engagement_rate is dropped — it was a manual estimate without a
--      grounded source. We can reintroduce later from real platform APIs.
--   3. Tier-manual-override defaults to TRUE for existing rows so the auto-
--      calc trigger we install in migration 026 doesn't immediately rewrite
--      tier values that the team set manually.
--   4. Drop platforms column and primary_handle column (redundant — handles
--      now live structured per platform).

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS social_handles jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier_manual_override boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_influencers_social_handles
  ON influencers USING gin(social_handles);

-- Strip a leading '@' from a handle string. Used during data migration.
CREATE OR REPLACE FUNCTION pg_temp.strip_at(h text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(coalesce(h, ''), '^@', '') $$;

-- Per-platform URL templates.
CREATE OR REPLACE FUNCTION pg_temp.derive_url(platform text, handle text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  clean text := pg_temp.strip_at(handle);
BEGIN
  IF clean = '' THEN RETURN ''; END IF;
  CASE platform
    WHEN 'instagram' THEN RETURN 'https://instagram.com/' || clean;
    WHEN 'tiktok'    THEN RETURN 'https://tiktok.com/@' || clean;
    WHEN 'youtube'   THEN RETURN 'https://youtube.com/@' || clean;
    WHEN 'facebook'  THEN RETURN 'https://facebook.com/' || clean;
    ELSE RETURN '';
  END CASE;
END;
$$;

-- Build a platform's new entry from the old entry.
CREATE OR REPLACE FUNCTION pg_temp.transform_entry(platform text, old_entry jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN old_entry IS NULL OR old_entry->>'handle' IS NULL THEN NULL
    ELSE jsonb_build_object(
      'handle', pg_temp.strip_at(old_entry->>'handle'),
      'url', pg_temp.derive_url(platform, old_entry->>'handle'),
      'followers', COALESCE((old_entry->>'followers')::int, 0)
    )
  END
$$;

-- Migrate every row's platforms JSONB into the new social_handles shape.
UPDATE influencers
SET social_handles = jsonb_strip_nulls(jsonb_build_object(
  'instagram', pg_temp.transform_entry('instagram', platforms->'instagram'),
  'tiktok',    pg_temp.transform_entry('tiktok',    platforms->'tiktok'),
  'youtube',   pg_temp.transform_entry('youtube',   platforms->'youtube'),
  'facebook',  pg_temp.transform_entry('facebook',  platforms->'facebook')
)),
-- Pin the manual override flag for existing rows; if their tier was set by
-- a human and we don't yet have the auto-calc trigger, this avoids surprises.
tier_manual_override = true
WHERE platforms IS NOT NULL AND platforms <> '{}'::jsonb;

-- Drop the old columns now that data has moved.
ALTER TABLE influencers
  DROP COLUMN IF EXISTS platforms,
  DROP COLUMN IF EXISTS primary_handle;
