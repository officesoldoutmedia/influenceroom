-- Migration 003: brands
-- See PRD §4 (schema) and §5 (RLS).

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  contact_email text,
  contact_phone text,
  billing_data jsonb,
  logo_url text,
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES team_members(id)
);

CREATE INDEX brands_status_idx ON brands (status) WHERE status = 'active';

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY brands_authenticated_read
  ON brands
  FOR SELECT
  TO authenticated
  USING (true);
