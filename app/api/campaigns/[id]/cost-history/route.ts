import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const { data: row } = await supabase
    .from('campaigns')
    .select('owner_id')
    .eq('id', id)
    .maybeSingle<{ owner_id: string | null }>()
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!canReadCampaign(user, { owner_id: row.owner_id })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: entries, error } = await supabase
    .from('campaign_cost_history')
    .select(`
      id, cost_type, amount_before, amount_after, changed_at,
      changed_by:team_members!campaign_cost_history_changed_by_fkey(id, name),
      participant:campaign_participants(id, account_handle, platform, influencer:influencers(name))
    `)
    .eq('campaign_id', id)
    .order('changed_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, entries: entries ?? [] })
}
