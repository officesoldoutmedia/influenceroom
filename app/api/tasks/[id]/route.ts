import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/campaigns/types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type PatchBody = {
  title?: string
  description?: string | null
  status?: string
  priority?: string
  due_date?: string | null
  assignee_id?: string | null
  group_id?: string | null
}

const INTERN_ALLOWED_FIELDS = new Set<keyof PatchBody>(['status'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const h = await headers()
  const role = h.get('x-user-role')
  const userId = h.get('x-user-id')

  const supabase = admin()
  const { data: task } = await supabase
    .from('tasks')
    .select('id, campaign_id, assignee_id, status, campaign:campaigns(owner_id)')
    .eq('id', id)
    .maybeSingle<{
      id: string
      campaign_id: string
      assignee_id: string | null
      status: string
      campaign: { owner_id: string | null } | null
    }>()

  if (!task) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const isFullWriter =
    role === 'owner' ||
    role === 'manager' ||
    (role === 'account' && task.campaign?.owner_id === userId)
  const isAssignee = task.assignee_id === userId

  if (!isFullWriter && !isAssignee) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Restrict to allowed fields if not a full writer
  if (!isFullWriter) {
    for (const k of Object.keys(body) as (keyof PatchBody)[]) {
      if (!INTERN_ALLOWED_FIELDS.has(k)) {
        return NextResponse.json({ ok: false, error: 'forbidden_field' }, { status: 403 })
      }
    }
  }

  const update: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ ok: false, error: 'invalid_title' }, { status: 400 })
    update.title = t
  }
  if (body.description !== undefined) update.description = body.description?.toString().trim() || null
  if (body.priority !== undefined) {
    if (!(TASK_PRIORITIES as readonly string[]).includes(body.priority)) {
      return NextResponse.json({ ok: false, error: 'invalid_priority' }, { status: 400 })
    }
    update.priority = body.priority
  }
  if (body.due_date !== undefined) update.due_date = body.due_date || null
  if (body.assignee_id !== undefined) update.assignee_id = body.assignee_id || null
  if (body.group_id !== undefined) update.group_id = body.group_id || null

  if (body.status !== undefined) {
    if (!(TASK_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
    }
    update.status = body.status
    // Auto-manage completed_at on status transitions to/from done
    if (body.status === 'done' && task.status !== 'done') {
      update.completed_at = new Date().toISOString()
    } else if (body.status !== 'done' && task.status === 'done') {
      update.completed_at = null
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select('*, assignee:team_members!tasks_assignee_id_fkey(id, name, avatar_url)')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, task: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const h = await headers()
  const role = h.get('x-user-role')
  const userId = h.get('x-user-id')

  const supabase = admin()
  const { data: task } = await supabase
    .from('tasks')
    .select('id, campaign:campaigns(owner_id)')
    .eq('id', id)
    .maybeSingle<{ id: string; campaign: { owner_id: string | null } | null }>()

  if (!task) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const isFullWriter =
    role === 'owner' ||
    role === 'manager' ||
    (role === 'account' && task.campaign?.owner_id === userId)

  if (!isFullWriter) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
