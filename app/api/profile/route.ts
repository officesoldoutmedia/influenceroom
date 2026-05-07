import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const PREF_KEYS = [
  'task_assigned',
  'task_status_changed',
  'deadline_reminder',
  'daily_digest',
  'campaign_started',
] as const
type PrefKey = (typeof PREF_KEYS)[number]

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const SELECT = 'id, name, email, role, avatar_url, notification_prefs, active, created_at'

async function getUserId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-user-id')
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data, error } = await admin()
    .from('team_members')
    .select(SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  if (!data) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true, profile: data })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: {
    name?: unknown
    email?: unknown
    avatar_url?: unknown
    notification_prefs?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 422 })
    }
    const trimmed = body.name.trim()
    if (trimmed.length < 2 || trimmed.length > 100) {
      return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 422 })
    }
    update.name = trimmed
  }

  if (body.email !== undefined) {
    if (typeof body.email !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 422 })
    }
    const email = body.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 422 })
    }
    update.email = email
  }

  if (body.avatar_url !== undefined) {
    if (body.avatar_url === null || body.avatar_url === '') {
      update.avatar_url = null
    } else if (typeof body.avatar_url === 'string') {
      const trimmed = body.avatar_url.trim()
      if (!/^https:\/\/.+/i.test(trimmed)) {
        return NextResponse.json({ ok: false, error: 'invalid_avatar_url' }, { status: 422 })
      }
      update.avatar_url = trimmed
    } else {
      return NextResponse.json({ ok: false, error: 'invalid_avatar_url' }, { status: 422 })
    }
  }

  if (body.notification_prefs !== undefined) {
    if (
      typeof body.notification_prefs !== 'object' ||
      body.notification_prefs === null ||
      Array.isArray(body.notification_prefs)
    ) {
      return NextResponse.json({ ok: false, error: 'invalid_prefs' }, { status: 422 })
    }
    const incoming = body.notification_prefs as Record<string, unknown>
    const cleaned: Record<PrefKey, boolean> = {
      task_assigned: true,
      task_status_changed: true,
      deadline_reminder: true,
      daily_digest: true,
      campaign_started: true,
    }
    for (const k of PREF_KEYS) {
      if (k in incoming) {
        if (typeof incoming[k] !== 'boolean') {
          return NextResponse.json({ ok: false, error: 'invalid_prefs' }, { status: 422 })
        }
        cleaned[k] = incoming[k] as boolean
      }
    }
    update.notification_prefs = cleaned
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_update' }, { status: 400 })
  }

  const supabase = admin()

  if (typeof update.email === 'string') {
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', update.email)
      .neq('id', userId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: false, error: 'email_exists' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('team_members')
    .update(update)
    .eq('id', userId)
    .select(SELECT)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'email_exists' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true, profile: data })
}
