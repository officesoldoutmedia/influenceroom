import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export type CostType = 'total_budget' | 'agreed_fee'

/**
 * Append un rând în campaign_cost_history pentru o modificare reală de cost.
 * Idempotency: nu se inserează nimic dacă before === after.
 * Best-effort: orice eroare e logată dar nu propagată — update-ul principal
 * nu trebuie blocat de un audit failure.
 */
export async function logCostChange(params: {
  campaignId: string
  participantId?: string | null
  costType: CostType
  before: number | null
  after: number | null
  changedBy: string | null
}): Promise<void> {
  if (params.before === params.after) return

  try {
    const supabase = admin()
    const { error } = await supabase.from('campaign_cost_history').insert({
      campaign_id: params.campaignId,
      participant_id: params.participantId ?? null,
      cost_type: params.costType,
      amount_before: params.before,
      amount_after: params.after,
      changed_by: params.changedBy,
    })
    if (error) console.error('[campaign cost audit]', error.message)
  } catch (err) {
    console.error('[campaign cost audit]', err)
  }
}
