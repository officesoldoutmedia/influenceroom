import { TIERS, STATUSES } from './types'

export type InfluencerInput = {
  name?: string
  primary_handle?: string | null
  platforms?: Record<string, unknown>
  niche_tags?: string[]
  tier?: string | null
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
}

export type ValidateResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

export function validateAndNormalize(body: InfluencerInput, partial = false): ValidateResult {
  const out: Record<string, unknown> = {}

  if (!partial || body.name !== undefined) {
    const n = body.name?.trim()
    if (!n) return { ok: false, error: 'missing_name' }
    out.name = n
  }
  if (body.primary_handle !== undefined) out.primary_handle = body.primary_handle?.trim() || null
  if (body.platforms !== undefined) out.platforms = body.platforms ?? {}
  if (body.niche_tags !== undefined) {
    if (!Array.isArray(body.niche_tags)) return { ok: false, error: 'invalid_tags' }
    out.niche_tags = body.niche_tags.map((t) => t.trim()).filter(Boolean)
  }
  if (body.tier !== undefined) {
    if (body.tier && !(TIERS as readonly string[]).includes(body.tier)) return { ok: false, error: 'invalid_tier' }
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

  return { ok: true, data: out }
}
