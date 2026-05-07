import { NextRequest, NextResponse } from 'next/server'
import { processQueueBatch } from '@/lib/email/queue-worker'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return new Response('forbidden', { status: 401 })
  }

  try {
    const result = await processQueueBatch({ limit: 50 })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
