-- Sprint 9 Faza 2B — consolidate influencer tier 'mega' into 'macro'.
--
-- Storage: tier is `text` with a CHECK constraint listing the allowed values.
-- We update any existing 'mega' rows (none at migration write time, but be
-- safe), then drop and recreate the CHECK with 4 values instead of 5.
--
-- The display label for 'macro' becomes "Macro & VIP" (short) /
-- "Macro & VIP / Community Size" (long) in the UI; storage value stays
-- 'macro' so existing data and queries don't churn.

UPDATE influencers SET tier = 'macro' WHERE tier = 'mega';

ALTER TABLE influencers DROP CONSTRAINT IF EXISTS influencers_tier_check;
ALTER TABLE influencers ADD CONSTRAINT influencers_tier_check
  CHECK (tier IN ('nano', 'micro', 'mid', 'macro'));
