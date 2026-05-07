'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export type Rule = {
  id: string
  event: string
  enabled: boolean
  config: Record<string, unknown>
  updated_at: string
}

export type NotificationRow = {
  id: string
  type: string
  recipient_email: string
  subject: string
  status: 'queued' | 'sent' | 'failed'
  retry_count: number
  error: string | null
  sent_at: string | null
  resend_message_id: string | null
  created_at: string
  recipient: { id: string; name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-stone-200 text-stone-700',
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
}

const TEMPLATES = [
  'task_assigned',
  'task_status_changed',
  'deadline_reminder',
  'daily_digest',
  'campaign_started',
] as const

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
const textareaCls = `${inputCls} min-h-[120px] font-mono text-xs`
const btnPrimary =
  'px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60'
const btnSecondary =
  'px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200'

type ApiRule = { ok?: boolean; error?: string; rule?: Rule }
type ApiNotif = { ok?: boolean; error?: string; notification?: NotificationRow }

export function NotificationsUI({
  initialRules,
  initialNotifications,
  initialFilterStatus,
}: {
  initialRules: Rule[]
  initialNotifications: NotificationRow[]
  initialFilterStatus: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [notifs, setNotifs] = useState<NotificationRow[]>(initialNotifications)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [detail, setDetail] = useState<NotificationRow | null>(null)

  async function toggleRule(rule: Rule) {
    const prev = rule.enabled
    setRules((all) => all.map((r) => (r.id === rule.id ? { ...r, enabled: !prev } : r)))
    const res = await fetch(`/api/admin/notifications/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !prev }),
    })
    if (!res.ok) {
      setRules((all) => all.map((r) => (r.id === rule.id ? { ...r, enabled: prev } : r)))
      const data = (await res.json().catch(() => ({}))) as ApiRule
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  async function sendTest(template: string) {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template }),
    })
    if (res.ok) {
      router.refresh()
      alert(`Test "${template}" enqueued. Apasă Run worker pentru a-l trimite.`)
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  async function runWorker() {
    const secret = prompt('CRON_SECRET (din .env.local — local only):')
    if (!secret) return
    const res = await fetch('/api/cron/process-queue', {
      method: 'POST',
      headers: { 'x-cron-secret': secret },
    })
    if (res.ok) {
      const data = (await res.json()) as { processed?: number; sent?: number; failed?: number; queued_remaining?: number }
      alert(
        `Processed: ${data.processed}, sent: ${data.sent}, failed: ${data.failed}, queued remaining: ${data.queued_remaining}`,
      )
      router.refresh()
    } else {
      alert(`Eroare ${res.status}: ${await res.text()}`)
    }
  }

  async function resendFailed(n: NotificationRow) {
    const res = await fetch(`/api/admin/notifications/${n.id}/resend`, { method: 'POST' })
    if (res.ok) {
      setNotifs((all) => all.map((x) => (x.id === n.id ? { ...x, status: 'queued', retry_count: 0 } : x)))
      setDetail(null)
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiNotif
      alert(`Eroare: ${data.error ?? 'server_error'}`)
    }
  }

  function setStatusFilter(s: string | null) {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <>
      {/* Rules */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
        <header className="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Notification rules</h2>
          <div className="flex gap-2 items-center">
            <select
              onChange={(e) => { if (e.target.value) sendTest(e.target.value); e.target.value = '' }}
              className="text-xs border border-stone-300 rounded-lg px-2 py-1 bg-white"
              defaultValue=""
            >
              <option value="">Send test…</option>
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button type="button" onClick={runWorker} className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              Run worker now
            </button>
          </div>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="text-left text-stone-500">
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Enabled</th>
              <th className="px-4 py-2 font-medium">Config</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-stone-900">{r.event}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleRule(r)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${r.enabled ? 'bg-emerald-500' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${r.enabled ? 'translate-x-4' : ''}`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-stone-600 font-mono max-w-md truncate">
                  {Object.keys(r.config ?? {}).length === 0 ? '—' : JSON.stringify(r.config)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setEditingRule(r)} className="text-xs px-3 py-1 rounded bg-stone-100 hover:bg-stone-200">
                    Edit config
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Recent notifications */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <header className="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Recent notifications</h2>
          <div className="flex gap-1">
            {(['', 'queued', 'sent', 'failed'] as const).map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setStatusFilter(s || null)}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  (initialFilterStatus ?? '') === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-stone-300 text-stone-600 hover:border-stone-500'
                }`}
              >
                {s || 'all'}
              </button>
            ))}
          </div>
        </header>
        {notifs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-stone-400 text-center">Niciun notification.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-left text-stone-500">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Recipient</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {notifs.map((n) => (
                <tr key={n.id} onClick={() => setDetail(n)} className="cursor-pointer hover:bg-stone-50">
                  <td className="px-4 py-2 text-xs text-stone-500 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2 text-xs text-stone-600">{n.type}</td>
                  <td className="px-4 py-2 text-xs text-stone-600">
                    {n.recipient?.name ?? '—'} <span className="text-stone-400">{n.recipient_email}</span>
                  </td>
                  <td className="px-4 py-2 text-stone-900 max-w-xs truncate">{n.subject}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[n.status]}`}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={(updated) => {
            setRules((all) => all.map((r) => (r.id === updated.id ? updated : r)))
            setEditingRule(null)
          }}
        />
      )}

      {detail && (
        <DetailModal
          row={detail}
          onClose={() => setDetail(null)}
          onResend={resendFailed}
        />
      )}
    </>
  )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function EditRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: Rule
  onClose: () => void
  onSaved: (r: Rule) => void
}) {
  const [json, setJson] = useState(JSON.stringify(rule.config ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      setError(`JSON invalid: ${(err as Error).message}`)
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError('Config trebuie să fie un object JSON')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/admin/notifications/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: parsed }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiRule
    setBusy(false)
    if (res.ok && data.rule) onSaved(data.rule)
    else setError(data.error ?? 'server_error')
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit config — {rule.event}</h2>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          className={textareaCls}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Save'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function DetailModal({
  row,
  onClose,
  onResend,
}: {
  row: NotificationRow
  onClose: () => void
  onResend: (n: NotificationRow) => void
}) {
  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold text-stone-900 mb-1">{row.subject}</h2>
      <p className="text-xs text-stone-500 mb-4">
        {row.type} · {row.recipient?.name ?? '—'} · {row.recipient_email}
      </p>
      <dl className="text-xs space-y-1 mb-4">
        <div className="flex gap-2"><dt className="text-stone-500 w-32">Status:</dt><dd>{row.status}</dd></div>
        <div className="flex gap-2"><dt className="text-stone-500 w-32">Created:</dt><dd>{new Date(row.created_at).toLocaleString('ro-RO')}</dd></div>
        {row.sent_at && <div className="flex gap-2"><dt className="text-stone-500 w-32">Sent at:</dt><dd>{new Date(row.sent_at).toLocaleString('ro-RO')}</dd></div>}
        {row.resend_message_id !== null && <div className="flex gap-2"><dt className="text-stone-500 w-32">Resend ID:</dt><dd>{row.resend_message_id}</dd></div>}
        {row.resend_message_id === null && row.status === 'sent' && (
          <div className="flex gap-2"><dt className="text-stone-500 w-32">Resend ID:</dt><dd className="text-amber-700">— (simulated, no Resend key)</dd></div>
        )}
        <div className="flex gap-2"><dt className="text-stone-500 w-32">Retries:</dt><dd>{row.retry_count}</dd></div>
        {row.error && <div className="flex gap-2"><dt className="text-stone-500 w-32">Error:</dt><dd className="text-rose-600">{row.error}</dd></div>}
      </dl>

      <div className="flex justify-end gap-2 pt-2">
        {row.status === 'failed' && (
          <button type="button" onClick={() => onResend(row)} className={btnPrimary}>
            Retry (re-queue)
          </button>
        )}
        <button type="button" onClick={onClose} className={btnSecondary}>Close</button>
      </div>
    </ModalShell>
  )
}
