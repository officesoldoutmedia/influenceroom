import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import {
  MILESTONE_TYPES,
  MILESTONE_RESPONSIBLES,
  type MilestoneType,
  type MilestoneResponsible,
} from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const supabase = admin()

  let q = supabase
    .from('campaign_milestones')
    .select('*')
    .eq('campaign_id', id)
    .order('due_date', { ascending: true })
    .order('position', { ascending: true })

  const completed = sp.get('completed')
  if (completed === 'true') q = q.not('completed_at', 'is', null)
  if (completed === 'false') q = q.is('completed_at', null)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, items: data ?? [] })
}

type AddBody = {
  type?: string
  name?: string | null
  due_date?: string
  responsible?: string
  responsible_name?: string | null
  notes?: string | null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: AddBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  if (!body.type || !(MILESTONE_TYPES as readonly string[]).includes(body.type)) {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 422 })
  }
  const type = body.type as MilestoneType

  const name = body.name?.trim() || null
  if (type === 'other' && !name) {
    return NextResponse.json({ ok: false, error: 'name_required_for_other_type' }, { status: 422 })
  }

  if (!body.due_date) {
    return NextResponse.json({ ok: false, error: 'missing_due_date' }, { status: 422 })
  }

  const responsible = (body.responsible ?? 'account_manager') as MilestoneResponsible
  if (!(MILESTONE_RESPONSIBLES as readonly string[]).includes(responsible)) {
    return NextResponse.json({ ok: false, error: 'invalid_responsible' }, { status: 422 })
  }
  const responsibleName = body.responsible_name?.trim() || null
  if (responsible === 'other' && !responsibleName) {
    return NextResponse.json({ ok: false, error: 'responsible_name_required' }, { status: 422 })
  }

  const supabase = admin()
  const { data: maxRow } = await supabase
    .from('campaign_milestones')
    .select('position')
    .eq('campaign_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (maxRow?.position ?? -1) + 1

  const h = await headers()
  const createdBy = h.get('x-user-id')

  const { data, error } = await supabase
    .from('campaign_milestones')
    .insert({
      campaign_id: id,
      type,
      name,
      due_date: body.due_date,
      responsible,
      responsible_name: responsibleName,
      notes: body.notes?.trim() || null,
      position: nextPosition,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, item: data })
}
