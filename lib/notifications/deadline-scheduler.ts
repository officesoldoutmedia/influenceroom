// Deadline reminder scheduler — fanned out daily by the worker cron.
//
// Recipients per Opțiunea A (Sprint 9 Faza 6 spec):
//   Deliverable.post_date: account manager 7d/3d/1d/overdue, influencer 3d/1d/overdue
//   Milestone.due_date:     account manager 7d/3d/1d/overdue (no influencer)
//
// Idempotency: each (resource, kind, recipient_type, recipient_email) is
// inserted into deadline_reminder_log under a UNIQUE constraint. Duplicate
// inserts fail (Postgres error code 23505) and we silently skip enqueueing
// the email — so re-running the scheduler within the same day, or a manual
// retry while the cron is also running, is safe.
//
// Account-manager recipients also get a web-push notification when they
// have an active push subscription (best-effort; failures don't block the
// email path). Influencers don't get push (they're not team_members).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { APP_URL } from '@/lib/email/client'
import {
  deliverableDeadlineReminder,
  type DeliverableDeadlineKind,
  type DeliverableRecipientType,
} from '@/lib/email/templates/deadline-reminder-deliverable'
import { milestoneDeadlineReminder } from '@/lib/email/templates/deadline-reminder-milestone'
import { sendPush } from '@/lib/push/send'

type ReminderKind = DeliverableDeadlineKind // same shape for milestones
type RecipientType = 'account_manager' | 'influencer'

export type SchedulerResult = {
  ok: true
  windows: Array<{ kind: ReminderKind; target_date: string }>
  deliverables_processed: number
  milestones_processed: number
  reminders_sent: number
  reminders_skipped: number
  push_sent: number
  push_failed: number
  errors: string[]
}

const DELIVERABLE_TYPE_LABEL: Record<string, string> = {
  story: 'Story',
  reel: 'Reel',
  tiktok: 'TikTok',
  carousel: 'Carousel',
  post: 'Post',
  youtube_long: 'YouTube long-form',
  youtube_short: 'YouTube Short',
  live: 'Live',
  custom: 'Custom',
}

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  draft: 'Schiță',
  sent_to_influencer: 'Trimis influencer',
  content_in_review: 'În review',
  approved: 'Aprobat',
  published: 'Publicat',
  cancelled: 'Anulat',
}

const MILESTONE_TYPE_LABEL: Record<string, string> = {
  brief_sent: 'Brief trimis',
  materials_approved: 'Materiale aprobate',
  content_draft_submitted: 'Draft conținut primit',
  final_content_approved: 'Conținut final aprobat',
  links_submitted: 'Link-uri trimise',
  report_delivered: 'Raport livrat',
  payment_processed: 'Plată procesată',
  other: 'Altul',
}

const MILESTONE_RESPONSIBLE_LABEL: Record<string, string> = {
  account_manager: 'Account manager',
  influencer: 'Influencer',
  brand: 'Brand',
  other: 'Altul',
}

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Today in Bucharest local time as YYYY-MM-DD. We use Bucharest because all
 * deadlines are stored as DATE (no time component) and the team works on
 * Bucharest time. DST is handled automatically by Intl.
 */
function bucharestToday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type LogResult = 'inserted' | 'duplicate' | 'error'

async function logAndEnqueue(
  supabase: SupabaseClient,
  args: {
    resourceType: 'deliverable' | 'milestone'
    resourceId: string
    kind: ReminderKind
    recipientType: RecipientType
    recipientEmail: string
    recipientId: string | null
    subject: string
    html: string
    text: string
    relatedCampaignId: string
  },
): Promise<LogResult> {
  // INSERT into log first; UNIQUE failure means already-sent.
  const { data: logRow, error: logErr } = await supabase
    .from('deadline_reminder_log')
    .insert({
      resource_type: args.resourceType,
      resource_id: args.resourceId,
      reminder_kind: args.kind,
      recipient_type: args.recipientType,
      recipient_email: args.recipientEmail,
    })
    .select('id')
    .single()

  if (logErr) {
    if (logErr.code === '23505') return 'duplicate'
    console.error('[deadline-scheduler] log insert failed:', logErr.message)
    return 'error'
  }

  // Now enqueue the notification row.
  const { data: notif, error: notifErr } = await supabase
    .from('notifications')
    .insert({
      type: 'deadline_reminder',
      recipient_id: args.recipientId,
      recipient_email: args.recipientEmail,
      subject: args.subject,
      body_html: args.html,
      body_text: args.text,
      related_campaign_id: args.relatedCampaignId,
      status: 'queued',
    })
    .select('id')
    .single()

  if (notifErr) {
    console.error('[deadline-scheduler] notification insert failed:', notifErr.message)
    return 'error'
  }

  // Wire the log → notification reference for traceability.
  await supabase
    .from('deadline_reminder_log')
    .update({ notification_id: notif.id })
    .eq('id', logRow.id)

  return 'inserted'
}

