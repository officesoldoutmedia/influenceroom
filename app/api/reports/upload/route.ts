import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'
import {
  ACCEPTED_MIMES,
  MAX_FILE_SIZE_BYTES,
  KPI_KEYS,
  sanitizeFilename,
} from '@/lib/reports/types'

const BUCKET = 'report-uploads'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function parseKpi(value: FormDataEntryValue | null): number | null {
  if (value == null) return null
  const s = typeof value === 'string' ? value.trim() : ''
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_form' }, { status: 400 })
  }

  const participantId = form.get('participant_id')
  if (typeof participantId !== 'string' || participantId.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_participant' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'missing_file' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'file_too_large', limit: MAX_FILE_SIZE_BYTES },
      { status: 422 },
    )
  }
  if (!(ACCEPTED_MIMES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_mime', mime: file.type },
      { status: 422 },
    )
  }

  const supabase = admin()

  // Scope check: participant → campaign owner
  const { data: participant } = await supabase
    .from('campaign_participants')
    .select('id, campaign_id, influencer_id, campaign:campaigns(owner_id)')
    .eq('id', participantId)
    .maybeSingle<{
      id: string
      campaign_id: string
      influencer_id: string | null
      campaign: { owner_id: string | null }[] | { owner_id: string | null } | null
    }>()
  if (!participant) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  const camp = Array.isArray(participant.campaign)
    ? participant.campaign[0] ?? null
    : participant.campaign
  if (!canReadCampaign(user, { owner_id: camp?.owner_id ?? null })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Upload Storage
  const timestamp = Date.now()
  const safeName = sanitizeFilename(file.name)
  const path = `${participantId}/${timestamp}-${safeName}`
  const fileBuf = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuf, { contentType: file.type, upsert: false })
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: 'upload_failed', detail: uploadErr.message },
      { status: 500 },
    )
  }

  // Build KPI row
  const kpi: Record<string, number | null> = {}
  for (const k of KPI_KEYS) {
    kpi[k] = parseKpi(form.get(k))
  }
  const notesRaw = form.get('notes')
  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null

  const insertPayload = {
    participant_id: participantId,
    campaign_id: participant.campaign_id,
    influencer_id: participant.influencer_id,
    file_path: path,
    file_name: file.name,
    file_size_bytes: file.size,
    file_mime: file.type,
    notes,
    uploaded_by: user.id,
    updated_by: user.id,
    ...kpi,
  }

  const { data: row, error: insertErr } = await supabase
    .from('report_uploads')
    .insert(insertPayload)
    .select('*')
    .maybeSingle()

  if (insertErr || !row) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    return NextResponse.json(
      { ok: false, error: 'insert_failed', detail: insertErr?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  return NextResponse.json({
    ok: true,
    report: { ...row, signedUrl: signed?.signedUrl ?? null },
  })
}
