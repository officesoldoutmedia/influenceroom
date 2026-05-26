// /api/campaigns/report-pdf
//   POST { monthFrom?, monthTo?, statuses?, brand?, owner?, q? }
//   → fetch filtered campaigns (limit 100), generate summary PDF, upload,
//     prune _reports/ to 10 latest, return signed URL.
//
// Path A scoping: requireWriter (owner/manager/account/intern din writer-list).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser } from '@/lib/auth/scope'
import { listCampaigns } from '@/lib/campaigns/search'
import {
  generateCampaignReportPDF,
  getCampaignReportStoragePath,
  type ReportCampaign,
  type ReportFilters,
} from '@/lib/campaigns/pdf-report'

const BUCKET = 'campaign-pdfs'
const REPORTS_PREFIX = '_reports'
const KEEP_LATEST = 10
const SIGNED_URL_TTL_SECONDS = 60 * 60
const MAX_CAMPAIGNS = 100

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type Body = {
  monthFrom?: string | null
  monthTo?: string | null
  statuses?: string[]
  brand?: string | null
  owner?: string | null
  influencer?: string | null
  q?: string | null
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    // empty body OK — toate filtre null = toate campaniile (cu cap 100)
  }

  const supabase = admin()
  const collected: ReportCampaign[] = []
  let page = 1
  const pageSize = 20
  while (collected.length < MAX_CAMPAIGNS + 1 && page <= 6) {
    const res = await listCampaigns({
      q: body.q ?? null,
      statuses: body.statuses ?? [],
      brand: body.brand ?? null,
      owner: body.owner ?? null,
      influencer: body.influencer ?? null,
      monthFrom: body.monthFrom ?? null,
      monthTo: body.monthTo ?? null,
      page,
      user,
    })
    for (const c of res.items) {
      collected.push({
        id: c.id,
        name: c.name,
        status: c.status,
        start_date: c.start_date,
        end_date: c.end_date,
        total_budget: c.total_budget,
        brand_name: c.brand?.name ?? null,
        participants_count: 0,
      })
    }
    if (res.items.length < pageSize) break
    page++
  }

  if (collected.length > MAX_CAMPAIGNS) {
    return NextResponse.json(
      {
        ok: false,
        error: 'too_many_campaigns',
        limit: MAX_CAMPAIGNS,
        message: `Filtrele curente returnează peste ${MAX_CAMPAIGNS} campanii. Restrângeţi filtrele.`,
      },
      { status: 422 },
    )
  }

  if (collected.length > 0) {
    const ids = collected.map((c) => c.id)
    const { data: counts } = await supabase
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', ids)
    const countMap = new Map<string, number>()
    for (const row of counts ?? []) {
      const cid = (row as { campaign_id: string }).campaign_id
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1)
    }
    for (const c of collected) {
      c.participants_count = countMap.get(c.id) ?? 0
    }
  }

  let brandName: string | null = null
  let ownerName: string | null = null
  if (body.brand) {
    const { data } = await supabase
      .from('brands')
      .select('name')
      .eq('id', body.brand)
      .maybeSingle<{ name: string }>()
    brandName = data?.name ?? null
  }
  if (body.owner) {
    const { data } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', body.owner)
      .maybeSingle<{ name: string }>()
    ownerName = data?.name ?? null
  }

  const filters: ReportFilters = {
    monthFrom: body.monthFrom ?? null,
    monthTo: body.monthTo ?? null,
    statuses: body.statuses ?? [],
    brandName,
    ownerName,
    search: body.q ?? null,
  }

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateCampaignReportPDF(collected, filters)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { ok: false, error: 'pdf_render_failed', detail },
      { status: 500 },
    )
  }

  const timestamp = Date.now()
  const path = getCampaignReportStoragePath(timestamp, body.monthFrom ?? null, body.monthTo ?? null)

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
    const { data: list } = await supabase.storage.from(BUCKET).list(REPORTS_PREFIX, {
      sortBy: { column: 'name', order: 'desc' },
    })
    const old = (list ?? []).slice(KEEP_LATEST)
    if (old.length > 0) {
      await supabase.storage.from(BUCKET).remove(old.map((o) => `${REPORTS_PREFIX}/${o.name}`))
    }
  } catch (err) {
    console.error('[report pdf prune]', err)
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
    count: collected.length,
    generatedAt: new Date(timestamp).toISOString(),
  })
}
