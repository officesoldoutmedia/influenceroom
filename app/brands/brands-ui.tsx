'use client'

import { useState } from 'react'

export type BrandStatus = 'active' | 'inactive'

export type Brand = {
  id: string
  name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  logo_url: string | null
  notes: string | null
  billing_data: { notes?: string } | null
  status: BrandStatus
  created_at: string
}

type Role = 'owner' | 'manager' | 'account' | 'intern'

const STATUS_BADGE: Record<BrandStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-stone-200 text-stone-600',
}

type ApiResp = { ok?: boolean; error?: string; brand?: Brand }

function initial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?'
}

export function BrandsUI({ initialBrands, role }: { initialBrands: Brand[]; role: Role }) {
  const [brands, setBrands] = useState<Brand[]>(initialBrands)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const canWrite = role === 'owner' || role === 'manager' || role === 'account'

  function upsert(brand: Brand) {
    setBrands((prev) => {
      const idx = prev.findIndex((b) => b.id === brand.id)
      if (idx === -1) return [brand, ...prev]
      const next = [...prev]
      next[idx] = brand
      return next
    })
  }

  async function toggleStatus(b: Brand) {
    const target: BrandStatus = b.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/brands/${b.id}`, {
      method: target === 'inactive' ? 'DELETE' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: target === 'inactive' ? undefined : JSON.stringify({ status: 'active' }),
    })
    if (res.ok) {
      upsert({ ...b, status: target })
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${data.error ?? res.status}`)
    }
  }

  if (brands.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <p className="text-stone-500 text-sm mb-4">Niciun brand încă.</p>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800"
          >
            + Adaugă brand
          </button>
        )}
        {showAdd && (
          <AddModal onClose={() => setShowAdd(false)} onCreated={(b) => { upsert(b); setShowAdd(false) }} />
        )}
      </div>
    )
  }

  return (
    <>
      {canWrite && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800"
          >
            + Adaugă brand
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-left text-stone-500">
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Campaigns</th>
              {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {brands.map((b) => (
              <tr key={b.id} className={b.status === 'active' ? '' : 'opacity-60'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center text-sm font-semibold overflow-hidden">
                      {b.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initial(b.name)
                      )}
                    </div>
                    <span className="font-medium text-stone-900">{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {b.contact_person && <div>{b.contact_person}</div>}
                  {b.contact_email && <div className="text-xs text-stone-500">{b.contact_email}</div>}
                  {!b.contact_person && !b.contact_email && <span className="text-stone-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status]}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-600">0</td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        className="px-3 py-1 rounded text-xs bg-stone-100 hover:bg-stone-200 text-stone-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(b)}
                        className="px-3 py-1 rounded text-xs bg-stone-100 hover:bg-stone-200 text-stone-700"
                      >
                        {b.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onCreated={(b) => { upsert(b); setShowAdd(false) }} />
      )}

      {editing && (
        <EditModal
          brand={editing}
          onClose={() => setEditing(null)}
          onUpdated={(b) => { upsert(b); setEditing(null) }}
        />
      )}
    </>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const textareaCls = `${inputCls} min-h-[60px]`
const btnPrimary =
  'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
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

function ErrorMap(code: string): string {
  return ({
    missing_name: 'Numele e obligatoriu',
    invalid_name: 'Nume invalid',
    invalid_email: 'Email invalid',
    invalid_status: 'Status invalid',
    not_found: 'Brand inexistent',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}

type FormState = {
  name: string
  contact_person: string
  contact_email: string
  contact_phone: string
  logo_url: string
  billing_notes: string
  notes: string
}

function emptyForm(): FormState {
  return {
    name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    logo_url: '',
    billing_notes: '',
    notes: '',
  }
}

function brandToForm(b: Brand): FormState {
  return {
    name: b.name,
    contact_person: b.contact_person ?? '',
    contact_email: b.contact_email ?? '',
    contact_phone: b.contact_phone ?? '',
    logo_url: b.logo_url ?? '',
    billing_notes: b.billing_data?.notes ?? '',
    notes: b.notes ?? '',
  }
}

function BrandFields({ form, set }: { form: FormState; set: (f: FormState) => void }) {
  return (
    <>
      <Field label="Name *">
        <input value={form.name} onChange={(e) => set({ ...form, name: e.target.value })} required className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact person">
          <input value={form.contact_person} onChange={(e) => set({ ...form, contact_person: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Contact email">
          <input type="email" value={form.contact_email} onChange={(e) => set({ ...form, contact_email: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact phone">
          <input value={form.contact_phone} onChange={(e) => set({ ...form, contact_phone: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Logo URL">
          <input value={form.logo_url} onChange={(e) => set({ ...form, logo_url: e.target.value })} className={inputCls} placeholder="https://..." />
        </Field>
      </div>
      <Field label="Detalii facturare">
        <textarea value={form.billing_notes} onChange={(e) => set({ ...form, billing_notes: e.target.value })} className={textareaCls} placeholder="Entitate, CUI, IBAN, adresă..." />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => set({ ...form, notes: e.target.value })} className={textareaCls} />
      </Field>
    </>
  )
}

function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Brand) => void }) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.brand) onCreated(data.brand)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Adaugă brand</h2>
      <form onSubmit={submit} className="space-y-3">
        <BrandFields form={form} set={setForm} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Create'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditModal({
  brand,
  onClose,
  onUpdated,
}: {
  brand: Brand
  onClose: () => void
  onUpdated: (b: Brand) => void
}) {
  const [form, setForm] = useState<FormState>(brandToForm(brand))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.brand) onUpdated(data.brand)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit {brand.name}</h2>
      <form onSubmit={submit} className="space-y-3">
        <BrandFields form={form} set={setForm} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Save'}</button>
        </div>
      </form>
    </ModalShell>
  )
}
