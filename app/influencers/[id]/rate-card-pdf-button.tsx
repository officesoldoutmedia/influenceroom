'use client'

// "Generează PDF" header action for the Rate Cards section.
//
// Server-driven: posts to /api/influencers/[id]/rate-card-pdf, takes the
// signed URL back, and pops a new tab so the browser handles the download
// flow. Disabled state surfaces when there are no rates to export so the
// user can see the affordance even if they can't act yet.

import { useState } from 'react'

type ApiResponse =
  | { ok: true; downloadUrl: string; path: string; generatedAt: string }
  | { ok: false; error: string; detail?: string }

const ERROR_LABELS: Record<string, string> = {
  unauthorized: 'Sesiune expirată — relogheaza-te.',
  forbidden: 'Nu ai drept de export pentru acest influencer.',
  not_found: 'Influencer inexistent.',
  no_rates_to_export: 'Adaugă cel puțin un rate înainte de a genera PDF.',
  pdf_render_failed: 'Generarea PDF a eșuat. Încearcă din nou.',
  upload_failed: 'Upload în storage eșuat. Încearcă din nou.',
  sign_failed: 'Nu am putut crea link-ul de descărcare.',
}

export function RateCardPdfButton({
  influencerId,
  disabled,
  disabledReason,
}: {
  influencerId: string
  disabled?: boolean
  disabledReason?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUrl, setLastUrl] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/influencers/${influencerId}/rate-card-pdf`, {
        method: 'POST',
      })
      const data = (await res.json().catch(() => ({}))) as ApiResponse
      if (!data.ok) {
        setError(ERROR_LABELS[data.error] ?? data.error)
        return
      }
      setLastUrl(data.downloadUrl)
      // Open the signed URL in a new tab — the browser handles
      // application/pdf as a download or inline preview per user prefs.
      window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare necunoscută')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {lastUrl && !busy && (
          <a
            href={lastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-brand-700 hover:text-brand-800 hover:underline"
          >
            Descarcă din nou
          </a>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={disabled || busy}
          title={disabled ? disabledReason : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Spinner /> Se generează...
            </>
          ) : (
            <>
              <DownloadIcon /> Generează PDF
            </>
          )}
        </button>
      </div>
      {error && <span className="text-[12px] text-rose-600">{error}</span>}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}
