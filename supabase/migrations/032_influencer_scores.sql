-- Migration 032: per-influencer score row (one-to-one with influencers).
--
-- 4 criteria are manual (engagement_rate, cpv, audience_ro, deliverable_quality)
-- and start NULL until a team member rates them. 2 criteria are auto-calculated
-- (punctuality, collaboration_history) and refreshed by recalc_influencer_score().
-- total_score and category are derived; explanation is the human-readable summary.

CREATE TABLE IF NOT EXISTS influencer_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL UNIQUE REFERENCES influencers(id) ON DELETE CASCADE,

  score_engagement_rate integer
    CHECK (score_engagement_rate IS NULL OR (score_engagement_rate >= 0 AND score_engagement_rate <= 100)),
  score_cpv integer
    CHECK (score_cpv IS NULL OR (score_cpv >= 0 AND score_cpv <= 100)),
  score_audience_ro integer
    CHECK (score_audience_ro IS NULL OR (score_audience_ro >= 0 AND score_audience_ro <= 100)),
  score_deliverable_quality integer
    CHECK (score_deliverable_quality IS NULL OR (score_deliverable_quality >= 0 AND score_deliverable_quality <= 100)),

  score_punctuality integer
    CHECK (score_punctuality IS NULL OR (score_punctuality >= 0 AND score_punctuality <= 100)),
  score_collaboration_history integer
    CHECK (score_collaboration_history IS NULL OR (score_collaboration_history >= 0 AND score_collaboration_history <= 100)),

  total_score integer NOT NULL DEFAULT 0
    CHECK (total_score >= 0 AND total_score <= 100),
  category text NOT NULL DEFAULT 'low'
    CHECK (category IN ('low', 'medium', 'high', 'top_performer')),

  explanation text,

  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_total ON influencer_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_category ON influencer_scores(category);

DROP TRIGGER IF EXISTS trg_scores_updated_at ON influencer_scores;
CREATE TRIGGER trg_scores_updated_at
  BEFORE UPDATE ON influencer_scores
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_participants();

ALTER TABLE influencer_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS influencer_scores_read_authn ON influencer_scores;
CREATE POLICY influencer_scores_read_authn ON influencer_scores
  FOR SELECT USING (auth.role() = 'authenticated');
