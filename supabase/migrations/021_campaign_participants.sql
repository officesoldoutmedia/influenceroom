-- Sprint 9 Faza 3a — replace simple campaign_influencers junction with a
-- rich campaign_participants table that supports multi-influencer ×
-- multi-platform participation per campaign, plus ad-hoc handles for
-- partners that don't (yet) have an influencer row.
--
-- Pre-flight: campaign_influencers had 0 rows at migration time (verified
-- via MCP), and no other tables FK into it. CASCADE drop is safe.

DROP TABLE IF EXISTS campaign_influencers CASCADE;

-- Status enum — same 7 values that were a CHECK constraint before.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_status') THEN
    CREATE TYPE participant_status AS ENUM (
      'pitched', 'negotiating', 'confirmed', 'content_in_review',
      'published', 'paid', 'cancelled'
    );
  END IF;
END $$;

-- Platform enum — used by campaign_participants.platform. The new value
-- 'facebook' lives here from day one so Faza 3a + 3b never need a re-run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_platform') THEN
    CREATE TYPE social_platform AS ENUM (
      'instagram', 'tiktok', 'youtube', 'facebook'
    );
  END IF;
END $$;

CREATE TABLE campaign_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES influencers(id) ON DELETE SET NULL,
  platform social_platform NOT NULL,
  account_handle text NOT NULL,
  is_adhoc boolean NOT NULL DEFAULT false,
  agreed_fee numeric,
  status participant_status NOT NULL DEFAULT 'pitched',
  publish_date date,
  post_url text,
  notes text,
  added_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_adhoc_consistency CHECK (
    (influencer_id IS NOT NULL AND is_adhoc = false) OR
    (influencer_id IS NULL AND is_adhoc = true)
  )
);

COMMENT ON COLUMN campaign_participants.influencer_id IS
  'NULL when participant is ad-hoc (handle not in influencers table). is_adhoc reflects this.';
COMMENT ON COLUMN campaign_participants.agreed_fee IS
  'EUR — single canonical currency';

CREATE INDEX idx_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX idx_participants_influencer ON campaign_participants(influencer_id) WHERE influencer_id IS NOT NULL;
CREATE INDEX idx_participants_platform ON campaign_participants(platform);

CREATE OR REPLACE FUNCTION trg_set_updated_at_participants()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON campaign_participants
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_participants();

ALTER TABLE campaign_participants ENABLE ROW LEVEL SECURITY;

-- Replicate the read policy from the dropped campaign_influencers (read-all
-- for any authenticated session; writes go through service-role from API).
CREATE POLICY campaign_participants_authenticated_read
  ON campaign_participants FOR SELECT
  USING (true);
