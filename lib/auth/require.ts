import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function requireOwner(): Promise<NextResponse | null> {
  const h = await headers()
  if (h.get('x-user-role') !== 'owner') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  return null
}
