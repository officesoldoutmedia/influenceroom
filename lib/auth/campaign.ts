import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function requireCampaignWriter(campaignId: string): Promise<NextResponse | null> {
  const h = await headers()
  const role = h.get('x-user-role')
  const userId = h.get('x-user-id')

  if (role === 'owner' || role === 'manager') return null
  if (role === 'account') {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data } = await supabase
      .from('campaigns')
      .select('owner_id')
      .eq('id', campaignId)
      .maybeSingle()
    if (data?.owner_id === userId) return null
  }
  return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
}
