-- Sprint 9 Faza 6 — deadline reminder bookkeeping.
--
-- Polymorphic log of every reminder we've sent for a deliverable or
-- milestone deadline. The UNIQUE index across (resource_type, resource_id,
-- reminder_kind, recipient_type, recipient_email) is the idempotency
-- guarantee: re-running the daily scheduler is safe — duplicate inserts
-- fail silently and we skip enqueueing the email.

CREATE TABLE IF NOT EXISTS deadline_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('deliverable', 'milestone')),
  resource_id uuid NOT NULL,
  reminder_kind text NOT NULL CHECK (reminder_kind IN ('7d', '3d', '1d', 'overdue')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('account_manager', 'influencer')),
  recipient_email text NOT NULL,
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deadline_log_unique
  ON deadline_reminder_log(resource_type, resource_id, reminder_kind, recipient_type, recipient_email);

CREATE INDEX IF NOT EXISTS idx_deadline_log_resource
  ON deadline_reminder_log(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_deadline_log_sent
  ON deadline_reminder_log(sent_at DESC);

ALTER TABLE deadline_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY deadline_log_authenticated_read
  ON deadline_reminder_log FOR SELECT
  USING (true);
