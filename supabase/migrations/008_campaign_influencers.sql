-- Migration 008: campaign_influencers junction
-- See PRD §4 (schema), §5 (RLS).

CREATE TABLE campaign_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES influencers(id) ON DELETE RESTRICT,
  agreed_fee numeric,
  deliverables text,
  status text DEFAULT 'pitched' CHECK (status IN (
    'pitched','negotiating','confirmed','content_in_review','published','paid','cancelled'
  )),
  publish_date date,
  post_url text,
  performance jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, influencer_id)
);

CREATE INDEX campaign_influencers_campaign_idx ON campaign_influencers (campaign_id);
CREATE INDEX campaign_influencers_influencer_idx ON campaign_influencers (influencer_id);
CREATE INDEX campaign_influencers_status_idx ON campaign_influencers (status);

ALTER TABLE campaign_influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_influencers_authenticated_read
  ON campaign_influencers
  FOR SELECT
  TO authenticated
  USING (true);
