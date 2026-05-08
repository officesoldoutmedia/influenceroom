-- Sprint 9 Faza 1 — switch the canonical currency from RON to EUR.
--
-- The 6 monetary columns already had generic names (no _ron / _eur suffix),
-- so no rename is needed. We add column comments so future contributors and
-- DB tooling see the canonical unit, and so anyone reviewing the schema in
-- Supabase dashboard knows the unit at a glance.
--
-- Data migration is a no-op: a `SELECT count(*) ... WHERE col > 0` returned
-- 0 across all 6 columns at the time this migration was written (test/seed
-- DB only). Existing nulls remain nulls; future inputs are interpreted as
-- whole-euro amounts.

COMMENT ON COLUMN influencers.rate_post   IS 'EUR — single canonical currency';
COMMENT ON COLUMN influencers.rate_story  IS 'EUR — single canonical currency';
COMMENT ON COLUMN influencers.rate_reel   IS 'EUR — single canonical currency';
COMMENT ON COLUMN influencers.rate_video  IS 'EUR — single canonical currency';
COMMENT ON COLUMN campaigns.total_budget  IS 'EUR — single canonical currency';
COMMENT ON COLUMN campaign_influencers.agreed_fee IS 'EUR — single canonical currency';
