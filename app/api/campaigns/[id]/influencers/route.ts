import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import { JUNCTION_STATUSES, type JunctionStatus } from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = admin()
  const { data, error } = await supabase
    .from('campaign_influencers')
    .select(
      `
        *,
        influencer:influencers(id, name, primary_handle, tier, platforms)
      `,
    )
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, items: data ?? [] })
}

type AddBody = {
  influencer_id?: string
  agreed_fee?: number | null
  deliverables?: string | null
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

  if (!body.influencer_id) {
    return NextResponse.json({ ok: false, error: 'missing_influencer' }, { status: 400 })
  }

  const status = (body.status ?? 'pitched') as JunctionStatus
  if (!(JUNCTION_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('campaign_influencers')
    .insert({
      campaign_id: id,
      influencer_id: body.influencer_id,
      agreed_fee: body.agreed_fee ?? null,
      deliverables: body.deliverables?.toString().trim() || null,
      status,
      notes: body.notes?.toString().trim() || null,
    })
    .select(
      `
        *,
        influencer:influencers(id, name, primary_handle, tier, platforms)
      `,
    )
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'already_in_campaign' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, item: data })
}
