import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type CreateBody = {
  name?: string
  due_date?: string | null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 })
  }

  const supabase = admin()

  // Compute next position
  const { data: last } = await supabase
    .from('task_groups')
    .select('position')
    .eq('campaign_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (last?.position ?? 0) + 1

  const { data, error } = await supabase
    .from('task_groups')
    .insert({
      campaign_id: id,
      name,
      position: nextPosition,
      due_date: body.due_date ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, group: data })
}
