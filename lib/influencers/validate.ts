import { TIERS, STATUSES } from './types'
import {
  PLATFORMS,
  validateUrl,
  normalizeHandle,
  type Platform,
  type SocialHandles,
} from './social'

export type InfluencerInput = {
  name?: string
  social_handles?: Record<string, unknown>
  niche_tags?: string[]
  tier?: string | null
  tier_manual_override?: boolean
  language?: string | null
  location_city?: string | null
  location_country?: string | null
  rate_post?: number | null
  rate_story?: number | null
  rate_reel?: number | null
  rate_video?: number | null
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
    out[platform as Platform] = { handle, url, followers }
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
  for (const k of ['rate_post', 'rate_story', 'rate_reel', 'rate_video'] as const) {
    if (body[k] !== undefined) {
      const v = body[k]
      if (v === null || v === undefined || (v as unknown) === '') {
        out[k] = null
      } else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        out[k] = v
      } else {
        return { ok: false, error: `invalid_${k}` }
      }
    }
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
