// Tier source-of-truth lives in ./tiers.ts (Sprint 9 Faza 2B consolidated
// mega → macro). Aliased here as TIERS so the existing import surface
// (`import { TIERS, type Tier } from '@/lib/influencers/types'`) keeps
// working without touching dozens of consumer files.
import type { Tier } from './tiers'
export { TIER_VALUES as TIERS, TIER_BADGE, TIER_LABELS_SHORT, TIER_LABELS_LONG } from './tiers'
export type { Tier }

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook'] as const
export type Platform = (typeof PLATFORMS)[number]

export const STATUSES = ['active', 'inactive', 'blacklist'] as const
export type InfluencerStatus = (typeof STATUSES)[number]

export type PlatformStats = {
  handle?: string
  followers?: number
  engagement_rate?: number
}

export type FiscalData = {
  entity_type?: string
  cui?: string
  iban?: string
  address?: string
}

export type Influencer = {
  id: string
  name: string
  primary_handle: string | null
  platforms: Partial<Record<Platform, PlatformStats>>
  niche_tags: string[]
  tier: Tier | null
  language: string | null
  location_city: string | null
  location_country: string | null
  rate_post: number | null
  rate_story: number | null
  rate_reel: number | null
  rate_video: number | null
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
