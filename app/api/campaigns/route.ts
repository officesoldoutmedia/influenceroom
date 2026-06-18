import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser } from '@/lib/auth/scope'
import { listCampaigns } from '@/lib/campaigns/search'
import { PR_TYPES, SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type AdminClient = ReturnType<typeof admin>

type AddParticipantResult = 'added' | 'skipped_inactive' | 'skipped_unavailable' | 'error'

/** Inserează un participant pe campanie, derivând account_handle (NOT NULL) din
 * profilul influencer-ului pentru platforma dată, cu fallback pe nume.
 * Best-effort: doar influenceri existenți + activi (paritate cu /participants);
 * campania rămâne creată chiar dacă un participant nu trece. Întoarce un rezultat
 * ca apelantul să poată raporta în UI ce nu s-a adăugat (vs. dispariție silent).
 * Folosit la creare pentru influencerul principal + participanții adiționali. */
async function addCampaignParticipant(
  supabase: AdminClient,
  opts: {
    campaignId: string
    influencerId: string
    platform: SocialPlatform
    fee?: number | null
    addedBy: string | null
  },
): Promise<AddParticipantResult> {
  const { data: inf } = await supabase
    .from('influencers')
    .select('name, status, social_handles')
    .eq('id', opts.influencerId)
    .maybeSingle()
  if (!inf) return 'skipped_unavailable'
  if (inf.status !== 'active') return 'skipped_inactive'
  const handles = inf.social_handles as Record<string, { handle?: string }> | null
  const accountHandle = handles?.[opts.platform]?.handle?.trim() || inf.name?.trim() || ''
  if (!accountHandle) return 'skipped_unavailable'
  const { error } = await supabase.from('campaign_participants').insert({
    campaign_id: opts.campaignId,
    influencer_id: opts.influencerId,
    platform: opts.platform,
    account_handle: accountHandle,
    is_adhoc: false,
    agreed_fee: opts.fee ?? null,
    added_by: opts.addedBy,
  })
  if (error) {
    console.error('[campaign create participant]', error)
    return 'error'
  }
  return 'added'
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
      influencer: sp.get('influencer'),
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
  agency_name?: string | null
  /** Tip PR (optional): pr_seeding / pr_blitz / pr_eveniment. */
  pr_type?: string | null
  /** Influencer principal (optional): la submit creez auto un campaign_participant
   * cu acest influencer + platform default (Instagram). */
  primary_influencer_id?: string | null
  /** Participanti aditionali adaugati direct in formularul de creare. Fiecare
   * aduce influencer + platforma + fee; account_handle se derivă server-side. */
  participants?: Array<{
    influencer_id?: string
    platform?: string
    agreed_fee?: number | null
  }>
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

  if (
    body.pr_type !== undefined && body.pr_type !== null &&
    !(PR_TYPES as readonly string[]).includes(body.pr_type)
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_pr_type' }, { status: 422 })
  }

  const h = await headers()
  const createdBy = h.get('x-user-id')
  const supabase = admin()

  // RPC create_campaign returnează uuid string (NU obiect). Tratăm explicit.
  const { data: createdId, error } = await supabase.rpc('create_campaign', {
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

  if (error || typeof createdId !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error?.message ?? 'no_id_returned' },
      { status: 500 },
    )
  }

  // Aplicăm agency_name + status într-un singur update după create_campaign RPC
  // (RPC-ul nu acceptă încă agency_name; tot el creează campania cu status='draft').
  const update: Record<string, unknown> = {}
  if (body.agency_name !== undefined) {
    update.agency_name = body.agency_name?.toString().trim() || null
  }
  if (body.pr_type !== undefined) update.pr_type = body.pr_type || null
  if (body.status === 'active') update.status = 'active'
  if (Object.keys(update).length > 0) {
    const { error: updErr } = await supabase
      .from('campaigns')
      .update(update)
      .eq('id', createdId)
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: 'server_error', detail: updErr.message },
        { status: 500 },
      )
    }
  }

  // Participanți creați direct din formularul de creare (best-effort — campania
  // rămâne creată chiar dacă un insert eșuează). Influencerul principal devine
  // participant Instagram; participanții adiționali aduc platforma + fee proprii.
  // BUGFIX (istoric): account_handle e NOT NULL — insert-ul vechi îl omitea și
  // participantul principal pica silent. Acum se derivă în addCampaignParticipant.
  // Dedup pe (influencer × platformă) ca să nu dublăm același rând.
  const seenParticipants = new Set<string>()
  const skippedParticipants: Array<{ influencer_id: string; reason: AddParticipantResult }> = []
  if (body.primary_influencer_id) {
    seenParticipants.add(`${body.primary_influencer_id}:instagram`)
    const r = await addCampaignParticipant(supabase, {
      campaignId: createdId,
      influencerId: body.primary_influencer_id,
      platform: 'instagram',
      addedBy: createdBy,
    })
    if (r !== 'added') skippedParticipants.push({ influencer_id: body.primary_influencer_id, reason: r })
  }
  for (const p of body.participants ?? []) {
    if (!p?.influencer_id) continue
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(p.platform ?? '')) continue
    const key = `${p.influencer_id}:${p.platform}`
    if (seenParticipants.has(key)) continue
    seenParticipants.add(key)
    const r = await addCampaignParticipant(supabase, {
      campaignId: createdId,
      influencerId: p.influencer_id,
      platform: p.platform as SocialPlatform,
      fee: p.agreed_fee ?? null,
      addedBy: createdBy,
    })
    if (r !== 'added') skippedParticipants.push({ influencer_id: p.influencer_id, reason: r })
  }

  // Fetch obiectul complet pentru response (cu status + agency_name actualizate).
  const { data: campaign, error: fetchErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', createdId)
    .maybeSingle()
  if (fetchErr || !campaign) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: fetchErr?.message ?? 'created_but_not_found' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, campaign, participants_skipped: skippedParticipants })
}
