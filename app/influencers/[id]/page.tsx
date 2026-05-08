import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Nav, type NavRole } from '@/app/_components/nav'
import {
  PLATFORMS,
  PLATFORM_LABEL,
  TIER_BADGE,
  TIER_LABELS_LONG,
  TIER_LABELS_FULL,
  primaryHandle,
  maxFollowers,
  type Influencer,
  type ManagerSummary,
  type Platform,
} from '@/lib/influencers/types'
import { formatFollowers, formatEur } from '@/lib/influencers/format'
import { DetailUI } from './detail-ui'
import { ScoreSection } from './score-section'
import { canReadInfluencer, isOwnerOrManager } from '@/lib/auth/scope'
import type { InfluencerScore, ScoreHistoryEntry } from '@/lib/scoring/types'
import {
  RATE_TYPES_PER_PLATFORM,
  RATE_TYPE_LABELS,
  countRatesForPlatform,
  totalRatesForPlatform,
  totalRateCount,
  type RateCard,
  type RateCards,
} from '@/lib/rate-cards/types'

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

  const [
    { data: me },
    { data: i },
    { data: managers },
    { data: score },
    { data: history },
  ] = await Promise.all([
    supabase.from('team_members').select('name').eq('id', userId).maybeSingle(),
    supabase.from('influencers').select('*').eq('id', id).maybeSingle<Influencer>(),
    supabase
      .from('team_members')
      .select('id, name, role')
      .eq('active', true)
      .in('role', ['owner', 'manager', 'account'])
      .order('name'),
    supabase.from('influencer_scores').select('*').eq('influencer_id', id).maybeSingle<InfluencerScore>(),
    supabase
      .from('influencer_score_history')
      .select('*')
      .eq('influencer_id', id)
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  if (!i) notFound()
  // Read-side scoping: account/intern see only own assignments + unassigned.
  // Surface as 404 (not 403) so probing users can't enumerate other managers'
  // rosters.
  const user = { id: userId, role }
  if (!canReadInfluencer(user, { account_manager_id: i.account_manager_id })) notFound()

  const managerName = i.account_manager_id
    ? ((managers ?? []) as ManagerSummary[]).find((m) => m.id === i.account_manager_id)?.name ?? null
    : null

  // Write-gating mirrors requireInfluencerWriter (Path A scope.ts): owner/manager
  // bypass; account/intern can write rows they own or that are unassigned.
  const canWrite =
    isOwnerOrManager(user) ||
    (role === 'account' &&
      (i.account_manager_id === null || i.account_manager_id === userId))

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
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {(() => {
                      const ph = primaryHandle(i.social_handles ?? {})
                      return ph ? (
                        <span className="text-sm text-stone-600">@{ph.entry.handle}</span>
                      ) : null
                    })()}
                    {i.tier && (
                      <span
                        title={TIER_LABELS_FULL[i.tier]}
                        className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[i.tier]}`}
                      >
                        {TIER_LABELS_LONG[i.tier]}
                      </span>
                    )}
                    {i.tier_manual_override && (
                      <span className="text-[10px] uppercase tracking-[0.06em] text-stone-400">
                        manual
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

          <Section title="Social media">
            {Object.keys(i.social_handles ?? {}).length === 0 ? (
              <p className="text-sm text-stone-400">Niciun handle adăugat.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLATFORMS.filter((p) => i.social_handles?.[p]).map((p) => {
                  const e = i.social_handles[p as Platform]!
                  return (
                    <li key={p}>
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-stone-50 hover:bg-brand-50/40 hover:border-brand-300 border border-stone-200 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                            {PLATFORM_LABEL[p as Platform]}
                          </span>
                          <span className="text-[11px] text-brand-700">Open ↗</span>
                        </div>
                        <div className="text-sm text-stone-900 mt-1 truncate">@{e.handle}</div>
                        <div className="text-[12px] text-stone-500 tabular-nums mt-0.5">
                          {formatFollowers(e.followers)} followers
                        </div>
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
            {i.tier && (
              <p className="text-[12px] text-stone-500 mt-3">
                Tier: <strong className="text-stone-700">{TIER_LABELS_FULL[i.tier]}</strong>
                {i.tier_manual_override
                  ? ' · setat manual'
                  : ` · auto din max ${formatFollowers(maxFollowers(i.social_handles ?? {}))} followers`}
              </p>
            )}
          </Section>

          <ScoreSection
            influencerId={id}
            initialScore={(score ?? null) as InfluencerScore | null}
            initialHistory={(history ?? []) as ScoreHistoryEntry[]}
            canEdit={canWrite}
          />

          <RateCardsSection rateCards={i.rate_cards ?? {}} canEdit={canWrite} influencerId={id} />

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

function RateCardsSection({
  rateCards,
  canEdit,
  influencerId,
}: {
  rateCards: RateCards
  canEdit: boolean
  influencerId: string
}) {
  const total = totalRateCount(rateCards)
  return (
    <Section title={`Rate Cards${total > 0 ? ` (${total} activate)` : ''}`}>
      {total === 0 ? (
        <p className="text-sm text-stone-400">
          Niciun rate card completat.
          {canEdit && (
            <>
              {' '}
              <Link href={`/influencers/${influencerId}`} className="text-brand-700 hover:underline">
                Editează profilul
              </Link>{' '}
              pentru a adăuga.
            </>
          )}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORMS.map((p) => {
            const card = rateCards[p]
            if (!card || countRatesForPlatform(card) === 0) return null
            return <PlatformRateTable key={p} platform={p} card={card} />
          })}
        </div>
      )}
    </Section>
  )
}

function PlatformRateTable({ platform, card }: { platform: Platform; card: RateCard }) {
  // Walk the canonical rate-type order so the table is consistent across
  // influencers and platforms (UR-30 always last, etc).
  const rows = (RATE_TYPES_PER_PLATFORM[platform] as readonly string[])
    .map((rt) => ({ rt, value: card[rt] }))
    .filter((r): r is { rt: string; value: number } => typeof r.value === 'number')
  const subtotal = totalRatesForPlatform(card)
  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-800">{PLATFORM_LABEL[platform]}</span>
        <span className="text-[12px] text-stone-500">
          {rows.length} rate{rows.length === 1 ? '' : '-uri'}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-stone-100">
          {rows.map(({ rt, value }) => (
            <tr key={rt}>
              <td className="px-3 py-2 text-stone-700">{RATE_TYPE_LABELS[rt] ?? rt}</td>
              <td className="px-3 py-2 text-stone-900 font-medium tabular-nums text-right">
                {formatEur(value)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-stone-50 border-t border-stone-200">
            <td className="px-3 py-2 text-[12px] text-stone-500 uppercase tracking-wide">Subtotal</td>
            <td className="px-3 py-2 text-stone-900 font-medium tabular-nums text-right">
              {formatEur(subtotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
