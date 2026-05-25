import { createClient } from '@supabase/supabase-js'

export const WEIGHT_KEYS = [
  'weight_engagement_rate',
  'weight_cpv',
  'weight_audience_ro',
  'weight_punctuality',
  'weight_deliverable_quality',
  'weight_collaboration_history',
] as const

export type WeightKey = (typeof WEIGHT_KEYS)[number]
export type Weights = Record<WeightKey, number>

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export function diffWeights(
  before: Weights,
  after: Weights,
): Record<string, { old: number; new: number }> {
  const changes: Record<string, { old: number; new: number }> = {}
  for (const k of WEIGHT_KEYS) {
    if (before[k] !== after[k]) {
      changes[k] = { old: before[k], new: after[k] }
    }
  }
  return changes
}

export async function logWeightsChange(params: {
  before: Weights
  after: Weights
  changedBy: string | null
}): Promise<void> {
  const changes = diffWeights(params.before, params.after)
  if (Object.keys(changes).length === 0) return

  try {
    const supabase = admin()
    const { error } = await supabase.from('scoring_settings_history').insert({
      weights_before: params.before,
      weights_after: params.after,
      changes,
      changed_by: params.changedBy,
    })
    if (error) console.error('[scoring weights audit]', error.message)
  } catch (err) {
    console.error('[scoring weights audit]', err)
  }
}
