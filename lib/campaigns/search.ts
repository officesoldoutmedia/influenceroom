import { createClient } from '@supabase/supabase-js'
import { CAMPAIGN_STATUSES, type CampaignWithJoins, type CampaignStatus } from './types'
import { scopeCampaignsRead, type UserContext } from '@/lib/auth/scope'

export const PAGE_SIZE = 20

export type CampaignSearchParams = {
  q?: string | null
  statuses?: string[]
  brand?: string | null
  owner?: string | null
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

  return {
    items: (data ?? []) as unknown as CampaignWithJoins[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  }
}
