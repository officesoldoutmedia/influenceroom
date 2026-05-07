-- Sprint 8 Phase 6 — manual broadcast (email + web push).
-- push_subscriptions: per-device push registrations keyed by endpoint URL.
-- broadcasts: history of every owner-sent broadcast (resolved recipient set + per-method counts).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_filter jsonb NOT NULL,
  resolved_recipient_ids uuid[] NOT NULL,
  methods text[] NOT NULL,
  email_success_count int NOT NULL DEFAULT 0,
  email_fail_count int NOT NULL DEFAULT 0,
  push_success_count int NOT NULL DEFAULT 0,
  push_fail_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_sender ON broadcasts(sender_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);

-- Extend notifications.type to allow 'broadcast' rows enqueued by the manual
-- broadcast pipeline.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'task_assigned'::text,
    'task_status_changed'::text,
    'deadline_reminder'::text,
    'daily_digest'::text,
    'campaign_started'::text,
    'broadcast'::text
  ]));
