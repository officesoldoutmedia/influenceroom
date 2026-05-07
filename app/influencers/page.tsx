import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { searchInfluencers } from '@/lib/influencers/search'
import type { ManagerSummary } from '@/lib/influencers/types'
import { InfluencersUI } from './influencers-ui'

export const dynamic = 'force-dynamic'

function arrayParam(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}
function strParam(v: string | string[] | undefined): string | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] : v
}
function numParam(v: string | string[] | undefined): number | null {
  const s = strParam(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const [{ data: me }, { data: managers }] = await Promise.all([
    supabase.from('team_members').select('name, role').eq('id', userId).maybeSingle(),
    supabase
      .from('team_members')
      .select('id, name, role')
      .eq('active', true)
      .in('role', ['owner', 'manager', 'account'])
      .order('name'),
  ])

  const filters = {
    q: strParam(sp.q),
    tiers: arrayParam(sp.tier),
    platform: strParam(sp.platform),
    fmin: numParam(sp.fmin),
    fmax: numParam(sp.fmax),
    tags: arrayParam(sp.tag),
    status: strParam(sp.status),
    manager: strParam(sp.manager),
    page: numParam(sp.page) ?? 1,
  }

  const result = await searchInfluencers(filters)

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-6 sm:mb-8">Influenceri</h1>
          <InfluencersUI
            initialItems={result.items}
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            initialFilters={filters}
            role={role}
            currentUserId={userId}
            managers={(managers ?? []) as ManagerSummary[]}
          />
        </div>
      </main>
    </>
  )
}
