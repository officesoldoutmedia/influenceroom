// /api/influencers/[id]/score
//   GET  → current score row + last 10 history entries
//   PATCH → upsert manual criteria (4 fields), then call recalc to update
//           total + audit history

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadInfluencer, requireInfluencerWriter } from '@/lib/auth/scope'
import type { InfluencerScore, ScoreHistoryEntry } from '@/lib/scoring/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const MANUAL_FIELDS = [
  'score_engagement_rate',
  'score_cpv',
  'score_audience_ro',
  'score_deliverable_quality',
] as const

type ManualField = (typeof MANUAL_FIELDS)[number]
type PatchBody = Partial<Record<ManualField, number | null>>

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = admin()

  // Confirm read access via Path A (404 on miss instead of 403).
  const { data: inf } = await supabase
    .from('influencers')
    .select('account_manager_id')
    .eq('id', id)
    .maybeSingle()
  if (!inf || !canReadInfluencer(user, inf)) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const [{ data: score }, { data: history }] = await Promise.all([
    supabase.from('influencer_scores').select('*').eq('influencer_id', id).maybeSingle(),
    supabase
      .from('influencer_score_history')
      .select('*')
      .eq('influencer_id', id)
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    ok: true,
    score: (score ?? null) as InfluencerScore | null,
    history: (history ?? []) as ScoreHistoryEntry[],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  // Same write rules as influencer rows: owner/manager bypass, account
  // gated to assigned/unassigned. requireInfluencerWriter handles 401/403.
  const denied = await requireInfluencerWriter(id)
  if (denied) return denied

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Validate each provided manual field is null or 0..100.
  const update: Record<string, number | null> = {}
  for (const f of MANUAL_FIELDS) {
    if (!(f in body)) continue
    const v = body[f]
    if (v === null) {
      update[f] = null
      continue
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100 || !Number.isInteger(v)) {
      return NextResponse.json({ ok: false, error: 'invalid_value', field: f }, { status: 422 })
    }
    update[f] = v
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()

  // UPSERT the manual fields. If the row doesn't exist yet, recalc would
  // create it — but we need our manual values to land first or recalc would
  // see them as NULL and skip them in the weighted sum.
  const { error: upsertErr } = await supabase
    .from('influencer_scores')
    .upsert({ influencer_id: id, ...update }, { onConflict: 'influencer_id' })

  if (upsertErr) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: upsertErr.message },
      { status: 500 },
    )
  }

  // Now recompute total + auto criteria + history entry.
  const { data: recalc, error: recalcErr } = await supabase.rpc('recalc_influencer_score', {
    p_influencer_id: id,
    p_changed_by: user.id,
    p_reason: 'manual_update',
  })
  if (recalcErr) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: recalcErr.message },
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
