import { createClient } from '@supabase/supabase-js'
import { CAMPAIGN_STATUSES, type CampaignWithJoins, type CampaignStatus, type ParticipantSummary } from './types'
import { scopeCampaignsRead, type UserContext } from '@/lib/auth/scope'

export const PAGE_SIZE = 20

export type CampaignSearchParams = {
  q?: string | null
  statuses?: string[]
  brand?: string | null
  owner?: string | null
  /** Filtru pe influencer: doar campaniile care îl au ca participant. */
  influencer?: string | null
  /** YYYY-MM — limita inferioară pentru overlap cu intervalul campaniei. */
  monthFrom?: string | null
  /** YYYY-MM — limita superioară pentru overlap. */
  monthTo?: string | null
  page?: number
  // Required at every call site; applied as a final WHERE so account managers
  // only see their own campaigns. Pass the result of getCurrentUser().
  user: UserContext
}

export type CampaignSearchResult = {
  items: CampaignWithJoins[]
  total: number
  page: number
  pageSize: number
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function listCampaigns(p: CampaignSearchParams): Promise<CampaignSearchResult> {
  const supabase = admin()

  const statuses = (p.statuses ?? []).filter(
    (s): s is CampaignStatus => (CAMPAIGN_STATUSES as readonly string[]).includes(s),
  )
  const page = Math.max(1, p.page ?? 1)

  let query = supabase
    .from('campaigns')
    .select(
      `
        *,
        brand:brands(id, name, logo_url),
        owner:team_members!campaigns_owner_id_fkey(id, name, role, avatar_url)
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (p.q) query = query.ilike('name', `%${p.q}%`)
  if (statuses.length) query = query.in('status', statuses)
  if (p.brand) query = query.eq('brand_id', p.brand)
  if (p.owner) query = query.eq('owner_id', p.owner)

  // Filtru influencer: pre-fetch ids de campanii unde apare ca participant
  // (model multi-participant — un influencer poate fi pe N campanii prin
  // diverse platforme). Apoi `.in('id', ids)` ca PostgREST count + paginare
  // să reflecte exact setul filtrat.
  if (p.influencer && /^[0-9a-f-]{36}$/i.test(p.influencer)) {
    const { data: cIds } = await supabase
      .from('campaign_participants')
      .select('campaign_id')
      .eq('influencer_id', p.influencer)
    const ids = Array.from(new Set((cIds ?? []).map((r) => (r as { campaign_id: string }).campaign_id)))
    query = query.in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  // §11 month overlap filter. O campanie cu (start, end) overlap-uieste cu
  // intervalul [fromStart, toEnd] dacă start <= toEnd AND (end >= fromStart OR end IS NULL).
  const monthRegex = /^\d{4}-\d{2}$/
  const monthFrom = p.monthFrom && monthRegex.test(p.monthFrom) ? p.monthFrom : null
  const monthTo = p.monthTo && monthRegex.test(p.monthTo) ? p.monthTo : null

  if (monthFrom) {
    const fromStart = `${monthFrom}-01`
    query = query.or(`end_date.gte.${fromStart},end_date.is.null`)
  }
  if (monthTo) {
    const [y, m] = monthTo.split('-').map(Number)
    const nextMonth = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1))
    nextMonth.setUTCDate(nextMonth.getUTCDate() - 1)
    const toEnd = nextMonth.toISOString().slice(0, 10)
    query = query.lte('start_date', toEnd)
  }
  if (monthFrom || monthTo) {
    query = query.not('start_date', 'is', null)
  }

  query = scopeCampaignsRead(query, p.user)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) {
    if (/not satisfiable/i.test(error.message)) {
      const head = await supabase.from('campaigns').select('id', { count: 'exact', head: true })
      return { items: [], total: head.count ?? 0, page, pageSize: PAGE_SIZE }
    }
    throw new Error(error.message)
  }

  const items = (data ?? []) as unknown as CampaignWithJoins[]

  // Populate participants summary per campanie (un singur round-trip,
  // dedup per campaign_id ca să arătăm o singură mențiune per influencer
  // chiar dacă e pe mai multe platforme).
  if (items.length > 0) {
    const campaignIds = items.map((c) => c.id)
    const { data: parts } = await supabase
      .from('campaign_participants')
      .select('id, campaign_id, influencer_id, is_adhoc, influencer:influencers(name)')
      .in('campaign_id', campaignIds)
    type Row = {
      id: string
      campaign_id: string
      influencer_id: string | null
      is_adhoc: boolean
      influencer: { name: string } | { name: string }[] | null
    }
    const byId = new Map<string, ParticipantSummary[]>()
    const seenInfluencer = new Map<string, Set<string>>()
    for (const r of (parts ?? []) as Row[]) {
      if (!byId.has(r.campaign_id)) byId.set(r.campaign_id, [])
      if (!seenInfluencer.has(r.campaign_id)) seenInfluencer.set(r.campaign_id, new Set())
      const key = r.influencer_id ?? `adhoc-${r.id}`
      const seen = seenInfluencer.get(r.campaign_id)!
      if (seen.has(key)) continue
      seen.add(key)
      const inf = Array.isArray(r.influencer) ? r.influencer[0] ?? null : r.influencer
      byId.get(r.campaign_id)!.push({
        id: r.id,
        influencer_id: r.influencer_id,
        influencer_name: inf?.name ?? null,
        is_adhoc: r.is_adhoc,
      })
    }
    for (const c of items) {
      c.participants = byId.get(c.id) ?? []
    }
  }

  return {
    items,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  }
}
