import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'
import {
  sendBroadcast,
  VALID_ROLES,
  type RecipientFilter,
  type Role,
} from '@/lib/broadcast/send'

const VALID_METHODS = ['email', 'push'] as const
type Method = (typeof VALID_METHODS)[number]

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function parseFilter(raw: unknown): RecipientFilter | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as { type?: unknown; roles?: unknown; user_ids?: unknown }
  if (f.type === 'all') return { type: 'all' }
  if (f.type === 'roles') {
    if (!Array.isArray(f.roles) || !f.roles.length) return null
    const cleaned = f.roles.filter((r): r is Role =>
      typeof r === 'string' && (VALID_ROLES as readonly string[]).includes(r),
    )
    if (!cleaned.length) return null
    return { type: 'roles', roles: cleaned }
  }
  if (f.type === 'users') {
    if (!Array.isArray(f.user_ids) || !f.user_ids.length) return null
    const cleaned = f.user_ids.filter(
      (id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id),
    )
    if (!cleaned.length) return null
    return { type: 'users', user_ids: Array.from(new Set(cleaned)) }
  }
  return null
}

export async function POST(req: NextRequest) {
  const denied = await requireOwner()
  if (denied) return denied

  const h = await headers()
  const senderId = h.get('x-user-id')!

  let body: {
    subject?: unknown
    body?: unknown
    recipient_filter?: unknown
    methods?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (subject.length < 2 || subject.length > 200) {
    return NextResponse.json({ ok: false, error: 'invalid_subject' }, { status: 422 })
  }
  if (text.length < 2 || text.length > 2000) {
    return NextResponse.json({ ok: false, error: 'invalid_body_text' }, { status: 422 })
  }

  const filter = parseFilter(body.recipient_filter)
  if (!filter) {
    return NextResponse.json({ ok: false, error: 'invalid_recipient_filter' }, { status: 422 })
  }

  if (!Array.isArray(body.methods) || !body.methods.length) {
    return NextResponse.json({ ok: false, error: 'invalid_methods' }, { status: 422 })
  }
  const methods = body.methods.filter((m): m is Method =>
    typeof m === 'string' && (VALID_METHODS as readonly string[]).includes(m),
  )
  if (!methods.length) {
    return NextResponse.json({ ok: false, error: 'invalid_methods' }, { status: 422 })
  }

  const supabase = admin()
  const { data: sender } = await supabase
    .from('team_members')
    .select('name')
    .eq('id', senderId)
    .maybeSingle<{ name: string }>()
  if (!sender) {
    return NextResponse.json({ ok: false, error: 'sender_not_found' }, { status: 404 })
  }

  try {
    const result = await sendBroadcast({
      sender_id: senderId,
      sender_name: sender.name,
      subject,
      body: text,
      recipient_filter: filter,
      methods,
    })
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[admin/broadcast] failed:', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
