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
import { ConfirmModal } from '@/lib/ui/confirm-modal'

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function ParticipantsSummary({
  participants,
}: {
  participants: Array<{ influencer_name: string | null; is_adhoc: boolean }>
}) {
  if (participants.length === 0) {
    return <span className="text-stone-400 italic">—</span>
  }
  const first = participants[0]
  const firstName = first.influencer_name ?? (first.is_adhoc ? 'Extern' : '—')
  const overflow = participants.length - 1
  const fullList = participants
    .map((p) => p.influencer_name ?? (p.is_adhoc ? 'Extern' : '—'))
    .join(', ')
  return (
    <span title={fullList} className="truncate">
      {firstName}
      {overflow > 0 && <span className="text-stone-400"> +{overflow}</span>}
    </span>
  )
}

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
export type SimpleInfluencer = { id: string; name: string }

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
  influencer: string | null
  monthFrom: string | null
  monthTo: string | null
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
  influencers,
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
  influencers: SimpleInfluencer[]
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
  const [rowToDelete, setRowToDelete] = useState<CampaignWithJoins | null>(null)
  const [rowDeleting, setRowDeleting] = useState(false)
  const [reportState, setReportState] = useState<
    { kind: 'idle' | 'loading' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function exportReport() {
    setReportState({ kind: 'loading' })
    try {
      const res = await fetch('/api/campaigns/report-pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          q: initialFilters.q,
          statuses: initialFilters.statuses,
          brand: initialFilters.brand,
          owner: initialFilters.owner,
          influencer: initialFilters.influencer,
          monthFrom: initialFilters.monthFrom,
          monthTo: initialFilters.monthTo,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        signedUrl?: string
        error?: string
        detail?: string
        message?: string
      }
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener')
        setReportState({ kind: 'idle' })
        return
      }
      setReportState({
        kind: 'error',
        message: data.message || data.detail || data.error || 'eroare necunoscută',
      })
      setTimeout(() => setReportState({ kind: 'idle' }), 5000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'eroare reţea'
      setReportState({ kind: 'error', message })
      setTimeout(() => setReportState({ kind: 'idle' }), 5000)
    }
  }

  async function deleteRow(c: CampaignWithJoins) {
    setRowDeleting(true)
    const res = await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' })
    setRowDeleting(false)
    setRowToDelete(null)
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== c.id))
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }

  function pushFilters(next: Partial<Filters>) {
    const merged: Filters = { ...initialFilters, ...next, page: next.page ?? 1 }
    const params = new URLSearchParams()
    if (merged.q) params.set('q', merged.q)
    for (const s of merged.statuses) params.append('status', s)
    if (merged.brand) params.set('brand', merged.brand)
    if (merged.owner) params.set('owner', merged.owner)
    if (merged.influencer) params.set('influencer', merged.influencer)
    if (merged.monthFrom) params.set('month_from', merged.monthFrom)
    if (merged.monthTo) params.set('month_to', merged.monthTo)
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
        influencers={influencers}
        canCreate={canCreate}
        onApply={pushFilters}
        onNew={() => setShowNew(true)}
        onExportReport={exportReport}
        reportLoading={reportState.kind === 'loading'}
        reportError={reportState.kind === 'error' ? reportState.message : null}
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
              <li key={c.id} className={`relative ${c.status === 'cancelled' ? 'opacity-60' : ''}`}>
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
                  <div className="mt-1 text-[12px] text-stone-500 truncate">
                    <ParticipantsSummary participants={c.participants ?? []} />
                  </div>
                </Link>
                {(c.status === 'draft' || c.status === 'cancelled') && (
                  <button
                    type="button"
                    aria-label="Șterge campania"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setRowToDelete(c)
                    }}
                    className="absolute bottom-3 right-3 p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                  <th className="px-4 py-3">Nume campanie</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Influenceri</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Deliverabile</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((c) => (
                  <tr
                    key={c.id}
                    className={`group hover:bg-stone-50 transition-colors ${c.status === 'cancelled' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-stone-900 hover:text-brand-800">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{c.brand?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600">
                      <ParticipantsSummary participants={c.participants ?? []} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600 tabular-nums">{c.start_date ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600 tabular-nums">{c.end_date ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{c.owner?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600 text-right tabular-nums">{c.deliverables_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {(c.status === 'draft' || c.status === 'cancelled') && (
                        <button
                          type="button"
                          aria-label="Șterge campania"
                          onClick={() => setRowToDelete(c)}
                          className="p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
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
          influencers={influencers}
          currentUserId={currentUserId}
          role={role}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            router.refresh()
            router.push(`/campaigns/${id}`)
          }}
        />
      )}

      {rowToDelete && (
        <ConfirmModal
          title="Ștergi campania?"
          description={`"${rowToDelete.name}" și toate datele asociate vor fi șterse definitiv.`}
          confirmLabel="Șterge definitiv"
          variant="danger"
          busy={rowDeleting}
          onConfirm={() => deleteRow(rowToDelete)}
          onCancel={() => setRowToDelete(null)}
        />
      )}
    </>
  )
}

function hasFilter(f: Filters): boolean {
  return !!(f.q || f.statuses.length || f.brand || f.owner || f.influencer || f.monthFrom || f.monthTo)
}

function FilterBar({
  filters,
  brands,
  members,
  influencers,
  canCreate,
  onApply,
  onNew,
  onExportReport,
  reportLoading,
  reportError,
}: {
  filters: Filters
  brands: SimpleBrand[]
  members: SimpleMember[]
  influencers: SimpleInfluencer[]
  canCreate: boolean
  onApply: (next: Partial<Filters>) => void
  onNew: () => void
  onExportReport: () => void
  reportLoading: boolean
  reportError: string | null
}) {
  const [q, setQ] = useState(filters.q ?? '')
  const [statuses, setStatuses] = useState<string[]>(filters.statuses)
  const [brand, setBrand] = useState<string>(filters.brand ?? '')
  const [owner, setOwner] = useState<string>(filters.owner ?? '')
  const [influencer, setInfluencer] = useState<string>(filters.influencer ?? '')
  const [monthFrom, setMonthFrom] = useState<string>(filters.monthFrom ?? '')
  const [monthTo, setMonthTo] = useState<string>(filters.monthTo ?? '')

  function commitMonths() {
    onApply({
      monthFrom: monthFrom || null,
      monthTo: monthTo || null,
    })
  }

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
    setInfluencer('')
    setMonthFrom('')
    setMonthTo('')
    onApply({ q: null, statuses: [], brand: null, owner: null, influencer: null, monthFrom: null, monthTo: null, page: 1 })
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
        <button
          type="button"
          onClick={onExportReport}
          disabled={reportLoading}
          className="h-11 px-4 rounded-md border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {reportLoading ? 'Generez raport...' : 'Export raport PDF'}
        </button>
        {reportError && (
          <span className="text-xs text-rose-700">{reportError}</span>
        )}
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
        <Combobox
          items={influencers.map((i): ComboboxItem => ({ id: i.id, label: i.name }))}
          value={influencer || null}
          onChange={(id) => {
            setInfluencer(id ?? '')
            onApply({ influencer: id })
          }}
          placeholder="Caută influencer..."
          emptyLabel="Niciun influencer."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="month"
          value={monthFrom}
          onChange={(e) => setMonthFrom(e.target.value)}
          onBlur={commitMonths}
          placeholder="De la luna"
          aria-label="De la luna"
          className={inputCls}
        />
        <input
          type="month"
          value={monthTo}
          onChange={(e) => setMonthTo(e.target.value)}
          onBlur={commitMonths}
          placeholder="Până la luna"
          aria-label="Până la luna"
          className={inputCls}
        />
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
    invalid_status_for_delete: 'Doar campaniile draft sau cancelled pot fi șterse',
    validation_failed: 'Datele introduse nu sunt valide',
    not_found: 'Campania nu există',
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
  influencers,
  currentUserId,
  role,
  onClose,
  onCreated,
}: {
  brands: SimpleBrand[]
  members: SimpleMember[]
  influencers: SimpleInfluencer[]
  currentUserId: string
  role: Role
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brandList, setBrandList] = useState<SimpleBrand[]>(brands)
  const [name, setName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [primaryInfluencerId, setPrimaryInfluencerId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [brief, setBrief] = useState('')
  const [ownerId, setOwnerId] = useState(currentUserId)
  const [internalNotes, setInternalNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitMode, setSubmitMode] = useState<'draft' | 'active' | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // State for the inline "Crează brand nou" mini-dialog. Tracks pending
  // resolve/reject so the Combobox can `await onCreate` while the user
  // fills in the 5-field form. resolved by saveBrand / cancelBrand below.
  const [brandModal, setBrandModal] = useState<{
    open: boolean
    name: string
    resolve: ((b: ComboboxItem | null) => void) | null
  }>({ open: false, name: '', resolve: null })

  const ownerCandidates = role === 'owner' || role === 'manager'
    ? members
    : members.filter((m) => m.id === currentUserId)

  function fieldErrorMessage(field: string, code: string): string {
    if (field === 'start_date' && code === 'missing') return 'Selectează data de start'
    if (field === 'end_date' && code === 'missing') return 'Selectează data de final'
    if (field === 'end_date' && code === 'before_start') return 'Data de final trebuie să fie după start'
    if (field === 'brand_id' && code === 'missing') return 'Selectează un brand'
    if (field === 'name' && code === 'missing') return 'Numele este obligatoriu'
    return `${field}: ${code}`
  }

  async function submit(mode: 'draft' | 'active') {
    if (!brandId) {
      setError('Selectează un brand')
      return
    }
    if (!name.trim()) {
      setError('Numele este obligatoriu')
      return
    }
    setSubmitMode(mode)
    setError(null)
    setFieldErrors({})
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        name,
        status: mode,
        agency_name: agencyName.trim() || null,
        primary_influencer_id: primaryInfluencerId,
        start_date: startDate || null,
        end_date: endDate || null,
        total_budget: budget === '' ? null : Number(budget),
        deliverables_count: deliverables === '' ? null : Number(deliverables),
        brief: brief || null,
        owner_id: ownerId || null,
        internal_notes: internalNotes || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp<{ id: string }> & {
      errors?: { field: string; code: string }[]
    }
    setSubmitMode(null)
    if (res.ok && data.campaign?.id) {
      onCreated(data.campaign.id)
      return
    }
    if (res.status === 422 && data.errors) {
      const m: Record<string, string> = {}
      for (const e of data.errors) {
        m[e.field] = fieldErrorMessage(e.field, e.code)
      }
      setFieldErrors(m)
      setError('Completează câmpurile lipsă pentru a activa campania')
    } else {
      setError(ErrorMap(data.error ?? 'server_error'))
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-stone-900 mb-4">Campanie nouă</h2>
        <form onSubmit={(e) => { e.preventDefault(); submit('draft') }} className="space-y-3">
          <Combobox
            label="Brand"
            required
            placeholder="Caută sau crează brand..."
            items={brandList.map((b): ComboboxItem => ({ id: b.id, label: b.name }))}
            value={brandId}
            onChange={setBrandId}
            onCreate={(q) =>
              new Promise<ComboboxItem | null>((resolve) => {
                // Hand off to the mini-modal — Combobox await-s this promise
                // and inserts the returned item when the user saves.
                setBrandModal({ open: true, name: q, resolve })
              })
            }
            createLabel={(q) => <>+ Crează brand nou: <strong>{q}</strong></>}
          />
          <Field label="Nume campanie *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Nume agenție">
            <input
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="ex: Influence Room"
              className={inputCls}
            />
          </Field>
          <Field label="Influencer principal">
            <Combobox
              items={influencers.map((i): ComboboxItem => ({ id: i.id, label: i.name }))}
              value={primaryInfluencerId}
              onChange={setPrimaryInfluencerId}
              placeholder="Caută influencer (opțional)..."
              emptyLabel="Niciun influencer."
            />
            <p className="text-xs text-stone-500 mt-1">
              Se adaugă automat ca participant Instagram. Pentru alți participanți / platforme,
              folosește tab-ul „Participanți” după creare.
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start (T+0)">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              {fieldErrors.start_date && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.start_date}</p>
              )}
            </Field>
            <Field label="Final">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              {fieldErrors.end_date && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.end_date}</p>
              )}
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
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={submitMode !== null} className={btnSecondary}>
              Anulează
            </button>
            <button
              type="button"
              onClick={() => submit('draft')}
              disabled={submitMode !== null}
              className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-60"
            >
              {submitMode === 'draft' ? '...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => submit('active')}
              disabled={submitMode !== null}
              className={btnPrimary}
            >
              {submitMode === 'active' ? '...' : 'Create & Activate'}
            </button>
          </div>
        </form>
      </div>
      {brandModal.open && (
        <InlineBrandModal
          initialName={brandModal.name}
          onCancel={() => {
            brandModal.resolve?.(null)
            setBrandModal({ open: false, name: '', resolve: null })
          }}
          onCreated={(brand) => {
            setBrandList((prev) => [...prev, brand])
            brandModal.resolve?.({ id: brand.id, label: brand.name })
            setBrandModal({ open: false, name: '', resolve: null })
          }}
        />
      )}
    </div>
  )
}

function InlineBrandModal({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string
  onCancel: () => void
  onCreated: (brand: { id: string; name: string }) => void
}) {
  const [name, setName] = useState(initialName)
  const [company, setCompany] = useState('')
  const [industry, setIndustry] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nume brand obligatoriu')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        company: company.trim() || null,
        industry: industry.trim() || null,
        contact_person: contactPerson.trim() || null,
        contact_email: contactEmail.trim() || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      brand?: { id: string; name: string }
    }
    setBusy(false)
    if (res.ok && data.brand) {
      onCreated({ id: data.brand.id, name: data.brand.name })
      return
    }
    setError(data.error === 'invalid_email' ? 'Email contact invalid' : 'Eroare server')
  }

  // Nested modal — sits above the campaign-new dialog. Higher z-index +
  // own backdrop so Esc/click-out only dismisses this one.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg text-stone-900 mb-4">Brand nou</h3>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nume brand *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Companie / client">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputCls}
                placeholder="ex: Coca-Cola Romania"
              />
            </Field>
            <Field label="Industrie">
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={inputCls}
                placeholder="ex: FMCG"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Persoană contact">
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Email contact">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className={btnSecondary}>Anulează</button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? '...' : 'Crează brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
