-- Sprint 15 Faza 4 §5: audit pentru modificările de cost (campaign budget + participant fee).
--
-- Pattern oglindit după influencer_rate_card_history (Sprint 14b): append-only,
-- one row per real change, idempotent (insert doar la diff real).
--
-- Single table cu enum cost_change_type acoperă ambele cazuri (budget la nivel
-- campanie + fee la nivel participant) cu CHECK constraint care enforce consistency:
--   total_budget → participant_id IS NULL
--   agreed_fee   → participant_id IS NOT NULL

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_change_type') THEN
    CREATE TYPE cost_change_type AS ENUM ('total_budget', 'agreed_fee');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS campaign_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES campaign_participants(id) ON DELETE CASCADE,
  cost_type cost_change_type NOT NULL,
  amount_before numeric,
  amount_after numeric,
  changed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (cost_type = 'total_budget' AND participant_id IS NULL)
    OR (cost_type = 'agreed_fee' AND participant_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cost_history_campaign
  ON campaign_cost_history(campaign_id, changed_at DESC);

ALTER TABLE campaign_cost_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_history_read_authn ON campaign_cost_history;
CREATE POLICY cost_history_read_authn ON campaign_cost_history
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE campaign_cost_history IS
  'Audit append-only pentru modificarile de cost. Un rand per (campaign, cost_type, [participant]) per modificare reala.';
