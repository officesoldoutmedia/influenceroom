import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: { endpoint?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const endpoint = body.endpoint
  if (typeof endpoint !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Scope deletion to this user so a stolen endpoint can't unsubscribe others.
  const { error } = await admin()
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
