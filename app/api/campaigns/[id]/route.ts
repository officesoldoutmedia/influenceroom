import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { CAMPAIGN_STATUSES, type CampaignStatus } from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function authorize(id: string): Promise<NextResponse | null> {
  const h = await headers()
  const role = h.get('x-user-role')
  const userId = h.get('x-user-id')

  if (role === 'owner' || role === 'manager') return null
  if (role === 'account') {
    const supabase = admin()
    const { data } = await supabase.from('campaigns').select('owner_id').eq('id', id).maybeSingle()
    if (data?.owner_id === userId) return null
  }
  return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = admin()

  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select(
      `
        *,
        brand:brands(id, name, logo_url, contact_person, contact_email),
        owner:team_members!campaigns_owner_id_fkey(id, name, role, avatar_url)
      `,
    )
    .eq('id', id)
    .maybeSingle()

  if (cErr) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: cErr.message }, { status: 500 })
  }
  if (!campaign) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const [{ data: groups }, { data: tasks }] = await Promise.all([
    supabase.from('task_groups').select('*').eq('campaign_id', id).order('position', { ascending: true }),
    supabase
      .from('tasks')
      .select('*, assignee:team_members!tasks_assignee_id_fkey(id, name, avatar_url)')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    ok: true,
    campaign,
    groups: groups ?? [],
    tasks: tasks ?? [],
  })
}

type PatchBody = {
  name?: string
  brief?: string | null
  status?: string
  start_date?: string | null
  end_date?: string | null
  total_budget?: number | null
  deliverables_count?: number | null
  internal_notes?: string | null
  owner_id?: string | null
  brand_id?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await authorize(id)
  if (denied) return denied

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 })
    update.name = n
  }
  if (body.brief !== undefined) update.brief = body.brief?.toString().trim() || null
  if (body.status !== undefined) {
    if (!(CAMPAIGN_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
    }
    update.status = body.status as CampaignStatus
  }
  if (body.start_date !== undefined) update.start_date = body.start_date || null
  if (body.end_date !== undefined) update.end_date = body.end_date || null
  if (body.total_budget !== undefined) update.total_budget = body.total_budget
  if (body.deliverables_count !== undefined) update.deliverables_count = body.deliverables_count
  if (body.internal_notes !== undefined) update.internal_notes = body.internal_notes?.toString().trim() || null
  if (body.owner_id !== undefined) update.owner_id = body.owner_id || null
  if (body.brand_id !== undefined) update.brand_id = body.brand_id

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('campaigns')
    .update(update)
    .eq('id', id)
    .select(
      `
        *,
        brand:brands(id, name, logo_url),
        owner:team_members!campaigns_owner_id_fkey(id, name, role, avatar_url)
      `,
    )
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, campaign: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await authorize(id)
  if (denied) return denied

  const supabase = admin()
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'cancelled' })
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