async function maybePushAccountManager(
  supabase: SupabaseClient,
  recipientId: string,
  payload: { title: string; body: string; url: string },
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId)

  for (const s of (subs ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
    const result = await sendPush(
      {
        endpoint: s.endpoint,
        expirationTime: null,
        keys: { p256dh: s.p256dh, auth: s.auth },
      },
      payload,
    )
    if (result.ok) {
      sent++
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } else {
      failed++
      if (result.expired) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }
  return { sent, failed }
}

type DeliverableRow = {
  id: string
  participant_id: string
  type: string
  custom_type_label: string | null
  quantity: number
  post_date: string
  status: string
  brief: string | null
  caption: string | null
  collab_handles: string[]
  hashtags: string[]
  participant: {
    influencer_id: string | null
    is_adhoc: boolean
    account_handle: string
    campaign_id: string
    influencer: {
      id: string
      name: string
      contact_email: string | null
    } | null
    campaign: {
      id: string
      name: string
      owner_id: string | null
      brand: { name: string } | null
      owner: {
        id: string
        name: string
        email: string
        notification_prefs: Record<string, boolean> | null
      } | null
    }
  }
}

type MilestoneRow = {
  id: string
  campaign_id: string
  type: string
  name: string | null
  due_date: string
  responsible: string
  responsible_name: string | null
  notes: string | null
  campaign: {
    id: string
    name: string
    owner_id: string | null
    brand: { name: string } | null
    owner: {
      id: string
      name: string
      email: string
      notification_prefs: Record<string, boolean> | null
    } | null
  }
}

export async function scheduleDeadlineNotifications(): Promise<SchedulerResult> {
  const supabase = admin()
  const today = bucharestToday()

  const windows: Array<{ kind: ReminderKind; target: string }> = [
    { kind: '7d', target: addDaysISO(today, 7) },
    { kind: '3d', target: addDaysISO(today, 3) },
    { kind: '1d', target: addDaysISO(today, 1) },
    { kind: 'overdue', target: today },
  ]

  let remindersSent = 0
  let remindersSkipped = 0
  let pushSent = 0
  let pushFailed = 0
  let deliverablesProcessed = 0
  let milestonesProcessed = 0
  const errors: string[] = []

  // ──────────── Deliverables ────────────
  for (const win of windows) {
    const baseSelect = supabase
      .from('campaign_deliverables')
      .select(
        `id, participant_id, type, custom_type_label, quantity, post_date, status,
         brief, caption, collab_handles, hashtags,
         participant:campaign_participants!inner(
           influencer_id, is_adhoc, account_handle, campaign_id,
           influencer:influencers(id, name, contact_email),
           campaign:campaigns(
             id, name, owner_id,
             brand:brands(name),
             owner:team_members!campaigns_owner_id_fkey(id, name, email, notification_prefs)
           )
         )`,
      )
      .not('post_date', 'is', null)
      .not('status', 'in', '(published,cancelled)')

    const { data, error } =
      win.kind === 'overdue'
        ? await baseSelect.lt('post_date', today)
        : await baseSelect.eq('post_date', win.target)

    if (error) {
      errors.push(`deliverables[${win.kind}]: ${error.message}`)
      continue
    }

    for (const row of (data ?? []) as unknown as DeliverableRow[]) {
      deliverablesProcessed++
      const campaign = row.participant.campaign
      if (!campaign) continue
      const brandName = campaign.brand?.name ?? '—'
      const typeLabel =
        row.type === 'custom' ? (row.custom_type_label ?? 'Custom') : (DELIVERABLE_TYPE_LABEL[row.type] ?? row.type)
      const statusLabel = DELIVERABLE_STATUS_LABEL[row.status] ?? row.status
      const participantLabel = row.participant.influencer?.name ?? row.participant.account_handle

      // ── Account manager recipient ──
      const owner = campaign.owner
      if (
        owner?.email &&
        (owner.notification_prefs?.deadline_reminder ?? true)
      ) {
        const { subject, html, text } = deliverableDeadlineReminder({
          kind: win.kind,
          recipientType: 'account_manager' as DeliverableRecipientType,
          recipientName: owner.name,
          campaignName: campaign.name,
          brandName,
          typeLabel,
          quantity: row.quantity,
          postDate: row.post_date,
          statusLabel,
          participantLabel,
          brief: row.brief,
          caption: row.caption,
          collabHandles: row.collab_handles ?? [],
          hashtags: row.hashtags ?? [],
          campaignUrl: `${APP_URL}/campaigns/${campaign.id}?tab=deliverables`,
        })
        const result = await logAndEnqueue(supabase, {
          resourceType: 'deliverable',
          resourceId: row.id,
          kind: win.kind,
          recipientType: 'account_manager',
          recipientEmail: owner.email,
          recipientId: owner.id,
          subject,
          html,
          text,
          relatedCampaignId: campaign.id,
        })
        if (result === 'inserted') {
          remindersSent++
          // Best-effort push to the account manager.
          const push = await maybePushAccountManager(supabase, owner.id, {
            title: subject,
            body: `${typeLabel} · ${campaign.name}`,
            url: `/campaigns/${campaign.id}?tab=deliverables`,
          })
          pushSent += push.sent
          pushFailed += push.failed
        } else if (result === 'duplicate') remindersSkipped++
      }

      // ── Influencer recipient (only on 3d/1d/overdue) ──
      const influencerEligible = win.kind !== '7d'
      if (
        influencerEligible &&
        !row.participant.is_adhoc &&
        row.participant.influencer?.contact_email
      ) {
        const inf = row.participant.influencer
        const { subject, html, text } = deliverableDeadlineReminder({
          kind: win.kind,
          recipientType: 'influencer',
          recipientName: inf.name,
          campaignName: campaign.name,
          brandName,
          typeLabel,
          quantity: row.quantity,
          postDate: row.post_date,
          statusLabel,
          participantLabel: inf.name,
          brief: row.brief,
          caption: row.caption,
          collabHandles: row.collab_handles ?? [],
          hashtags: row.hashtags ?? [],
          campaignUrl: `${APP_URL}/campaigns/${campaign.id}?tab=deliverables`,
        })
        const result = await logAndEnqueue(supabase, {
          resourceType: 'deliverable',
          resourceId: row.id,
          kind: win.kind,
          recipientType: 'influencer',
          recipientEmail: inf.contact_email!,
          recipientId: null, // influencers aren't team_members; use null
          subject,
          html,
          text,
          relatedCampaignId: campaign.id,
        })
        if (result === 'inserted') remindersSent++
        else if (result === 'duplicate') remindersSkipped++
      }
    }
  }

  // ──────────── Milestones ────────────
  for (const win of windows) {
    const baseSelect = supabase
      .from('campaign_milestones')
      .select(
        `id, campaign_id, type, name, due_date, responsible, responsible_name, notes,
         campaign:campaigns(
           id, name, owner_id,
           brand:brands(name),
           owner:team_members!campaigns_owner_id_fkey(id, name, email, notification_prefs)
         )`,
      )
      .is('completed_at', null)

    const { data, error } =
      win.kind === 'overdue'
        ? await baseSelect.lt('due_date', today)
        : await baseSelect.eq('due_date', win.target)

    if (error) {
      errors.push(`milestones[${win.kind}]: ${error.message}`)
      continue
    }

    for (const row of (data ?? []) as unknown as MilestoneRow[]) {
      milestonesProcessed++
      const campaign = row.campaign
      if (!campaign) continue
      const brandName = campaign.brand?.name ?? '—'
      const milestoneLabel =
        row.type === 'other' ? (row.name ?? 'Etapă') : (MILESTONE_TYPE_LABEL[row.type] ?? row.type)
      const responsibleLabel =
        row.responsible === 'other'
          ? (row.responsible_name ?? 'Altcineva')
          : (MILESTONE_RESPONSIBLE_LABEL[row.responsible] ?? row.responsible)

      const owner = campaign.owner
      if (
        owner?.email &&
        (owner.notification_prefs?.deadline_reminder ?? true)
      ) {
        const { subject, html, text } = milestoneDeadlineReminder({
          kind: win.kind,
          recipientName: owner.name,
          campaignName: campaign.name,
          brandName,
          milestoneLabel,
          dueDate: row.due_date,
          responsibleLabel,
          notes: row.notes,
          campaignUrl: `${APP_URL}/campaigns/${campaign.id}?tab=milestones`,
        })
        const result = await logAndEnqueue(supabase, {
          resourceType: 'milestone',
          resourceId: row.id,
          kind: win.kind,
          recipientType: 'account_manager',
          recipientEmail: owner.email,
          recipientId: owner.id,
          subject,
          html,
          text,
          relatedCampaignId: campaign.id,
        })
        if (result === 'inserted') {
          remindersSent++
          const push = await maybePushAccountManager(supabase, owner.id, {
            title: subject,
            body: `${milestoneLabel} · ${campaign.name}`,
            url: `/campaigns/${campaign.id}?tab=milestones`,
          })
          pushSent += push.sent
          pushFailed += push.failed
        } else if (result === 'duplicate') remindersSkipped++
      }
    }
  }

  return {
    ok: true,
    windows: windows.map((w) => ({ kind: w.kind, target_date: w.target })),
    deliverables_processed: deliverablesProcessed,
    milestones_processed: milestonesProcessed,
    reminders_sent: remindersSent,
    reminders_skipped: remindersSkipped,
    push_sent: pushSent,
    push_failed: pushFailed,
    errors,
  }
}
