// Influencer Room — vanilla service worker.
// Strategy:
//   /api/*               → network-only, never cached (always fresh data)
//   navigation requests  → network-first, fallback to /offline.html on failure
//   static (_next/static, /icons/, /manifest.json, /favicon.ico) → cache-first
//   cross-origin         → bypass (let the browser handle it)
// Bump CACHE_VERSION when shell URLs or strategies change so the activate
// handler can purge stale caches.

const CACHE_VERSION = 'ir-v1'
const CACHE_NAME = `ir-shell-${CACHE_VERSION}`
const SHELL_URLS = [
  '/',
  '/login',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // addAll is atomic; if one URL 404s the whole precache fails. Use
      // individual adds and tolerate per-URL failures so a missing optional
      // asset doesn't block install on first deploy.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: 'same-origin' })
            if (res.ok || res.type === 'opaqueredirect') {
              await cache.put(url, res.clone())
            }
          } catch {
            // ignore — precache best-effort
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request

  // Only handle GET; let other methods pass through.
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Cross-origin: bypass.
  if (url.origin !== self.location.origin) return

  // API: network-only, no cache.
  if (url.pathname.startsWith('/api/')) return

  // Navigation: network-first, fall back to cached /offline shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          return fresh
        } catch {
          const cache = await caches.open(CACHE_NAME)
          const cached = await cache.match('/offline')
          return (
            cached ??
            new Response('offline', { status: 503, headers: { 'content-type': 'text/plain' } })
          )
        }
      })(),
    )
    return
  }

  // Static assets: cache-first, refresh in background.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(req)
        if (cached) {
          // Background revalidate — best-effort, ignore errors.
          fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone())
            })
            .catch(() => {})
          return cached
        }
        try {
          const res = await fetch(req)
          if (res && res.ok) cache.put(req, res.clone())
          return res
        } catch (err) {
          throw err
        }
      })(),
    )
    return
  }

  // Anything else (Next dynamic chunks, RSC payloads, etc.): network-only.
})

// Push + notificationclick stubs — wired in Sprint 8 Phase 6.
self.addEventListener('push', () => {
  // Phase 6 will populate: parse event.data, show notification.
})

self.addEventListener('notificationclick', () => {
  // Phase 6 will populate: open / focus the matching client window.
})
