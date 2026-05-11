// Sprint 13a — rate cards per platform.
//
// Each platform has its own set of valid rate types. The whitelist below is
// the source of truth: the API validator rejects keys outside it, the form
// only renders inputs for them, and the detail page only walks them. UR-30
// (Usage Rights 30 days — the right to use the influencer's content in brand
// assets for 30 days) is universal across platforms.
//
// New rate types don't need a DB migration; add them here and they'll flow
// through validation + UI together.

import { PLATFORMS, type Platform } from '@/lib/influencers/social'

export const RATE_TYPES_PER_PLATFORM = {
  facebook: ['photo', 'video', 'story_set', 'ur_30d'] as const,
  instagram: ['photo', 'video', 'story_set', 'ur_30d'] as const,
  tiktok: ['video', 'boost_7d', 'boost_15d', 'boost_30d', 'ur_30d'] as const,
  youtube: ['video_insert', 'shorts', 'dedicated', 'ur_30d'] as const,
} satisfies Record<Platform, readonly string[]>

export type RateTypeFor<P extends Platform> = (typeof RATE_TYPES_PER_PLATFORM)[P][number]

export const RATE_TYPE_LABELS: Record<string, string> = {
  photo: 'Photo',
  video: 'Video',
  story_set: 'Story set',
  reel: 'Reel',
  carousel: 'Carousel',
  boost_7d: 'Boost 7 zile',
  boost_15d: 'Boost 15 zile',
  boost_30d: 'Boost 30 zile',
  video_insert: 'Video insert',
  shorts: 'YT Shorts',
  dedicated: 'Dedicated YT',
  ur_30d: 'UR — 30 zile',
}

export const RATE_TYPE_DESCRIPTIONS: Record<string, string> = {
  ur_30d: 'Usage Rights 30 zile — drept de utilizare conținut în brand assets',
  boost_7d: 'Boost paid 7 zile — promoted reach extra',
  boost_15d: 'Boost paid 15 zile',
  boost_30d: 'Boost paid 30 zile',
  dedicated: 'Video dedicat brand-ului (sponsored entire video)',
  video_insert: 'Insert in video existent (mid-roll)',
  shorts: 'YouTube Shorts (sub 60s)',
}

export type RateCard = Partial<Record<string, number>>
export type RateCards = Partial<Record<Platform, RateCard>>

export function getValidRateTypesForPlatform(platform: Platform): readonly string[] {
  return RATE_TYPES_PER_PLATFORM[platform]
}

export function isValidRateType(platform: Platform, rateType: string): boolean {
  return (RATE_TYPES_PER_PLATFORM[platform] as readonly string[]).includes(rateType)
}

export function totalRatesForPlatform(card: RateCard | undefined): number {
  if (!card) return 0
  return Object.values(card)
    .filter((v): v is number => typeof v === 'number')
    .reduce((a, b) => a + b, 0)
}

export function countRatesForPlatform(card: RateCard | undefined): number {
  if (!card) return 0
  return Object.values(card).filter((v): v is number => typeof v === 'number' && v > 0).length
}

export function totalRateCount(cards: RateCards): number {
  return PLATFORMS.reduce((acc, p) => acc + countRatesForPlatform(cards[p]), 0)
}

export function hasAnyRate(cards: RateCards): boolean {
  return PLATFORMS.some((p) => countRatesForPlatform(cards[p]) > 0)
}

// Shape returned by compareRateCards. Keys are "<platform>.<rate_type>" so a
// single flat lookup table is enough for both the audit row and the UI
// rendering. `old`/`new` are null when the rate was unset on that side.
export type RateCardChangeMap = Record<string, { old: number | null; new: number | null }>

// Compare two rate-card maps and return a flat diff. Used by the API audit
// hook on PATCH /api/influencers/[id]: if compareRateCards returns an empty
// object we skip writing a history row (idempotent — re-saving identical
// rate_cards isn't noise).
export function compareRateCards(
  before: RateCards | null | undefined,
  after: RateCards | null | undefined,
): RateCardChangeMap {
  const changes: RateCardChangeMap = {}
  const safeBefore = before ?? {}
  const safeAfter = after ?? {}
  for (const platform of PLATFORMS) {
    const b = safeBefore[platform] ?? {}
    const a = safeAfter[platform] ?? {}
    // Union of rate-type keys seen on either side.
    const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)])
    for (const rt of keys) {
      const oldV = typeof b[rt] === 'number' ? b[rt] : null
      const newV = typeof a[rt] === 'number' ? a[rt] : null
      if (oldV !== newV) {
        changes[`${platform}.${rt}`] = { old: oldV, new: newV }
      }
    }
  }
  return changes
}

export function hasRateCardChanges(changes: RateCardChangeMap): boolean {
  return Object.keys(changes).length > 0
}
