-- Migration 040: append-only audit for rate-card changes.
--
-- Feedback echipa (Sprint 14) — costurile sunt sensitive, orice modificare
-- trebuie să lase urmă (cine, când, ce s-a schimbat). Pattern oglindit după
-- influencer_score_history din Sprint 10: append-only, one row per real
-- change, idempotent (no row inserted when before == after).
--
-- changes jsonb shape (computed in API by compareRateCards):
--   { "instagram.video": { "old": 2500, "new": 2700 },
--     "tiktok.boost_7d": { "old": null, "new": 1000 } }
--
-- Before/after snapshots are stored full so we don't have to re-derive what
-- "old" looked like later — small JSONB blobs, cheap on storage, perfect for
-- a small-team audit log.

CREATE TABLE IF NOT EXISTS influencer_rate_card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

  rate_cards_before jsonb,
  rate_cards_after  jsonb,
  changes           jsonb,

  changed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_history_influencer
  ON influencer_rate_card_history(influencer_id, changed_at DESC);

ALTER TABLE influencer_rate_card_history ENABLE ROW LEVEL SECURITY;

-- Path A: service_role bypasses. Policy kept as defence-in-depth.
DROP POLICY IF EXISTS rate_card_history_read_authn ON influencer_rate_card_history;
CREATE POLICY rate_card_history_read_authn ON influencer_rate_card_history
  FOR SELECT USING (auth.role() = 'authenticated');
