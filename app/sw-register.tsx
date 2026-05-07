'use client'

import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    // Skip in dev: HMR + SW caching is a footgun and dev never serves
    // production-built static chunks.
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[sw] registered', reg.scope)
        }
      })
      .catch((err) => {
        console.warn('[sw] register failed', err)
      })
  }, [])

  return null
}
