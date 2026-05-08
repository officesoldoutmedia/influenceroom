// Single source of truth for influencer tier values + display labels.
// Sprint 9 Faza 2B consolidated 5 tiers → 4 (mega merged into macro).
// The DB CHECK constraint enforces these 4 values verbatim.

export const TIER_VALUES = ['nano', 'micro', 'mid', 'macro'] as const
export type Tier = (typeof TIER_VALUES)[number]

/** Compact label — pills, badges, table cells. */
export const TIER_LABELS_SHORT: Record<Tier, string> = {
  nano: 'Nano',
  micro: 'Micro',
  mid: 'Mid',
  macro: 'Macro & VIP',
}

/** Long-form label — form select, detail-page badge, anywhere with room. */
export const TIER_LABELS_LONG: Record<Tier, string> = {
  nano: 'Nano',
  micro: 'Micro',
  mid: 'Mid',
  macro: 'Macro & VIP / Community Size',
}

/** Tailwind classes per tier — used by every list/detail/badge surface. */
export const TIER_BADGE: Record<Tier, string> = {
  nano: 'bg-stone-200 text-stone-700',
  micro: 'bg-blue-100 text-blue-700',
  mid: 'bg-cyan-100 text-cyan-700',
  macro: 'bg-amber-100 text-amber-800',
}
