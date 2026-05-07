'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export type MemberOption = { id: string; name: string; role: string }

export type BroadcastRow = {
  id: string
  sender_name: string
  subject: string
  body: string
  recipient_count: number
  methods: string[]
  email_success: number
  email_fail: number
  push_success: number
  push_fail: number
  created_at: string
}

const ALL_ROLES = ['owner', 'manager', 'account', 'intern'] as const
type Role = (typeof ALL_ROLES)[number]
const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  account: 'Account',
  intern: 'Intern',
}

type FilterMode = 'all' | 'roles' | 'users'

const ERROR_MAP: Record<string, string> = {
  invalid_subject: 'Subiectul trebuie să aibă între 2 și 200 caractere.',
  invalid_body_text: 'Mesajul trebuie să aibă între 2 și 2000 caractere.',
  invalid_recipient_filter: 'Selectează cel puțin un destinatar.',
  invalid_methods: 'Selectează cel puțin o metodă (Email sau Push).',
  forbidden: 'Doar owner poate trimite broadcasturi.',
  server_error: 'Eroare server. Încearcă din nou.',
}

export function BroadcastUI({
  members,
  history,
}: {
  members: MemberOption[]
  history: BroadcastRow[]
}) {
  return (
    <div className="space-y-4">
      <ComposeCard members={members} />
      <HistoryCard rows={history} />
    </div>
  )
}

