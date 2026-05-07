import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'
import { validateTemplate } from '@/lib/campaigns/template-validate'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const denied = await requireOwner()
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const v = validateTemplate(body as Parameters<typeof validateTemplate>[0], false)
  if (!v.ok) return NextResponse.json(v, { status: 400 })

  const supabase = admin()
  const { data, error } = await supabase
    .from('campaign_templates')
    .insert({
      name: v.data.name,
      description: v.data.description,
      default_duration_days: v.data.default_duration_days,
      active: v.data.active ?? true,
      default_task_groups: v.data.default_task_groups,
    })
    .select('id, name, description, default_duration_days, active, default_task_groups, created_at')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, template: data })
}
