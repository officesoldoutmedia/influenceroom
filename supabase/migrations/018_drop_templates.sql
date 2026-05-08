-- Sprint 9 Faza 2A — eliminate the campaign_templates entity entirely.
--
-- Decision: campaigns now start completely empty (no task_groups, no tasks).
-- Each account/owner adds groups + tasks manually after seeing what the
-- specific campaign needs. Starter packs may be revisited after we have
-- pattern data from 10–20 real campaigns.

-- 1. Detach campaigns from templates.
ALTER TABLE campaigns DROP COLUMN IF EXISTS template_id;

-- 2. Drop the table itself (CASCADE clears any remaining FKs / views).
DROP TABLE IF EXISTS campaign_templates CASCADE;

-- 3. Drop the old RPC that materialised tasks from a template.
DROP FUNCTION IF EXISTS create_campaign_from_template CASCADE;

-- 4. Replace with a thin RPC that just inserts a campaign row.
--    Returns the new id so the API route can redirect to /campaigns/[id]
--    where the (empty) task board renders an "add first group" CTA.
CREATE OR REPLACE FUNCTION public.create_campaign(
  p_brand_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_total_budget numeric,
  p_deliverables_count integer,
  p_brief text,
  p_owner_id uuid,
  p_internal_notes text,
  p_created_by uuid
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
    deliverables_count, brief, owner_id, internal_notes,
    created_by, status
  ) VALUES (
    p_brand_id, p_name, p_start_date, p_end_date, p_total_budget,
    p_deliverables_count, p_brief, p_owner_id, p_internal_notes,
    p_created_by, 'draft'
  )
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_campaign(
  uuid, text, date, date, numeric, integer, text, uuid, text, uuid
) TO service_role;
