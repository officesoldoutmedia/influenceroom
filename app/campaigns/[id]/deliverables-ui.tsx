'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABEL,
  PLATFORM_LABEL,
  type CampaignDeliverable,
  type CampaignParticipantJoined,
  type DeliverableStatus,
  type DeliverableType,
} from '@/lib/campaigns/types'
import { Avatar, Button, EmptyState } from '@/lib/ui'

const STATUS_BADGE: Record<DeliverableStatus, string> = {
  draft: 'bg-stone-200 text-stone-700',
  sent_to_influencer: 'bg-blue-100 text-blue-700',
  content_in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-cyan-100 text-cyan-700',
  published: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

export function DeliverablesUI({
  campaignId,
  participants,
  initialItems,
  canEdit,
}: {
  campaignId: string
  participants: CampaignParticipantJoined[]
  initialItems: CampaignDeliverable[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<CampaignDeliverable[]>(initialItems)
  const [adding, setAdding] = useState<CampaignParticipantJoined | null>(null)
  const [editing, setEditing] = useState<CampaignDeliverable | null>(null)

  function upsert(it: CampaignDeliverable) {
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

  if (participants.length === 0) {
    return (
      <EmptyState
        title="Niciun participant încă"
        description="Adaugă participanți în tab-ul Participanți, apoi te întorci aici să le atașezi livrabile."
      />
    )
  }

  return (
    <div className="space-y-4">
      {participants.map((p) => {
        const rows = items
          .filter((d) => d.participant_id === p.id)
          .sort((a, b) => a.position - b.position)
        return (
          <div key={p.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={p.influencer?.name ?? p.account_handle} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">
                    {p.influencer?.name ?? p.account_handle}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.06em] text-stone-500">
                    {PLATFORM_LABEL[p.platform]} · {rows.length} {rows.length === 1 ? 'livrabil' : 'livrabile'}
                  </div>
                </div>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdding(p)}
                >
                  + Adaugă livrabil
                </Button>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-stone-500">
                Niciun livrabil pentru acest participant.
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {rows.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(d)}
                      className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-sm font-medium text-stone-900 shrink-0">
                          {d.quantity}× {d.type === 'custom' ? d.custom_type_label : DELIVERABLE_TYPE_LABEL[d.type]}
                        </span>
                        {d.brief && (
                          <span className="text-[12px] text-stone-500 truncate">
                            {d.brief.length > 60 ? d.brief.slice(0, 60) + '…' : d.brief}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-stone-500 tabular-nums">
                          {d.post_date ?? '—'}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[d.status]}`}>
                          {DELIVERABLE_STATUS_LABEL[d.status]}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {adding && (
        <DeliverableModal
          campaignId={campaignId}
          participant={adding}
          onClose={() => setAdding(null)}
          onSaved={(it) => {
            upsert(it)
            setAdding(null)
            router.refresh()
          }}
        />
      )}
      {editing && (
        <DeliverableModal
          campaignId={campaignId}
          participant={participants.find((p) => p.id === editing.participant_id) ?? null}
          deliverable={editing}
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

function DeliverableModal({
  campaignId,
  participant,
  deliverable,
  onClose,
  onSaved,
  onDeleted,
}: {
  campaignId: string
  participant: CampaignParticipantJoined | null
  deliverable?: CampaignDeliverable
  onClose: () => void
  onSaved: (it: CampaignDeliverable) => void
  onDeleted?: (id: string) => void
}) {
  const isEdit = !!deliverable

  const [type, setType] = useState<DeliverableType>(deliverable?.type ?? 'reel')
  const [customLabel, setCustomLabel] = useState(deliverable?.custom_type_label ?? '')
  const [quantity, setQuantity] = useState(String(deliverable?.quantity ?? 1))
  const [postDate, setPostDate] = useState(deliverable?.post_date ?? '')
  const [collabHandles, setCollabHandles] = useState<string[]>(deliverable?.collab_handles ?? [])
  const [hashtags, setHashtags] = useState<string[]>(deliverable?.hashtags ?? [])
  const [brief, setBrief] = useState(deliverable?.brief ?? '')
  const [caption, setCaption] = useState(deliverable?.caption ?? '')
  const [notes, setNotes] = useState(deliverable?.notes ?? '')
  const [status, setStatus] = useState<DeliverableStatus>(deliverable?.status ?? 'draft')
  const [publishedUrl, setPublishedUrl] = useState(deliverable?.published_url ?? '')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const payload = {
      participant_id: participant?.id,
      type,
      custom_type_label: type === 'custom' ? customLabel : null,
      quantity: Number(quantity) || 1,
      post_date: postDate || null,
      collab_handles: collabHandles,
      hashtags,
      brief: brief || null,
      caption: caption || null,
      notes: notes || null,
      status,
      published_url: publishedUrl || null,
    }
    const url = isEdit
      ? `/api/campaigns/${campaignId}/deliverables/${deliverable!.id}`
      : `/api/campaigns/${campaignId}/deliverables`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      item?: CampaignDeliverable
    }
    setBusy(false)
    if (res.ok && data.item) onSaved(data.item)
    else setError(ErrorMap(data.error ?? 'server_error'))
  }

  async function destroy() {
    if (!deliverable || !onDeleted) return
    if (!confirm('Sigur ștergi acest livrabil?')) return
    setBusy(true)
    const res = await fetch(`/api/campaigns/${campaignId}/deliverables/${deliverable.id}`, {
      method: 'DELETE',
    })
    setBusy(false)
    if (res.ok) onDeleted(deliverable.id)
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
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-stone-900 mb-1">
          {isEdit ? 'Editează livrabil' : 'Adaugă livrabil'}
        </h2>
        {participant && (
          <p className="text-xs text-stone-500 mb-4">
            {participant.influencer?.name ?? participant.account_handle} · {PLATFORM_LABEL[participant.platform]}
          </p>
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Tip">
                <select value={type} onChange={(e) => setType(e.target.value as DeliverableType)} className={inputCls}>
                  {DELIVERABLE_TYPES.map((t) => (
                    <option key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Cantitate">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {type === 'custom' && (
            <Field label="Etichetă custom">
              <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} className={inputCls} />
            </Field>
          )}
          <Field label="Data postării">
            <input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Colaboratori (handles)">
            <TagInput value={collabHandles} onChange={setCollabHandles} placeholder="@handle, Enter pentru add" />
          </Field>
          <Field label="Hashtags">
            <TagInput value={hashtags} onChange={setHashtags} placeholder="#tag, Enter pentru add" />
          </Field>
          <Field label="Brief">
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="Caption draft">
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="Note interne">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)} className={inputCls}>
              {DELIVERABLE_STATUSES.map((s) => (
                <option key={s} value={s}>{DELIVERABLE_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          {status === 'published' && (
            <Field label="Link publicat">
              <input type="url" value={publishedUrl} onChange={(e) => setPublishedUrl(e.target.value)} placeholder="https://..." className={inputCls} />
            </Field>
          )}
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

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (value.includes(v)) return
    onChange([...value, v])
    setDraft('')
  }

  function remove(t: string) {
    onChange(value.filter((x) => x !== t))
  }

  return (
    <div className={`${inputCls} flex flex-wrap gap-1.5 items-center min-h-[42px] py-2`}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 text-[12px]">
          {t}
          <button type="button" onClick={() => remove(t)} className="hover:text-brand-900" aria-label={`Șterge ${t}`}>×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => add(draft)}
        placeholder={placeholder}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
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
    invalid_status: 'Status invalid',
    custom_label_required: 'Etichetă custom obligatorie',
    published_requires_url_and_date: 'Pentru status Publicat: link + dată postare obligatorii',
    participant_not_in_campaign: 'Participantul nu aparține acestei campanii',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}
