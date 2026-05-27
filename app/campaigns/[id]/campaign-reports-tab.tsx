'use client'

import { useEffect, useState } from 'react'
import { ConfirmModal } from '@/lib/ui/confirm-modal'
import { ReportUploadModal } from '@/app/_components/report-upload-modal'
import { ReportEditModal } from '@/app/_components/report-edit-modal'
import { ReportRow } from '@/app/_components/report-row'
import type { ReportEntry } from '@/lib/reports/types'

type Participant = {
  id: string
  platform: string
  account_handle: string | null
  is_adhoc: boolean
  influencer?: { name: string } | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; entries: ReportEntry[] }
  | { kind: 'error'; message: string }

export function CampaignReportsTab({
  campaignId,
  participants,
}: {
  campaignId: string
  participants: Participant[]
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [uploadFor, setUploadFor] = useState<Participant | null>(null)
  const [editing, setEditing] = useState<ReportEntry | null>(null)
  const [deleteFor, setDeleteFor] = useState<ReportEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function reload() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/reports?campaign_id=${campaignId}`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        entries?: ReportEntry[]
        error?: string
      }
      if (res.ok && data.entries) {
        setState({ kind: 'ok', entries: data.entries })
      } else {
        setState({ kind: 'error', message: data.error ?? 'server_error' })
      }
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' })
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/reports?campaign_id=${campaignId}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          entries?: ReportEntry[]
          error?: string
        }
        if (cancelled) return
        if (res.ok && data.entries) {
          setState({ kind: 'ok', entries: data.entries })
        } else {
          setState({ kind: 'error', message: data.error ?? 'server_error' })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [campaignId])

  async function confirmDelete() {
    if (!deleteFor) return
    setDeleting(true)
    const res = await fetch(`/api/reports/${deleteFor.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteFor(null)
    if (res.ok) {
      await reload()
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'unknown'}`)
    }
  }

  if (state.kind === 'loading') return <div className="text-sm text-stone-500">Se încarcă...</div>
  if (state.kind === 'error') return <div className="text-sm text-rose-600">Eroare: {state.message}</div>

  const grouped = new Map<string, ReportEntry[]>()
  for (const r of state.entries) {
    grouped.set(r.participant_id, [...(grouped.get(r.participant_id) ?? []), r])
  }

  return (
    <div className="space-y-4">
      {participants.map((p) => {
        const reports = grouped.get(p.id) ?? []
        const label = `${p.influencer?.name ?? (p.is_adhoc ? 'Extern' : '—')} · ${p.platform}`
        return (
          <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base text-stone-900">{label}</h3>
              <button
                type="button"
                onClick={() => setUploadFor(p)}
                className="px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs hover:bg-brand-800"
              >
                + Upload raport
              </button>
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-stone-500">Niciun raport.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                    <th className="px-4 py-2">Fişier</th>
                    <th className="px-4 py-2">KPI</th>
                    <th className="px-4 py-2">Când</th>
                    <th className="px-4 py-2">De</th>
                    <th className="px-4 py-2 text-right">Acţiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reports.map((r) => (
                    <ReportRow
                      key={r.id}
                      report={r}
                      onEdit={(rep) => setEditing(rep)}
                      onDelete={(rep) => setDeleteFor(rep)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {uploadFor && (
        <ReportUploadModal
          participantId={uploadFor.id}
          participantLabel={`${uploadFor.influencer?.name ?? (uploadFor.is_adhoc ? 'Extern' : '—')} · ${uploadFor.platform}`}
          onClose={() => setUploadFor(null)}
          onUploaded={() => reload()}
        />
      )}

      {editing && (
        <ReportEditModal
          report={editing}
          onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}

      {deleteFor && (
        <ConfirmModal
          title="Şterge raport?"
          description={`"${deleteFor.file_name}" va fi şters definitiv (DB + Storage).`}
          confirmLabel="Şterge definitiv"
          variant="danger"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteFor(null)}
        />
      )}
    </div>
  )
}
