import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadCampaign, canReadInfluencer } from '@/lib/auth/scope'

const BUCKET = 'report-uploads'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const LIST_LIMIT = 20

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const participantId = sp.get('participant_id')
  const campaignId = sp.get('campaign_id')
  const influencerId = sp.get('influencer_id')

  const filterCount = [participantId, campaignId, influencerId].filter((v) => v && v.length > 0).length
  if (filterCount !== 1) {
    return NextResponse.json({ ok: false, error: 'one_filter_required' }, { status: 400 })
  }

  const supabase = admin()

  // Scope check
  if (campaignId) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('owner_id')
      .eq('id', campaignId)
      .maybeSingle<{ owner_id: string | null }>()
    if (!c) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    if (!canReadCampaign(user, { owner_id: c.owner_id })) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
  } else if (participantId) {
    const { data: p } = await supabase
      .from('campaign_participants')
      .select('campaign:campaigns(owner_id)')
      .eq('id', participantId)
      .maybeSingle<{ campaign: { owner_id: string | null }[] | { owner_id: string | null } | null }>()
    if (!p) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    const camp = Array.isArray(p.campaign) ? p.campaign[0] ?? null : p.campaign
    if (!canReadCampaign(user, { owner_id: camp?.owner_id ?? null })) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
  } else if (influencerId) {
    const { data: i } = await supabase
      .from('influencers')
      .select('account_manager_id')
      .eq('id', influencerId)
      .maybeSingle<{ account_manager_id: string | null }>()
    if (!i) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    if (!canReadInfluencer(user, { account_manager_id: i.account_manager_id })) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
  }

  let query = supabase
    .from('report_uploads')
    .select(`
      *,
      uploaded_by:team_members!report_uploads_uploaded_by_fkey(id, name),
      updated_by:team_members!report_uploads_updated_by_fkey(id, name),
      participant:campaign_participants(id, platform, account_handle, influencer:influencers(id, name)),
      campaign:campaigns(id, name)
    `)
    .order('uploaded_at', { ascending: false })
    .limit(LIST_LIMIT)

  if (participantId) query = query.eq('participant_id', participantId)
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (influencerId) query = query.eq('influencer_id', influencerId)

  const { data: entries, error } = await query
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }

  // Sign URLs
  const withUrls = await Promise.all(
    (entries ?? []).map(async (e) => {
      const filePath = (e as { file_path: string }).file_path
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
      return { ...e, signedUrl: signed?.signedUrl ?? null }
    }),
  )

  return NextResponse.json({ ok: true, entries: withUrls })
}
