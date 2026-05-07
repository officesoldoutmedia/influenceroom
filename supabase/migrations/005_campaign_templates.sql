-- Migration 005: campaign_templates
-- See PRD §4 (schema), §5 (RLS), §9 (3 starter templates seeded separately).

CREATE TABLE campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_task_groups jsonb NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX campaign_templates_active_idx ON campaign_templates (active) WHERE active = true;

ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_templates_authenticated_read
  ON campaign_templates
  FOR SELECT
  TO authenticated
  USING (true);