function ComposeCard({ members }: { members: MemberOption[] }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<FilterMode>('all')
  const [roles, setRoles] = useState<Set<Role>>(new Set(['account']))
  const [userIds, setUserIds] = useState<Set<string>>(new Set())
  const [methods, setMethods] = useState<Set<'email' | 'push'>>(new Set(['email', 'push']))
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const router = useRouter()

  const recipientCount = useMemo(() => {
    if (mode === 'all') return members.length
    if (mode === 'roles') return members.filter((m) => roles.has(m.role as Role)).length
    return userIds.size
  }, [mode, members, roles, userIds])

  const methodsLabel = useMemo(() => {
    const arr: string[] = []
    if (methods.has('email')) arr.push('Email')
    if (methods.has('push')) arr.push('Push')
    return arr.join(' + ')
  }, [methods])

  const canSend =
    subject.trim().length >= 2 &&
    body.trim().length >= 2 &&
    recipientCount > 0 &&
    methods.size > 0 &&
    !busy

  function flash(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function send() {
    setBusy(true)
    let filter: object = { type: 'all' }
    if (mode === 'roles') filter = { type: 'roles', roles: Array.from(roles) }
    if (mode === 'users') filter = { type: 'users', user_ids: Array.from(userIds) }

    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: subject.trim(),
        body: body.trim(),
        recipient_filter: filter,
        methods: Array.from(methods),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      result?: {
        recipient_count: number
        email_success: number
        push_success: number
      }
    }
    setBusy(false)
    setConfirming(false)
    if (res.ok && data.ok && data.result) {
      const r = data.result
      flash(
        'ok',
        `Trimis către ${r.recipient_count} ${r.recipient_count === 1 ? 'persoană' : 'persoane'} (email ${r.email_success}, push ${r.push_success})`,
      )
      setSubject('')
      setBody('')
      router.refresh()
    } else {
      flash('err', ERROR_MAP[data.error ?? 'server_error'] ?? ERROR_MAP.server_error)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      {toast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm shadow-lg ${
            toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
        Compune
      </h2>

      <Field label="Subiect">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          className={inputCls}
          placeholder="Titlu scurt..."
        />
      </Field>

      <Field label="Mesaj">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={6}
          className={`${inputCls} resize-y`}
          placeholder="Mesajul către echipă..."
        />
        <div className="text-xs text-stone-400 mt-1 text-right">
          {body.length} / 2000
        </div>
      </Field>

      <div>
        <span className="block text-xs font-medium text-stone-600 mb-2">Destinatari</span>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
            />
            <span>Toți ({members.length})</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'roles'}
              onChange={() => setMode('roles')}
            />
            <span>După rol</span>
          </label>
          {mode === 'roles' && (
            <div className="ml-6 flex flex-wrap gap-3">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={roles.has(r)}
                    onChange={(e) => {
                      const next = new Set(roles)
                      if (e.target.checked) next.add(r)
                      else next.delete(r)
                      setRoles(next)
                    }}
                  />
                  <span>{ROLE_LABEL[r]}</span>
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'users'}
              onChange={() => setMode('users')}
            />
            <span>Persoane specifice</span>
          </label>
          {mode === 'users' && (
            <div className="ml-6 max-h-40 overflow-y-auto border border-stone-200 rounded-lg p-2 space-y-1">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={userIds.has(m.id)}
                    onChange={(e) => {
                      const next = new Set(userIds)
                      if (e.target.checked) next.add(m.id)
                      else next.delete(m.id)
                      setUserIds(next)
                    }}
                  />
                  <span>
                    {m.name}{' '}
                    <span className="text-stone-400 text-xs">· {ROLE_LABEL[m.role as Role] ?? m.role}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-stone-600 mb-2">Metode</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={methods.has('email')}
              onChange={(e) => {
                const next = new Set(methods)
                if (e.target.checked) next.add('email')
                else next.delete('email')
                setMethods(next)
              }}
            />
            <span>Email</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={methods.has('push')}
              onChange={(e) => {
                const next = new Set(methods)
                if (e.target.checked) next.add('push')
                else next.delete('push')
                setMethods(next)
              }}
            />
            <span>Push</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
        <span className="text-sm text-stone-600">
          Va fi trimis către <strong>{recipientCount}</strong>{' '}
          {recipientCount === 1 ? 'persoană' : 'persoane'} via{' '}
          <strong>{methodsLabel || '—'}</strong>
        </span>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!canSend}
          className={btnPrimary}
        >
          Trimite
        </button>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Confirmă</h3>
            <p className="text-sm text-stone-600 mb-4">
              Trimite către <strong>{recipientCount}</strong>{' '}
              {recipientCount === 1 ? 'persoană' : 'persoane'} via{' '}
              <strong>{methodsLabel}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={btnSecondary}
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={send}
                disabled={busy}
                className={btnPrimary}
              >
                {busy ? '...' : 'Trimite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryCard({ rows }: { rows: BroadcastRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-3">
        Istoric (ultimele 20)
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">Niciun broadcast încă.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-stone-500">
            <tr className="text-left border-b border-stone-100">
              <th className="py-2 font-medium">Data</th>
              <th className="py-2 font-medium">Sender</th>
              <th className="py-2 font-medium">Subiect</th>
              <th className="py-2 font-medium text-right">Dest.</th>
              <th className="py-2 font-medium">Met.</th>
              <th className="py-2 font-medium text-right">Email</th>
              <th className="py-2 font-medium text-right">Push</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowItem
                key={r.id}
                row={r}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function RowItem({
  row,
  expanded,
  onToggle,
}: {
  row: BroadcastRow
  expanded: boolean
  onToggle: () => void
}) {
  const date = new Date(row.created_at).toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <>
      <tr
        className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-2 text-stone-600">{date}</td>
        <td className="py-2 text-stone-700">{row.sender_name}</td>
        <td className="py-2 text-stone-900 truncate max-w-[260px]">{row.subject}</td>
        <td className="py-2 text-stone-600 text-right">{row.recipient_count}</td>
        <td className="py-2 text-stone-600">{row.methods.join('+')}</td>
        <td className="py-2 text-right">
          <span className="text-emerald-600">{row.email_success}</span>
          {row.email_fail > 0 && (
            <span className="text-rose-600"> / {row.email_fail}</span>
          )}
        </td>
        <td className="py-2 text-right">
          <span className="text-emerald-600">{row.push_success}</span>
          {row.push_fail > 0 && (
            <span className="text-rose-600"> / {row.push_fail}</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-stone-50">
          <td colSpan={7} className="px-3 py-3 text-stone-700 whitespace-pre-wrap text-sm">
            {row.body}
          </td>
        </tr>
      )}
    </>
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
