'use client'

import { useEffect, useState } from 'react'
import { formatEur } from '@/lib/influencers/format'

// PostgREST returns one-to-one joins as either a single object or a
// single-element array depending on FK alias / version. We accept both
// shapes in the wire type and normalise via `pickOne` below — same
// pattern as app/api/campaigns/[id]/pdf/route.ts handles `influencer`.
type Person = { id: string; name: string }
type ParticipantRow = {
  id: string
  account_handle: string | null
  platform: string
  influencer: { name: string } | { name: string }[] | null
}
type Entry = {
  id: string
  cost_type: 'total_budget' | 'agreed_fee'
  amount_before: number | null
  amount_after: number | null
  changed_at: string
  changed_by: Person | Person[] | null
  participant: ParticipantRow | ParticipantRow[] | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; entries: Entry[] }
  | { kind: 'error'; message: string }

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'acum câteva secunde'
  if (diffMin < 60) return `acum ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `acum ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `acum ${diffD} zile`
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAmount(n: number | null): string {
  if (n == null) return '—'
  return formatEur(n)
}

export function CampaignAuditTab({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/campaigns/${campaignId}/cost-history`)
      .then(async (res) => {
        const data = (await res
          .json()
          .catch(() => ({}))) as { entries?: Entry[]; error?: string }
        if (cancelled) return
        if (res.ok && data.entries) {
          setState({ kind: 'ok', entries: data.entries })
        } else {
          setState({ kind: 'error', message: data.error ?? 'server_error' })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [campaignId])

  if (state.kind === 'loading') {
    return <div className="text-sm text-stone-500">Se încarcă istoricul...</div>
  }
  if (state.kind === 'error') {
    return <div className="text-sm text-rose-600">Eroare: {state.message}</div>
  }
  if (state.entries.length === 0) {
    return (
      <div className="text-sm text-stone-500 bg-white border border-stone-200 rounded-xl p-6 text-center">
        Niciun istoric pentru această campanie.
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
            <th className="px-4 py-3">Tip</th>
            <th className="px-4 py-3">Detaliu</th>
            <th className="px-4 py-3 text-right">De la</th>
            <th className="px-4 py-3 text-right">La</th>
            <th className="px-4 py-3">Modificat de</th>
            <th className="px-4 py-3">Când</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {state.entries.map((e) => {
            const participant = pickOne(e.participant)
            const influencer = participant ? pickOne(participant.influencer) : null
            const changedBy = pickOne(e.changed_by)
            return (
              <tr key={e.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    {e.cost_type === 'total_budget' ? 'Buget' : 'Fee'}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {e.cost_type === 'agreed_fee' && participant
                    ? `${influencer?.name ?? 'Extern'} (${participant.platform})`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-stone-600 text-right tabular-nums">{formatAmount(e.amount_before)}</td>
                <td className="px-4 py-3 text-stone-900 text-right tabular-nums font-medium">{formatAmount(e.amount_after)}</td>
                <td className="px-4 py-3 text-stone-600">{changedBy?.name ?? '—'}</td>
                <td className="px-4 py-3 text-stone-500" title={new Date(e.changed_at).toLocaleString('ro-RO')}>
                  {formatRelative(e.changed_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
