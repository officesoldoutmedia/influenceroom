import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { searchInfluencers } from '@/lib/influencers/search'
import { validateAndNormalize, type InfluencerInput } from '@/lib/influencers/validate'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  try {
    const result = await searchInfluencers({
      q: sp.get('q'),
      tiers: sp.getAll('tier'),
      platform: sp.get('platform'),
      fmin: sp.get('fmin') ? Number(sp.get('fmin')) : null,
      fmax: sp.get('fmax') ? Number(sp.get('fmax')) : null,
      tags: sp.getAll('tag'),
      status: sp.get('status'),
      page: Number(sp.get('page') ?? '1'),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: 'server_error', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied

  let body: InfluencerInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const v = validateAndNormalize(body, false)
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })

  const supabase = admin()
  const { data, error } = await supabase
    .from('influencers')
    .insert(v.data)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, influencer: data })
}
