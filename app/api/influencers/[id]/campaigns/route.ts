// GET /api/influencers/[id]/campaigns
//
// Returns the list of campaigns where this influencer has been a participant
// (across all platforms), with one row per campaign (platforms are merged).
// Used by /influencers/[id] "Campanii anterioare" section.
//
// Path A scoping:
//   - read access to the influencer first: out-of-scope IDs surface as 404
//     so account users can't enumerate other managers' rosters.
//   - campaign visibility re-filtered: account users see only campaigns
//     they own (campaigns.owner_id == user.id); owner/manager bypass.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  canReadCampaign,
  canReadInfluencer,
  getCurrentUser,
  isOwnerOrManager,
} from '@/lib/auth/scope'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type ParticipantRow = {
  platform: string
  campaign: {
    id: string
    name: string
    status: string
    start_date: string | null
    end_date: string | null
    owner_id: string | null
    brand: { name: string } | { name: string }[] | null
  } | Array<{
    id: string
    name: string
    status: string
    start_date: string | null
    end_date: string | null
    owner_id: string | null
    brand: { name: string } | { name: string }[] | null
  }> | null
}

export type InfluencerCampaign = {
  campaign_id: string
  name: string
  brand_name: string | null
  status: string
  start_date: string | null
  end_date: string | null
  platforms: string[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()

  // Read-side influencer check first — 404 if out of scope.
  const { data: inf } = await supabase
    .from('influencers')
    .select('account_manager_id')
    .eq('id', id)
    .maybeSingle()
  if (!inf || !canReadInfluencer(user, inf)) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // One row per (campaign × platform). We aggregate platforms in TS so the
  // endpoint stays simple and Supabase doesn't need a custom SQL function.
  const { data: rows, error } = await supabase
    .from('campaign_participants')
    .select(
      `
        platform,
        campaign:campaigns!inner(
          id, name, status, start_date, end_date, owner_id,
          brand:brands(name)
        )
      `,
    )
    .eq('influencer_id', id)

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }

  const byCampaign = new Map<string, InfluencerCampaign>()
  for (const row of (rows ?? []) as unknown as ParticipantRow[]) {
    const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign
    if (!campaign) continue
    if (!canReadCampaign(user, { owner_id: campaign.owner_id })) continue

    const existing = byCampaign.get(campaign.id)
    if (existing) {
      if (!existing.platforms.includes(row.platform)) {
        existing.platforms.push(row.platform)
      }
      continue
    }
    const brand = Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand
    byCampaign.set(campaign.id, {
      campaign_id: campaign.id,
      name: campaign.name,
      brand_name: brand?.name ?? null,
      status: campaign.status,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      platforms: [row.platform],
    })
  }

  const items = Array.from(byCampaign.values()).sort((a, b) => {
    // Newest first by start_date, nulls last.
    if (a.start_date === b.start_date) return 0
    if (a.start_date == null) return 1
    if (b.start_date == null) return -1
    return a.start_date < b.start_date ? 1 : -1
  })

  return NextResponse.json({
    ok: true,
    items,
    is_scoped: !isOwnerOrManager(user),
  })
}
