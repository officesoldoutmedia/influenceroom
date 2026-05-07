import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'

const STATUSES = ['active', 'inactive'] as const

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
  const denied = await requireWriter()
  if (denied) return denied

  const { id } = await params

  let body: {
    name?: string
    contact_person?: string | null
    contact_email?: string | null
    contact_phone?: string | null
    billing_notes?: string | null
    logo_url?: string | null
    notes?: string | null
    status?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, string | null | { notes: string }> = {}

  if (typeof body.name === 'string') {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 })
    update.name = n
  }
  if (body.contact_person !== undefined) {
    update.contact_person = body.contact_person?.toString().trim() || null
  }
  if (body.contact_email !== undefined) {
    const e = body.contact_email?.toString().trim() || null
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }
    update.contact_email = e
  }
  if (body.contact_phone !== undefined) {
    update.contact_phone = body.contact_phone?.toString().trim() || null
  }
  if (body.billing_notes !== undefined) {
    const v = body.billing_notes?.toString().trim() || null
    update.billing_data = v ? { notes: v } : null
  }
  if (body.logo_url !== undefined) {
    update.logo_url = body.logo_url?.toString().trim() || null
  }
  if (body.notes !== undefined) {
    update.notes = body.notes?.toString().trim() || null
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
    }
    update.status = body.status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('brands')
    .update(update)
    .eq('id', id)
    .select('id, name, contact_person, contact_email, contact_phone, logo_url, notes, billing_data, status, created_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, brand: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireWriter()
  if (denied) return denied

  const { id } = await params

  const supabase = admin()
  const { data, error } = await supabase
    .from('brands')
    .update({ status: 'inactive' })
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
