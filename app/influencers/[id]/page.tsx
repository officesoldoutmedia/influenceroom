import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Nav, type NavRole } from '@/app/_components/nav'
import { PLATFORMS, TIER_BADGE, TIER_LABELS_LONG, type Influencer, type ManagerSummary } from '@/lib/influencers/types'
import { formatFollowers, formatEur } from '@/lib/influencers/format'
import { DetailUI } from './detail-ui'

export const dynamic = 'force-dynamic'

export default async function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const [{ data: me }, { data: i }, { data: managers }] = await Promise.all([
    supabase.from('team_members').select('name').eq('id', userId).maybeSingle(),
    supabase.from('influencers').select('*').eq('id', id).maybeSingle<Influencer>(),
    supabase
      .from('team_members')
      .select('id, name, role')
      .eq('active', true)
      .in('role', ['owner', 'manager', 'account'])
      .order('name'),
  ])

  if (!i) notFound()

  const managerName = i.account_manager_id
    ? ((managers ?? []) as ManagerSummary[]).find((m) => m.id === i.account_manager_id)?.name ?? null
    : null

  const canWrite = role === 'owner' || role === 'manager' || role === 'account'

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/influencers" className="text-sm text-stone-500 hover:text-stone-800">← Influencers</Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-xl font-semibold">
                  {i.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-stone-900">{i.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {i.primary_handle && <span className="text-sm text-stone-600">{i.primary_handle}</span>}
                    {i.tier && (
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[i.tier]}`}>
                        {TIER_LABELS_LONG[i.tier]}
                      </span>
                    )}
                    <span className={`text-[10px] uppercase tracking-wide ${i.status === 'active' ? 'text-emerald-600' : i.status === 'blacklist' ? 'text-rose-600' : 'text-stone-400'}`}>
                      {i.status}
                    </span>
                    {i.exclusive && (
                      <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                        exclusive
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {canWrite && (
                <DetailUI influencer={i} managers={(managers ?? []) as ManagerSummary[]} />
              )}
            </div>

            <p className="text-sm text-stone-500 mt-3">
              <span className="text-stone-400">Account manager:</span>{' '}
              <span className={managerName ? 'text-stone-700' : 'italic text-stone-400'}>
                {managerName ?? 'Unassigned'}
              </span>
            </p>

            {(i.location_city || i.location_country) && (
              <p className="text-sm text-stone-500 mt-1">
                {[i.location_city, i.location_country].filter(Boolean).join(', ')}
                {i.language && ` · ${i.language}`}
              </p>
            )}

            {i.niche_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {i.niche_tags.map((t) => (
                  <span key={t} className="text-xs bg-brand-50 text-brand-800 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Section title="Platforms">
            {Object.keys(i.platforms ?? {}).length === 0 ? (
              <p className="text-sm text-stone-400">No platforms recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-stone-500">
                  <tr className="text-left">
                    <th className="pb-2 font-medium">Platform</th>
                    <th className="pb-2 font-medium">Handle</th>
                    <th className="pb-2 font-medium text-right">Followers</th>
                    <th className="pb-2 font-medium text-right">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {PLATFORMS.filter((p) => i.platforms?.[p]).map((p) => {
                    const stats = i.platforms[p]!
                    return (
                      <tr key={p} className="border-t border-stone-100">
                        <td className="py-2 capitalize">{p}</td>
                        <td className="py-2 text-stone-600">{stats.handle ?? '—'}</td>
                        <td className="py-2 text-stone-600 text-right">{formatFollowers(stats.followers)}</td>
                        <td className="py-2 text-stone-600 text-right">
                          {stats.engagement_rate != null ? `${(stats.engagement_rate * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Rates (EUR)">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <RateBlock label="Post" value={i.rate_post} />
              <RateBlock label="Story" value={i.rate_story} />
              <RateBlock label="Reel" value={i.rate_reel} />
              <RateBlock label="Video" value={i.rate_video} />
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Email" value={i.contact_email} />
              <Info label="Phone" value={i.contact_phone} />
              <Info label="Agent" value={i.agent_name} />
              <Info label="Agent email" value={i.agent_email} />
            </div>
          </Section>

          {i.fiscal_data && Object.keys(i.fiscal_data).length > 0 && (
            <Section title="Fiscal">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Entity" value={i.fiscal_data.entity_type} />
                <Info label="CUI" value={i.fiscal_data.cui} />
                <Info label="IBAN" value={i.fiscal_data.iban} />
                <Info label="Address" value={i.fiscal_data.address} />
              </div>
            </Section>
          )}

          {i.notes && (
            <Section title="Notes">
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{i.notes}</p>
            </Section>
          )}

          <Section title="Campaigns">
            <p className="text-sm text-stone-400">No campaigns yet (Sprint 3).</p>
          </Section>
        </div>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-stone-500 mb-0.5">{label}</div>
      <div className="text-stone-900">{value || '—'}</div>
    </div>
  )
}

function RateBlock({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-stone-50 rounded-lg p-3">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className="text-stone-900 font-medium tabular-nums">{formatEur(value)}</div>
    </div>
  )
}
