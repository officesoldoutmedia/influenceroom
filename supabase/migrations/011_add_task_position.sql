-- Migration 011: add position column to tasks (task_groups already has one).
-- Backfill via ROW_NUMBER per group ordered by created_at, then enforce default.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position int;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at) - 1 AS pos
  FROM tasks
)
UPDATE tasks t
SET position = o.pos
FROM ordered o
WHERE t.id = o.id AND t.position IS NULL;

ALTER TABLE tasks ALTER COLUMN position SET DEFAULT 0;
ALTER TABLE tasks ALTER COLUMN position SET NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_group_position_idx ON tasks (group_id, position);
