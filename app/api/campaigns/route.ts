import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser } from '@/lib/auth/scope'
import { listCampaigns } from '@/lib/campaigns/search'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  try {
    const result = await listCampaigns({
      q: sp.get('q'),
      statuses: sp.getAll('status'),
      brand: sp.get('brand'),
      owner: sp.get('owner'),
      monthFrom: sp.get('month_from'),
      monthTo: sp.get('month_to'),
      page: Number(sp.get('page') ?? '1'),
      user,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: 'server_error', detail }, { status: 500 })
  }
}

type CreateBody = {
  brand_id?: string
  name?: string
  status?: 'draft' | 'active'
  start_date?: string | null
  end_date?: string | null
  total_budget?: number | null
  deliverables_count?: number | null
  brief?: string | null
  owner_id?: string | null
  internal_notes?: string | null
}

type FieldError = { field: string; code: string }

function validateCreateBody(body: CreateBody): FieldError[] {
  const errors: FieldError[] = []
  if (!body.brand_id) errors.push({ field: 'brand_id', code: 'missing' })
  if (!body.name?.trim()) errors.push({ field: 'name', code: 'missing' })

  if (body.status === 'active') {
    if (!body.start_date) errors.push({ field: 'start_date', code: 'missing' })
    if (!body.end_date) errors.push({ field: 'end_date', code: 'missing' })
    if (body.start_date && body.end_date && body.start_date > body.end_date) {
      errors.push({ field: 'end_date', code: 'before_start' })
    }
  }
  return errors
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const errors = validateCreateBody(body)
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: 'validation_failed', errors }, { status: 422 })
  }

  const h = await headers()
  const createdBy = h.get('x-user-id')
  const supabase = admin()

  const { data, error } = await supabase.rpc('create_campaign', {
    p_brand_id: body.brand_id!,
    p_name: body.name!.trim(),
    p_start_date: body.start_date ?? null,
    p_end_date: body.end_date ?? null,
    p_total_budget: body.total_budget ?? null,
    p_deliverables_count: body.deliverables_count ?? null,
    p_brief: body.brief?.toString().trim() || null,
    p_owner_id: body.owner_id ?? createdBy,
    p_internal_notes: body.internal_notes?.toString().trim() || null,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  if (body.status === 'active' && data?.id) {
    const { error: updErr } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', data.id)
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: 'server_error', detail: updErr.message },
        { status: 500 },
      )
    }
    data.status = 'active'
  }

  return NextResponse.json({ ok: true, campaign: data })
}
