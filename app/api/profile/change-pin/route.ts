import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: { current_pin?: unknown; new_pin?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const current = body.current_pin
  const next = body.new_pin
  if (typeof current !== 'string' || typeof next !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  if (!/^\d{4}$/.test(next)) {
    return NextResponse.json({ ok: false, error: 'invalid_format' }, { status: 422 })
  }

  const { data, error } = await admin().rpc('change_pin', {
    p_user_id: userId,
    p_current_pin: current,
    p_new_pin: next,
  })

  if (error) {
    console.error('[change_pin] rpc error:', error.message)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (result.ok) return NextResponse.json({ ok: true })

  const code = result.error ?? 'invalid_current_pin'
  const status = code === 'invalid_format' ? 422 : 400
  return NextResponse.json({ ok: false, error: code }, { status })
}
