-- Migration 001: team_members
-- See PRD §4 (schema) and §5 (RLS).

CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','account','intern')),
  avatar_url text,
  active boolean DEFAULT true,
  failed_pin_attempts int DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX team_members_active_idx ON team_members (active) WHERE active = true;

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_authenticated_read_active
  ON team_members
  FOR SELECT
  TO authenticated
  USING (active = true);
