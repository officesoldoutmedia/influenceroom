-- Migration 031: scoring weight settings (singleton).
--
-- Six criteria, each weighted 0..100. Stored as a singleton row enforced by
-- `id = 1` PK + CHECK so we always read settings via `WHERE id = 1`. Weights
-- do NOT need to sum to 100 — recalc_influencer_score() re-normalises by the
-- sum of weights of *active* (non-NULL) criteria, so missing manual scores
-- don't drag the total down.

CREATE TABLE IF NOT EXISTS scoring_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  weight_engagement_rate integer NOT NULL DEFAULT 25
    CHECK (weight_engagement_rate >= 0 AND weight_engagement_rate <= 100),
  weight_cpv integer NOT NULL DEFAULT 20
    CHECK (weight_cpv >= 0 AND weight_cpv <= 100),
  weight_audience_ro integer NOT NULL DEFAULT 20
    CHECK (weight_audience_ro >= 0 AND weight_audience_ro <= 100),
  weight_punctuality integer NOT NULL DEFAULT 15
    CHECK (weight_punctuality >= 0 AND weight_punctuality <= 100),
  weight_deliverable_quality integer NOT NULL DEFAULT 10
    CHECK (weight_deliverable_quality >= 0 AND weight_deliverable_quality <= 100),
  weight_collaboration_history integer NOT NULL DEFAULT 10
    CHECK (weight_collaboration_history >= 0 AND weight_collaboration_history <= 100),

  updated_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO scoring_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_scoring_settings_updated_at ON scoring_settings;
CREATE TRIGGER trg_scoring_settings_updated_at
  BEFORE UPDATE ON scoring_settings
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_participants();

ALTER TABLE scoring_settings ENABLE ROW LEVEL SECURITY;

-- Path A: service_role bypasses these. Kept as defense-in-depth + intent doc.
DROP POLICY IF EXISTS scoring_settings_read_authn ON scoring_settings;
CREATE POLICY scoring_settings_read_authn ON scoring_settings
  FOR SELECT USING (auth.role() = 'authenticated');
