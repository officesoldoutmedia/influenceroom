import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import {
  MILESTONE_TYPES,
  MILESTONE_RESPONSIBLES,
  type MilestoneType,
  type MilestoneResponsible,
} from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type PatchBody = {
  type?: string
  name?: string | null
  due_date?: string
  responsible?: string
  responsible_name?: string | null
  notes?: string | null
  /** ISO timestamp to mark complete; null clears completion. */
  completed_at?: string | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  const { id, mid } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const supabase = admin()
  const { data: current } = await supabase
    .from('campaign_milestones')
    .select('id, campaign_id, type, name, responsible, responsible_name')
    .eq('id', mid)
    .maybeSingle<{
      id: string
      campaign_id: string
      type: MilestoneType
      name: string | null
      responsible: MilestoneResponsible
      responsible_name: string | null
    }>()
  if (!current || current.campaign_id !== id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}

  if (body.type !== undefined) {
    if (!(MILESTONE_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 422 })
    }
    update.type = body.type
  }
  if (body.name !== undefined) update.name = body.name?.trim() || null
  if (body.due_date !== undefined) {
    if (!body.due_date) {
      return NextResponse.json({ ok: false, error: 'missing_due_date' }, { status: 422 })
    }
    update.due_date = body.due_date
  }
  if (body.responsible !== undefined) {
    if (!(MILESTONE_RESPONSIBLES as readonly string[]).includes(body.responsible)) {
      return NextResponse.json({ ok: false, error: 'invalid_responsible' }, { status: 422 })
    }
    update.responsible = body.responsible
  }
  if (body.responsible_name !== undefined) {
    update.responsible_name = body.responsible_name?.trim() || null
  }
  if (body.notes !== undefined) update.notes = body.notes?.trim() || null

  // Completion toggle: when setting completed_at to a value, also stamp
  // completed_by from the JWT. When clearing, drop completed_by too.
  if (body.completed_at !== undefined) {
    if (body.completed_at === null) {
      update.completed_at = null
      update.completed_by = null
    } else {
      const date = new Date(body.completed_at)
      if (Number.isNaN(date.valueOf())) {
        return NextResponse.json({ ok: false, error: 'invalid_completed_at' }, { status: 422 })
      }
      update.completed_at = date.toISOString()
      const h = await headers()
      update.completed_by = h.get('x-user-id') ?? null
    }
  }

  // Cross-field validation
  const finalType = (update.type ?? current.type) as MilestoneType
  const finalName = update.name === undefined ? current.name : (update.name as string | null)
  if (finalType === 'other' && !finalName) {
    return NextResponse.json({ ok: false, error: 'name_required_for_other_type' }, { status: 422 })
  }
  const finalResponsible = (update.responsible ?? current.responsible) as MilestoneResponsible
  const finalRespName =
    update.responsible_name === undefined ? current.responsible_name : (update.responsible_name as string | null)
  if (finalResponsible === 'other' && !finalRespName) {
    return NextResponse.json({ ok: false, error: 'responsible_name_required' }, { status: 422 })
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaign_milestones')
    .update(update)
    .eq('id', mid)
    .select('*')
    .maybeSingle()
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  const { id, mid } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const { data, error } = await admin()
    .from('campaign_milestones')
    .delete()
    .eq('id', mid)
    .eq('campaign_id', id)
    .select('id')
    .maybeSingle()
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
