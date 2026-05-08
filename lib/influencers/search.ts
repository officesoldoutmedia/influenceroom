import { createClient } from '@supabase/supabase-js'
import { TIERS, PLATFORMS, STATUSES, type Tier, type Platform, type InfluencerStatus, type Influencer } from './types'
import { scopeInfluencersRead, type UserContext } from '@/lib/auth/scope'

export const PAGE_SIZE = 20

const SCORE_CATEGORIES = ['low', 'medium', 'high', 'top_performer'] as const
type ScoreCategoryFilter = (typeof SCORE_CATEGORIES)[number]

export type SearchParams = {
  q?: string | null
  tiers?: string[]
  platform?: string | null
  fmin?: number | null
  fmax?: number | null
  tags?: string[]
  status?: string | null
  /** uuid | "unassigned" | null */
  manager?: string | null
  // Filter by influencer_scores.category. When set, we pre-fetch matching
  // influencer ids and apply `.in('id', ids)` so PostgREST's pagination + count
  // still reflect the filtered set. Influencers without a score row are
  // excluded when this filter is active.
  scoreCategory?: string | null
  page?: number
  // Required at every call site; applied as a final WHERE so account managers
  // only see influencers assigned to them or unassigned. Pass the result of
  // getCurrentUser().
  user: UserContext
}

export type SearchResult = {
  items: Influencer[]
  total: number
  page: number
  pageSize: number
}

export async function searchInfluencers(p: SearchParams): Promise<SearchResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const tiers = (p.tiers ?? []).filter((t): t is Tier => (TIERS as readonly string[]).includes(t))
  const platformFilter: Platform | null =
    p.platform && (PLATFORMS as readonly string[]).includes(p.platform) ? (p.platform as Platform) : null
  const tags = (p.tags ?? []).filter((t) => t.length > 0)
  const status = p.status as InfluencerStatus | null
  const page = Math.max(1, p.page ?? 1)

  let query = supabase
    .from('influencers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (p.q) query = query.ilike('name', `%${p.q}%`)
  if (tiers.length) query = query.in('tier', tiers)
  if (tags.length) query = query.contains('niche_tags', tags)
  if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq('status', status)

  if (p.scoreCategory && (SCORE_CATEGORIES as readonly string[]).includes(p.scoreCategory)) {
    const { data: scoredIds } = await supabase
      .from('influencer_scores')
      .select('influencer_id')
      .eq('category', p.scoreCategory as ScoreCategoryFilter)
    const ids = (scoredIds ?? []).map((r) => (r as { influencer_id: string }).influencer_id)
    // Always set a constraint — empty array forces zero results, which is
    // the right outcome when no influencer has a score in the picked band.
    query = query.in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  if (p.manager === 'unassigned') {
    query = query.is('account_manager_id', null)
  } else if (p.manager && /^[0-9a-f-]{36}$/i.test(p.manager)) {
    query = query.eq('account_manager_id', p.manager)
  }

  const rangePlatform: Platform | null =
    platformFilter ?? (p.fmin != null || p.fmax != null ? 'instagram' : null)
  if (platformFilter) {
    query = query.not(`social_handles->${platformFilter}`, 'is', null)
  }
  if (rangePlatform && p.fmin != null && Number.isFinite(p.fmin)) {
    query = query.gte(`social_handles->${rangePlatform}->followers::int`, p.fmin)
  }
  if (rangePlatform && p.fmax != null && Number.isFinite(p.fmax)) {
    query = query.lte(`social_handles->${rangePlatform}->followers::int`, p.fmax)
  }
  query = scopeInfluencersRead(query, p.user)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) {
    // Out-of-range page on PostgREST returns 416 "not satisfiable".
    // Re-query for count alone so the UI can recover (e.g. show "page X of Y").
    if (/not satisfiable/i.test(error.message)) {
      const head = await supabase
        .from('influencers')
        .select('id', { count: 'exact', head: true })
      return {
        items: [],
        total: head.count ?? 0,
        page,
        pageSize: PAGE_SIZE,
      }
    }
    throw new Error(error.message)
  }

  return {
    items: (data ?? []) as Influencer[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  }
}
