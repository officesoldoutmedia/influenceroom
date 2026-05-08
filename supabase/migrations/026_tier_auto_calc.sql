-- Sprint 9 Faza 3c — auto-calculate tier from MAX(followers) across the
-- four platforms. Manual override flag (`tier_manual_override`) bypasses
-- the trigger so a human pick stays sticky.

-- Pure function — given a social_handles JSONB, return the tier text.
-- Thresholds (from Oana's Mai 8 feedback):
--   nano   < 25,000
--   micro  25,000 – 99,999
--   mid    100,000 – 499,999
--   macro  500,000+
CREATE OR REPLACE FUNCTION public.calc_influencer_tier(handles jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  max_f integer;
BEGIN
  SELECT GREATEST(
    COALESCE((handles->'instagram'->>'followers')::integer, 0),
    COALESCE((handles->'tiktok'   ->>'followers')::integer, 0),
    COALESCE((handles->'youtube'  ->>'followers')::integer, 0),
    COALESCE((handles->'facebook' ->>'followers')::integer, 0)
  ) INTO max_f;

  IF max_f < 25000      THEN RETURN 'nano';
  ELSIF max_f < 100000  THEN RETURN 'micro';
  ELSIF max_f < 500000  THEN RETURN 'mid';
  ELSE                       RETURN 'macro';
  END IF;
END;
$$;

-- Trigger function — keep tier in sync with social_handles unless the
-- override flag is set. Fires on INSERT and on UPDATE OF (social_handles,
-- tier_manual_override) so plain status/note updates don't recompute.
CREATE OR REPLACE FUNCTION public.trg_auto_calc_tier()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tier_manual_override THEN
    RETURN NEW;
  END IF;
  NEW.tier := public.calc_influencer_tier(NEW.social_handles);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencers_auto_tier ON influencers;
CREATE TRIGGER trg_influencers_auto_tier
  BEFORE INSERT OR UPDATE OF social_handles, tier_manual_override
  ON influencers
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_calc_tier();

-- Backfill: if anyone has tier_manual_override = false, recompute now.
-- (Migration 025 set existing rows to override=true, so this is a no-op
-- for present data but locks in the invariant for any pre-existing row
-- that was somehow not marked.)
UPDATE influencers
SET tier = public.calc_influencer_tier(social_handles)
WHERE tier_manual_override = false;
