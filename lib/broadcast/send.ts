// Broadcast pipeline: resolve recipients from filter, enqueue email rows
// (bypassing per-user notification_prefs since broadcasts are owner-initiated
// org-wide messages), fan out web-push to each device, return per-method counts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { renderEmail } from '@/lib/email/render'
import { sendPush, type PushPayload } from '@/lib/push/send'

export const VALID_ROLES = ['owner', 'manager', 'account', 'intern'] as const
export type Role = (typeof VALID_ROLES)[number]

export type RecipientFilter =
  | { type: 'all' }
  | { type: 'roles'; roles: Role[] }
  | { type: 'users'; user_ids: string[] }

export type BroadcastInput = {
  sender_id: string
  sender_name: string
  subject: string
  body: string
  recipient_filter: RecipientFilter
  methods: Array<'email' | 'push'>
}

export type BroadcastResult = {
  broadcast_id: string
  recipient_count: number
  email_success: number
  email_fail: number
  push_success: number
  push_fail: number
  /** Notification rows inserted by this broadcast — caller can pass to
   * processQueueBatch via ctx.waitUntil for instant flush without cron. */
  notification_ids: string[]
}

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type Recipient = { id: string; name: string; email: string }

async function resolveRecipients(
  supabase: SupabaseClient,
  filter: RecipientFilter,
): Promise<Recipient[]> {
  let query = supabase
    .from('team_members')
    .select('id, name, email')
    .eq('active', true)

  if (filter.type === 'roles') {
    query = query.in('role', filter.roles)
  } else if (filter.type === 'users') {
    if (!filter.user_ids.length) return []
    query = query.in('id', filter.user_ids)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Recipient[]
}

export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  const supabase = admin()

  const recipients = await resolveRecipients(supabase, input.recipient_filter)
  const recipient_ids = recipients.map((r) => r.id)

  const { data: bRow, error: bErr } = await supabase
    .from('broadcasts')
    .insert({
      sender_id: input.sender_id,
      subject: input.subject,
      body: input.body,
      recipient_filter: input.recipient_filter,
      resolved_recipient_ids: recipient_ids,
      methods: input.methods,
    })
    .select('id')
    .single()
  if (bErr || !bRow) throw new Error(bErr?.message ?? 'broadcast_insert_failed')
  const broadcastId = bRow.id as string

  let emailSuccess = 0
  let emailFail = 0
  let pushSuccess = 0
  let pushFail = 0
  const notificationIds: string[] = []

  // Email: enqueue notification rows. The queue worker delivers them either
  // via cron (when configured) or via auto-flush in the broadcast handler's
  // ctx.waitUntil — see app/api/admin/broadcast/route.ts.
  if (input.methods.includes('email')) {
    for (const r of recipients) {
      const rendered = renderEmail({
        type: 'broadcast',
        params: {
          recipientName: r.name,
          senderName: input.sender_name,
          subject: input.subject,
          body: input.body,
        },
      })
      const { data: inserted, error } = await supabase
        .from('notifications')
        .insert({
          type: 'broadcast',
          recipient_id: r.id,
          recipient_email: r.email,
          subject: rendered.subject,
          body_html: rendered.html,
          body_text: rendered.text,
          status: 'queued',
        })
        .select('id')
        .single<{ id: string }>()
      if (error || !inserted) {
        emailFail++
        console.error('[broadcast] email enqueue failed:', r.email, error?.message)
      } else {
        emailSuccess++
        notificationIds.push(inserted.id)
      }
    }
  }

  // Push: load all subscriptions for the resolved recipients, then send each.
  if (input.methods.includes('push') && recipient_ids.length) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', recipient_ids)

    const payload: PushPayload = {
      title: input.subject,
      body: input.body,
      url: '/',
      tag: `broadcast-${broadcastId}`,
    }

    for (const s of subs ?? []) {
      const subRow = s as {
        id: string
        endpoint: string
        p256dh: string
        auth: string
      }
      const result = await sendPush(
        {
          endpoint: subRow.endpoint,
          expirationTime: null,
          keys: { p256dh: subRow.p256dh, auth: subRow.auth },
        },
        payload,
      )
      if (result.ok) {
        pushSuccess++
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', subRow.id)
      } else {
        pushFail++
        if (result.expired) {
          await supabase.from('push_subscriptions').delete().eq('id', subRow.id)
        }
      }
    }
  }

  await supabase
    .from('broadcasts')
    .update({
      email_success_count: emailSuccess,
      email_fail_count: emailFail,
      push_success_count: pushSuccess,
      push_fail_count: pushFail,
    })
    .eq('id', broadcastId)

  return {
    broadcast_id: broadcastId,
    recipient_count: recipients.length,
    email_success: emailSuccess,
    email_fail: emailFail,
    push_success: pushSuccess,
    push_fail: pushFail,
    notification_ids: notificationIds,
  }
}
