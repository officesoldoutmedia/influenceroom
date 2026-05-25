import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'
import { KPI_KEYS } from '@/lib/reports/types'

const BUCKET = 'report-uploads'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function fetchMeta(
  supabase: ReturnType<typeof admin>,
  reportId: string,
): Promise<{ ownerId: string | null; filePath: string; participantId: string } | null> {
  const { data: row } = await supabase
    .from('report_uploads')
    .select('id, file_path, participant_id, campaign_id')
    .eq('id', reportId)
    .maybeSingle<{ id: string; file_path: string; participant_id: string; campaign_id: string | null }>()
  if (!row) return null
  let ownerId: string | null = null
  if (row.campaign_id) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('owner_id')
      .eq('id', row.campaign_id)
      .maybeSingle<{ owner_id: string | null }>()
    ownerId = c?.owner_id ?? null
  }
  return { ownerId, filePath: row.file_path, participantId: row.participant_id }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const meta = await fetchMeta(supabase, id)
  if (!meta) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!canReadCampaign(user, { owner_id: meta.ownerId })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const k of KPI_KEYS) {
    if (!(k in body)) continue
    const v = body[k]
    if (v === null || v === '') {
      update[k] = null
      continue
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
      return NextResponse.json({ ok: false, error: 'invalid_kpi', field: k }, { status: 422 })
    }
    update[k] = v
  }
  if ('notes' in body) {
    const n = body.notes
    update.notes = typeof n === 'string' && n.trim() ? n.trim() : null
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }
  update.updated_by = user.id
  update.updated_at = new Date().toISOString()

  const { data: row, error } = await supabase
    .from('report_uploads')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error || !row) {
    return NextResponse.json(
      { ok: false, error: 'update_failed', detail: error?.message ?? 'not_found' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, report: row })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const meta = await fetchMeta(supabase, id)
  if (!meta) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!canReadCampaign(user, { owner_id: meta.ownerId })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  await supabase.storage.from(BUCKET).remove([meta.filePath]).catch((err) => {
    console.error('[report delete storage]', err)
  })

  const { error } = await supabase.from('report_uploads').delete().eq('id', id)
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'delete_failed', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
