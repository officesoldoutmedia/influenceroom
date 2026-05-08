import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type Body = {
  participant_id?: string
  ordered_ids?: string[]
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  if (!body.participant_id || !Array.isArray(body.ordered_ids)) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const supabase = admin()

  // Verify participant belongs to this campaign.
  const { data: p } = await supabase
    .from('campaign_participants')
    .select('id')
    .eq('id', body.participant_id)
    .eq('campaign_id', id)
    .maybeSingle()
  if (!p) {
    return NextResponse.json({ ok: false, error: 'participant_not_in_campaign' }, { status: 422 })
  }

  // Verify all ids belong to that participant; fetch the set first.
  const { data: existing } = await supabase
    .from('campaign_deliverables')
    .select('id')
    .eq('participant_id', body.participant_id)
  const allowed = new Set((existing ?? []).map((r) => r.id))
  for (const id of body.ordered_ids) {
    if (!allowed.has(id)) {
      return NextResponse.json({ ok: false, error: 'unknown_deliverable' }, { status: 422 })
    }
  }

  // Apply positions sequentially.
  for (let i = 0; i < body.ordered_ids.length; i++) {
    const { error } = await supabase
      .from('campaign_deliverables')
      .update({ position: i })
      .eq('id', body.ordered_ids[i])
    if (error) {
      return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
