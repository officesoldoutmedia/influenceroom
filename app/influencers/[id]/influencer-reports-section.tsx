'use client'

import { useEffect, useState } from 'react'
import { ConfirmModal } from '@/lib/ui/confirm-modal'
import { ReportEditModal } from '@/app/_components/report-edit-modal'
import { ReportRow } from '@/app/_components/report-row'
import type { ReportEntry } from '@/lib/reports/types'

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; entries: ReportEntry[] }
  | { kind: 'error'; message: string }

export function InfluencerReportsSection({ influencerId }: { influencerId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [editing, setEditing] = useState<ReportEntry | null>(null)
  const [deleteFor, setDeleteFor] = useState<ReportEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function reload() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/reports?influencer_id=${influencerId}`)
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
    fetch(`/api/reports?influencer_id=${influencerId}`)
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
  }, [influencerId])

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

  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6 mt-6">
      <h2 className="font-display text-lg text-stone-900 mb-4">Rapoarte campanii</h2>

      {state.kind === 'loading' && <p className="text-sm text-stone-500">Se încarcă...</p>}
      {state.kind === 'error' && <p className="text-sm text-rose-600">Eroare: {state.message}</p>}
      {state.kind === 'ok' && state.entries.length === 0 && (
        <p className="text-sm text-stone-500">Niciun raport pentru acest influencer.</p>
      )}
      {state.kind === 'ok' && state.entries.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
              <th className="px-4 py-2">Fişier</th>
              <th className="px-4 py-2">Campanie</th>
              <th className="px-4 py-2">KPI</th>
              <th className="px-4 py-2">Când</th>
              <th className="px-4 py-2">De</th>
              <th className="px-4 py-2 text-right">Acţiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {state.entries.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                showCampaign
                onEdit={(rep) => setEditing(rep)}
                onDelete={(rep) => setDeleteFor(rep)}
              />
            ))}
          </tbody>
        </table>
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
          description={`"${deleteFor.file_name}" va fi şters definitiv.`}
          confirmLabel="Şterge definitiv"
          variant="danger"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteFor(null)}
        />
      )}
    </section>
  )
}
