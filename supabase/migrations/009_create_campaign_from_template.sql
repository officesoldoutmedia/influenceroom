-- Migration 009: create_campaign_from_template RPC.
-- Inserts a campaigns row, then if a template is chosen, expands its
-- default_task_groups into task_groups + tasks with due_date computed
-- as start_date + due_offset_days.

CREATE OR REPLACE FUNCTION public.create_campaign_from_template(
  p_brand_id uuid,
  p_template_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_total_budget numeric,
  p_deliverables_count int,
  p_brief text,
  p_owner_id uuid,
  p_internal_notes text,
  p_created_by uuid
) RETURNS campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign campaigns;
  v_template campaign_templates;
  v_group jsonb;
  v_task jsonb;
  v_group_id uuid;
  v_group_due date;
BEGIN
  INSERT INTO campaigns (
    brand_id, template_id, name, brief, status,
    start_date, end_date, total_budget, deliverables_count,
    internal_notes, owner_id
  ) VALUES (
    p_brand_id, p_template_id, p_name, p_brief, 'draft',
    p_start_date, p_end_date, p_total_budget, p_deliverables_count,
    p_internal_notes, p_owner_id
  ) RETURNING * INTO v_campaign;

  IF p_template_id IS NOT NULL AND p_start_date IS NOT NULL THEN
    SELECT * INTO v_template FROM campaign_templates WHERE id = p_template_id;
    IF v_template.id IS NOT NULL THEN
      FOR v_group IN SELECT * FROM jsonb_array_elements(v_template.default_task_groups) LOOP
        v_group_due := p_start_date + COALESCE((v_group->>'due_offset_days')::int, 0);
        INSERT INTO task_groups (campaign_id, name, position, due_date)
        VALUES (
          v_campaign.id,
          v_group->>'name',
          (v_group->>'position')::int,
          v_group_due
        ) RETURNING id INTO v_group_id;
        FOR v_task IN SELECT * FROM jsonb_array_elements(v_group->'tasks') LOOP
          INSERT INTO tasks (
            campaign_id, group_id, title, description,
            priority, status, due_date, created_by
          ) VALUES (
            v_campaign.id,
            v_group_id,
            v_task->>'title',
            v_task->>'description',
            COALESCE(v_task->>'priority', 'normal'),
            'todo',
            v_group_due,
            p_created_by
          );
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  RETURN v_campaign;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_campaign_from_template(uuid, uuid, text, date, date, numeric, int, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_campaign_from_template(uuid, uuid, text, date, date, numeric, int, text, uuid, text, uuid) TO service_role;
