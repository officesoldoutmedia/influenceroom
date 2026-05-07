import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET() {
  const denied = await requireOwner()
  if (denied) return denied

  const supabase = admin()
  const { data, error } = await supabase
    .from('notification_rules')
    .select('id, event, enabled, config, updated_at')
    .order('event', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, items: data ?? [] })
}
