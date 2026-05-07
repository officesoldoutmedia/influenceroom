import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET() {
  const supabase = admin()
  const { data, error } = await supabase
    .from('campaign_templates')
    .select('id, name, description, default_task_groups, active, created_at')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, items: data ?? [] })
}
