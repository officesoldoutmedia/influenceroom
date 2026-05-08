'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  JUNCTION_STATUSES,
  NEXT_JUNCTION_STATES,
  type CampaignInfluencerJoined,
  type JunctionStatus,
  type Performance,
} from '@/lib/campaigns/types'
import { formatEur } from '@/lib/influencers/format'

const STATUS_BADGE: Record<JunctionStatus, string> = {
  pitched: 'bg-stone-200 text-stone-700',
  negotiating: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-700',
  content_in_review: 'bg-purple-100 text-purple-700',
  published: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const TIER_BADGE: Record<string, string> = {
  nano: 'bg-stone-200 text-stone-700',
  micro: 'bg-blue-100 text-blue-700',
  mid: 'bg-cyan-100 text-cyan-700',
  macro: 'bg-purple-100 text-purple-700',
  mega: 'bg-amber-100 text-amber-800',
}

type ApiResp = { ok?: boolean; error?: string; item?: CampaignInfluencerJoined }

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary = 'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'
const btnSecondary = 'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'
const btnDanger = 'px-3 py-1 rounded text-xs bg-rose-50 text-rose-700 hover:bg-rose-100'

function ErrorMap(code: string): string {
  return ({
    missing_influencer: 'Selectează un influencer',
    invalid_status: 'Status invalid',
    already_in_campaign: 'Deja în campanie',
    publish_date_required: 'Data publicării e obligatorie pentru status published+',
    post_url_required: 'URL postare obligatoriu pentru status published+',
    forbidden: 'Acces interzis',
    not_found: 'Inexistent',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}

function primaryHandle(item: CampaignInfluencerJoined): string {
  if (item.influencer?.primary_handle) return item.influencer.primary_handle
  for (const p of ['instagram', 'tiktok', 'youtube', 'twitch']) {
    const stats = item.influencer?.platforms?.[p]
    if (stats?.handle) return stats.handle
  }
  return '—'
}

function formatPerformance(p: Performance): string {
  const views = p.views
  if (views == null) return '—'
  if (views < 1000) return `${views} views`
  if (views < 1_000_000) return `${(views / 1000).toFixed(1).replace(/\.0$/, '')}K views`
  return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`
}

export function RosterUI({
  campaignId,
  initialItems,
  canWrite,
}: {
  campaignId: string
  initialItems: CampaignInfluencerJoined[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<CampaignInfluencerJoined[]>(initialItems)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(initialItems), [initialItems])

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CampaignInfluencerJoined | null>(null)

  function upsert(item: CampaignInfluencerJoined) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id)
      if (idx === -1) return [...prev, item]
      const next = [...prev]
      next[idx] = item
      return next
    })
  }

  async function changeStatus(item: CampaignInfluencerJoined, next: JunctionStatus) {
    if (next === 'cancelled' && !confirm(`Marchezi ${item.influencer?.name} ca anulat?`)) return
    const res = await fetch(`/api/campaigns/${campaignId}/influencers/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    if (res.ok && data.item) upsert(data.item)
    else alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
  }

  async function remove(item: CampaignInfluencerJoined) {
    if (!confirm(`Scoți ${item.influencer?.name} din campanie? (delete)`)) return
    const res = await fetch(`/api/campaigns/${campaignId}/influencers/${item.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== item.id))
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }

  // Summary stats
  const totalFee = items.reduce((acc, i) => acc + (i.agreed_fee ?? 0), 0)
  const avgFee = items.length > 0 ? Math.round(totalFee / items.length) : 0
  const byStatus = new Map<JunctionStatus, number>()
  for (const i of items) byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1)

  return (
    <>
      <section className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total influenceri" value={String(items.length)} />
          <Stat label="Confirmed" value={String(byStatus.get('confirmed') ?? 0)} />
          <Stat label="Published" value={String(byStatus.get('published') ?? 0)} />
          <Stat label="Total fee" value={formatEur(totalFee)} />
        </div>
        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {JUNCTION_STATUSES.map((s) => {
              const n = byStatus.get(s) ?? 0
              if (n === 0) return null
              return (
                <span key={s} className={`px-2 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>
                  {s.replace('_', ' ')}: {n}
                </span>
              )
            })}
            <span className="text-stone-500 ml-2">avg fee {formatEur(avgFee)}</span>
          </div>
        )}
      </section>

      {canWrite && (
        <div className="flex justify-end mb-3">
          <button type="button" onClick={() => setShowAdd(true)} className={btnPrimary}>
            + Add influencer
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-stone-500 text-sm mb-4">Roster gol — nimeni adăugat încă.</p>
          {canWrite && (
            <button type="button" onClick={() => setShowAdd(true)} className={btnPrimary}>
              Add your first influencer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-left text-stone-500">
                <th className="px-4 py-3 font-medium">Influencer</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Fee</th>
                <th className="px-4 py-3 font-medium">Deliverables</th>
                <th className="px-4 py-3 font-medium">Publish</th>
                <th className="px-4 py-3 font-medium">Performance</th>
                {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item) => {
                const transitions = NEXT_JUNCTION_STATES[item.status]
                return (
                  <tr key={item.id} className={item.status === 'cancelled' ? 'opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-xs font-semibold">
                          {item.influencer?.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          {item.influencer ? (
                            <Link href={`/influencers/${item.influencer.id}`} className="font-medium text-stone-900 hover:text-brand-800">
                              {item.influencer.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-stone-900">—</span>
                          )}
                          <div className="text-xs text-stone-500">{primaryHandle(item)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.influencer?.tier && (
                        <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[item.influencer.tier] ?? 'bg-stone-100 text-stone-700'}`}>
                          {item.influencer.tier}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-right">
                      {item.agreed_fee != null ? item.agreed_fee.toLocaleString('ro-RO') : '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-600 max-w-[180px]">
                      <span className="line-clamp-2">{item.deliverables ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {item.publish_date ?? '—'}
                      {item.post_url && (
                        <a href={item.post_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-brand-700 hover:underline truncate max-w-[140px]">
                          {item.post_url}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{formatPerformance(item.performance ?? {})}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5 items-center">
                          {transitions.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) changeStatus(item, e.target.value as JunctionStatus) }}
                              className="text-xs border border-stone-300 rounded px-2 py-1 bg-white"
                            >
                              <option value="">→ status</option>
                              {transitions.map((s) => (
                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                              ))}
                            </select>
                          )}
                          <button type="button" onClick={() => setEditing(item)} className="px-3 py-1 rounded text-xs bg-stone-100 hover:bg-stone-200 text-stone-700">
                            Edit
                          </button>
                          <button type="button" onClick={() => remove(item)} className={btnDanger}>
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddModal
          campaignId={campaignId}
          excludeIds={items.map((i) => i.influencer_id)}
          onClose={() => setShowAdd(false)}
          onAdded={(item) => {
            upsert(item)
            setShowAdd(false)
            router.refresh()
          }}
        />
      )}

      {editing && (
        <EditModal
          campaignId={campaignId}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            upsert(item)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-stone-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-semibold text-stone-900">{value}</div>
    </div>
  )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

type SearchInfluencer = {
  id: string
  name: string
  primary_handle: string | null
  tier: string | null
}

function AddModal({
  campaignId,
  excludeIds,
  onClose,
  onAdded,
}: {
  campaignId: string
  excludeIds: string[]
  onClose: () => void
  onAdded: (item: CampaignInfluencerJoined) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchInfluencer[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<SearchInfluencer | null>(null)

  const [agreedFee, setAgreedFee] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [status, setStatus] = useState<JunctionStatus>('pitched')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams({ status: 'active' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/influencers?${params.toString()}`)
      const data = (await res.json().catch(() => ({}))) as { items?: SearchInfluencer[] }
      if (cancelled) return
      const items = data.items ?? []
      setResults(items.filter((i) => !excludeIds.includes(i.id)))
      setLoading(false)
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, excludeIds])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!picked) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/influencers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        influencer_id: picked.id,
        agreed_fee: agreedFee === '' ? null : Number(agreedFee),
        deliverables: deliverables || null,
        status,
        notes: notes || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.item) onAdded(data.item)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Add influencer to campaign</h2>

      {!picked ? (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            autoFocus
            className={inputCls}
          />
          <div className="mt-3 max-h-[400px] overflow-y-auto">
            {loading && <p className="text-sm text-stone-400 py-3">Caut...</p>}
            {!loading && results.length === 0 && <p className="text-sm text-stone-400 py-3">Niciun rezultat.</p>}
            <ul className="divide-y divide-stone-100">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(r)}
                    className="w-full text-left flex items-center gap-3 py-2 px-2 rounded hover:bg-stone-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-xs font-semibold">
                      {r.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-900">{r.name}</div>
                      <div className="text-xs text-stone-500">{r.primary_handle ?? '—'}</div>
                    </div>
                    {r.tier && (
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[r.tier] ?? 'bg-stone-100 text-stone-700'}`}>
                        {r.tier}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-3 mt-2 border-t border-stone-200">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="bg-stone-50 rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-xs font-semibold">
              {picked.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-stone-900">{picked.name}</div>
              <div className="text-xs text-stone-500">{picked.primary_handle ?? '—'}</div>
            </div>
            <button type="button" onClick={() => setPicked(null)} className="text-xs text-stone-500 underline">Change</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Agreed fee (€)">
              <input type="number" min={0} value={agreedFee} onChange={(e) => setAgreedFee(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Initial status">
              <select value={status} onChange={(e) => setStatus(e.target.value as JunctionStatus)} className={inputCls}>
                {JUNCTION_STATUSES.filter((s) => s !== 'cancelled').map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Deliverables">
            <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className={textareaCls} placeholder="ex: 1 IG Reel + 3 Stories" />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Add'}</button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}

function EditModal({
  campaignId,
  item,
  onClose,
  onSaved,
}: {
  campaignId: string
  item: CampaignInfluencerJoined
  onClose: () => void
  onSaved: (item: CampaignInfluencerJoined) => void
}) {
  const [agreedFee, setAgreedFee] = useState(item.agreed_fee == null ? '' : String(item.agreed_fee))
  const [deliverables, setDeliverables] = useState(item.deliverables ?? '')
  const [status, setStatus] = useState<JunctionStatus>(item.status)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [publishDate, setPublishDate] = useState(item.publish_date ?? '')
  const [postUrl, setPostUrl] = useState(item.post_url ?? '')
  const [perf, setPerf] = useState<Performance>(item.performance ?? {})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function setPerfNum(k: keyof Performance, v: string) {
    const next = { ...perf }
    if (v === '') delete next[k]
    else next[k] = Number(v)
    setPerf(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/influencers/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agreed_fee: agreedFee === '' ? null : Number(agreedFee),
        deliverables: deliverables || null,
        status,
        notes: notes || null,
        publish_date: publishDate || null,
        post_url: postUrl || null,
        performance: perf,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.item) onSaved(data.item)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit {item.influencer?.name ?? 'influencer'}</h2>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agreed fee (€)">
            <input type="number" min={0} value={agreedFee} onChange={(e) => setAgreedFee(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as JunctionStatus)} className={inputCls}>
              {JUNCTION_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Deliverables">
          <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className={textareaCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Publish date">
            <input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Post URL">
            <input type="url" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} className={inputCls} placeholder="https://..." />
          </Field>
        </div>

        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mt-2">Performance</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['views', 'likes', 'saves', 'reach', 'comments', 'shares'] as const).map((k) => (
            <Field key={k} label={k}>
              <input
                type="number"
                min={0}
                value={perf[k] ?? ''}
                onChange={(e) => setPerfNum(k, e.target.value)}
                className={inputCls}
              />
            </Field>
          ))}
        </div>

        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Save'}</button>
        </div>
      </form>
    </ModalShell>
  )
}
