-- Migration 007: task_groups + tasks
-- See PRD §4 (schema), §5 (RLS).

CREATE TABLE task_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX task_groups_campaign_idx ON task_groups (campaign_id, position);

ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_groups_authenticated_read
  ON task_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  group_id uuid REFERENCES task_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES team_members(id),
  status text DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','review','done')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES team_members(id)
);

CREATE INDEX tasks_assignee_status_idx ON tasks (assignee_id, status);
CREATE INDEX tasks_campaign_group_idx ON tasks (campaign_id, group_id);
CREATE INDEX tasks_due_open_idx ON tasks (due_date) WHERE status NOT IN ('done','blocked');

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_authenticated_read
  ON tasks
  FOR SELECT
  TO authenticated
  USING (true);
