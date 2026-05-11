import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
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

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied

  let body: {
    name?: string
    company?: string
    industry?: string
    contact_person?: string
    contact_email?: string
    contact_phone?: string
    billing_notes?: string
    logo_url?: string
    notes?: string
    status?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 })
  }

  const status = body.status ?? 'active'
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  if (body.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.contact_email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const h = await headers()
  const createdBy = h.get('x-user-id')

  const supabase = admin()
  const { data, error } = await supabase
    .from('brands')
    .insert({
      name,
      company: body.company?.trim() || null,
      industry: body.industry?.trim() || null,
      contact_person: body.contact_person?.trim() || null,
      contact_email: body.contact_email?.trim() || null,
      contact_phone: body.contact_phone?.trim() || null,
      billing_data: body.billing_notes ? { notes: body.billing_notes } : null,
      logo_url: body.logo_url?.trim() || null,
      notes: body.notes?.trim() || null,
      status,
      created_by: createdBy,
    })
    .select('id, name, company, industry, contact_person, contact_email, contact_phone, logo_url, notes, billing_data, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, brand: data })
}
