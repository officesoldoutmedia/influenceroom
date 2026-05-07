'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  CAMPAIGN_STATUSES,
  type CampaignStatus,
  type CampaignWithJoins,
  type TemplateGroupDef,
} from '@/lib/campaigns/types'

type Role = 'owner' | 'manager' | 'account' | 'intern'

export type SimpleBrand = { id: string; name: string }
export type SimpleMember = { id: string; name: string; role: string }
export type SimpleTemplate = { id: string; name: string; default_task_groups: TemplateGroupDef[] }

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
  templates,
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
  templates: SimpleTemplate[]
  currentUserId: string
  role: Role
}) {
  const router = useRouter()
  const pathname = usePathname()
  const canCreate = role === 'owner' || role === 'manager' || role === 'account'

  const [items, setItems] = useState<CampaignWithJoins[]>(initialItems)
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
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-stone-500 text-sm mb-1">Niciun campaign găsit.</p>
          {hasFilter(initialFilters) && (
            <p className="text-stone-400 text-xs">Încearcă să resetezi filtrele.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-left text-stone-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Brand</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium text-right">Deliverables</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((c) => (
                <tr key={c.id} className={c.status === 'cancelled' ? 'opacity-60' : ''}>
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-stone-900 hover:text-indigo-700">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{c.brand?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{c.start_date ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-600">{c.end_date ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-600">{c.owner?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-right">{c.deliverables_count ?? '—'}</td>
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
            <button type="button" disabled={page <= 1} onClick={() => pushFilters({ page: page - 1 })} className="px-3 py-1 rounded border border-stone-300 disabled:opacity-40">Prev</button>
            <span className="px-3 py-1 text-stone-600">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => pushFilters({ page: page + 1 })} className="px-3 py-1 rounded border border-stone-300 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showNew && (
        <NewCampaignModal
          brands={brands}
          members={members}
          templates={templates}
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

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 space-y-3">
      <div className="flex gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
        />
        <select
          value={brand}
          onChange={(e) => { setBrand(e.target.value); onApply({ brand: e.target.value || null }) }}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
        >
          <option value="">All brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={owner}
          onChange={(e) => { setOwner(e.target.value); onApply({ owner: e.target.value || null }) }}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
        >
          <option value="">All owners</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {canCreate && (
          <button type="button" onClick={onNew} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 whitespace-nowrap">
            + New campaign
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-500 mr-1">Status:</span>
        {CAMPAIGN_STATUSES.map((s) => {
          const active = statuses.includes(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`text-xs px-2 py-0.5 rounded-full border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}
            >
              {s.replace('_', ' ')}
            </button>
          )
        })}
        {showReset && (
          <button type="button" onClick={reset} className="text-xs text-stone-500 underline ml-2">
            Reset filters
          </button>
        )}
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary =
  'px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60'
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

function maxOffsetDays(groups: TemplateGroupDef[]): number | null {
  if (!groups.length) return null
  return groups.reduce((max, g) => Math.max(max, g.due_offset_days), -Infinity)
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function NewCampaignModal({
  brands,
  members,
  templates,
  currentUserId,
  role,
  onClose,
  onCreated,
}: {
  brands: SimpleBrand[]
  members: SimpleMember[]
  templates: SimpleTemplate[]
  currentUserId: string
  role: Role
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [brandId, setBrandId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endDateTouched, setEndDateTouched] = useState(false)
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

  const tpl = templates.find((t) => t.id === templateId)
  const tplMaxOffset = tpl ? maxOffsetDays(tpl.default_task_groups) : null

  // Auto-fill end_date when template + start_date set, unless user has touched
  useEffect(() => {
    if (endDateTouched) return
    if (!startDate) { setEndDate(''); return }
    if (tplMaxOffset == null) return
    setEndDate(addDaysISO(startDate, tplMaxOffset))
  }, [startDate, tplMaxOffset, endDateTouched])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        template_id: templateId || null,
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
        <h2 className="text-lg font-semibold text-stone-900 mb-4">New campaign</h2>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Brand *">
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} required className={inputCls}>
              <option value="">— select brand —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Template">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
              <option value="">No template — blank</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date (publish / T+0)">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setEndDateTouched(true) }}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total budget (RON)">
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
