// Tier source-of-truth lives in ./tiers.ts (Sprint 9 Faza 2B consolidated
// mega → macro; Faza 3c added range labels + auto-calc thresholds).
import type { Tier } from './tiers'
export {
  TIER_VALUES as TIERS,
  TIER_BADGE,
  TIER_LABELS_SHORT,
  TIER_LABELS_LONG,
  TIER_LABELS_RANGE,
  TIER_LABELS_FULL,
  TIER_THRESHOLDS,
  calcTier,
} from './tiers'
export type { Tier }

// Platforms + social handles (Faza 3c) — see ./social.ts for the canonical
// PLATFORMS / Platform / SocialHandle / SocialHandles types and helpers.
// Re-exported here so the existing
// `import { PLATFORMS } from '@/lib/influencers/types'` import surface
// keeps working.
export {
  PLATFORMS,
  PLATFORM_LABEL,
  inferUrl,
  validateUrl,
  normalizeHandle,
  maxFollowers,
  primaryHandle,
} from './social'
export type { Platform, SocialHandle, SocialHandles } from './social'

export const STATUSES = ['active', 'inactive', 'blacklist'] as const
export type InfluencerStatus = (typeof STATUSES)[number]

export type FiscalData = {
  entity_type?: string
  cui?: string
  iban?: string
  address?: string
}

import type { SocialHandles } from './social'
import type { RateCards } from '@/lib/rate-cards/types'

export type Influencer = {
  id: string
  name: string
  social_handles: SocialHandles
  niche_tags: string[]
  tier: Tier | null
  tier_manual_override: boolean
  language: string | null
  location_city: string | null
  location_country: string | null
  rate_cards: RateCards
  contact_email: string | null
  contact_phone: string | null
  agent_name: string | null
  agent_email: string | null
  fiscal_data: FiscalData | null
  exclusive: boolean
  status: InfluencerStatus
  notes: string | null
  account_manager_id: string | null
  created_at: string
  updated_at: string
}

export type ManagerSummary = { id: string; name: string; role: string }

export const PRESET_TAGS = [
  'fashion',
  'beauty',
  'fitness',
  'tech',
  'gaming',
  'food',
  'travel',
  'lifestyle',
  'music',
  'comedy',
  'business',
] as const
