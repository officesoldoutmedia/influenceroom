-- Sprint 9 Faza 3b — campaign-level milestone tracking.
--
-- Milestones live at the campaign level (one row per checkpoint), not per
-- participant. Cancelled when the campaign is deleted.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_type') THEN
    CREATE TYPE milestone_type AS ENUM (
      'brief_sent', 'materials_approved', 'content_draft_submitted',
      'final_content_approved', 'links_submitted', 'report_delivered',
      'payment_processed', 'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_responsible') THEN
    CREATE TYPE milestone_responsible AS ENUM (
      'account_manager', 'influencer', 'brand', 'other'
    );
  END IF;
END $$;

CREATE TABLE campaign_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type milestone_type NOT NULL,
  name text,
  due_date date NOT NULL,
  responsible milestone_responsible NOT NULL DEFAULT 'account_manager',
  responsible_name text,
  completed_at timestamptz,
  completed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_other_requires_name CHECK (type <> 'other' OR name IS NOT NULL),
  CONSTRAINT chk_other_responsible_name CHECK (
    responsible <> 'other' OR responsible_name IS NOT NULL
  )
);

CREATE INDEX idx_milestones_campaign ON campaign_milestones(campaign_id);
CREATE INDEX idx_milestones_due_date ON campaign_milestones(due_date);
CREATE INDEX idx_milestones_completed ON campaign_milestones(completed_at)
  WHERE completed_at IS NOT NULL;

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON campaign_milestones
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_participants();

ALTER TABLE campaign_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_milestones_authenticated_read
  ON campaign_milestones FOR SELECT
  USING (true);
