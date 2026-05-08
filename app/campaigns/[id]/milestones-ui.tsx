'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MILESTONE_TYPES,
  MILESTONE_TYPE_LABEL,
  MILESTONE_RESPONSIBLES,
  MILESTONE_RESPONSIBLE_LABEL,
  type CampaignMilestone,
  type MilestoneType,
  type MilestoneResponsible,
} from '@/lib/campaigns/types'
import { Button, EmptyState } from '@/lib/ui'

export function MilestonesUI({
  campaignId,
  initialItems,
  canEdit,
}: {
  campaignId: string
  initialItems: CampaignMilestone[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<CampaignMilestone[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CampaignMilestone | null>(null)

  const pending = items
    .filter((m) => !m.completed_at)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const done = items
    .filter((m) => m.completed_at)
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

  function upsert(it: CampaignMilestone) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === it.id)
      if (idx === -1) return [...prev, it]
      const next = [...prev]
      next[idx] = it
      return next
    })
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  async function toggleComplete(m: CampaignMilestone, completed: boolean) {
    const res = await fetch(`/api/campaigns/${campaignId}/milestones/${m.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed_at: completed ? new Date().toISOString() : null }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; item?: CampaignMilestone }
    if (res.ok && data.item) {
      upsert(data.item)
      router.refresh()
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Etape</h2>
          <p className="text-xs text-stone-500 mt-1">
            {pending.length} în așteptare · {done.length} finalizate
          </p>
        </div>
        {canEdit && (
          <Button type="button" variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            + Adaugă etapă
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nicio etapă încă"
          description={canEdit ? 'Adaugă primul checkpoint (brief trimis, materiale aprobate, etc).' : 'Nu există etape definite.'}
          action={canEdit ? (
            <Button type="button" variant="primary" onClick={() => setShowAdd(true)}>+ Adaugă etapă</Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <Section title="În așteptare">
              {pending.map((m) => (
                <MilestoneRow
                  key={m.id}
                  m={m}
                  canEdit={canEdit}
                  onToggle={(c) => toggleComplete(m, c)}
                  onClick={() => setEditing(m)}
                />
              ))}
            </Section>
          )}
          {done.length > 0 && (
            <Section title="Finalizate">
              {done.map((m) => (
                <MilestoneRow
                  key={m.id}
                  m={m}
                  canEdit={canEdit}
                  onToggle={(c) => toggleComplete(m, c)}
                  onClick={() => setEditing(m)}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      {showAdd && (
        <MilestoneModal
          campaignId={campaignId}
          onClose={() => setShowAdd(false)}
          onSaved={(it) => {
            upsert(it)
            setShowAdd(false)
            router.refresh()
          }}
        />
      )}
      {editing && (
        <MilestoneModal
          campaignId={campaignId}
          milestone={editing}
          onClose={() => setEditing(null)}
          onSaved={(it) => {
            upsert(it)
            setEditing(null)
            router.refresh()
          }}
          onDeleted={(id) => {
            remove(id)
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-2">
        {title}
      </div>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function MilestoneRow({
  m,
  canEdit,
  onToggle,
  onClick,
}: {
  m: CampaignMilestone
  canEdit: boolean
  onToggle: (completed: boolean) => void
  onClick: () => void
}) {
  const isDone = !!m.completed_at
  const today = new Date().toISOString().slice(0, 10)
  const overdue = !isDone && m.due_date < today
  const daysFromNow = !isDone ? daysBetween(today, m.due_date) : null

  const label = m.type === 'other' ? (m.name ?? '—') : MILESTONE_TYPE_LABEL[m.type]
  const responsibleLabel = m.responsible === 'other'
    ? (m.responsible_name ?? '—')
    : MILESTONE_RESPONSIBLE_LABEL[m.responsible]

  return (
    <li
      className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-colors ${
        overdue ? 'border-rose-200' : 'border-stone-200'
      }`}
    >
      <input
        type="checkbox"
        checked={isDone}
        disabled={!canEdit}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-5 h-5 cursor-pointer accent-brand-700"
        aria-label={isDone ? 'Marchează ca neterminat' : 'Marchează ca finalizat'}
      />
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className={`text-sm font-medium truncate ${isDone ? 'line-through text-stone-500' : 'text-stone-900'}`}>
          {label}
        </div>
        <div className="text-[12px] text-stone-500 mt-0.5">
          <span className="tabular-nums">{m.due_date}</span>
          {daysFromNow != null && (
            <span className={overdue ? 'text-rose-600 ml-1.5' : 'text-stone-500 ml-1.5'}>
              {overdue
                ? `(restant ${Math.abs(daysFromNow)} zile)`
                : daysFromNow === 0
                  ? '(astăzi)'
                  : `(în ${daysFromNow} zile)`}
            </span>
          )}
          {' · '}
          {responsibleLabel}
        </div>
      </button>
    </li>
  )
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').valueOf()
  const b = new Date(toIso + 'T00:00:00Z').valueOf()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function MilestoneModal({
  campaignId,
  milestone,
  onClose,
  onSaved,
  onDeleted,
}: {
  campaignId: string
  milestone?: CampaignMilestone
  onClose: () => void
  onSaved: (it: CampaignMilestone) => void
  onDeleted?: (id: string) => void
}) {
  const isEdit = !!milestone

  const [type, setType] = useState<MilestoneType>(milestone?.type ?? 'brief_sent')
  const [name, setName] = useState(milestone?.name ?? '')
  const [dueDate, setDueDate] = useState(milestone?.due_date ?? '')
  const [responsible, setResponsible] = useState<MilestoneResponsible>(milestone?.responsible ?? 'account_manager')
  const [responsibleName, setResponsibleName] = useState(milestone?.responsible_name ?? '')
  const [notes, setNotes] = useState(milestone?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!dueDate) {
      setError('Data limită obligatorie')
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      type,
      name: type === 'other' ? name : null,
      due_date: dueDate,
      responsible,
      responsible_name: responsible === 'other' ? responsibleName : null,
      notes: notes || null,
    }
    const url = isEdit
      ? `/api/campaigns/${campaignId}/milestones/${milestone!.id}`
      : `/api/campaigns/${campaignId}/milestones`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      item?: CampaignMilestone
    }
    setBusy(false)
    if (res.ok && data.item) onSaved(data.item)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  async function destroy() {
    if (!milestone || !onDeleted) return
    if (!confirm('Sigur ștergi această etapă?')) return
    setBusy(true)
    const res = await fetch(`/api/campaigns/${campaignId}/milestones/${milestone.id}`, {
      method: 'DELETE',
    })
    setBusy(false)
    if (res.ok) onDeleted(milestone.id)
    else setError('Eroare la ștergere')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-stone-900 mb-4">
          {isEdit ? 'Editează etapă' : 'Adaugă etapă'}
        </h2>
        <div className="space-y-3">
          <Field label="Tip">
            <select value={type} onChange={(e) => setType(e.target.value as MilestoneType)} className={inputCls}>
              {MILESTONE_TYPES.map((t) => (
                <option key={t} value={t}>{MILESTONE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
          {type === 'other' && (
            <Field label="Nume etapă">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
          )}
          <Field label="Data limită">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Responsabil">
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value as MilestoneResponsible)}
              className={inputCls}
            >
              {MILESTONE_RESPONSIBLES.map((r) => (
                <option key={r} value={r}>{MILESTONE_RESPONSIBLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>
          {responsible === 'other' && (
            <Field label="Nume responsabil">
              <input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} className={inputCls} />
            </Field>
          )}
          <Field label="Note">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        <div className="flex justify-between gap-2 pt-4 mt-4 border-t border-stone-100">
          {isEdit && onDeleted ? (
            <Button type="button" variant="destructive" size="sm" onClick={destroy} disabled={busy}>
              Șterge
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Anulează</Button>
            <Button type="button" variant="primary" loading={busy} onClick={save}>
              {isEdit ? 'Salvează' : 'Adaugă'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-stone-700 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full px-3 py-2.5 border border-stone-300 rounded-md text-sm bg-white focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'

function ErrorMap(code: string): string {
  return ({
    invalid_type: 'Tip invalid',
    invalid_responsible: 'Responsabil invalid',
    name_required_for_other_type: 'Nume etapă obligatoriu pentru tip "Altul"',
    responsible_name_required: 'Nume responsabil obligatoriu pentru "Altul"',
    missing_due_date: 'Data limită obligatorie',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}
