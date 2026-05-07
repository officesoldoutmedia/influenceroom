import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import { TASK_PRIORITIES, type TaskPriority } from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type CreateBody = {
  group_id?: string | null
  title?: string
  description?: string | null
  priority?: string
  assignee_id?: string | null
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

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ ok: false, error: 'missing_title' }, { status: 400 })
  }

  const priority = (body.priority ?? 'normal') as TaskPriority
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
    return NextResponse.json({ ok: false, error: 'invalid_priority' }, { status: 400 })
  }

  const h = await headers()
  const createdBy = h.get('x-user-id')

  const supabase = admin()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      campaign_id: id,
      group_id: body.group_id ?? null,
      title,
      description: body.description?.toString().trim() || null,
      priority,
      status: 'todo',
      assignee_id: body.assignee_id ?? null,
      due_date: body.due_date ?? null,
      created_by: createdBy,
    })
    .select('*, assignee:team_members!tasks_assignee_id_fkey(id, name, avatar_url)')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: data })
}
