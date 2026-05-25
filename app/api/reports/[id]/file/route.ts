import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'

const BUCKET = 'report-uploads'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()

  const { data: row } = await supabase
    .from('report_uploads')
    .select('id, file_path, participant_id, campaign_id')
    .eq('id', id)
    .maybeSingle<{ id: string; file_path: string; participant_id: string; campaign_id: string | null }>()
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let ownerId: string | null = null
  if (row.campaign_id) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('owner_id')
      .eq('id', row.campaign_id)
      .maybeSingle<{ owner_id: string | null }>()
    ownerId = c?.owner_id ?? null
  }
  if (!canReadCampaign(user, { owner_id: ownerId })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const expectedPrefix = `${row.participant_id}/`
  if (!row.file_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS)
  if (error || !signed) {
    return NextResponse.json({ ok: false, error: 'sign_failed', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, signedUrl: signed.signedUrl })
}
