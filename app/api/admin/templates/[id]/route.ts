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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner()
  if (denied) return denied

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const v = validateTemplate(body as Parameters<typeof validateTemplate>[0], true)
  if (!v.ok) return NextResponse.json(v, { status: 400 })

  const update: Record<string, unknown> = {}
  for (const key of ['name', 'description', 'default_duration_days', 'active', 'default_task_groups'] as const) {
    const val = (v.data as unknown as Record<string, unknown>)[key]
    if (val !== undefined) update[key] = val
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('campaign_templates')
    .update(update)
    .eq('id', id)
    .select('id, name, description, default_duration_days, active, default_task_groups, created_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, template: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner()
  if (denied) return denied

  const { id } = await params
  const supabase = admin()

  const { count: refCount, error: countErr } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)
  if (countErr) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: countErr.message }, { status: 500 })
  }

  if ((refCount ?? 0) > 0) {
    // Soft-delete: set active=false. Existing campaigns keep their cloned task_groups/tasks
    // (template_id FK is ON DELETE SET NULL but we don't hard-delete here, so it stays linked).
    const { data, error } = await supabase
      .from('campaign_templates')
      .update({ active: false })
      .eq('id', id)
      .select('id, active')
      .maybeSingle()
    if (error) {
      return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, soft_deleted: true, campaigns_count: refCount })
  }

  const { error } = await supabase.from('campaign_templates').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, soft_deleted: false, campaigns_count: 0 })
}
