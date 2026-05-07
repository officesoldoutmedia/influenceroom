-- Migration 004: influencers
-- See PRD §4 (schema) and §5 (RLS).

CREATE TABLE influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  primary_handle text,
  platforms jsonb DEFAULT '{}'::jsonb,
  niche_tags text[] DEFAULT '{}',
  tier text CHECK (tier IN ('nano','micro','mid','macro','mega')),
  language text DEFAULT 'ro',
  location_city text,
  location_country text DEFAULT 'Romania',
  rate_post numeric,
  rate_story numeric,
  rate_reel numeric,
  rate_video numeric,
  contact_email text,
  contact_phone text,
  agent_name text,
  agent_email text,
  fiscal_data jsonb,
  exclusive boolean DEFAULT false,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','blacklist')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX influencers_niche_tags_idx ON influencers USING gin (niche_tags);
CREATE INDEX influencers_platforms_idx ON influencers USING gin (platforms);
CREATE INDEX influencers_tier_idx ON influencers (tier);
CREATE INDEX influencers_active_idx ON influencers (status) WHERE status = 'active';

ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY influencers_authenticated_read
  ON influencers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.touch_influencers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_influencers_updated_at();
