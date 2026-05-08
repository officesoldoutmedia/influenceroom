import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_STATUSES,
  type DeliverableType,
  type DeliverableStatus,
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
  custom_type_label?: string | null
  quantity?: number
  post_date?: string | null
  collab_handles?: string[]
  hashtags?: string[]
  brief?: string | null
  caption?: string | null
  notes?: string | null
  status?: string
  published_url?: string | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; did: string }> },
) {
  const { id, did } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const supabase = admin()

  // Verify the deliverable belongs to a participant in this campaign.
  const { data: current } = await supabase
    .from('campaign_deliverables')
    .select('id, type, custom_type_label, post_date, published_url, status, participant:campaign_participants!inner(campaign_id)')
    .eq('id', did)
    .maybeSingle<{
      id: string
      type: DeliverableType
      custom_type_label: string | null
      post_date: string | null
      published_url: string | null
      status: DeliverableStatus
      participant: { campaign_id: string }
    }>()
  if (!current || current.participant.campaign_id !== id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}

  if (body.type !== undefined) {
    if (!(DELIVERABLE_TYPES as readonly string[]).includes(body.type)) {
      return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 422 })
    }
    update.type = body.type
  }
  if (body.custom_type_label !== undefined) {
    update.custom_type_label = body.custom_type_label?.trim() || null
  }
  if (body.quantity !== undefined) {
    update.quantity = Math.max(1, Math.floor(body.quantity))
  }
  if (body.post_date !== undefined) update.post_date = body.post_date || null
  if (body.collab_handles !== undefined) update.collab_handles = Array.isArray(body.collab_handles) ? body.collab_handles : []
  if (body.hashtags !== undefined) update.hashtags = Array.isArray(body.hashtags) ? body.hashtags : []
  if (body.brief !== undefined) update.brief = body.brief?.trim() || null
  if (body.caption !== undefined) update.caption = body.caption?.trim() || null
  if (body.notes !== undefined) update.notes = body.notes?.trim() || null
  if (body.published_url !== undefined) update.published_url = body.published_url?.trim() || null
  if (body.status !== undefined) {
    if (!(DELIVERABLE_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 422 })
    }
    update.status = body.status
  }

  // Validate cross-field constraints with the post-update view.
  const finalType = (update.type ?? current.type) as DeliverableType
  const finalCustom =
    update.custom_type_label === undefined ? current.custom_type_label : (update.custom_type_label as string | null)
  if (finalType === 'custom' && !finalCustom) {
    return NextResponse.json({ ok: false, error: 'custom_label_required' }, { status: 422 })
  }

  const finalStatus = (update.status ?? current.status) as DeliverableStatus
  const finalPostDate =
    update.post_date === undefined ? current.post_date : (update.post_date as string | null)
  const finalPublishedUrl =
    update.published_url === undefined ? current.published_url : (update.published_url as string | null)
  if (finalStatus === 'published' && (!finalPublishedUrl || !finalPostDate)) {
    return NextResponse.json({ ok: false, error: 'published_requires_url_and_date' }, { status: 422 })
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaign_deliverables')
    .update(update)
    .eq('id', did)
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
  { params }: { params: Promise<{ id: string; did: string }> },
) {
  const { id, did } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const supabase = admin()
  // Ensure cross-tenant safety via the campaign_id join.
  const { data: current } = await supabase
    .from('campaign_deliverables')
    .select('id, participant:campaign_participants!inner(campaign_id)')
    .eq('id', did)
    .maybeSingle<{ id: string; participant: { campaign_id: string } }>()
  if (!current || current.participant.campaign_id !== id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { error } = await supabase.from('campaign_deliverables').delete().eq('id', did)
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
