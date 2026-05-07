import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type PatchBody = {
  enabled?: boolean
  config?: Record<string, unknown>
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner()
  if (denied) return denied

  const { id } = await params

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.enabled === 'boolean') update.enabled = body.enabled
  if (body.config !== undefined && typeof body.config === 'object' && body.config !== null) {
    update.config = body.config
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }
  update.updated_at = new Date().toISOString()

  const supabase = admin()
  const { data, error } = await supabase
    .from('notification_rules')
    .update(update)
    .eq('id', id)
    .select('id, event, enabled, config, updated_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, rule: data })
}
