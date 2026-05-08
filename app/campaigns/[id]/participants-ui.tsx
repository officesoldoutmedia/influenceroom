'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PARTICIPANT_STATUSES,
  SOCIAL_PLATFORMS,
  PLATFORM_LABEL,
  type CampaignParticipantJoined,
  type ParticipantStatus,
  type SocialPlatform,
} from '@/lib/campaigns/types'
import { formatEur } from '@/lib/influencers/format'
import { Avatar, Button, EmptyState } from '@/lib/ui'

type InfluencerOption = {
  id: string
  name: string
  social_handles: Record<string, { handle: string; url: string; followers: number }>
}

const STATUS_BADGE: Record<ParticipantStatus, string> = {
  pitched: 'bg-stone-200 text-stone-700',
  negotiating: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-700',
  content_in_review: 'bg-purple-100 text-purple-700',
  published: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-200 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-700',
}

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  pitched: 'pitched',
  negotiating: 'negotiating',
  confirmed: 'confirmed',
  content_in_review: 'content review',
  published: 'published',
  paid: 'paid',
  cancelled: 'cancelled',
}

export function ParticipantsUI({
  campaignId,
  initialItems,
  influencers,
  canEdit,
}: {
  campaignId: string
  initialItems: CampaignParticipantJoined[]
  influencers: InfluencerOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<CampaignParticipantJoined[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CampaignParticipantJoined | null>(null)

  // Group rows by influencer_id (or by ad-hoc handle for ad-hoc rows).
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; rows: CampaignParticipantJoined[] }>()
    for (const it of items) {
      const key = it.influencer_id ?? `adhoc:${it.account_handle}`
      const label = it.influencer?.name ?? it.account_handle
      const existing = map.get(key)
      if (existing) existing.rows.push(it)
      else map.set(key, { label, rows: [it] })
    }
    return Array.from(map.values())
  }, [items])

  const totals = useMemo(() => {
    const totalFee = items.reduce((acc, i) => acc + Number(i.agreed_fee ?? 0), 0)
    const confirmed = items.filter((i) => i.status === 'confirmed').length
    const published = items.filter((i) => i.status === 'published' || i.status === 'paid').length
    return { totalFee, confirmed, published }
  }, [items])

  function upsert(it: CampaignParticipantJoined) {
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

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Participanți</h2>
          <p className="text-xs text-stone-500 mt-1">
            {items.length} {items.length === 1 ? 'rând' : 'rânduri'}
            {totals.confirmed > 0 && ` · ${totals.confirmed} confirmed`}
            {totals.published > 0 && ` · ${totals.published} published`}
            {totals.totalFee > 0 && ` · ${formatEur(totals.totalFee)}`}
          </p>
        </div>
        {canEdit && (
          <Button type="button" variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            + Adaugă participant
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Niciun participant încă"
          description={
            canEdit
              ? 'Adaugă primul influencer (sau handle ad-hoc) pe campania asta.'
              : 'Niciun rând adăugat de către owner.'
          }
          action={
            canEdit ? (
              <Button type="button" variant="primary" onClick={() => setShowAdd(true)}>
                + Adaugă participant
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {grouped.map((g) => (
            <li key={g.label} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50 flex items-center gap-3">
                <Avatar name={g.label} size="sm" />
                <span className="font-medium text-stone-900">{g.label}</span>
                {g.rows[0].is_adhoc && (
                  <span className="text-[10px] uppercase tracking-[0.06em] text-stone-500">ad-hoc</span>
                )}
              </div>
              <ul className="divide-y divide-stone-100">
                {g.rows.map((r) => (
                  <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 w-20">
                        {PLATFORM_LABEL[r.platform]}
                      </span>
                      <span className="text-sm text-stone-700 truncate">{r.account_handle}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {r.agreed_fee != null && (
                        <span className="text-sm text-stone-600 tabular-nums">{formatEur(r.agreed_fee)}</span>
                      )}
                      <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="text-[12px] text-stone-500 hover:text-brand-800 underline underline-offset-2"
                        >
                          Editează
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <AddModal
          campaignId={campaignId}
          influencers={influencers}
          onClose={() => setShowAdd(false)}
          onAdded={(added) => {
            for (const it of added) upsert(it)
            setShowAdd(false)
            router.refresh()
          }}
        />
      )}

      {editing && (
        <EditModal
          campaignId={campaignId}
          row={editing}
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

function AddModal({
  campaignId,
  influencers,
  onClose,
  onAdded,
}: {
  campaignId: string
  influencers: InfluencerOption[]
  onClose: () => void
  onAdded: (items: CampaignParticipantJoined[]) => void
}) {
  const [tab, setTab] = useState<'existing' | 'adhoc'>('existing')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Existing influencer flow
  const [influencerId, setInfluencerId] = useState('')
  const selectedInf = influencers.find((i) => i.id === influencerId)
  const [pickedPlatforms, setPickedPlatforms] = useState<Set<SocialPlatform>>(new Set())
  const [feeByPlatform, setFeeByPlatform] = useState<Record<string, string>>({})
  const [handleByPlatform, setHandleByPlatform] = useState<Record<string, string>>({})

  // Ad-hoc flow
  const [adhocPlatform, setAdhocPlatform] = useState<SocialPlatform>('instagram')
  const [adhocHandle, setAdhocHandle] = useState('')
  const [adhocFee, setAdhocFee] = useState('')

  // Auto-fill handle from influencer profile when platform is picked.
  useEffect(() => {
    if (!selectedInf) return
    const next: Record<string, string> = { ...handleByPlatform }
    for (const p of pickedPlatforms) {
      if (next[p] === undefined) {
        next[p] = selectedInf.social_handles?.[p]?.handle ?? ''
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHandleByPlatform(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId, Array.from(pickedPlatforms).sort().join(',')])

  function togglePlatform(p: SocialPlatform) {
    const next = new Set(pickedPlatforms)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setPickedPlatforms(next)
  }

  async function submitExisting() {
    if (!influencerId) {
      setError('Selectează un influencer')
      return
    }
    if (pickedPlatforms.size === 0) {
      setError('Selectează cel puțin o platformă')
      return
    }
    setBusy(true)
    setError(null)
    const created: CampaignParticipantJoined[] = []
    let firstError: string | null = null
    for (const p of pickedPlatforms) {
      const handle = handleByPlatform[p]?.trim() || selectedInf?.social_handles?.[p]?.handle || ''
      if (!handle) {
        firstError = `Lipsește handle pentru ${PLATFORM_LABEL[p]}`
        break
      }
      const feeStr = feeByPlatform[p] ?? ''
      const fee = feeStr === '' ? null : Number(feeStr)
      const res = await fetch(`/api/campaigns/${campaignId}/participants`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          influencer_id: influencerId,
          platform: p,
          account_handle: handle,
          agreed_fee: fee,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        item?: CampaignParticipantJoined
      }
      if (!res.ok || !data.item) {
        firstError = data.error ?? 'server_error'
        break
      }
      created.push(data.item)
    }
    setBusy(false)
    if (firstError) {
      setError(firstError)
      if (created.length > 0) onAdded(created) // partial save still surfaces
    } else {
      onAdded(created)
    }
  }

  async function submitAdhoc() {
    const handle = adhocHandle.trim()
    if (!handle) {
      setError('Handle obligatoriu')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/participants`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        influencer_id: null,
        platform: adhocPlatform,
        account_handle: handle,
        agreed_fee: adhocFee === '' ? null : Number(adhocFee),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      item?: CampaignParticipantJoined
    }
    setBusy(false)
    if (res.ok && data.item) onAdded([data.item])
    else setError(data.error ?? 'server_error')
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
        <h2 className="font-display text-xl text-stone-900 mb-4">Adaugă participant</h2>

        <div className="flex gap-1 mb-5 border-b border-stone-200">
          <TabButton active={tab === 'existing'} onClick={() => setTab('existing')}>
            Influencer existent
          </TabButton>
          <TabButton active={tab === 'adhoc'} onClick={() => setTab('adhoc')}>
            Handle ad-hoc
          </TabButton>
        </div>

        {tab === 'existing' ? (
          <div className="space-y-4">
            <Field label="Influencer">
              <select
                value={influencerId}
                onChange={(e) => {
                  setInfluencerId(e.target.value)
                  setPickedPlatforms(new Set())
                  setHandleByPlatform({})
                  setFeeByPlatform({})
                }}
                className={inputCls}
              >
                <option value="">— alege —</option>
                {influencers.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </Field>

            {selectedInf && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-2">
                  Platforme participante
                </div>
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.map((p) => {
                    const has = !!selectedInf.social_handles?.[p]
                    const checked = pickedPlatforms.has(p)
                    return (
                      <div
                        key={p}
                        className={`border rounded-lg p-3 ${
                          checked ? 'border-brand-300 bg-brand-50/40' : 'border-stone-200'
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePlatform(p)}
                          />
                          <span className="text-sm font-medium text-stone-800">
                            {PLATFORM_LABEL[p]}
                          </span>
                          {!has && (
                            <span className="text-[10px] uppercase tracking-[0.06em] text-stone-400">
                              not in profile
                            </span>
                          )}
                        </label>
                        {checked && (
                          <div className="mt-2 grid grid-cols-2 gap-2 ml-6">
                            <input
                              value={handleByPlatform[p] ?? ''}
                              onChange={(e) =>
                                setHandleByPlatform({ ...handleByPlatform, [p]: e.target.value })
                              }
                              placeholder="@handle"
                              className={inputCls}
                            />
                            <input
                              type="number"
                              min={0}
                              value={feeByPlatform[p] ?? ''}
                              onChange={(e) =>
                                setFeeByPlatform({ ...feeByPlatform, [p]: e.target.value })
                              }
                              placeholder="Fee (€)"
                              className={inputCls}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{ErrorMap(error)}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <Button type="button" variant="secondary" onClick={onClose}>Anulează</Button>
              <Button type="button" variant="primary" loading={busy} onClick={submitExisting}>
                Adaugă
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Platformă">
                <select
                  value={adhocPlatform}
                  onChange={(e) => setAdhocPlatform(e.target.value as SocialPlatform)}
                  className={inputCls}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fee (€)">
                <input
                  type="number"
                  min={0}
                  value={adhocFee}
                  onChange={(e) => setAdhocFee(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Handle">
              <input
                value={adhocHandle}
                onChange={(e) => setAdhocHandle(e.target.value)}
                placeholder="@handle"
                className={inputCls}
              />
            </Field>
            <p className="text-[12px] text-stone-500">
              Handle-ul nu va fi adăugat în baza de influenceri — doar pe campania asta.
            </p>
            {error && <p className="text-sm text-rose-600">{ErrorMap(error)}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <Button type="button" variant="secondary" onClick={onClose}>Anulează</Button>
              <Button type="button" variant="primary" loading={busy} onClick={submitAdhoc}>
                Adaugă
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EditModal({
  campaignId,
  row,
  onClose,
  onSaved,
  onDeleted,
}: {
  campaignId: string
  row: CampaignParticipantJoined
  onClose: () => void
  onSaved: (it: CampaignParticipantJoined) => void
  onDeleted: (id: string) => void
}) {
  const [status, setStatus] = useState<ParticipantStatus>(row.status)
  const [fee, setFee] = useState(row.agreed_fee != null ? String(row.agreed_fee) : '')
  const [handle, setHandle] = useState(row.account_handle)
  const [publishDate, setPublishDate] = useState(row.publish_date ?? '')
  const [postUrl, setPostUrl] = useState(row.post_url ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/campaigns/${campaignId}/participants/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status,
        agreed_fee: fee === '' ? null : Number(fee),
        account_handle: handle,
        publish_date: publishDate || null,
        post_url: postUrl || null,
        notes: notes || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      item?: CampaignParticipantJoined
    }
    setBusy(false)
    if (res.ok && data.item) onSaved(data.item)
    else setError(data.error ?? 'server_error')
  }

  async function destroy() {
    if (!confirm('Sigur ștergi acest participant?')) return
    setBusy(true)
    const res = await fetch(`/api/campaigns/${campaignId}/participants/${row.id}`, {
      method: 'DELETE',
    })
    setBusy(false)
    if (res.ok) onDeleted(row.id)
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
        <h2 className="font-display text-xl text-stone-900 mb-1">Editează participant</h2>
        <p className="text-xs text-stone-500 mb-4">
          {row.influencer?.name ?? row.account_handle} · {PLATFORM_LABEL[row.platform]}
        </p>
        <div className="space-y-3">
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ParticipantStatus)}
              className={inputCls}
            >
              {PARTICIPANT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Handle">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Fee (€)">
            <input
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publish date">
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Post URL">
              <input
                type="url"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Note">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>
        </div>
        {error && <p className="text-sm text-rose-600 mt-3">{ErrorMap(error)}</p>}
        <div className="flex justify-between gap-2 pt-4 mt-4 border-t border-stone-100">
          <Button type="button" variant="destructive" size="sm" onClick={destroy} disabled={busy}>
            Șterge
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Anulează</Button>
            <Button type="button" variant="primary" loading={busy} onClick={save}>Salvează</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-brand-700 text-brand-800'
          : 'border-transparent text-stone-500 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
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
    invalid_platform: 'Platformă invalidă',
    invalid_status: 'Status invalid',
    missing_handle: 'Handle obligatoriu',
    influencer_not_found: 'Influencer inexistent',
    influencer_not_active: 'Influencer inactiv',
    publish_date_required: 'Publish date obligatoriu pentru status published+',
    post_url_required: 'Post URL obligatoriu pentru status published+',
    forbidden: 'Acces interzis',
    server_error: 'Eroare server',
  } as Record<string, string>)[code] ?? code
}
