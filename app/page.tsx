import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from './_components/nav'
import { Card, PageHeader, Badge, Button } from '@/lib/ui'
import { scopeCampaignsRead, scopeInfluencersRead } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const me = { id: userId, role }
  const campaignsBase = supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  const influencersBase = supabase
    .from('influencers')
    .select('id, name, tier, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5)

  const [{ data: user }, campaigns, myTasks, recentInfluencers] = await Promise.all([
    supabase.from('team_members').select('id, name, role').eq('id', userId).maybeSingle(),
    scopeCampaignsRead(campaignsBase, me),
    supabase
      .from('tasks')
      .select('id, title, status, due_date, campaign_id')
      .eq('assignee_id', userId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),
    scopeInfluencersRead(influencersBase, me),
  ])

  if (!user) redirect('/login')

  const firstName = user.name.split(' ')[0]

  return (
    <>
      <Nav name={user.name} role={role} />
      <main className="bg-stone-50 pwa-safe-bottom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <PageHeader
            eyebrow="Bună ziua"
            title={`${firstName}.`}
            description="Privire de ansamblu peste taskurile tale, campaniile active și echipa ta."
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* My open tasks */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  Taskurile tale deschise
                </h2>
                <Link
                  href="/tasks"
                  className="text-[12px] font-medium text-brand-700 hover:text-brand-800"
                >
                  Toate →
                </Link>
              </div>
              {myTasks.data && myTasks.data.length > 0 ? (
                <ul className="divide-y divide-stone-100">
                  {myTasks.data.map((t) => (
                    <li key={t.id} className="py-2.5 flex items-center gap-3">
                      <Link
                        href={`/campaigns/${t.campaign_id}`}
                        className="flex-1 min-w-0 hover:text-brand-700"
                      >
                        <div className="text-sm font-medium text-stone-900 truncate">
                          {t.title}
                        </div>
                        {t.due_date && (
                          <div className="text-[12px] text-stone-500 mt-0.5">
                            {new Date(t.due_date).toLocaleDateString('ro-RO', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </div>
                        )}
                      </Link>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-500 py-3">
                  Nu ai taskuri deschise. Frumos.
                </p>
              )}
            </Card>

            {/* Recent campaigns */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  Campanii recente
                </h2>
                <Link
                  href="/campaigns"
                  className="text-[12px] font-medium text-brand-700 hover:text-brand-800"
                >
                  Toate →
                </Link>
              </div>
              {campaigns.data && campaigns.data.length > 0 ? (
                <ul className="divide-y divide-stone-100">
                  {(campaigns.data as Array<{ id: string; name: string; status: string }>).map((c) => (
                    <li key={c.id} className="py-2.5">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="block hover:text-brand-700"
                      >
                        <div className="text-sm font-medium text-stone-900 truncate">
                          {c.name}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="brand" size="sm">
                            {c.status}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-4">
                  <p className="text-sm text-stone-500 mb-3">Nicio campanie încă.</p>
                  <Link href="/campaigns">
                    <Button size="sm" variant="primary">
                      Crează prima campanie
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Recent influencers */}
            <Card className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  Influenceri activi recenți
                </h2>
                <Link
                  href="/influencers"
                  className="text-[12px] font-medium text-brand-700 hover:text-brand-800"
                >
                  Toți →
                </Link>
              </div>
              {recentInfluencers.data && recentInfluencers.data.length > 0 ? (
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {(recentInfluencers.data as Array<{ id: string; name: string; tier: string | null; status: string }>).map((i) => (
                    <li key={i.id}>
                      <Link
                        href={`/influencers/${i.id}`}
                        className="block rounded-lg border border-stone-200 p-3 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                      >
                        <div className="text-sm font-medium text-stone-900 truncate">
                          {i.name}
                        </div>
                        {i.tier && (
                          <div className="mt-1.5">
                            <Badge variant="neutral" size="sm">
                              {i.tier}
                            </Badge>
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-500">Niciun influencer activ.</p>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
    todo: 'neutral',
    in_progress: 'info',
    blocked: 'warning',
    review: 'info',
    done: 'success',
  }
  return <Badge variant={map[status] ?? 'neutral'} size="sm">{status.replace('_', ' ')}</Badge>
}
