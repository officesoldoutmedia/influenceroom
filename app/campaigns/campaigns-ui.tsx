'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  CAMPAIGN_STATUSES,
  type CampaignStatus,
  type CampaignWithJoins,
} from '@/lib/campaigns/types'
import { EmptyState, Button, Combobox, type ComboboxItem } from '@/lib/ui'

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'draft',
  active: 'active',
  in_review: 'în review',
  completed: 'finalizat',
  cancelled: 'anulat',
}

type Role = 'owner' | 'manager' | 'account' | 'intern'

export type SimpleBrand = { id: string; name: string }
export type SimpleMember = { id: string; name: string; role: string }

const STATUS_BADGE: Record<CampaignStatus, string> = {
  draft: 'bg-stone-200 text-stone-700',
  active: 'bg-emerald-100 text-emerald-700',
  in_review: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

type Filters = {
  q: string | null
  statuses: string[]
  brand: string | null
  owner: string | null
  page: number
}

type ApiResp<T> = { ok?: boolean; error?: string; campaign?: T }

export function CampaignsUI({
  initialItems,
  total,
  page,
  pageSize,
  initialFilters,
  brands,
  members,
  currentUserId,
  role,
}: {
  initialItems: CampaignWithJoins[]
  total: number
  page: number
  pageSize: number
  initialFilters: Filters
  brands: SimpleBrand[]
  members: SimpleMember[]
  currentUserId: string
  role: Role
}) {
  const router = useRouter()
  const pathname = usePathname()
  const canCreate = role === 'owner' || role === 'manager' || role === 'account'

  const [items, setItems] = useState<CampaignWithJoins[]>(initialItems)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(initialItems), [initialItems])

  const [showNew, setShowNew] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function pushFilters(next: Partial<Filters>) {
    const merged: Filters = { ...initialFilters, ...next, page: next.page ?? 1 }
    const params = new URLSearchParams()
    if (merged.q) params.set('q', merged.q)
    for (const s of merged.statuses) params.append('status', s)
    if (merged.brand) params.set('brand', merged.brand)
    if (merged.owner) params.set('owner', merged.owner)
    if (merged.page > 1) params.set('page', String(merged.page))
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <>
      <FilterBar
        filters={initialFilters}
        brands={brands}
        members={members}
        canCreate={canCreate}
        onApply={pushFilters}
        onNew={() => setShowNew(true)}
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nicio campanie găsită"
          description={
            hasFilter(initialFilters)
              ? 'Încearcă să resetezi filtrele.'
              : 'Crează prima campanie pentru a începe să gestionezi briefuri și deliverabile.'
          }
          action={
            !hasFilter(initialFilters) && canCreate ? (
              <Button type="button" variant="primary" onClick={() => setShowNew(true)}>
                + Adaugă campanie
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="md:hidden space-y-2">
            {items.map((c) => (
              <li key={c.id} className={c.status === 'cancelled' ? 'opacity-60' : ''}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="block bg-white border border-stone-200 rounded-xl p-4 active:bg-stone-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-stone-900 truncate">{c.name}</span>
                    <span className={`shrink-0 text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[12px] text-stone-500 gap-2">
                    <span className="truncate">{c.brand?.name ?? '—'}</span>
                    <span className="shrink-0">{c.owner?.name ?? '—'}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                  <th className="px-4 py-3">Nume</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Deliverabile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-stone-50 transition-colors ${c.status === 'cancelled' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-stone-900 hover:text-brand-800">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{c.brand?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600 tabular-nums">{c.start_date ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600 tabular-nums">{c.end_date ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{c.owner?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600 text-right tabular-nums">{c.deliverables_count ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-stone-500 tabular-nums">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} din {total}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => pushFilters({ page: page - 1 })} className="px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-transparent text-stone-700">← Anterior</button>
            <span className="px-3 py-1.5 text-stone-600 tabular-nums">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => pushFilters({ page: page + 1 })} className="px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-transparent text-stone-700">Următor →</button>
          </div>
        </div>
      )}

      {showNew && (
        <NewCampaignModal
          brands={brands}
          members={members}
          currentUserId={currentUserId}
          role={role}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            router.push(`/campaigns/${id}`)
          }}
        />
      )}
    </>
  )
}

function hasFilter(f: Filters): boolean {
  return !!(f.q || f.statuses.length || f.brand || f.owner)
}

function FilterBar({
  filters,
  brands,
  members,
  canCreate,
  onApply,
  onNew,
}: {
  filters: Filters
  brands: SimpleBrand[]
  members: SimpleMember[]
  canCreate: boolean
  onApply: (next: Partial<Filters>) => void
  onNew: () => void
}) {
  const [q, setQ] = useState(filters.q ?? '')
  const [statuses, setStatuses] = useState<string[]>(filters.statuses)
  const [brand, setBrand] = useState<string>(filters.brand ?? '')
  const [owner, setOwner] = useState<string>(filters.owner ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      if ((q || null) !== filters.q) onApply({ q: q || null })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function toggleStatus(s: CampaignStatus) {
    const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s]
    setStatuses(next)
    onApply({ statuses: next })
  }

  function reset() {
    setQ('')
    setStatuses([])
    setBrand('')
    setOwner('')
    onApply({ q: null, statuses: [], brand: null, owner: null, page: 1 })
  }

  const showReset = useMemo(() => hasFilter(filters), [filters])

  const inputCls =
    'w-full px-3 py-2.5 border border-stone-300 rounded-md text-sm bg-white focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] p-4 mb-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută după nume…"
          className={`${inputCls} sm:flex-1`}
        />
        {canCreate && (
          <button
            type="button"
            onClick={onNew}
            className="h-11 px-4 rounded-md bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 whitespace-nowrap shrink-0"
          >
            + Adaugă campanie
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={brand}
          onChange={(e) => { setBrand(e.target.value); onApply({ brand: e.target.value || null }) }}
          className={inputCls}
        >
          <option value="">Toate brandurile</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={owner}
          onChange={(e) => { setOwner(e.target.value); onApply({ owner: e.target.value || null }) }}
          className={inputCls}
        >
          <option value="">Toți ownerii</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-2">
          Status
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CAMPAIGN_STATUSES.map((s) => {
            const active = statuses.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                aria-pressed={active}
                className={`min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 rounded-full border text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            )
          })}
        </div>
      </div>

      {showReset && (
        <div className="pt-1">
          <button
            type="button"
            onClick={reset}
            className="text-[12px] text-stone-500 hover:text-stone-800 underline underline-offset-2"
          >
            Resetează filtrele
          </button>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary =
  'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'

function ErrorMap(code: string): string {
  return ({
    missing_brand: 'Selectează un brand',
    missing_name: 'Numele e obligatoriu',
    invalid_status: 'Status invalid',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function NewCampaignModal({
  brands,
  members,
  currentUserId,
  role,
  onClose,
  onCreated,
}: {
  brands: SimpleBrand[]
  members: SimpleMember[]
  currentUserId: string
  role: Role
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brandList, setBrandList] = useState<SimpleBrand[]>(brands)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [brief, setBrief] = useState('')
  const [ownerId, setOwnerId] = useState(currentUserId)
  const [internalNotes, setInternalNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ownerCandidates = role === 'owner' || role === 'manager'
    ? members
    : members.filter((m) => m.id === currentUserId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!brandId) {
      setError('Selectează un brand')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        name,
        start_date: startDate || null,
        end_date: endDate || null,
        total_budget: budget === '' ? null : Number(budget),
        deliverables_count: deliverables === '' ? null : Number(deliverables),
        brief: brief || null,
        owner_id: ownerId || null,
        internal_notes: internalNotes || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp<{ id: string }>
    setBusy(false)
    if (res.ok && data.campaign?.id) onCreated(data.campaign.id)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-stone-900 mb-4">Campanie nouă</h2>
        <form onSubmit={submit} className="space-y-3">
          <Combobox
            label="Brand"
            required
            placeholder="Caută sau crează brand..."
            items={brandList.map((b): ComboboxItem => ({ id: b.id, label: b.name }))}
            value={brandId}
            onChange={setBrandId}
            onCreate={async (q) => {
              const res = await fetch('/api/brands', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: q }),
              })
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean
                brand?: { id: string; name: string }
              }
              if (!res.ok || !data.brand) return null
              const created = { id: data.brand.id, name: data.brand.name }
              setBrandList((prev) => [...prev, created])
              return { id: created.id, label: created.name }
            }}
            createLabel={(q) => <>+ Crează brand nou: <strong>{q}</strong></>}
          />
          <Field label="Nume *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start (T+0)">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Final">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total budget (€)">
              <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Deliverables count">
              <input type="number" min={0} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Brief">
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} className={textareaCls} />
          </Field>
          <Field label="Owner">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
              {ownerCandidates.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </Field>
          <Field label="Internal notes">
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className={textareaCls} />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
