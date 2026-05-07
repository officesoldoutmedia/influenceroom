import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sign, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth/jwt'

type VerifyRow = {
  id: string | null
  name: string | null
  role: 'owner' | 'manager' | 'account' | 'intern' | null
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  let body: { user_id?: string; pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { user_id, pin } = body
  if (!user_id || !pin) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  const supabase = admin()

  const { data, error } = await supabase.rpc('verify_pin', {
    p_user_id: user_id,
    p_pin: pin,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  const verified: VerifyRow | null = Array.isArray(data) ? (data[0] ?? null) : data

  if (verified && verified.id && verified.role && verified.name) {
    const token = await sign({ user_id: verified.id, role: verified.role })
    const res = NextResponse.json({
      ok: true,
      user: { id: verified.id, name: verified.name, role: verified.role },
    })
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return res
  }

  const { data: row } = await supabase
    .from('team_members')
    .select('locked_until')
    .eq('id', user_id)
    .maybeSingle()

  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return NextResponse.json(
      { ok: false, error: 'locked', locked_until: row.locked_until },
      { status: 423 },
    )
  }

  return NextResponse.json({ ok: false, error: 'invalid_pin' }, { status: 401 })
}
