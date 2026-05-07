// Queue worker — pure function shared by:
//   - /api/cron/process-queue (no IDs → drains FIFO up to `limit`)
//   - /api/admin/broadcast    (specific IDs → flushes just those rows
//                              synchronously inside ctx.waitUntil)
//
// Retry semantics match the original cron handler: failed sends increment
// retry_count and stay queued until they hit max_attempts, then transition to
// status='failed'. No next_retry_at column — re-processing is opportunistic.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './client'

const DEFAULT_LIMIT = 50
const DEFAULT_MAX_ATTEMPTS = 3

export type ProcessOptions = {
  /** When given, process only these notifications regardless of status. */
  notification_ids?: string[]
  /** FIFO cap when notification_ids is omitted. */
  limit?: number
  /** retry_count threshold; rows that hit this go status='failed'. */
  max_attempts?: number
}

export type ProcessResult = {
  processed: number
  sent: number
  failed: number
  queued_remaining: number
}

type QueuedRow = {
  id: string
  recipient_email: string
  subject: string
  body_html: string | null
  body_text: string | null
  retry_count: number
  status: string
}

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function processQueueBatch(opts: ProcessOptions = {}): Promise<ProcessResult> {
  const supabase = admin()
  const maxAttempts = opts.max_attempts ?? DEFAULT_MAX_ATTEMPTS

  let rows: QueuedRow[] = []
  if (opts.notification_ids?.length) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, recipient_email, subject, body_html, body_text, retry_count, status')
      .in('id', opts.notification_ids)
      .eq('status', 'queued')
    if (error) throw new Error(error.message)
    rows = (data ?? []) as QueuedRow[]
  } else {
    const limit = opts.limit ?? DEFAULT_LIMIT
    const { data, error } = await supabase
      .from('notifications')
      .select('id, recipient_email, subject, body_html, body_text, retry_count, status')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    rows = (data ?? []) as QueuedRow[]
  }

  let sent = 0
  let failed = 0

  for (const row of rows) {
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
      const reachedLimit = nextRetry >= maxAttempts
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

  const { count: remaining } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  return {
    processed: rows.length,
    sent,
    failed,
    queued_remaining: remaining ?? 0,
  }
}
