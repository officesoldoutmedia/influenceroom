'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CAMPAIGN_STATUSES, type CampaignStatus, type CampaignWithJoins } from '@/lib/campaigns/types'

export type SimpleBrand = { id: string; name: string }
export type SimpleMember = { id: string; name: string; role: string }

type Role = 'owner' | 'manager' | 'account' | 'intern'

type ApiResp = { ok?: boolean; error?: string; campaign?: CampaignWithJoins }

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary = 'px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs hover:bg-brand-800 disabled:opacity-60'
const btnDanger = 'px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-60'

function ErrorMap(code: string): string {
  return ({
    invalid_name: 'Nume invalid',
    invalid_status: 'Status invalid',
    forbidden: 'Acces interzis',
    not_found: 'Campaign inexistent',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}

export function CampaignDetailUI({
  campaign,
  brands,
  members,
  currentUserId,
  role,
}: {
  campaign: CampaignWithJoins
  brands: SimpleBrand[]
  members: SimpleMember[]
  currentUserId: string
  role: Role
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function changeStatus(next: CampaignStatus) {
    if (next === campaign.status) return
    setStatusBusy(true)
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setStatusBusy(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }

  async function softCancel() {
    if (!confirm(`Anulezi campaign "${campaign.name}"? (status → cancelled)`)) return
    setCancelling(true)
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
    setCancelling(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={campaign.status}
        onChange={(e) => changeStatus(e.target.value as CampaignStatus)}
        disabled={statusBusy}
        className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white"
      >
        {CAMPAIGN_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
      <button type="button" onClick={() => setEditing(true)} className={btnPrimary}>Edit</button>
      {campaign.status !== 'cancelled' && (
        <button type="button" onClick={softCancel} disabled={cancelling} className={btnDanger}>
          {cancelling ? '...' : 'Cancel'}
        </button>
      )}
      {editing && (
        <EditModal
          campaign={campaign}
          brands={brands}
          members={members}
          currentUserId={currentUserId}
          role={role}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function EditModal({
  campaign,
  brands,
  members,
  currentUserId,
  role,
  onClose,
  onSaved,
}: {
  campaign: CampaignWithJoins
  brands: SimpleBrand[]
  members: SimpleMember[]
  currentUserId: string
  role: Role
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(campaign.name)
  const [brandId, setBrandId] = useState(campaign.brand_id)
  const [startDate, setStartDate] = useState(campaign.start_date ?? '')
  const [endDate, setEndDate] = useState(campaign.end_date ?? '')
  const [budget, setBudget] = useState(campaign.total_budget == null ? '' : String(campaign.total_budget))
  const [deliverables, setDeliverables] = useState(campaign.deliverables_count == null ? '' : String(campaign.deliverables_count))
  const [brief, setBrief] = useState(campaign.brief ?? '')
  const [ownerId, setOwnerId] = useState(campaign.owner_id ?? '')
  const [internalNotes, setInternalNotes] = useState(campaign.internal_notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ownerCandidates = role === 'owner' || role === 'manager'
    ? members
    : members.filter((m) => m.id === currentUserId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        brand_id: brandId,
        start_date: startDate || null,
        end_date: endDate || null,
        total_budget: budget === '' ? null : Number(budget),
        deliverables_count: deliverables === '' ? null : Number(deliverables),
        brief: brief || null,
        owner_id: ownerId || null,
        internal_notes: internalNotes || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok) onSaved()
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit {campaign.name}</h2>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Brand">
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date (T+0)">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="End date">
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
              <option value="">— none —</option>
              {ownerCandidates.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </Field>
          <Field label="Internal notes">
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className={textareaCls} />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60">{busy ? '...' : 'Save'}</button>
          </div>
        </form>
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
