'use client'

import { useState } from 'react'
import { Avatar } from '@/lib/ui'

export type Role = 'owner' | 'manager' | 'account' | 'intern'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: Role
  avatar_url: string | null
  active: boolean
  created_at: string
}

const ROLES: Role[] = ['owner', 'manager', 'account', 'intern']

type ApiResp = { ok?: boolean; error?: string; member?: TeamMember }

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-brand-100 text-brand-800',
  manager: 'bg-blue-100 text-blue-700',
  account: 'bg-cyan-100 text-cyan-700',
  intern: 'bg-stone-200 text-stone-700',
}

type Props = {
  initialMembers: TeamMember[]
  currentUserId: string
}

export function TeamUI({ initialMembers, currentUserId }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [resetting, setResetting] = useState<TeamMember | null>(null)

  function upsert(member: TeamMember) {
    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.id === member.id)
      if (idx === -1) return [member, ...prev]
      const next = [...prev]
      next[idx] = member
      return next
    })
  }

  async function toggleActive(m: TeamMember) {
    if (m.id === currentUserId) return
    const res = await fetch(`/api/admin/team/${m.id}`, {
      method: m.active ? 'DELETE' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: m.active ? undefined : JSON.stringify({ active: true }),
    })
    if (res.ok) {
      upsert({ ...m, active: !m.active })
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${data.error ?? res.status}`)
    }
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800"
        >
          + Adaugă membru
        </button>
      </div>

      {/* Mobile: cards */}
      <ul className="md:hidden space-y-2">
        {members.map((m) => (
          <li key={m.id} className={m.active ? '' : 'opacity-50'}>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Avatar name={m.name} src={m.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-900 truncate">{m.name}</span>
                    {m.id === currentUserId && (
                      <span className="text-[10px] uppercase tracking-[0.06em] text-stone-400">tu</span>
                    )}
                  </div>
                  <div className="text-[12px] text-stone-500 truncate mt-0.5">{m.email}</div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-[0.06em] font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[m.role]}`}>
                      {m.role}
                    </span>
                    <span className={`text-[11px] font-medium ${m.active ? 'text-emerald-700' : 'text-stone-400'}`}>
                      {m.active ? '● activ' : '○ inactiv'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(m)}
                  className="px-3 py-2 rounded-md text-[13px] bg-stone-100 hover:bg-stone-200 text-stone-700"
                >
                  Editează
                </button>
                <button
                  type="button"
                  onClick={() => setResetting(m)}
                  className="px-3 py-2 rounded-md text-[13px] bg-stone-100 hover:bg-stone-200 text-stone-700"
                >
                  Resetează PIN
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(m)}
                  disabled={m.id === currentUserId}
                  className="px-3 py-2 rounded-md text-[13px] bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={m.id === currentUserId ? 'Nu te poți dezactiva pe tine' : ''}
                >
                  {m.active ? 'Dezactivează' : 'Activează'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
              <th className="px-4 py-3">Nume</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members.map((m) => (
              <tr key={m.id} className={`hover:bg-stone-50 transition-colors ${m.active ? '' : 'opacity-50'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatar_url} size="sm" />
                    <span className="font-medium text-stone-900">{m.name}</span>
                    {m.id === currentUserId && (
                      <span className="text-[10px] uppercase tracking-[0.06em] text-stone-400">tu</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-stone-600">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-[0.06em] font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[m.role]}`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${m.active ? 'text-emerald-700' : 'text-stone-400'}`}>
                    {m.active ? '● activ' : '○ inactiv'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      className="px-3 py-1.5 rounded-md text-xs bg-stone-100 hover:bg-stone-200 text-stone-700"
                    >
                      Editează
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetting(m)}
                      className="px-3 py-1.5 rounded-md text-xs bg-stone-100 hover:bg-stone-200 text-stone-700"
                    >
                      Resetează PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(m)}
                      disabled={m.id === currentUserId}
                      className="px-3 py-1.5 rounded-md text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={m.id === currentUserId ? 'Nu te poți dezactiva pe tine' : ''}
                    >
                      {m.active ? 'Dezactivează' : 'Activează'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onCreated={(m) => {
            upsert(m)
            setShowAdd(false)
          }}
        />
      )}

      {editing && (
        <EditModal
          member={editing}
          onClose={() => setEditing(null)}
          onUpdated={(m) => {
            upsert(m)
            setEditing(null)
          }}
        />
      )}

      {resetting && (
        <ResetPinModal
          member={resetting}
          onClose={() => setResetting(null)}
          onDone={() => setResetting(null)}
        />
      )}
    </>
  )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ErrorMap(code: string): string {
  return {
    invalid_email: 'Email invalid',
    invalid_pin: 'PIN invalid (4 cifre)',
    invalid_role: 'Rol invalid',
    invalid_name: 'Nume invalid',
    missing_fields: 'Toate câmpurile sunt obligatorii',
    email_exists: 'Email deja folosit',
    cannot_delete_self: 'Nu te poți dezactiva pe tine',
    not_found: 'Membru inexistent',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  }[code] ?? code
}

function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: TeamMember) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('account')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, role, pin }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.member) onCreated(data.member)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Adaugă membru</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Initial PIN (4 cifre)">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
            className={inputCls}
          />
        </Field>
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
  member,
  onClose,
  onUpdated,
}: {
  member: TeamMember
  onClose: () => void
  onUpdated: (m: TeamMember) => void
}) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [role, setRole] = useState<Role>(member.role)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, role }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok && data.member) onUpdated(data.member)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit {member.name}</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
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

function ResetPinModal({
  member,
  onClose,
  onDone,
}: {
  member: TeamMember
  onClose: () => void
  onDone: () => void
}) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm) {
      setConfirm(true)
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/team/${member.id}/reset-pin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp
    setBusy(false)
    if (res.ok) onDone()
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Reset PIN — {member.name}</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="New PIN (4 cifre)">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
              setConfirm(false)
            }}
            required
            className={inputCls}
          />
        </Field>
        {confirm && (
          <p className="text-sm text-amber-700">
            Sigur? PIN-ul actual va fi înlocuit cu <code>{pin}</code>. Click &quot;Confirm&quot; încă o dată.
          </p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy || pin.length !== 4} className={btnPrimary}>
            {busy ? '...' : confirm ? 'Confirm' : 'Reset PIN'}
          </button>
        </div>
      </form>
    </ModalShell>
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

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const btnPrimary =
  'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'
