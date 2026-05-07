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

type Body = {
  groups?: { id: string; position: number }[]
  tasks?: { id: string; position: number; group_id: string | null }[]
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const supabase = admin()
  const errors: string[] = []

  if (Array.isArray(body.groups)) {
    for (const g of body.groups) {
      const { error } = await supabase
        .from('task_groups')
        .update({ position: g.position })
        .eq('id', g.id)
        .eq('campaign_id', id)
      if (error) errors.push(`group ${g.id}: ${error.message}`)
    }
  }

  if (Array.isArray(body.tasks)) {
    for (const t of body.tasks) {
      const { error } = await supabase
        .from('tasks')
        .update({ position: t.position, group_id: t.group_id })
        .eq('id', t.id)
        .eq('campaign_id', id)
      if (error) errors.push(`task ${t.id}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: 'partial_failure', detail: errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
