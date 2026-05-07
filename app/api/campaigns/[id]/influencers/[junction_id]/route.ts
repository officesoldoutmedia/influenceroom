import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import { JUNCTION_STATUSES, type JunctionStatus, type Performance } from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const REQUIRES_PUBLISH = new Set<JunctionStatus>(['published', 'paid'])

type PatchBody = {
  agreed_fee?: number | null
  deliverables?: string | null
  status?: string
  notes?: string | null
  publish_date?: string | null
  post_url?: string | null
  performance?: Partial<Performance>
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; junction_id: string }> },
) {
  const { id, junction_id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const supabase = admin()

  // Fetch current state for status-transition validation (publish_date/post_url required for published+)
  const { data: current } = await supabase
    .from('campaign_influencers')
    .select('campaign_id, publish_date, post_url')
    .eq('id', junction_id)
    .maybeSingle()
  if (!current || current.campaign_id !== id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (body.agreed_fee !== undefined) update.agreed_fee = body.agreed_fee
  if (body.deliverables !== undefined) update.deliverables = body.deliverables?.toString().trim() || null
  if (body.notes !== undefined) update.notes = body.notes?.toString().trim() || null
  if (body.publish_date !== undefined) update.publish_date = body.publish_date || null
  if (body.post_url !== undefined) update.post_url = body.post_url?.toString().trim() || null
  if (body.status !== undefined) {
    if (!(JUNCTION_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
    }
    update.status = body.status
  }
  if (body.performance !== undefined) {
    const cleaned: Performance = {}
    for (const k of ['views', 'likes', 'saves', 'reach', 'comments', 'shares'] as const) {
      const v = body.performance[k]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) cleaned[k] = v
    }
    update.performance = cleaned
  }

  // Required fields when transitioning to published / paid
  const nextStatus = (update.status ?? null) as JunctionStatus | null
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
    .from('campaign_influencers')
    .update(update)
    .eq('id', junction_id)
    .select(
      `
        *,
        influencer:influencers(id, name, primary_handle, tier, platforms)
      `,
    )
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
  { params }: { params: Promise<{ id: string; junction_id: string }> },
) {
  const { id, junction_id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const supabase = admin()
  const { data, error } = await supabase
    .from('campaign_influencers')
    .delete()
    .eq('id', junction_id)
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
