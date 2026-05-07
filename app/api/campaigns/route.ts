import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { listCampaigns } from '@/lib/campaigns/search'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  try {
    const result = await listCampaigns({
      q: sp.get('q'),
      statuses: sp.getAll('status'),
      brand: sp.get('brand'),
      owner: sp.get('owner'),
      page: Number(sp.get('page') ?? '1'),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: 'server_error', detail }, { status: 500 })
  }
}

type CreateBody = {
  brand_id?: string
  template_id?: string | null
  name?: string
  start_date?: string | null
  end_date?: string | null
  total_budget?: number | null
  deliverables_count?: number | null
  brief?: string | null
  owner_id?: string | null
  internal_notes?: string | null
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

  if (!body.brand_id) return NextResponse.json({ ok: false, error: 'missing_brand' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 })

  const h = await headers()
  const createdBy = h.get('x-user-id')

  const supabase = admin()
  const { data, error } = await supabase.rpc('create_campaign_from_template', {
    p_brand_id: body.brand_id,
    p_template_id: body.template_id ?? null,
    p_name: body.name.trim(),
    p_start_date: body.start_date ?? null,
    p_end_date: body.end_date ?? null,
    p_total_budget: body.total_budget ?? null,
    p_deliverables_count: body.deliverables_count ?? null,
    p_brief: body.brief?.toString().trim() || null,
    p_owner_id: body.owner_id ?? createdBy,
    p_internal_notes: body.internal_notes?.toString().trim() || null,
    p_created_by: createdBy,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, campaign: data })
}
