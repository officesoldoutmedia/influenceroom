// /api/campaigns/[id]/pdf
//   POST → render PDF, upload, prune to 5 latest, return signed URL.
//   GET  → re-sign existing path (?path=...) cu guard că path-ul aparţine
//          campaniei.
//
// Path A scoping: requireCampaignWriter pentru POST (echivalent cu PATCH),
// canReadCampaign pentru GET (read-only re-sign).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'
import {
  generateCampaignPDF,
  getCampaignPdfStoragePath,
  type CampaignForPdf,
  type ParticipantForPdf,
  type DeliverableForPdf,
  type MilestoneForPdf,
} from '@/lib/campaigns/pdf-single'

const BUCKET = 'campaign-pdfs'
const KEEP_LATEST = 5
const SIGNED_URL_TTL_SECONDS = 60 * 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const supabase = admin()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(`
      id, name, status, start_date, end_date, total_budget, deliverables_count, brief,
      brand:brands(name),
      owner:team_members!campaigns_owner_id_fkey(name)
    `)
    .eq('id', id)
    .maybeSingle<CampaignForPdf>()

  if (!campaign) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const [{ data: participants }, { data: deliverables }, { data: milestones }] = await Promise.all([
    supabase
      .from('campaign_participants')
      .select('id, platform, account_handle, status, agreed_fee, is_adhoc, influencer:influencers(name)')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('campaign_deliverables')
      .select('id, type, custom_type_label, quantity, post_date, status, published_url, participant_id, participant:campaign_participants!inner(campaign_id)')
      .eq('participant.campaign_id', id)
      .order('post_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('campaign_milestones')
      .select('id, type, name, due_date, responsible, responsible_name, completed_at')
      .eq('campaign_id', id)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  // PostgREST returnează relaţiile ca array chiar şi când e one-to-one.
  // Mapăm explicit la influencer (un singur element) pentru tipul nostru.
  type RawParticipant = Omit<ParticipantForPdf, 'influencer'> & {
    influencer: { name: string }[] | { name: string } | null
  }
  const flatParticipants: ParticipantForPdf[] = ((participants ?? []) as RawParticipant[]).map((p) => ({
    ...p,
    influencer: Array.isArray(p.influencer) ? p.influencer[0] ?? null : p.influencer,
  }))

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateCampaignPDF(
      campaign,
      flatParticipants,
      (deliverables ?? []) as unknown as DeliverableForPdf[],
      (milestones ?? []) as MilestoneForPdf[],
    )
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { ok: false, error: 'pdf_render_failed', detail },
      { status: 500 },
    )
  }

  const timestamp = Date.now()
  const path = getCampaignPdfStoragePath(id, timestamp)

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: 'upload_failed', detail: uploadErr.message },
      { status: 500 },
    )
  }

  try {
    const { data: list } = await supabase.storage.from(BUCKET).list(id, {
      sortBy: { column: 'name', order: 'desc' },
    })
    const old = (list ?? []).slice(KEEP_LATEST)
    if (old.length > 0) {
      await supabase.storage.from(BUCKET).remove(old.map((o) => `${id}/${o.name}`))
    }
  } catch (err) {
    console.error('[campaign pdf prune]', err)
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) {
    return NextResponse.json(
      { ok: false, error: 'sign_failed', detail: signErr?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    path,
    generatedAt: new Date(timestamp).toISOString(),
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Fetch owner_id ca să aplicăm Path A pe canReadCampaign.
  const supabase = admin()
  const { data: row } = await supabase
    .from('campaigns')
    .select('owner_id')
    .eq('id', id)
    .maybeSingle<{ owner_id: string | null }>()
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!canReadCampaign(user, { owner_id: row.owner_id })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path) {
    return NextResponse.json({ ok: false, error: 'missing_path' }, { status: 400 })
  }
  if (!path.startsWith(`${id}/`)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'sign_failed', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, signedUrl: data.signedUrl, path })
}
