'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Influencer, ManagerSummary } from '@/lib/influencers/types'
import {
  influencerToForm,
  formToPayload,
  InfluencerFormFields,
  type FormValues,
} from '../influencer-form'

type ApiResp = { ok?: boolean; error?: string; influencer?: Influencer }

const btnPrimary =
  'px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'
const btnDanger =
  'px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-60'

function ErrorMap(code: string): string {
  return ({
    missing_name: 'Numele e obligatoriu',
    invalid_tier: 'Tier invalid',
    invalid_status: 'Status invalid',
    invalid_email: 'Email contact invalid',
    invalid_agent_email: 'Email agent invalid',
    not_found: 'Influencer inexistent',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}

export function DetailUI({ influencer, managers }: { influencer: Influencer; managers: ManagerSummary[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function softDelete() {
    if (!confirm(`Dezactivezi ${influencer.name}? (status → inactive)`)) return
    setDeleting(true)
    const res = await fetch(`/api/influencers/${influencer.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }

  return (
    <div className="flex gap-2">
      {influencer.status === 'active' && (
        <button type="button" onClick={softDelete} disabled={deleting} className={btnDanger}>
          {deleting ? '...' : 'Deactivate'}
        </button>
      )}
      <button type="button" onClick={() => setEditing(true)} className={btnPrimary}>
        Edit
      </button>
      {editing && (
        <EditModal
          influencer={influencer}
          managers={managers}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function EditModal({
  influencer,
  managers,
  onClose,
  onSaved,
}: {
  influencer: Influencer
  managers: ManagerSummary[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormValues>(influencerToForm(influencer))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/influencers/${influencer.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok) onSaved()
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-stone-900 mb-2">Edit {influencer.name}</h2>
        <form onSubmit={submit}>
          <InfluencerFormFields form={form} set={setForm} managers={managers} />
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
