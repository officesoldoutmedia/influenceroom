-- Migration 030: track when a deliverable was actually published.
--
-- The existing `updated_at` is a poor proxy because any field edit refreshes
-- it. Sprint 10 scoring needs a true "published moment" so `calc_punctuality_score`
-- can compare it against `post_date`. Set automatically by trigger on the
-- status->'published' transition; cleared on revert so re-publishing restamps.

ALTER TABLE campaign_deliverables
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE OR REPLACE FUNCTION trg_stamp_published_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Stamp on transition into 'published' if not explicitly set by caller.
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published'
     AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  -- Reset when leaving 'published' so a re-publish gets a fresh timestamp.
  IF NEW.status IS DISTINCT FROM 'published' THEN
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deliverables_published_at ON campaign_deliverables;
CREATE TRIGGER trg_deliverables_published_at
  BEFORE UPDATE ON campaign_deliverables
  FOR EACH ROW EXECUTE FUNCTION trg_stamp_published_at();

-- Backfill: any row already in 'published' state gets its updated_at as a
-- best-effort published moment (better than NULL for punctuality calc).
UPDATE campaign_deliverables
   SET published_at = updated_at
 WHERE status = 'published' AND published_at IS NULL;
