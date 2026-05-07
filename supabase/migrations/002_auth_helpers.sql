-- Migration 002: PIN auth helpers
-- See PRD §3 (auth flow). pgcrypto produces bcrypt hashes interoperable with bcryptjs.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.hash_pin(p_pin text)
RETURNS text
LANGUAGE sql
SET search_path = public, extensions, pg_temp
AS $$
  SELECT crypt(p_pin, gen_salt('bf', 10));
$$;

REVOKE EXECUTE ON FUNCTION public.hash_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_pin(text) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_pin(p_user_id uuid, p_pin text)
RETURNS team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_row team_members;
BEGIN
  SELECT *
    INTO v_row
    FROM team_members
   WHERE id = p_user_id
     AND active = true
     AND (locked_until IS NULL OR locked_until <= now());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF crypt(p_pin, v_row.pin_hash) = v_row.pin_hash THEN
    UPDATE team_members
       SET failed_pin_attempts = 0,
           locked_until = NULL
     WHERE id = p_user_id
    RETURNING * INTO v_row;
    RETURN v_row;
  ELSE
    UPDATE team_members
       SET failed_pin_attempts = failed_pin_attempts + 1,
           locked_until = CASE
             WHEN failed_pin_attempts + 1 >= 5
               THEN now() + interval '5 minutes'
             ELSE locked_until
           END
     WHERE id = p_user_id;
    RETURN NULL;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_pin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(uuid, text) TO service_role;
