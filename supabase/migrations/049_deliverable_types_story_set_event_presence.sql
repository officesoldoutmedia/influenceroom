-- Sprint 15 — two new deliverable types requested by the team (2026-06-17):
--   story_set       — "Story set": a set/sequence of stories billed as one
--                     deliverable (distinct from a single 'story').
--   event_presence  — "Prezență eveniment": the influencer only attends an
--                     event, with no classic post/story/reel deliverable.
--
-- Postgres enums are append-only (there is no DROP VALUE), so this migration
-- is IRREVERSIBLE. `ADD VALUE IF NOT EXISTS` keeps it idempotent / safe to
-- re-run. The dropdown + display ORDER is controlled by DELIVERABLE_TYPES in
-- lib/campaigns/types.ts (the TS array), not by the physical enum order here,
-- so simply appending the new values is fine.
--
-- DEPLOY ORDER: apply this migration to Supabase BEFORE deploying the code
-- that references the new values — otherwise an INSERT of 'story_set' /
-- 'event_presence' is rejected by the DB enum.
--
-- No GRANT needed: this alters an existing type, it does not create a new
-- public table (see CLAUDE.md "New public tables must GRANT to service_role").

ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'story_set';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'event_presence';
