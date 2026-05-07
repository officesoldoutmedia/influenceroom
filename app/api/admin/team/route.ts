import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'

const ROLES = ['owner', 'manager', 'account', 'intern'] as const

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

  let body: { name?: string; email?: string; role?: string; pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const role = body.role
  const pin = body.pin

  if (!name || !email || !role || !pin) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 })
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'invalid_pin' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const supabase = admin()

  const { data: hashed, error: hashErr } = await supabase.rpc('hash_pin', { p_pin: pin })
  if (hashErr || typeof hashed !== 'string') {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('team_members')
    .insert({ name, email, role, pin_hash: hashed, active: true })
    .select('id, name, email, role, active, avatar_url, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'email_exists' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, member: data })
}
