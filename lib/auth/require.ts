import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

const WRITER_ROLES = new Set(['owner', 'manager', 'account'])

export async function requireOwner(): Promise<NextResponse | null> {
  const h = await headers()
  if (h.get('x-user-role') !== 'owner') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  return null
}

export async function requireWriter(): Promise<NextResponse | null> {
  const h = await headers()
  if (!WRITER_ROLES.has(h.get('x-user-role') ?? '')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  return null
}
