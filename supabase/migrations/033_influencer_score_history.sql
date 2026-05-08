-- Migration 033: append-only audit of score changes.
--
-- One row per total_score change. The `changes` jsonb captures the diff
-- (typically {old_total, new_total, ...}); change_reason is one of
-- 'manual_update' | 'auto_recalc' | 'weights_changed' so the UI can group
-- entries by cause.

CREATE TABLE IF NOT EXISTS influencer_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

  total_score integer,
  category text,

  changes jsonb,
  change_reason text NOT NULL
    CHECK (change_reason IN ('manual_update', 'auto_recalc', 'weights_changed')),

  changed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_history_influencer
  ON influencer_score_history(influencer_id, changed_at DESC);

ALTER TABLE influencer_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS score_history_read_authn ON influencer_score_history;
CREATE POLICY score_history_read_authn ON influencer_score_history
  FOR SELECT USING (auth.role() = 'authenticated');
