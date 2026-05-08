// /api/admin/scoring-settings
//   GET   → owner only; returns the singleton settings row.
//   PATCH → owner only; validates each weight 0..100, updates settings, then
//           bulk-recalculates every influencer score with reason='weights_changed'.
//
// Sum of weights is NOT enforced to equal 100 — recalc_influencer_score
// re-normalises by the sum of *active* weights, so the relative ratio is what
// matters. UI surfaces the running total as informational only.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'
import { getCurrentUser } from '@/lib/auth/scope'
import type { ScoringSettings } from '@/lib/scoring/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const WEIGHT_FIELDS = [
  'weight_engagement_rate',
  'weight_cpv',
  'weight_audience_ro',
  'weight_punctuality',
  'weight_deliverable_quality',
  'weight_collaboration_history',
] as const

type WeightField = (typeof WEIGHT_FIELDS)[number]
type PatchBody = Partial<Record<WeightField, number>>

export async function GET() {
  const denied = await requireOwner()
  if (denied) return denied

  const { data, error } = await admin()
    .from('scoring_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, settings: (data ?? null) as ScoringSettings | null })
}

export async function PATCH(req: NextRequest) {
  const denied = await requireOwner()
  if (denied) return denied

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, number | string> = {}
  for (const f of WEIGHT_FIELDS) {
    if (!(f in body)) continue
    const v = body[f]
    if (
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      !Number.isInteger(v) ||
      v < 0 ||
      v > 100
    ) {
      return NextResponse.json({ ok: false, error: 'invalid_value', field: f }, { status: 422 })
    }
    update[f] = v
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }
  update.updated_by = user.id

  const supabase = admin()
  const { data: settings, error } = await supabase
    .from('scoring_settings')
    .update(update)
    .eq('id', 1)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }

  // Bulk recalc — fan out across every influencer so category bands stay
  // accurate. The team is small (<200 influencers in beta) so doing this
  // synchronously keeps the UX honest ("Settings saved + 187 scores
  // recomputed") instead of hiding it behind a deferred job.
  const { data: ids } = await supabase.from('influencers').select('id')
  let recalculated = 0
  for (const row of (ids ?? []) as Array<{ id: string }>) {
    const { error: rErr } = await supabase.rpc('recalc_influencer_score', {
      p_influencer_id: row.id,
      p_changed_by: user.id,
      p_reason: 'weights_changed',
    })
    if (!rErr) recalculated++
  }

  return NextResponse.json({
    ok: true,
    settings: (settings ?? null) as ScoringSettings | null,
    recalculated,
  })
}
