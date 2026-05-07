-- Sprint 8 Phase 4: per-user notification prefs + self-service PIN change.
--
-- avatar_url already exists on team_members (added in 001_team_members.sql).
-- This migration adds a JSONB notification_prefs column with all 5 events
-- enabled by default, and a change_pin RPC that lets logged-in users rotate
-- their own PIN after verifying the current one.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
    '{"task_assigned":true,"task_status_changed":true,"deadline_reminder":true,"daily_digest":true,"campaign_started":true}'::jsonb;

-- change_pin: verify current PIN, then update hash and clear lockout state.
-- Returns jsonb {ok: true} on success, {ok: false, error: '...'} on failure.
-- Lockout/attempt counters are managed by verify_pin so failed change attempts
-- count toward the same 5-attempt lockout as login.
CREATE OR REPLACE FUNCTION public.change_pin(
  p_user_id uuid,
  p_current_pin text,
  p_new_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_verified team_members;
BEGIN
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_format');
  END IF;

  v_verified := verify_pin(p_user_id, p_current_pin);

  IF v_verified.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_current_pin');
  END IF;

  UPDATE team_members
     SET pin_hash = hash_pin(p_new_pin),
         failed_pin_attempts = 0,
         locked_until = NULL
   WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_pin(uuid, text, text) TO service_role;
