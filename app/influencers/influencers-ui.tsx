'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  TIERS,
  PLATFORMS,
  PRESET_TAGS,
  type Tier,
  type Platform,
  type Influencer,
} from '@/lib/influencers/types'
import { formatFollowers } from '@/lib/influencers/format'
import {
  emptyForm,
  formToPayload,
  InfluencerFormFields,
  type FormValues,
} from './influencer-form'

type Role = 'owner' | 'manager' | 'account' | 'intern'

const TIER_BADGE: Record<Tier, string> = {
  nano: 'bg-stone-200 text-stone-700',
  micro: 'bg-blue-100 text-blue-700',
  mid: 'bg-cyan-100 text-cyan-700',
  macro: 'bg-purple-100 text-purple-700',
  mega: 'bg-amber-100 text-amber-800',
}

type Filters = {
  q: string | null
  tiers: string[]
  platform: string | null
  fmin: number | null
  fmax: number | null
  tags: string[]
  status: string | null
  page: number
}

type ApiResp = { ok?: boolean; error?: string; influencer?: Influencer }

export function InfluencersUI({
  initialItems,
  total,
  page,
  pageSize,
  initialFilters,
  role,
}: {
  initialItems: Influencer[]
  total: number
  page: number
  pageSize: number
  initialFilters: Filters
  role: Role
}) {
  const router = useRouter()
  const pathname = usePathname()
  const canWrite = role === 'owner' || role === 'manager' || role === 'account'

  const [items, setItems] = useState<Influencer[]>(initialItems)
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const [showAdd, setShowAdd] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function pushFilters(next: Partial<Filters>) {
    const merged: Filters = { ...initialFilters, ...next, page: next.page ?? 1 }
    const params = new URLSearchParams()
    if (merged.q) params.set('q', merged.q)
    for (const t of merged.tiers) params.append('tier', t)
    if (merged.platform) params.set('platform', merged.platform)
    if (merged.fmin != null) params.set('fmin', String(merged.fmin))
    if (merged.fmax != null) params.set('fmax', String(merged.fmax))
    for (const t of merged.tags) params.append('tag', t)
    if (merged.status) params.set('status', merged.status)
    if (merged.page > 1) params.set('page', String(merged.page))
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function upsert(inf: Influencer) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === inf.id)
      if (idx === -1) return [inf, ...prev]
      const next = [...prev]
      next[idx] = inf
      return next
    })
  }

  return (
    <>
      <FilterBar filters={initialFilters} onApply={pushFilters} canWrite={canWrite} onAdd={() => setShowAdd(true)} />

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-stone-500 text-sm mb-1">Niciun influencer găsit.</p>
          {hasActiveFilter(initialFilters) && (
            <p className="text-stone-400 text-xs">Încearcă să resetezi filtrele.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-left text-stone-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Primary</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Niches</th>
                <th className="px-4 py-3 font-medium text-right">Followers</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((i) => (
                <tr key={i.id} className={i.status === 'active' ? '' : 'opacity-60'}>
                  <td className="px-4 py-3">
                    <Link href={`/influencers/${i.id}`} className="flex items-center gap-3 hover:text-indigo-700">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                        {i.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="font-medium text-stone-900">{i.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{i.primary_handle ?? '—'}</td>
                  <td className="px-4 py-3">
                    {i.tier && (
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TIER_BADGE[i.tier]}`}>
                        {i.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {i.niche_tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                      {i.niche_tags.length > 3 && <span className="text-[10px] text-stone-400">+{i.niche_tags.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600 text-right">
                    {primaryFollowers(i)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wide ${i.status === 'active' ? 'text-emerald-600' : i.status === 'blacklist' ? 'text-rose-600' : 'text-stone-400'}`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-stone-500">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => pushFilters({ page: page - 1 })}
              className="px-3 py-1 rounded border border-stone-300 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-stone-600">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => pushFilters({ page: page + 1 })}
              className="px-3 py-1 rounded border border-stone-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <FormModal
          title="Add influencer"
          initial={emptyForm()}
          onClose={() => setShowAdd(false)}
          onSaved={(inf) => {
            upsert(inf)
            setShowAdd(false)
            router.refresh()
          }}
          method="POST"
          url="/api/influencers"
        />
      )}
    </>
  )
}

function hasActiveFilter(f: Filters): boolean {
  return !!(f.q || f.tiers.length || f.platform || f.fmin != null || f.fmax != null || f.tags.length || f.status)
}

function primaryFollowers(i: Influencer): string {
  for (const p of PLATFORMS) {
    const stats = i.platforms?.[p]
    if (stats?.followers != null) return formatFollowers(stats.followers)
  }
  return '—'
}

function FilterBar({
  filters,
  onApply,
  canWrite,
  onAdd,
}: {
  filters: Filters
  onApply: (next: Partial<Filters>) => void
  canWrite: boolean
  onAdd: () => void
}) {
  const [q, setQ] = useState(filters.q ?? '')
  const [tiers, setTiers] = useState<string[]>(filters.tiers)
  const [platform, setPlatform] = useState<string>(filters.platform ?? '')
  const [fmin, setFmin] = useState<string>(filters.fmin != null ? String(filters.fmin) : '')
  const [fmax, setFmax] = useState<string>(filters.fmax != null ? String(filters.fmax) : '')
  const [tags, setTags] = useState<string[]>(filters.tags)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      if ((q || null) !== filters.q) onApply({ q: q || null })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function toggleTier(t: Tier) {
    const next = tiers.includes(t) ? tiers.filter((x) => x !== t) : [...tiers, t]
    setTiers(next)
    onApply({ tiers: next })
  }
  function setPlat(p: string) {
    setPlatform(p)
    onApply({ platform: p || null })
  }
  function commitRange() {
    onApply({
      fmin: fmin === '' ? null : Number(fmin),
      fmax: fmax === '' ? null : Number(fmax),
    })
  }
  function toggleTag(t: string) {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]
    setTags(next)
    onApply({ tags: next })
  }
  function reset() {
    setQ('')
    setTiers([])
    setPlatform('')
    setFmin('')
    setFmax('')
    setTags([])
    onApply({ q: null, tiers: [], platform: null, fmin: null, fmax: null, tags: [], status: null, page: 1 })
  }

  const hasFilter = useMemo(() => hasActiveFilter(filters), [filters])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 space-y-3">
      <div className="flex gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
        />
        <select value={platform} onChange={(e) => setPlat(e.target.value)} className="px-3 py-2 border border-stone-300 rounded-lg text-sm">
          <option value="">Any platform</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={fmin}
          onChange={(e) => setFmin(e.target.value)}
          onBlur={commitRange}
          placeholder="Followers min"
          className="w-32 px-3 py-2 border border-stone-300 rounded-lg text-sm"
        />
        <input
          type="number"
          min={0}
          value={fmax}
          onChange={(e) => setFmax(e.target.value)}
          onBlur={commitRange}
          placeholder="max"
          className="w-32 px-3 py-2 border border-stone-300 rounded-lg text-sm"
        />
        {canWrite && (
          <button type="button" onClick={onAdd} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 whitespace-nowrap">
            + Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-500 mr-1">Tier:</span>
        {TIERS.map((t) => {
          const active = tiers.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTier(t)}
              className={`text-xs px-2 py-0.5 rounded-full border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}
            >
              {t}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-500 mr-1">Niches:</span>
        {PRESET_TAGS.map((t) => {
          const active = tags.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className={`text-xs px-2 py-0.5 rounded-full border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}
            >
              {t}
            </button>
          )
        })}
        {hasFilter && (
          <button type="button" onClick={reset} className="text-xs text-stone-500 underline ml-2">
            Reset filters
          </button>
        )}
      </div>
    </div>
  )
}

const btnPrimary =
  'px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'

function ErrorMap(code: string): string {
  return ({
    missing_name: 'Numele e obligatoriu',
    invalid_tier: 'Tier invalid',
    invalid_status: 'Status invalid',
    invalid_email: 'Email contact invalid',
    invalid_agent_email: 'Email agent invalid',
    invalid_tags: 'Format taguri invalid',
    not_found: 'Influencer inexistent',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}

function FormModal({
  title,
  initial,
  onClose,
  onSaved,
  method,
  url,
}: {
  title: string
  initial: FormValues
  onClose: () => void
  onSaved: (i: Influencer) => void
  method: 'POST' | 'PATCH'
  url: string
}) {
  const [form, setForm] = useState<FormValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.influencer) onSaved(data.influencer)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-stone-900 mb-2">{title}</h2>
        <form onSubmit={submit}>
          <InfluencerFormFields form={form} set={setForm} />
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-stone-200">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
