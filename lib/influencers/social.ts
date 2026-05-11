// Sprint 9 Faza 3c — structured per-platform handles for influencers.
// Replaces the prior `platforms` JSONB shape (handle/followers/engagement).
//
// JSONB shape stored in influencers.social_handles:
//   {
//     instagram?: { handle, url, followers, engagement_rate? },
//     tiktok?:    { handle, url, followers, engagement_rate? },
//     youtube?:   { handle, url, followers, engagement_rate? },
//     facebook?:  { handle, url, followers, engagement_rate? },
//   }
// All four platform keys optional. `handle` is stored without the leading '@'.
// `engagement_rate` (Sprint 10 hotfix 2026-05-11) is the real ER as percent
// (0..100, two decimals). Distinct from `score_engagement_rate` on
// influencer_scores, which is the team's 0..100 quality rating. JSONB stays
// the source of truth so adding the field needs no DB migration; rows that
// pre-date this change just have it missing — the helpers below treat
// `undefined` as "not measured yet" (no badge displayed).

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
  /** Real engagement rate as a percent (0..100). Optional — `undefined`
   *  means "not measured yet" and the UI hides the badge. */
  engagement_rate?: number
}

export type SocialHandles = Partial<Record<Platform, SocialHandle>>

// Agency-standard engagement-rate bands. Thresholds are open at the top of
// each band (e.g. exactly 1.0 lands in `medium`, not `low`). Tuned with Oana
// 2026-05-08 — adjust here only after a team conversation.
export type EngagementLevel = 'low' | 'medium' | 'good' | 'very_good' | 'excellent'

export const ENGAGEMENT_LEVELS: readonly EngagementLevel[] = [
  'low',
  'medium',
  'good',
  'very_good',
  'excellent',
] as const

export const ENGAGEMENT_LEVEL_LABELS: Record<EngagementLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  good: 'Good',
  very_good: 'Very Good',
  excellent: 'Excellent',
}

// Tailwind classes — match the existing score-category palette (rose →
// amber → emerald → violet) with `lime` slotted in as the "Good" middle.
export const ENGAGEMENT_LEVEL_COLORS: Record<EngagementLevel, string> = {
  low: 'bg-rose-100 text-rose-900',
  medium: 'bg-amber-100 text-amber-900',
  good: 'bg-lime-100 text-lime-900',
  very_good: 'bg-emerald-100 text-emerald-900',
  excellent: 'bg-violet-100 text-violet-900',
}

export function engagementLevelFromRate(rate: number | undefined | null): EngagementLevel | null {
  if (rate == null || !Number.isFinite(rate)) return null
  if (rate < 1) return 'low'
  if (rate < 3) return 'medium'
  if (rate < 6) return 'good'
  if (rate < 10) return 'very_good'
  return 'excellent'
}

/** Two-decimal display, e.g. 3.45 → "3.45%". Returns "—" for null/undefined
 *  so callers can use it directly in JSX without ternaries. */
export function formatEngagementRate(rate: number | undefined | null): string {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${rate.toFixed(2)}%`
}

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
