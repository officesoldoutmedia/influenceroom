-- Sprint 11 feedback Oana: camp text liber pentru numele agentiei
-- (uneori clientii vin prin alta agentie intermediara, nu mereu Influence Room).

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS agency_name text;

COMMENT ON COLUMN campaigns.agency_name IS
  'Numele agentiei intermediare (text liber). Default Influence Room dar variabil.';
