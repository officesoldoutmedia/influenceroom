'use client'

import { useState } from 'react'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

export function CampaignPdfButton({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function exportPdf() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pdf`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        signedUrl?: string
        error?: string
        detail?: string
      }
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener')
        setState({ kind: 'idle' })
        return
      }
      const msg = data.detail || data.error || 'eroare necunoscută'
      setState({ kind: 'error', message: msg })
      setTimeout(() => setState({ kind: 'idle' }), 5000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'eroare reţea'
      setState({ kind: 'error', message })
      setTimeout(() => setState({ kind: 'idle' }), 5000)
    }
  }

  if (state.kind === 'error') {
    return (
      <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
        {state.message}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      disabled={state.kind === 'loading'}
      className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-60"
    >
      {state.kind === 'loading' ? 'Generez PDF...' : 'Export PDF'}
    </button>
  )
}
