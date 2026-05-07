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

  let body: {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
    user_agent?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  const userAgent = body.user_agent

  if (
    typeof endpoint !== 'string' ||
    !/^https?:\/\//i.test(endpoint) ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string'
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_subscription' }, { status: 422 })
  }

  const { error } = await admin()
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : null,
      },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('[push/subscribe] upsert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
