import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import {
  PARTICIPANT_STATUSES,
  SOCIAL_PLATFORMS,
  type ParticipantStatus,
} from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const REQUIRES_PUBLISH = new Set<ParticipantStatus>(['published', 'paid'])

const PARTICIPANT_SELECT = `
  *,
  influencer:influencers(id, name, primary_handle, tier, platforms)
`

type PatchBody = {
  platform?: string
  account_handle?: string
  agreed_fee?: number | null
  status?: string
  publish_date?: string | null
  post_url?: string | null
  notes?: string | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participant_id: string }> },
) {
  const { id, participant_id } = await params
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
    .from('campaign_participants')
    .select('campaign_id, publish_date, post_url')
    .eq('id', participant_id)
    .maybeSingle()
  if (!current || current.campaign_id !== id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (body.platform !== undefined) {
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(body.platform)) {
      return NextResponse.json({ ok: false, error: 'invalid_platform' }, { status: 422 })
    }
    update.platform = body.platform
  }
  if (body.account_handle !== undefined) {
    const trimmed = body.account_handle?.toString().trim()
    if (!trimmed) return NextResponse.json({ ok: false, error: 'missing_handle' }, { status: 422 })
    update.account_handle = trimmed
  }
  if (body.agreed_fee !== undefined) update.agreed_fee = body.agreed_fee
  if (body.notes !== undefined) update.notes = body.notes?.toString().trim() || null
  if (body.publish_date !== undefined) update.publish_date = body.publish_date || null
  if (body.post_url !== undefined) update.post_url = body.post_url?.toString().trim() || null
  if (body.status !== undefined) {
    if (!(PARTICIPANT_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 422 })
    }
    update.status = body.status
  }

  const nextStatus = (update.status ?? null) as ParticipantStatus | null
  if (nextStatus && REQUIRES_PUBLISH.has(nextStatus)) {
    const finalPublishDate = update.publish_date ?? current.publish_date
    const finalPostUrl = update.post_url ?? current.post_url
    if (!finalPublishDate) {
      return NextResponse.json({ ok: false, error: 'publish_date_required' }, { status: 400 })
    }
    if (!finalPostUrl) {
      return NextResponse.json({ ok: false, error: 'post_url_required' }, { status: 400 })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaign_participants')
    .update(update)
    .eq('id', participant_id)
    .select(PARTICIPANT_SELECT)
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
  { params }: { params: Promise<{ id: string; participant_id: string }> },
) {
  const { id, participant_id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const { data, error } = await admin()
    .from('campaign_participants')
    .delete()
    .eq('id', participant_id)
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
