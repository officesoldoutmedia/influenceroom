-- Migration 010: notifications + notification_rules
-- See PRD §4 (schema), §5 (RLS), §7 (templates).

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN (
    'task_assigned','task_status_changed','deadline_reminder','daily_digest','campaign_started'
  )),
  recipient_id uuid REFERENCES team_members(id),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  related_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  related_campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  status text DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  resend_message_id text,
  sent_at timestamptz,
  error text,
  retry_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX notifications_queue_idx ON notifications (status, created_at) WHERE status = 'queued';
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_authenticated_read
  ON notifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL UNIQUE,
  enabled boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_rules_authenticated_read
  ON notification_rules
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO notification_rules (event, enabled, config) VALUES
  ('task_assigned', true, '{}'::jsonb),
  ('task_status_changed', true, '{"only_for_roles":["owner","manager"]}'::jsonb),
  ('deadline_reminder', true, '{"days_before":[3,1]}'::jsonb),
  ('daily_digest', true, '{"send_at_hour_local":9,"tz":"Europe/Bucharest"}'::jsonb),
  ('campaign_started', true, '{}'::jsonb)
ON CONFLICT (event) DO NOTHING;
