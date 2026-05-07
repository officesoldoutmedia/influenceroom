import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/client'

const BATCH_SIZE = 50
const MAX_RETRIES = 3

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type QueuedRow = {
  id: string
  recipient_email: string
  subject: string
  body_html: string | null
  body_text: string | null
  retry_count: number
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return new Response('forbidden', { status: 401 })
  }

  const supabase = admin()
  const { data: queued, error } = await supabase
    .from('notifications')
    .select('id, recipient_email, subject, body_html, body_text, retry_count')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const items = (queued ?? []) as QueuedRow[]
  let sent = 0
  let failed = 0

  for (const row of items) {
    try {
      const result = await sendEmail({
        to: row.recipient_email,
        subject: row.subject,
        html: row.body_html ?? '',
        text: row.body_text ?? '',
      })
      await supabase
        .from('notifications')
        .update({
          status: 'sent',
          resend_message_id: result.id,
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', row.id)
      sent += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      const nextRetry = row.retry_count + 1
      const reachedLimit = nextRetry >= MAX_RETRIES
      await supabase
        .from('notifications')
        .update({
          status: reachedLimit ? 'failed' : 'queued',
          retry_count: nextRetry,
          error: message,
        })
        .eq('id', row.id)
      if (reachedLimit) failed += 1
    }
  }

  // Recount remaining
  const { count: remaining } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  return NextResponse.json({
    ok: true,
    processed: items.length,
    sent,
    failed,
    queued_remaining: remaining ?? 0,
  })
}
