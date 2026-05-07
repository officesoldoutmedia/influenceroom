import { createClient } from '@supabase/supabase-js'
import { renderEmail, type RenderArgs } from '@/lib/email/render'

export type Recipient = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
}

export type EnqueueOpts = {
  recipient: Recipient
  related_task_id?: string | null
  related_campaign_id?: string | null
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// Never throws. Logs errors to console; user-facing operations should not be
// blocked by notification failures.
export async function enqueueNotification(args: RenderArgs, opts: EnqueueOpts): Promise<void> {
  try {
    if (!opts.recipient.active || !opts.recipient.email) return

    const supabase = admin()

    const { data: rule } = await supabase
      .from('notification_rules')
      .select('enabled, config')
      .eq('event', args.type)
      .maybeSingle<{ enabled: boolean; config: Record<string, unknown> | null }>()

    if (!rule || !rule.enabled) return

    // only_for_roles gate
    const cfg = rule.config ?? {}
    const onlyForRoles = cfg.only_for_roles
    if (Array.isArray(onlyForRoles) && !onlyForRoles.includes(opts.recipient.role)) return

    // Per-recipient opt-out (Sprint 8 Phase 4). Treat missing pref entry as
    // opt-in so users seeded before migration 015 still receive everything.
    const { data: prefRow } = await supabase
      .from('team_members')
      .select('notification_prefs')
      .eq('id', opts.recipient.id)
      .maybeSingle<{ notification_prefs: Record<string, unknown> | null }>()
    const prefs = prefRow?.notification_prefs ?? {}
    if (prefs[args.type] === false) return

    const rendered = renderEmail(args)

    const { error } = await supabase.from('notifications').insert({
      type: args.type,
      recipient_id: opts.recipient.id,
      recipient_email: opts.recipient.email,
      subject: rendered.subject,
      body_html: rendered.html,
      body_text: rendered.text,
      related_task_id: opts.related_task_id ?? null,
      related_campaign_id: opts.related_campaign_id ?? null,
      status: 'queued',
    })

    if (error) {
      console.error('[enqueueNotification] insert failed:', error.message)
    }
  } catch (err) {
    console.error('[enqueueNotification] unexpected error:', err)
  }
}
