import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import {
  PARTICIPANT_STATUSES,
  SOCIAL_PLATFORMS,
  type ParticipantStatus,
  type SocialPlatform,
} from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const PARTICIPANT_SELECT = `
  *,
  influencer:influencers(id, name, tier, social_handles)
`

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { data, error } = await admin()
    .from('campaign_participants')
    .select(PARTICIPANT_SELECT)
    .eq('campaign_id', id)
    .order('added_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, items: data ?? [] })
}

type AddBody = {
  influencer_id?: string | null
  platform?: string
  account_handle?: string
  agreed_fee?: number | null
  status?: string
  notes?: string | null
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

  if (!body.platform || !(SOCIAL_PLATFORMS as readonly string[]).includes(body.platform)) {
    return NextResponse.json({ ok: false, error: 'invalid_platform' }, { status: 422 })
  }
  const platform = body.platform as SocialPlatform

  const handle = body.account_handle?.toString().trim()
  if (!handle) {
    return NextResponse.json({ ok: false, error: 'missing_handle' }, { status: 422 })
  }

  const status = (body.status ?? 'pitched') as ParticipantStatus
  if (!(PARTICIPANT_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 422 })
  }

  const influencerId = body.influencer_id ?? null
  const isAdhoc = influencerId === null

  // If linking to an existing influencer, validate it exists + is active.
  const supabase = admin()
  if (influencerId !== null) {
    const { data: inf } = await supabase
      .from('influencers')
      .select('id, status')
      .eq('id', influencerId)
      .maybeSingle()
    if (!inf) {
      return NextResponse.json({ ok: false, error: 'influencer_not_found' }, { status: 404 })
    }
    if (inf.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'influencer_not_active' }, { status: 422 })
    }
  }

  const h = await headers()
  const addedBy = h.get('x-user-id')

  const { data, error } = await supabase
    .from('campaign_participants')
    .insert({
      campaign_id: id,
      influencer_id: influencerId,
      platform,
      account_handle: handle,
      is_adhoc: isAdhoc,
      agreed_fee: body.agreed_fee ?? null,
      status,
      notes: body.notes?.toString().trim() || null,
      added_by: addedBy,
    })
    .select(PARTICIPANT_SELECT)
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, item: data })
}
