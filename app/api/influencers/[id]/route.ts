import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { requireInfluencerWriter } from '@/lib/auth/scope'
import { validateAndNormalize, type InfluencerInput } from '@/lib/influencers/validate'
import {
  compareRateCards,
  hasRateCardChanges,
  type RateCards,
} from '@/lib/rate-cards/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireWriter()
  if (denied) return denied

  const { id } = await params

  const scoped = await requireInfluencerWriter(id)
  if (scoped) return scoped

  let body: InfluencerInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const v = validateAndNormalize(body, true)
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
  if (Object.keys(v.data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()

  // Rate-card audit (Sprint 14b). When the payload touches rate_cards, fetch
  // the current value first so we can diff before/after and write an audit
  // row. We only read the column needed — keep the round-trip tight.
  let beforeRateCards: RateCards | null = null
  const willUpdateRateCards = 'rate_cards' in v.data
  if (willUpdateRateCards) {
    const { data: pre } = await supabase
      .from('influencers')
      .select('rate_cards')
      .eq('id', id)
      .maybeSingle<{ rate_cards: RateCards | null }>()
    beforeRateCards = pre?.rate_cards ?? null
  }

  const { data, error } = await supabase
    .from('influencers')
    .update(v.data)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (willUpdateRateCards) {
    const after = (data as { rate_cards: RateCards | null }).rate_cards ?? null
    const changes = compareRateCards(beforeRateCards, after)
    if (hasRateCardChanges(changes)) {
      const h = await headers()
      const changedBy = h.get('x-user-id')
      // Fire-and-mostly-forget — audit failures shouldn't fail the user
      // edit. Log to server for follow-up if it ever does break.
      const { error: histErr } = await supabase
        .from('influencer_rate_card_history')
        .insert({
          influencer_id: id,
          rate_cards_before: beforeRateCards,
          rate_cards_after: after,
          changes,
          changed_by: changedBy,
        })
      if (histErr) {
        console.warn('[rate-card-audit] history insert failed:', histErr.message)
      }
    }
  }

  return NextResponse.json({ ok: true, influencer: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireWriter()
  if (denied) return denied

  const { id } = await params

  const scoped = await requireInfluencerWriter(id)
  if (scoped) return scoped

  const supabase = admin()
  const { data, error } = await supabase
    .from('influencers')
    .update({ status: 'inactive' })
    .eq('id', id)
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
