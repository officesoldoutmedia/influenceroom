import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { validateAndNormalize, type InfluencerInput } from '@/lib/influencers/validate'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireWriter()
  if (denied) return denied

  const { id } = await params

  let body: InfluencerInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const v = validateAndNormalize(body, true)
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
  if (Object.keys(v.data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()
  const { data, error } = await supabase
    .from('influencers')
    .update(v.data)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, influencer: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireWriter()
  if (denied) return denied

  const { id } = await params

  const supabase = admin()
  const { data, error } = await supabase
    .from('influencers')
    .update({ status: 'inactive' })
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
