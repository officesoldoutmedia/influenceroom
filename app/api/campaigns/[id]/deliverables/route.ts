import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
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

const SELECT = '*'

/** Filter request to ensure participant belongs to the campaign in the URL. */
async function assertParticipantInCampaign(participantId: string, campaignId: string) {
  const { data } = await admin()
    .from('campaign_participants')
    .select('id')
    .eq('id', participantId)
    .eq('campaign_id', campaignId)
    .maybeSingle()
  return !!data
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const supabase = admin()

  let q = supabase
    .from('campaign_deliverables')
    .select(`${SELECT}, participant:campaign_participants!inner(id, campaign_id)`)
    .eq('participant.campaign_id', id)
    .order('position', { ascending: true })

  const status = sp.get('status')
  if (status) q = q.eq('status', status)
  const participantId = sp.get('participant_id')
  if (participantId) q = q.eq('participant_id', participantId)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, items: data ?? [] })
}

type AddBody = {
  participant_id?: string
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: AddBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  if (!body.participant_id) {
    return NextResponse.json({ ok: false, error: 'missing_participant' }, { status: 400 })
  }
  const ok = await assertParticipantInCampaign(body.participant_id, id)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'participant_not_in_campaign' }, { status: 422 })
  }

  if (!body.type || !(DELIVERABLE_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 422 })
  }
  const type = body.type as DeliverableType
  if (type === 'custom' && !body.custom_type_label?.trim()) {
    return NextResponse.json({ ok: false, error: 'custom_label_required' }, { status: 422 })
  }

  const status = (body.status ?? 'draft') as DeliverableStatus
  if (!(DELIVERABLE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 422 })
  }
  if (status === 'published') {
    if (!body.published_url || !body.post_date) {
      return NextResponse.json({ ok: false, error: 'published_requires_url_and_date' }, { status: 422 })
    }
  }

  const supabase = admin()

  // Default position = MAX(position) + 1 within the same participant.
  const { data: maxRow } = await supabase
    .from('campaign_deliverables')
    .select('position')
    .eq('participant_id', body.participant_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (maxRow?.position ?? -1) + 1

  const h = await headers()
  const createdBy = h.get('x-user-id')

  const quantity = Math.max(1, Math.floor(body.quantity ?? 1))

  const { data, error } = await supabase
    .from('campaign_deliverables')
    .insert({
      participant_id: body.participant_id,
      type,
      custom_type_label: type === 'custom' ? body.custom_type_label?.trim() : null,
      quantity,
      post_date: body.post_date || null,
      collab_handles: Array.isArray(body.collab_handles) ? body.collab_handles : [],
      hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
      brief: body.brief?.trim() || null,
      caption: body.caption?.trim() || null,
      notes: body.notes?.trim() || null,
      status,
      published_url: body.published_url?.trim() || null,
      position: nextPosition,
      created_by: createdBy,
    })
    .select(SELECT)
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, item: data })
}
