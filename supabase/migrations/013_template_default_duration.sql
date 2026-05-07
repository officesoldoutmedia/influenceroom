-- Migration 013: add default_duration_days to campaign_templates.
-- Backfill = MAX(due_offset_days) - MIN(due_offset_days) across all groups
-- in the template's default_task_groups JSONB. Fallback 30 if spread is 0.

ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS default_duration_days int;

WITH spans AS (
  SELECT t.id,
         GREATEST(
           COALESCE(
             (SELECT MAX((g->>'due_offset_days')::int) - MIN((g->>'due_offset_days')::int)
              FROM jsonb_array_elements(t.default_task_groups) g),
             30
           ),
           1
         ) AS dur
  FROM campaign_templates t
)
UPDATE campaign_templates t
SET default_duration_days = COALESCE(t.default_duration_days, s.dur)
FROM spans s
WHERE t.id = s.id;

ALTER TABLE campaign_templates ALTER COLUMN default_duration_days SET DEFAULT 30;
ALTER TABLE campaign_templates ALTER COLUMN default_duration_days SET NOT NULL;
