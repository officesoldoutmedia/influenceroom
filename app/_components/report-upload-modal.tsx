'use client'

import { useState, type FormEvent } from 'react'
import {
  ACCEPTED_MIMES,
  KPI_KEYS,
  KPI_LABELS_RO,
  MAX_FILE_SIZE_BYTES,
  type KpiKey,
  type ReportEntry,
} from '@/lib/reports/types'

type State = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; message: string }

export function ReportUploadModal({
  participantId,
  participantLabel,
  onClose,
  onUploaded,
}: {
  participantId: string
  participantLabel: string
  onClose: () => void
  onUploaded: (report: ReportEntry) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [kpi, setKpi] = useState<Record<KpiKey, string>>(() => {
    const init = {} as Record<KpiKey, string>
    for (const k of KPI_KEYS) init[k] = ''
    return init
  })
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setState({ kind: 'error', message: 'Selectează un fişier' })
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({ kind: 'error', message: 'Fişier prea mare (max 10MB)' })
      return
    }
    if (!(ACCEPTED_MIMES as readonly string[]).includes(file.type)) {
      setState({ kind: 'error', message: 'Tip de fişier neacceptat' })
      return
    }
    setState({ kind: 'submitting' })

    const form = new FormData()
    form.append('participant_id', participantId)
    form.append('file', file)
    for (const k of KPI_KEYS) {
      if (kpi[k] !== '') form.append(k, kpi[k])
    }
    if (notes.trim()) form.append('notes', notes.trim())

    try {
      const res = await fetch('/api/reports/upload', { method: 'POST', body: form })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        report?: ReportEntry
        error?: string
        detail?: string
      }
      if (res.ok && data.report) {
        onUploaded(data.report)
        onClose()
      } else {
        setState({ kind: 'error', message: data.detail || data.error || 'eroare necunoscută' })
      }
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'eroare reţea' })
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={state.kind === 'submitting' ? undefined : onClose}
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-stone-900 mb-1">Upload raport</h2>
        <p className="text-sm text-stone-500 mb-4">{participantLabel}</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">Fişier *</label>
            <input
              type="file"
              accept={ACCEPTED_MIMES.join(',')}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
            {file && (
              <p className="text-xs text-stone-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {KPI_KEYS.map((k) => (
              <div key={k}>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">
                  {KPI_LABELS_RO[k]}
                </label>
                <input
                  type="number"
                  min={0}
                  value={kpi[k]}
                  onChange={(e) => setKpi({ ...kpi, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm min-h-[60px]"
            />
          </div>

          {state.kind === 'error' && <p className="text-sm text-rose-600">{state.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={state.kind === 'submitting'}
              className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 disabled:opacity-60"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={state.kind === 'submitting'}
              className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60"
            >
              {state.kind === 'submitting' ? 'Se încarcă...' : 'Salvează raport'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
