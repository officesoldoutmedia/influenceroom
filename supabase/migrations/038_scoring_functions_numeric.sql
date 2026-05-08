-- Migration 038: re-type scoring functions for numeric per-criterion scores.
--
-- After migration 037 the influencer_scores.score_* columns became
-- numeric(5,2). The three functions that produce or consume those values
-- are re-declared accordingly:
--
--   calc_punctuality_score → returns numeric (2 decimals via ROUND).
--   calc_collaboration_history_score → returns numeric (still 0/20/40/.../100,
--     but typed numeric for assignment-compatibility with the new columns).
--   recalc_influencer_score → assigns the numeric outputs into score_punctuality
--     and score_collaboration_history; total_score stays integer because
--     category banding only cares about whole numbers and badges look
--     cleaner without trailing decimals.

-- Drop-and-recreate is required because Postgres won't let us change a
-- function's return type via REPLACE.
DROP FUNCTION IF EXISTS calc_punctuality_score(uuid);
DROP FUNCTION IF EXISTS calc_collaboration_history_score(uuid);

CREATE FUNCTION calc_punctuality_score(p_influencer_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
  total_published integer;
  on_time integer;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE d.published_at IS NOT NULL
        AND d.post_date IS NOT NULL
        AND d.published_at::date <= d.post_date
    )
  INTO total_published, on_time
  FROM campaign_deliverables d
  JOIN campaign_participants p ON d.participant_id = p.id
  WHERE p.influencer_id = p_influencer_id
    AND d.status = 'published'
    AND d.post_date IS NOT NULL;

  IF total_published = 0 THEN RETURN NULL; END IF;
  RETURN ROUND((on_time::numeric / total_published * 100), 2);
END;
$$;

CREATE FUNCTION calc_collaboration_history_score(p_influencer_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
  campaign_count integer;
BEGIN
  SELECT COUNT(DISTINCT p.campaign_id)
  INTO campaign_count
  FROM campaign_participants p
  JOIN campaigns c ON p.campaign_id = c.id
  WHERE p.influencer_id = p_influencer_id
    AND c.status = 'completed';

  IF campaign_count = 0 THEN RETURN 0; END IF;
  IF campaign_count >= 5 THEN RETURN 100; END IF;
  RETURN (campaign_count * 20)::numeric;
END;
$$;

-- recalc keeps the same signature; only its internal locals change type so
-- the IF-blocks accept numeric inputs from the new columns and from the
-- updated calc_* functions. total_score is still rounded to integer.
CREATE OR REPLACE FUNCTION recalc_influencer_score(
  p_influencer_id uuid,
  p_changed_by uuid DEFAULT NULL,
  p_reason text DEFAULT 'auto_recalc'
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  s influencer_scores;
  w scoring_settings;
  weighted_sum numeric := 0;
  sum_weight numeric := 0;
  total integer;
  cat text;
  expl text;
  old_total integer;
  punct numeric;
  collab numeric;
BEGIN
  SELECT * INTO w FROM scoring_settings WHERE id = 1;
  SELECT * INTO s FROM influencer_scores WHERE influencer_id = p_influencer_id;
  old_total := COALESCE(s.total_score, 0);

  punct := calc_punctuality_score(p_influencer_id);
  collab := calc_collaboration_history_score(p_influencer_id);

  IF s.score_engagement_rate IS NOT NULL THEN
    weighted_sum := weighted_sum + s.score_engagement_rate * w.weight_engagement_rate;
    sum_weight := sum_weight + w.weight_engagement_rate;
  END IF;
  IF s.score_cpv IS NOT NULL THEN
    weighted_sum := weighted_sum + s.score_cpv * w.weight_cpv;
    sum_weight := sum_weight + w.weight_cpv;
  END IF;
  IF s.score_audience_ro IS NOT NULL THEN
    weighted_sum := weighted_sum + s.score_audience_ro * w.weight_audience_ro;
    sum_weight := sum_weight + w.weight_audience_ro;
  END IF;
  IF s.score_deliverable_quality IS NOT NULL THEN
    weighted_sum := weighted_sum + s.score_deliverable_quality * w.weight_deliverable_quality;
    sum_weight := sum_weight + w.weight_deliverable_quality;
  END IF;
  IF punct IS NOT NULL THEN
    weighted_sum := weighted_sum + punct * w.weight_punctuality;
    sum_weight := sum_weight + w.weight_punctuality;
  END IF;
  -- collab is always non-NULL (0 floor), include unconditionally.
  weighted_sum := weighted_sum + collab * w.weight_collaboration_history;
  sum_weight := sum_weight + w.weight_collaboration_history;

  IF sum_weight = 0 THEN
    total := 0;
  ELSE
    -- ROUND first to nearest integer, then clamp to the 0..100 band.
    total := LEAST(100, GREATEST(0, ROUND(weighted_sum / sum_weight)::integer));
  END IF;

  IF total <= 40 THEN cat := 'low';
  ELSIF total <= 65 THEN cat := 'medium';
  ELSIF total <= 85 THEN cat := 'high';
  ELSE cat := 'top_performer';
  END IF;

  expl := 'Scor ' || total || '/100. ';
  IF s.score_engagement_rate IS NOT NULL THEN
    expl := expl || 'Engagement: ' || s.score_engagement_rate || '. ';
  END IF;
  IF s.score_cpv IS NOT NULL THEN
    expl := expl || 'CPV: ' || s.score_cpv || '. ';
  END IF;
  IF s.score_audience_ro IS NOT NULL THEN
    expl := expl || 'Audiență RO: ' || s.score_audience_ro || '. ';
  END IF;
  IF s.score_deliverable_quality IS NOT NULL THEN
    expl := expl || 'Calitate livrabile: ' || s.score_deliverable_quality || '. ';
  END IF;
  IF punct IS NOT NULL THEN
    expl := expl || 'Punctualitate auto: ' || punct || '%. ';
  END IF;
  expl := expl || 'Istoric colaborări auto: ' || collab || ' (din ' || (collab/20)::int || ' campanii completate).';

  INSERT INTO influencer_scores (
    influencer_id, score_punctuality, score_collaboration_history,
    total_score, category, explanation, last_calculated_at, updated_by
  ) VALUES (
    p_influencer_id, punct, collab, total, cat, expl, now(), p_changed_by
  )
  ON CONFLICT (influencer_id) DO UPDATE SET
    score_punctuality = EXCLUDED.score_punctuality,
    score_collaboration_history = EXCLUDED.score_collaboration_history,
    total_score = EXCLUDED.total_score,
    category = EXCLUDED.category,
    explanation = EXCLUDED.explanation,
    last_calculated_at = now(),
    updated_by = COALESCE(p_changed_by, influencer_scores.updated_by);

  IF old_total IS DISTINCT FROM total THEN
    INSERT INTO influencer_score_history (
      influencer_id, total_score, category,
      changes, change_reason, changed_by
    ) VALUES (
      p_influencer_id, total, cat,
      jsonb_build_object('old_total', old_total, 'new_total', total),
      p_reason, p_changed_by
    );
  END IF;

  RETURN jsonb_build_object(
    'total_score', total, 'category', cat, 'explanation', expl,
    'punctuality', punct, 'collaboration', collab, 'sum_weight', sum_weight
  );
END;
$$;
