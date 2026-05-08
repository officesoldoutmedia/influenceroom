// Single source of truth for influencer tier values + display labels.
// Sprint 9 Faza 2B consolidated 5 tiers → 4 (mega merged into macro).
// Sprint 9 Faza 3c added range labels + auto-calc thresholds.

export const TIER_VALUES = ['nano', 'micro', 'mid', 'macro'] as const
export type Tier = (typeof TIER_VALUES)[number]

/** Compact label — pills, badges, table cells. */
export const TIER_LABELS_SHORT: Record<Tier, string> = {
  nano: 'Nano',
  micro: 'Micro',
  mid: 'Middle',
  macro: 'Macro & VIP',
}

/** Pill / dropdown label that hints the size range — Oana 2026-05-08
 *  feedback ("ca să nu se încurce când încadrează influencer"). */
export const TIER_LABELS_RANGE: Record<Tier, string> = {
  nano: 'Nano · <25k',
  micro: 'Micro · 25k–100k',
  mid: 'Middle · 100k–500k',
  macro: 'Macro & VIP · 500k+',
}

/** Long-form label — detail page sub-text, tooltips, settings. */
/** Alias maintained for backward-compat with code written before Faza 3c. */
export const TIER_LABELS_LONG = {
  nano: 'Nano (community size sub 25k)',
  micro: 'Micro (community size 25k–100k)',
  mid: 'Middle (community size 100k–500k)',
  macro: 'Macro & VIP (community size 500k+)',
} as const

export const TIER_LABELS_FULL: Record<Tier, string> = {
  nano: 'Nano (community size sub 25k)',
  micro: 'Micro (community size 25k–100k)',
  mid: 'Middle (community size 100k–500k)',
  macro: 'Macro & VIP (community size 500k+)',
}

/** Tailwind classes per tier — used by every list/detail/badge surface. */
export const TIER_BADGE: Record<Tier, string> = {
  nano: 'bg-stone-200 text-stone-700',
  micro: 'bg-blue-100 text-blue-700',
  mid: 'bg-cyan-100 text-cyan-700',
  macro: 'bg-amber-100 text-amber-800',
}

/** Auto-calc thresholds. Mirrored in the DB function `calc_influencer_tier`
 *  (migration 026); keep them in sync. */
export const TIER_THRESHOLDS = {
  nano_max: 25000,    // < 25k
  micro_max: 100000,  // < 100k
  mid_max: 500000,    // < 500k → macro
} as const

/** Client-side mirror of the DB calc_influencer_tier function. Useful for
 *  showing a preview of the auto-tier in the form before save. */
export function calcTier(maxFollowers: number): Tier {
  if (maxFollowers < TIER_THRESHOLDS.nano_max) return 'nano'
  if (maxFollowers < TIER_THRESHOLDS.micro_max) return 'micro'
  if (maxFollowers < TIER_THRESHOLDS.mid_max) return 'mid'
  return 'macro'
}
