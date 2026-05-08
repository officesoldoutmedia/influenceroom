import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { CAMPAIGN_STATUSES, type CampaignStatus } from '@/lib/campaigns/types'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import { enqueueNotification } from '@/lib/notifications/enqueue'
import { APP_URL } from '@/lib/email/client'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
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
  const denied = await requireCampaignWriter(id)
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

  // Capture previous status to detect draft → active transition for hooks
  const { data: prev } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', id)
    .maybeSingle<{ status: string }>()
  const previousStatus = prev?.status ?? null

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
    .maybeSingle<{
      id: string
      name: string
      status: string
      start_date: string | null
      end_date: string | null
      brand: { id: string; name: string } | null
      owner: { id: string; name: string } | null
    }>()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Hook: campaign_started on draft → active
  try {
    if (previousStatus === 'draft' && data.status === 'active') {
      const h = await headers()
      const userId = h.get('x-user-id')
      const campaignUrl = `${APP_URL}/campaigns/${data.id}`
      const ownerName = data.owner?.name ?? 'Cineva'
      const brandName = data.brand?.name ?? '—'

      const [{ count: confirmedCount }, { data: recipients }] = await Promise.all([
        supabase
          .from('campaign_participants')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', data.id)
          .eq('status', 'confirmed'),
        supabase
          .from('team_members')
          .select('id, name, email, role, active')
          .eq('active', true)
          .neq('id', userId ?? ''),
      ])

      for (const r of recipients ?? []) {
        await enqueueNotification(
          {
            type: 'campaign_started',
            params: {
              recipientName: r.name,
              campaignName: data.name,
              brandName,
              ownerName,
              startDate: data.start_date,
              endDate: data.end_date,
              confirmedInfluencersCount: confirmedCount ?? 0,
              campaignUrl,
            },
          },
          { recipient: r, related_campaign_id: data.id },
        )
      }
    }
  } catch (err) {
    console.error('[campaign PATCH hooks] error:', err)
  }

  return NextResponse.json({ ok: true, campaign: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
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
