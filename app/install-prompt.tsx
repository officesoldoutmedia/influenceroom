'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'install_prompt_dismissed'
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const t = Number(raw)
    return Number.isFinite(t) && Date.now() - t < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS sets navigator.standalone; spec uses display-mode media query.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const webkit = /WebKit/.test(ua)
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua)
  return iOS && webkit && notChrome
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone()) return
    if (recentlyDismissed()) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setEvt(e as BIPEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    if (isIosSafari()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowIosHint(true)
      setHidden(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    setHidden(true)
  }

  async function install() {
    if (!evt) return
    await evt.prompt()
    await evt.userChoice
    setEvt(null)
    setHidden(true)
  }

  if (hidden) return null
  if (!evt && !showIosHint) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] bg-white border border-stone-200 rounded-xl shadow-lg p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
        IR
      </div>
      <div className="flex-1 text-sm text-stone-800">
        {evt ? (
          <span>Instalează aplicația pentru acces rapid din homescreen.</span>
        ) : (
          <span>
            Instalează: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
          </span>
        )}
      </div>
      {evt && (
        <button
          type="button"
          onClick={install}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
        >
          Instalează
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Închide"
        className="text-stone-400 hover:text-stone-700 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  )
}
