-- Sprint 9 Faza 2 — fix-up. Migration 018 introduced create_campaign that
-- inserts a `created_by` column, but the actual `campaigns` table never had
-- that column (only `owner_id`). Drop the old RPC signature, recreate without
-- the extraneous parameter.

DROP FUNCTION IF EXISTS public.create_campaign(
  uuid, text, date, date, numeric, integer, text, uuid, text, uuid
);

CREATE OR REPLACE FUNCTION public.create_campaign(
  p_brand_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_total_budget numeric,
  p_deliverables_count integer,
  p_brief text,
  p_owner_id uuid,
  p_internal_notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  INSERT INTO campaigns (
    brand_id, name, start_date, end_date, total_budget,
    deliverables_count, brief, owner_id, internal_notes, status
  ) VALUES (
    p_brand_id, p_name, p_start_date, p_end_date, p_total_budget,
    p_deliverables_count, p_brief, p_owner_id, p_internal_notes,
    'draft'
  )
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_campaign(
  uuid, text, date, date, numeric, integer, text, uuid, text
) TO service_role;
