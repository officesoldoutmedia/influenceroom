// Sprint 9 Faza 3c — structured per-platform handles for influencers.
// Replaces the prior `platforms` JSONB shape (handle/followers/engagement).
//
// JSONB shape stored in influencers.social_handles:
//   {
//     instagram?: { handle, url, followers },
//     tiktok?:    { handle, url, followers },
//     youtube?:   { handle, url, followers },
//     facebook?:  { handle, url, followers },
//   }
// All four keys optional. `handle` is stored without the leading '@'.

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook'] as const
export type Platform = (typeof PLATFORMS)[number]

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
}

export type SocialHandle = {
  handle: string
  url: string
  followers: number
}

export type SocialHandles = Partial<Record<Platform, SocialHandle>>

/** Normalize: strip leading '@' and trim. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

/** Best-effort URL synthesis from handle. UI auto-fills this but the user
 *  can override (e.g. a Facebook page that lives under /pages/<id>). */
export function inferUrl(platform: Platform, handle: string): string {
  const clean = normalizeHandle(handle)
  if (!clean) return ''
  switch (platform) {
    case 'instagram': return `https://instagram.com/${clean}`
    case 'tiktok':    return `https://tiktok.com/@${clean}`
    case 'youtube':   return `https://youtube.com/@${clean}`
    case 'facebook':  return `https://facebook.com/${clean}`
  }
}

/** URL must be HTTPS and live on the platform's domain (or a known alias). */
export function validateUrl(platform: Platform, url: string): boolean {
  if (!url.startsWith('https://')) return false
  const allowed: Record<Platform, string[]> = {
    instagram: ['instagram.com', 'www.instagram.com'],
    tiktok:    ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
    youtube:   ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
    facebook:  ['facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com'],
  }
  try {
    const u = new URL(url)
    return allowed[platform].includes(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

/** Greatest follower count across the four platforms — drives auto-tier. */
export function maxFollowers(handles: SocialHandles): number {
  return PLATFORMS.reduce((max, p) => Math.max(max, handles[p]?.followers ?? 0), 0)
}

/** Primary handle pick for compact list display: first populated platform
 *  in the canonical PLATFORMS order. Returns null when no handles exist. */
export function primaryHandle(handles: SocialHandles): { platform: Platform; entry: SocialHandle } | null {
  for (const p of PLATFORMS) {
    const e = handles[p]
    if (e?.handle) return { platform: p, entry: e }
  }
  return null
}
