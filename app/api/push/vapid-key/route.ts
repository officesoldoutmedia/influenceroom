import { NextResponse } from 'next/server'
import { vapidPublicKey } from '@/lib/push/send'

export async function GET() {
  const key = vapidPublicKey()
  if (!key) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, public_key: key })
}
