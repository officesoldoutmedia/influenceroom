import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner()
  if (denied) return denied

  const { id } = await params

  let body: { name?: string; email?: string; role?: string; active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, string | boolean> = {}
  if (typeof body.name === 'string') {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 })
    update.name = n
  }
  if (typeof body.email === 'string') {
    const e = body.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }
    update.email = e
  }
  if (typeof body.role === 'string') {
    if (!ROLES.includes(body.role as (typeof ROLES)[number])) {
      return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 })
    }
    update.role = body.role
  }
  if (typeof body.active === 'boolean') {
    update.active = body.active
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('team_members')
    .update(update)
    .eq('id', id)
    .select('id, name, email, role, active, avatar_url, created_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'email_exists' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, member: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner()
  if (denied) return denied

  const { id } = await params

  const h = await headers()
  if (h.get('x-user-id') === id) {
    return NextResponse.json({ ok: false, error: 'cannot_delete_self' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('team_members')
    .update({ active: false })
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
