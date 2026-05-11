import { TIERS, STATUSES } from './types'
import {
  PLATFORMS,
  validateUrl,
  normalizeHandle,
  type Platform,
  type SocialHandles,
} from './social'
import { isValidRateType, type RateCard, type RateCards } from '@/lib/rate-cards/types'

export type InfluencerInput = {
  name?: string
  social_handles?: Record<string, unknown>
  niche_tags?: string[]
  tier?: string | null
  tier_manual_override?: boolean
  language?: string | null
  location_city?: string | null
  location_country?: string | null
  rate_cards?: Record<string, unknown>
  // Legacy single-numeric rates were dropped in migration 035. Inputs that
  // still send these are silently ignored (they were only ever populated for
  // SPEAK and the migration moved that data into rate_cards.instagram).
  contact_email?: string | null
  contact_phone?: string | null
  agent_name?: string | null
  agent_email?: string | null
  fiscal_data?: Record<string, unknown> | null
  exclusive?: boolean
  status?: string
  notes?: string | null
  account_manager_id?: string | null
}

export type ValidateResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

// Whitelist-validate rate_cards. Strips empty platforms / null+empty values
// so the payload landing in DB is already shaped like jsonb_strip_nulls would
// produce. Reject unknown platforms or rate types per platform with a typed
// error code so the UI can pinpoint the offending input.
function validateRateCards(raw: Record<string, unknown>): RateCards | { error: string } {
  const out: RateCards = {}
  for (const platform of Object.keys(raw)) {
    if (!(PLATFORMS as readonly string[]).includes(platform)) {
      return { error: `invalid_rate_platform_${platform}` }
    }
    const card = raw[platform]
    if (card === null || card === undefined) continue
    if (typeof card !== 'object' || Array.isArray(card)) {
      return { error: `invalid_rate_card_${platform}` }
    }
    const cleaned: RateCard = {}
    for (const [rateType, value] of Object.entries(card as Record<string, unknown>)) {
      if (!isValidRateType(platform as Platform, rateType)) {
        return { error: `invalid_rate_type_${platform}_${rateType}` }
      }
      // Accept null / '' / undefined as "clear this rate" → drop the key.
      if (value === null || value === undefined || (value as unknown) === '') continue
      // Allow numeric strings from form inputs.
      const num = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(num) || num < 0) {
        return { error: `invalid_rate_value_${platform}_${rateType}` }
      }
      cleaned[rateType] = num
    }
    if (Object.keys(cleaned).length > 0) {
      out[platform as Platform] = cleaned
    }
  }
  return out
}

function validateSocialHandles(raw: Record<string, unknown>): SocialHandles | { error: string } {
  const out: SocialHandles = {}
  for (const platform of PLATFORMS) {
    const entry = raw[platform]
    if (entry === undefined || entry === null) continue
    if (typeof entry !== 'object') return { error: `invalid_handle_${platform}` }
    const obj = entry as Record<string, unknown>
    const rawHandle = typeof obj.handle === 'string' ? obj.handle : ''
    const handle = normalizeHandle(rawHandle)
    if (!handle) continue // empty handle = platform not used
    if (handle.length < 1 || handle.length > 100) return { error: `invalid_handle_${platform}` }
    const url = typeof obj.url === 'string' ? obj.url.trim() : ''
    if (!url) return { error: `missing_url_${platform}` }
    if (!validateUrl(platform as Platform, url)) return { error: `invalid_url_${platform}` }
    const followersRaw = obj.followers
    let followers = 0
    if (typeof followersRaw === 'number' && Number.isFinite(followersRaw) && followersRaw >= 0) {
      followers = Math.floor(followersRaw)
    } else if (followersRaw !== undefined && followersRaw !== null && followersRaw !== '') {
      return { error: `invalid_followers_${platform}` }
    }

    // engagement_rate (Sprint 10 hotfix 2026-05-11): optional percent
    // 0..100 with two decimals. Empty string / null / undefined all mean
    // "not measured" and the key is omitted from the persisted JSONB so
    // the UI's null-check renders cleanly.
    const erRaw = obj.engagement_rate
    let engagementRate: number | undefined
    if (erRaw === undefined || erRaw === null || erRaw === '') {
      engagementRate = undefined
    } else if (typeof erRaw === 'number' && Number.isFinite(erRaw) && erRaw >= 0 && erRaw <= 100) {
      // Round to 2 decimals so what's stored matches what the UI shows.
      engagementRate = Math.round(erRaw * 100) / 100
    } else {
      return { error: `invalid_engagement_rate_${platform}` }
    }

    out[platform as Platform] = {
      handle,
      url,
      followers,
      ...(engagementRate !== undefined ? { engagement_rate: engagementRate } : {}),
    }
  }
  return out
}

export function validateAndNormalize(body: InfluencerInput, partial = false): ValidateResult {
  const out: Record<string, unknown> = {}

  if (!partial || body.name !== undefined) {
    const n = body.name?.trim()
    if (!n) return { ok: false, error: 'missing_name' }
    out.name = n
  }
  if (body.social_handles !== undefined) {
    const result = validateSocialHandles(body.social_handles ?? {})
    if ('error' in result) return { ok: false, error: result.error }
    out.social_handles = result
  }
  if (body.niche_tags !== undefined) {
    if (!Array.isArray(body.niche_tags)) return { ok: false, error: 'invalid_tags' }
    out.niche_tags = body.niche_tags.map((t) => t.trim()).filter(Boolean)
  }
  if (body.tier_manual_override !== undefined) {
    out.tier_manual_override = !!body.tier_manual_override
  }
  if (body.tier !== undefined) {
    // Tier is only honored when the override flag is true; otherwise the
    // DB trigger overwrites it from social_handles. We still accept and
    // sanity-check the value so a no-op write doesn't fail validation.
    if (body.tier && !(TIERS as readonly string[]).includes(body.tier)) {
      return { ok: false, error: 'invalid_tier' }
    }
    out.tier = body.tier || null
  }
  if (body.language !== undefined) out.language = body.language || 'ro'
  if (body.location_city !== undefined) out.location_city = body.location_city?.trim() || null
  if (body.location_country !== undefined) out.location_country = body.location_country?.trim() || 'Romania'
  if (body.rate_cards !== undefined) {
    const result = validateRateCards(body.rate_cards ?? {})
    if ('error' in result) return { ok: false, error: result.error }
    out.rate_cards = result
  }
  if (body.contact_email !== undefined) {
    const e = body.contact_email?.trim() || null
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: 'invalid_email' }
    out.contact_email = e
  }
  if (body.contact_phone !== undefined) out.contact_phone = body.contact_phone?.trim() || null
  if (body.agent_name !== undefined) out.agent_name = body.agent_name?.trim() || null
  if (body.agent_email !== undefined) {
    const e = body.agent_email?.trim() || null
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: 'invalid_agent_email' }
    out.agent_email = e
  }
  if (body.fiscal_data !== undefined) out.fiscal_data = body.fiscal_data ?? null
  if (body.exclusive !== undefined) out.exclusive = !!body.exclusive
  if (body.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(body.status)) return { ok: false, error: 'invalid_status' }
    out.status = body.status
  }
  if (body.notes !== undefined) out.notes = body.notes?.trim() || null
  if (body.account_manager_id !== undefined) {
    if (body.account_manager_id === null || body.account_manager_id === '') {
      out.account_manager_id = null
    } else if (typeof body.account_manager_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.account_manager_id)) {
      out.account_manager_id = body.account_manager_id
    } else {
      return { ok: false, error: 'invalid_account_manager' }
    }
  }

  return { ok: true, data: out }
}
