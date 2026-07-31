'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV_DEPTH_KEY = 'ir_nav_depth'

function navDepth(): number {
  const raw = sessionStorage.getItem(NAV_DEPTH_KEY)
  const n = raw === null ? 0 : Number(raw)
  return Number.isFinite(n) ? n : 0
}

// Mounted once in the root layout: counts route visits in this tab so
// BackLink can tell real in-app history from a direct/shared-link entry.
// window.history.length is not a reliable signal — the initial about:blank
// entry of a fresh tab counts toward it, and prior non-app pages would
// make back() leave the app.
export function NavHistoryTracker() {
  const pathname = usePathname()
  useEffect(() => {
    sessionStorage.setItem(NAV_DEPTH_KEY, String(navDepth() + 1))
  }, [pathname])
  return null
}

type BackLinkProps = {
  fallbackHref: string
  className?: string
  children: React.ReactNode
}

// Back-arrow link that navigates via history.back() so list pages regain
// their full URL (search + filters) and scroll position. Falls back to a
// plain link to `fallbackHref` when this tab has no in-app page to go back
// to (shared link / new tab). Modified clicks (cmd/ctrl/shift/alt) keep
// default Link behavior, e.g. open-in-new-tab.
export function BackLink({ fallbackHref, className, children }: BackLinkProps) {
  const router = useRouter()
  return (
    <Link
      href={fallbackHref}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        if (navDepth() > 1) {
          e.preventDefault()
          router.back()
        }
      }}
    >
      {children}
    </Link>
  )
}
