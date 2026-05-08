-- Migration 037: per-criterion score columns INTEGER → numeric(5,2).
--
-- Feedback Oana 2026-05-08 17:57 — sliders that round to integer steps
-- lose meaningful precision (e.g. CPV 0.31 collapsed to 0). Bumping the six
-- per-criterion columns to numeric(5,2) gives the team two decimals of
-- headroom (range 0.00..100.00) while leaving total_score as a rounded
-- integer for clean badges and category banding.
--
-- Existing values are preserved automatically by the type cast (integer →
-- numeric is lossless). The CHECK constraints are dropped and recreated
-- with cleaner `chk_*` names so they read sensibly in psql diff output.

ALTER TABLE influencer_scores
  DROP CONSTRAINT IF EXISTS influencer_scores_score_engagement_rate_check,
  DROP CONSTRAINT IF EXISTS influencer_scores_score_cpv_check,
  DROP CONSTRAINT IF EXISTS influencer_scores_score_audience_ro_check,
  DROP CONSTRAINT IF EXISTS influencer_scores_score_deliverable_quality_check,
  DROP CONSTRAINT IF EXISTS influencer_scores_score_punctuality_check,
  DROP CONSTRAINT IF EXISTS influencer_scores_score_collaboration_history_check;

ALTER TABLE influencer_scores
  ALTER COLUMN score_engagement_rate TYPE numeric(5,2),
  ALTER COLUMN score_cpv TYPE numeric(5,2),
  ALTER COLUMN score_audience_ro TYPE numeric(5,2),
  ALTER COLUMN score_deliverable_quality TYPE numeric(5,2),
  ALTER COLUMN score_punctuality TYPE numeric(5,2),
  ALTER COLUMN score_collaboration_history TYPE numeric(5,2);

ALTER TABLE influencer_scores
  ADD CONSTRAINT chk_score_engagement_rate
    CHECK (score_engagement_rate IS NULL OR (score_engagement_rate >= 0 AND score_engagement_rate <= 100)),
  ADD CONSTRAINT chk_score_cpv
    CHECK (score_cpv IS NULL OR (score_cpv >= 0 AND score_cpv <= 100)),
  ADD CONSTRAINT chk_score_audience_ro
    CHECK (score_audience_ro IS NULL OR (score_audience_ro >= 0 AND score_audience_ro <= 100)),
  ADD CONSTRAINT chk_score_deliverable_quality
    CHECK (score_deliverable_quality IS NULL OR (score_deliverable_quality >= 0 AND score_deliverable_quality <= 100)),
  ADD CONSTRAINT chk_score_punctuality
    CHECK (score_punctuality IS NULL OR (score_punctuality >= 0 AND score_punctuality <= 100)),
  ADD CONSTRAINT chk_score_collaboration_history
    CHECK (score_collaboration_history IS NULL OR (score_collaboration_history >= 0 AND score_collaboration_history <= 100));
