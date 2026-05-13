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
import {
  ENGAGEMENT_LEVEL_COLORS,
  ENGAGEMENT_LEVEL_LABELS,
  engagementLevelFromRate,
  formatEngagementRate,
} from '@/lib/influencers/social'
import { DetailUI } from './detail-ui'
import { ScoreSection } from './score-section'
import { RateCardPdfButton } from './rate-card-pdf-button'
import { canReadInfluencer, isOwnerOrManager } from '@/lib/auth/scope'
import type { InfluencerScore, ScoreHistoryEntry } from '@/lib/scoring/types'
import {
  RATE_TYPES_PER_PLATFORM,
  RATE_TYPE_LABELS,
  countRatesForPlatform,
  totalRateCount,
  hasAnyRate,
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
    { data: rateHistory },
    { data: participantRows },
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
    supabase
      .from('influencer_rate_card_history')
      .select('id, changed_at, changes, changed_by, changer:team_members!influencer_rate_card_history_changed_by_fkey(name)')
      .eq('influencer_id', id)
      .order('changed_at', { ascending: false })
      .limit(10),
    // "Campanii anterioare" — one row per (campaign × platform); we aggregate
    // platforms in TS below and scope visibility client-of-server-side via
    // canReadCampaign so account users only see campaigns they own.
    supabase
      .from('campaign_participants')
      .select(
        `platform,
         campaign:campaigns!inner(
           id, name, status, start_date, end_date, owner_id,
           brand:brands(name)
         )`,
      )
      .eq('influencer_id', id),
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

  // Aggregate campaign participants into per-campaign rows. Path A scoping:
  // account users see only campaigns they own; owner/manager see everything.
  // Many-to-one nested-selects can come back as object or single-item array
  // depending on Supabase's hint — unwrap both shapes.
  const previousCampaigns = aggregatePreviousCampaigns(
    (participantRows ?? []) as ParticipantCampaignRow[],
    user,
  ).slice(0, 10)

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
                        className="group block bg-stone-50 hover:bg-brand-50/40 hover:border-brand-300 border border-stone-200 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                            {PLATFORM_LABEL[p as Platform]}
                          </span>
                        </div>
                        <div className="text-sm text-stone-900 mt-1 truncate">@{e.handle}</div>
                        <div className="text-[12px] text-stone-500 tabular-nums mt-0.5">
                          {formatFollowers(e.followers)} followers
                        </div>
                        {(() => {
                          const lvl = engagementLevelFromRate(e.engagement_rate)
                          if (!lvl) return null
                          return (
                            <div className="text-[12px] text-stone-500 tabular-nums mt-1 flex items-center gap-1.5">
                              <span>ER: {formatEngagementRate(e.engagement_rate)}</span>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${ENGAGEMENT_LEVEL_COLORS[lvl]}`}
                              >
                                {ENGAGEMENT_LEVEL_LABELS[lvl]}
                              </span>
                            </div>
                          )
                        })()}
                        {/* "Open Profile" affordance: hidden on hover-capable
                            devices until the card is hovered; permanently
                            visible on touch devices where hover doesn't fire.
                            The whole card is still the anchor — clicking the
                            button is just clicking the same link. */}
                        <div className="mt-3 flex justify-center">
                          <span className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand-700 text-white text-[11px] font-medium uppercase tracking-wider">
                            Open Profile <span aria-hidden>↗</span>
                          </span>
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

          {isOwnerOrManager(user) && (rateHistory ?? []).length > 0 && (
            <RateCardHistorySection entries={(rateHistory ?? []) as RateCardHistoryEntry[]} />
          )}

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

          <PreviousCampaignsSection items={previousCampaigns} />
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
  const empty = !hasAnyRate(rateCards)
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
          {`Rate Cards${total > 0 ? ` (${total} activate)` : ''}`}
        </h2>
        {canEdit && (
          <RateCardPdfButton
            influencerId={influencerId}
            disabled={empty}
            disabledReason={empty ? 'Adaugă rate-uri înainte de a genera PDF' : undefined}
          />
        )}
      </div>
      {empty ? (
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
    </div>
  )
}

function PlatformRateTable({ platform, card }: { platform: Platform; card: RateCard }) {
  // Walk the canonical rate-type order so the table is consistent across
  // influencers and platforms (UR-30 always last, etc).
  //
  // Stefan 2026-05-13: subtotal row dropped here too (matches the PDF tweak
  // from Sprint 13b polish). Sums aren't relevant — each rate is its own
  // line-item price; team computes their own combinations.
  const rows = (RATE_TYPES_PER_PLATFORM[platform] as readonly string[])
    .map((rt) => ({ rt, value: card[rt] }))
    .filter((r): r is { rt: string; value: number } => typeof r.value === 'number')
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
      </table>
    </div>
  )
}

type RateCardHistoryEntry = {
  id: string
  changed_at: string
  changes: Record<string, { old: number | null; new: number | null }> | null
  changed_by: string | null
  // Supabase nested-select on a many-to-one FK returns the related row
  // either as an object or as a single-element array depending on hint —
  // accept both shapes and unwrap below.
  changer: { name: string } | { name: string }[] | null
}

function RateCardHistorySection({ entries }: { entries: RateCardHistoryEntry[] }) {
  // Owner/manager-only audit list — shown collapsed by default. Format:
  // "8 mai 2026, 18:23 — Ramona R. a modificat Instagram.video: 2500€ → 2700€"
  // Multi-key changes get one row per key for readability.
  return (
    <details className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <summary className="cursor-pointer flex items-center justify-between gap-2 list-none">
        <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
          Istoric modificări tarife ({entries.length})
        </h2>
        <span className="text-[11px] text-stone-400">click pentru detalii</span>
      </summary>
      <ul className="mt-4 space-y-2 text-sm">
        {entries.map((entry) => {
          const when = new Date(entry.changed_at).toLocaleString('ro-RO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          const changer = Array.isArray(entry.changer) ? entry.changer[0] : entry.changer
          const who = changer?.name ?? 'Sistem'
          const changes = entry.changes ?? {}
          const keys = Object.keys(changes)
          return (
            <li key={entry.id} className="border-l-2 border-brand-200 pl-3">
              <div className="text-[12px] text-stone-500">
                {when} — <span className="text-stone-700 font-medium">{who}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {keys.map((k) => {
                  const { old: oldV, new: newV } = changes[k]
                  return (
                    <li key={k} className="text-[13px] text-stone-700 tabular-nums">
                      <span className="text-stone-500">{k}:</span>{' '}
                      {oldV == null ? '—' : formatEur(oldV)}
                      <span className="mx-1.5 text-stone-400">→</span>
                      {newV == null ? '—' : formatEur(newV)}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

// ── Previous campaigns ──────────────────────────────────────────────────────

type ParticipantCampaignRow = {
  platform: string
  campaign:
    | {
        id: string
        name: string
        status: string
        start_date: string | null
        end_date: string | null
        owner_id: string | null
        brand: { name: string } | { name: string }[] | null
      }
    | Array<{
        id: string
        name: string
        status: string
        start_date: string | null
        end_date: string | null
        owner_id: string | null
        brand: { name: string } | { name: string }[] | null
      }>
    | null
}

type PreviousCampaign = {
  campaign_id: string
  name: string
  brand_name: string | null
  status: string
  start_date: string | null
  end_date: string | null
  platforms: string[]
}

function aggregatePreviousCampaigns(
  rows: ParticipantCampaignRow[],
  user: { id: string; role: string },
): PreviousCampaign[] {
  const isPrivileged = user.role === 'owner' || user.role === 'manager'
  const map = new Map<string, PreviousCampaign>()
  for (const row of rows) {
    const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign
    if (!campaign) continue
    if (!isPrivileged && campaign.owner_id !== user.id) continue
    const existing = map.get(campaign.id)
    if (existing) {
      if (!existing.platforms.includes(row.platform)) {
        existing.platforms.push(row.platform)
      }
      continue
    }
    const brand = Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand
    map.set(campaign.id, {
      campaign_id: campaign.id,
      name: campaign.name,
      brand_name: brand?.name ?? null,
      status: campaign.status,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      platforms: [row.platform],
    })
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.start_date === b.start_date) return 0
    if (a.start_date == null) return 1
    if (b.start_date == null) return -1
    return a.start_date < b.start_date ? 1 : -1
  })
}

const PLATFORM_ABBR: Record<string, string> = {
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  facebook: 'FB',
}

const STATUS_LABEL_RO: Record<string, string> = {
  draft: 'Schiță',
  active: 'Activă',
  in_review: 'În review',
  completed: 'Finalizată',
  cancelled: 'Anulată',
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })
  if (start && end) return `${fmt(start)} — ${fmt(end)}`
  return fmt((start ?? end) as string)
}

function PreviousCampaignsSection({ items }: { items: PreviousCampaign[] }) {
  return (
    <Section title={`Campanii anterioare${items.length ? ` (${items.length})` : ''}`}>
      {items.length === 0 ? (
        <p className="text-sm text-stone-400">Niciun istoric campanii.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((c) => {
            const platforms = c.platforms
              .map((p) => PLATFORM_ABBR[p] ?? p.toUpperCase())
              .join(', ')
            const statusLabel = STATUS_LABEL_RO[c.status] ?? c.status
            return (
              <li key={c.campaign_id}>
                <Link
                  href={`/campaigns/${c.campaign_id}`}
                  className="block py-3 -mx-2 px-2 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">
                        {c.name}
                        {c.brand_name && (
                          <span className="text-stone-400"> · {c.brand_name}</span>
                        )}
                        {platforms && (
                          <span className="text-stone-400"> · {platforms}</span>
                        )}
                      </div>
                      <div className="text-[12px] text-stone-500 mt-0.5">
                        {formatRange(c.start_date, c.end_date)} · Status: {statusLabel}
                      </div>
                    </div>
                    <span className="text-stone-400" aria-hidden>→</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
