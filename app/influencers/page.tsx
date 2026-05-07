import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { searchInfluencers } from '@/lib/influencers/search'
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

  const { data: me } = await supabase
    .from('team_members')
    .select('name')
    .eq('id', userId)
    .maybeSingle()

  const filters = {
    q: strParam(sp.q),
    tiers: arrayParam(sp.tier),
    platform: strParam(sp.platform),
    fmin: numParam(sp.fmin),
    fmax: numParam(sp.fmax),
    tags: arrayParam(sp.tag),
    status: strParam(sp.status),
    page: numParam(sp.page) ?? 1,
  }

  const result = await searchInfluencers(filters)

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-stone-900 mb-6">Influencers</h1>
          <InfluencersUI
            initialItems={result.items}
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            initialFilters={filters}
            role={role}
          />
        </div>
      </main>
    </>
  )
}
