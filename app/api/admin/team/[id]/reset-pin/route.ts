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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner()
  if (denied) return denied

  const { id } = await params

  let body: { pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const pin = body.pin
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'invalid_pin' }, { status: 400 })
  }

  const supabase = admin()

  const { data: hashed, error: hashErr } = await supabase.rpc('hash_pin', { p_pin: pin })
  if (hashErr || typeof hashed !== 'string') {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('team_members')
    .update({ pin_hash: hashed, failed_pin_attempts: 0, locked_until: null })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
