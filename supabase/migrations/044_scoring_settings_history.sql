-- Sprint 15 Faza 4 §5: audit pentru schimbarile ponderilor scoring.
--
-- Extinde scoring_settings.updated_by/at (timestamp only) cu snapshot complet
-- before/after + diff calculat in API. Pattern identic cu influencer_rate_card_history.
--
-- changes jsonb shape (computed in API):
--   { "weight_engagement_rate": { "old": 25, "new": 30 },
--     "weight_cpv": { "old": 20, "new": 15 } }

CREATE TABLE IF NOT EXISTS scoring_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weights_before jsonb,
  weights_after jsonb,
  changes jsonb,
  changed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_settings_history_time
  ON scoring_settings_history(changed_at DESC);

ALTER TABLE scoring_settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scoring_settings_history_read_authn ON scoring_settings_history;
CREATE POLICY scoring_settings_history_read_authn ON scoring_settings_history
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE scoring_settings_history IS
  'Audit append-only pentru schimbarile ponderilor scoring. Insert doar la diff real.';
