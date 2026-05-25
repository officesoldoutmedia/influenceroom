'use client'

import { useState, type FormEvent } from 'react'
import { KPI_KEYS, KPI_LABELS_RO, type KpiKey, type ReportEntry } from '@/lib/reports/types'

type State = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; message: string }

export function ReportEditModal({
  report,
  onClose,
  onSaved,
}: {
  report: ReportEntry
  onClose: () => void
  onSaved: (report: ReportEntry) => void
}) {
  const [kpi, setKpi] = useState<Record<KpiKey, string>>(() => {
    const init = {} as Record<KpiKey, string>
    for (const k of KPI_KEYS) {
      const v = report[k]
      init[k] = v != null ? String(v) : ''
    }
    return init
  })
  const [notes, setNotes] = useState(report.notes ?? '')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'submitting' })

    const body: Record<string, unknown> = {}
    for (const k of KPI_KEYS) {
      const raw = kpi[k]
      if (raw === '') {
        body[k] = null
      } else {
        const n = Number(raw)
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          setState({ kind: 'error', message: `Valoare invalidă: ${KPI_LABELS_RO[k]}` })
          return
        }
        body[k] = n
      }
    }
    body.notes = notes

    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        report?: ReportEntry
        error?: string
        detail?: string
      }
      if (res.ok && data.report) {
        onSaved(data.report)
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
        <h2 className="font-display text-xl text-stone-900 mb-1">Editează raport</h2>
        <p className="text-sm text-stone-500 mb-4">{report.file_name}</p>

        <form onSubmit={submit} className="space-y-3">
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
              {state.kind === 'submitting' ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
