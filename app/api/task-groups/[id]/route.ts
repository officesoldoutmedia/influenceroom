import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type PatchBody = {
  name?: string
  due_date?: string | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = admin()
  const { data: group } = await supabase
    .from('task_groups')
    .select('id, campaign_id')
    .eq('id', id)
    .maybeSingle()

  if (!group) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const denied = await requireCampaignWriter(group.campaign_id)
  if (denied) return denied

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 })
    update.name = n
  }
  if (body.due_date !== undefined) update.due_date = body.due_date || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('task_groups')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, group: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = admin()
  const { data: group } = await supabase
    .from('task_groups')
    .select('id, campaign_id')
    .eq('id', id)
    .maybeSingle()

  if (!group) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const denied = await requireCampaignWriter(group.campaign_id)
  if (denied) return denied

  const { error } = await supabase.from('task_groups').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
