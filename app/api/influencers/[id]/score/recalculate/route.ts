// POST /api/influencers/[id]/score/recalculate
//   Force a fresh recompute. Useful after deliverables get published or
//   campaigns transition to 'completed' — both feed the auto criteria. Any
//   write-eligible user can trigger it (Path A: owner/manager bypass; account
//   gated to own/unassigned).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, requireInfluencerWriter } from '@/lib/auth/scope'
import type { InfluencerScore } from '@/lib/scoring/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const denied = await requireInfluencerWriter(id)
  if (denied) return denied

  const supabase = admin()
  const { data: recalc, error } = await supabase.rpc('recalc_influencer_score', {
    p_influencer_id: id,
    p_changed_by: user.id,
    p_reason: 'auto_recalc',
  })
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }

  const { data: score } = await supabase
    .from('influencer_scores')
    .select('*')
    .eq('influencer_id', id)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    score: (score ?? null) as InfluencerScore | null,
    recalc,
  })
}
