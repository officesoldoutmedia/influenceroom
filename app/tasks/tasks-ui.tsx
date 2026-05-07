'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TASK_STATUSES, type TaskStatus, type TaskPriority } from '@/lib/campaigns/types'

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-stone-200 text-stone-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-amber-100 text-amber-800',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-stone-100 text-stone-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-rose-100 text-rose-700',
}

export type TaskWithCampaign = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  campaign_id: string
  assignee_id: string | null
  campaign: { id: string; name: string } | null
  assignee: { id: string; name: string } | null
}

type Bucket = 'overdue' | 'today' | 'this_week' | 'later'

function bucketFor(due: string | null): Bucket {
  if (!due) return 'later'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'this_week'
  return 'later'
}

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This week',
  later: 'Later',
}

export function TasksUI({
  initialItems,
  currentUserId,
  role,
}: {
  initialItems: TaskWithCampaign[]
  currentUserId: string
  role: string
}) {
  const [items, setItems] = useState<TaskWithCampaign[]>(initialItems)

  async function patchStatus(id: string, next: TaskStatus) {
    const prev = items.find((t) => t.id === id)
    if (!prev) return
    setItems((all) => all.map((t) => (t.id === id ? { ...t, status: next } : t)))
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) {
      setItems((all) => all.map((t) => (t.id === id ? prev : t)))
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'server_error'}`)
      return
    }
    // If marked done/cancelled, remove from active list
    if (next === 'done') {
      setItems((all) => all.filter((t) => t.id !== id))
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <p className="text-stone-500 text-sm">Niciun task activ. 🎉</p>
      </div>
    )
  }

  const grouped = new Map<Bucket, TaskWithCampaign[]>()
  for (const t of items) {
    const b = bucketFor(t.due_date)
    const arr = grouped.get(b) ?? []
    arr.push(t)
    grouped.set(b, arr)
  }

  const order: Bucket[] = ['overdue', 'today', 'this_week', 'later']

  return (
    <div className="space-y-5">
      {order.map((b) => {
        const list = grouped.get(b) ?? []
        if (list.length === 0) return null
        return (
          <section key={b} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <header className="bg-stone-50 px-4 py-2 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900">{BUCKET_LABELS[b]}</h2>
              <span className="text-xs text-stone-500">{list.length} task{list.length === 1 ? '' : 's'}</span>
            </header>
            <ul className="divide-y divide-stone-100">
              {list.map((t) => {
                const canPatch =
                  role === 'owner' || role === 'manager' || role === 'account' || t.assignee_id === currentUserId
                return (
                  <li key={t.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <select
                      value={t.status}
                      disabled={!canPatch}
                      onChange={(e) => patchStatus(t.id, e.target.value as TaskStatus)}
                      className={`text-[10px] uppercase tracking-wide font-medium px-2 py-1 rounded-full border-0 ${STATUS_BADGE[t.status]} disabled:opacity-50`}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                    <div className="flex-1 min-w-0">
                      <div className="text-stone-900 truncate">{t.title}</div>
                      {t.campaign && (
                        <Link href={`/campaigns/${t.campaign.id}`} className="text-xs text-stone-500 hover:text-brand-800">
                          {t.campaign.name}
                        </Link>
                      )}
                    </div>
                    {t.assignee && t.assignee.id !== currentUserId && (
                      <span className="text-xs text-stone-500">{t.assignee.name}</span>
                    )}
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority]}`}>
                      {t.priority}
                    </span>
                    <span className={`text-xs w-24 text-right ${b === 'overdue' ? 'text-rose-600 font-medium' : 'text-stone-500'}`}>
                      {t.due_date ?? '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
