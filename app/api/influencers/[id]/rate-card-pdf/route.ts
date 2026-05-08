// /api/influencers/[id]/rate-card-pdf
//
//   POST → render PDF, upload to Storage as
//          rate-cards/<influencer_id>/<timestamp>-rate-card.pdf, prune to the
//          latest 5 versions for that influencer, return a 1h signed URL.
//   GET  → re-mint a 1h signed URL for an existing path (?path=...). Useful
//          when the user reloads the page and we don't want to regenerate.
//
// Path A scoping: read uses canReadInfluencer (404 if out-of-scope so probing
// account users can't enumerate IDs); write side reuses requireInfluencerWriter
// — same gate as the rest of the influencer write surface.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getCurrentUser,
  canReadInfluencer,
  requireInfluencerWriter,
} from '@/lib/auth/scope'
import {
  generateRateCardPDF,
  getRateCardStoragePath,
  NoRatesError,
} from '@/lib/rate-cards/pdf-generator'
import type { Influencer } from '@/lib/influencers/types'

const BUCKET = 'rate-cards'
const KEEP_LATEST = 5
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1h

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

  // Same authz contract as PATCH /api/influencers/[id]: owner/manager bypass,
  // account gated to assigned/unassigned. requireInfluencerWriter handles 401/403.
  const denied = await requireInfluencerWriter(id)
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()

  const { data: inf } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', id)
    .maybeSingle<Influencer>()

  if (!inf) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateRateCardPDF(inf)
  } catch (err) {
    if (err instanceof NoRatesError) {
      return NextResponse.json(
        { ok: false, error: 'no_rates_to_export' },
        { status: 422 },
      )
    }
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { ok: false, error: 'pdf_render_failed', detail },
      { status: 500 },
    )
  }

  const timestamp = Date.now()
  const path = getRateCardStoragePath(id, timestamp)

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: 'upload_failed', detail: uploadErr.message },
      { status: 500 },
    )
  }

  // Prune older versions — keep most recent KEEP_LATEST. Failures here don't
  // block the response; the user already has their fresh download URL.
  await pruneOldRateCards(supabase, id).catch((e) => {
    console.warn('[rate-card-pdf] prune failed:', e)
  })

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
    downloadUrl: signed.signedUrl,
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

  const supabase = admin()

  // Read-side scoping: 404 (not 403) on out-of-scope influencer.
  const { data: inf } = await supabase
    .from('influencers')
    .select('account_manager_id')
    .eq('id', id)
    .maybeSingle()
  if (!inf || !canReadInfluencer(user, inf)) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const requestedPath = req.nextUrl.searchParams.get('path')
  if (!requestedPath) {
    return NextResponse.json({ ok: false, error: 'missing_path' }, { status: 400 })
  }
  // Defence: only accept paths that belong to this influencer's directory.
  // A user with read access to influencer A must not be able to mint signed
  // URLs for objects under another influencer's directory.
  const expectedPrefix = `${id}/`
  if (!requestedPath.startsWith(expectedPrefix) || requestedPath.includes('..')) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 })
  }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(requestedPath, SIGNED_URL_TTL_SECONDS)
  if (error || !signed) {
    return NextResponse.json(
      { ok: false, error: 'sign_failed', detail: error?.message ?? 'unknown' },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, downloadUrl: signed.signedUrl, path: requestedPath })
}

async function pruneOldRateCards(
  supabase: ReturnType<typeof admin>,
  influencerId: string,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).list(influencerId, {
    limit: 100,
    sortBy: { column: 'name', order: 'desc' },
  })
  if (error || !data) return

  const stale = data.slice(KEEP_LATEST)
  if (stale.length === 0) return

  const stalePaths = stale.map((f) => `${influencerId}/${f.name}`)
  await supabase.storage.from(BUCKET).remove(stalePaths)
}
