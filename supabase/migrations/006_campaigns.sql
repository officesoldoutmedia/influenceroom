-- Migration 006: campaigns
-- See PRD §4 (schema), §5 (RLS).

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES campaign_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  brief text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','in_review','completed','cancelled')),
  start_date date,
  end_date date,
  total_budget numeric,
  deliverables_count int,
  internal_notes text,
  owner_id uuid REFERENCES team_members(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX campaigns_status_active_idx ON campaigns (status) WHERE status IN ('active','in_review');
CREATE INDEX campaigns_brand_idx ON campaigns (brand_id);
CREATE INDEX campaigns_owner_idx ON campaigns (owner_id);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_authenticated_read
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.touch_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_campaigns_updated_at();
