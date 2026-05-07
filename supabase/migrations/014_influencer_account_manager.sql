-- Migration 014: account_manager_id on influencers (FK to team_members).
-- All existing influencers default to NULL (Unassigned). When a team_member is
-- deleted, the FK cascades to NULL — influencer stays in roster, just unassigned.

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS account_manager_id uuid
  REFERENCES team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_influencers_account_manager
  ON influencers(account_manager_id)
  WHERE account_manager_id IS NOT NULL;
