import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { requireOwner } from '@/lib/auth/require'
import { enqueueNotification } from '@/lib/notifications/enqueue'
import { APP_URL } from '@/lib/email/client'
import type { RenderArgs } from '@/lib/email/render'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const TEMPLATES = [
  'task_assigned',
  'task_status_changed',
  'deadline_reminder',
  'daily_digest',
  'campaign_started',
] as const

type TemplateName = (typeof TEMPLATES)[number]

type Body = { template?: string }

function mockRenderArgs(template: TemplateName, recipientName: string): RenderArgs {
  switch (template) {
    case 'task_assigned':
      return {
        type: 'task_assigned',
        params: {
          assigneeName: recipientName,
          taskTitle: '[Sample] Send pitch',
          campaignName: '[Sample] Q4 Brand Boost',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          assignedByName: 'Influence Room',
          taskUrl: APP_URL,
        },
      }
    case 'task_status_changed':
      return {
        type: 'task_status_changed',
        params: {
          taskTitle: '[Sample] Sign contract',
          campaignName: '[Sample] Q4 Brand Boost',
          oldStatus: 'todo',
          newStatus: 'done',
          changedByName: 'Influence Room',
          taskUrl: APP_URL,
        },
      }
    case 'deadline_reminder':
      return {
        type: 'deadline_reminder',
        params: {
          recipientName,
          taskTitle: '[Sample] Live monitoring',
          campaignName: '[Sample] Q4 Brand Boost',
          daysUntilDue: 1,
          taskUrl: APP_URL,
          markDoneUrl: APP_URL,
        },
      }
    case 'daily_digest':
      return {
        type: 'daily_digest',
        params: {
          recipientName,
          overdueTasks: [
            { id: '1', title: '[Sample] Send pitch', campaignName: 'Q4', dueDate: '2026-05-05', priority: 'high', link: APP_URL },
          ],
          todayTasks: [
            { id: '2', title: '[Sample] Brief approval', campaignName: 'Q4', dueDate: new Date().toISOString().slice(0, 10), priority: 'normal', link: APP_URL },
          ],
          weekTasks: [],
          appUrl: APP_URL,
        },
      }
    case 'campaign_started':
      return {
        type: 'campaign_started',
        params: {
          recipientName,
          campaignName: '[Sample] Q4 Brand Boost',
          brandName: 'ACME',
          ownerName: 'Influence Room',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: null,
          confirmedInfluencersCount: 3,
          campaignUrl: APP_URL,
        },
      }
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireOwner()
  if (denied) return denied

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const template = body.template as TemplateName | undefined
  if (!template || !(TEMPLATES as readonly string[]).includes(template)) {
    return NextResponse.json({ ok: false, error: 'invalid_template' }, { status: 400 })
  }

  const h = await headers()
  const userId = h.get('x-user-id')

  const supabase = admin()
  const { data: me } = await supabase
    .from('team_members')
    .select('id, name, email, role, active')
    .eq('id', userId ?? '')
    .maybeSingle()

  if (!me) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  await enqueueNotification(mockRenderArgs(template, me.name), { recipient: me })

  // Find the just-inserted row to return its id
  const { data: latest } = await supabase
    .from('notifications')
    .select('id')
    .eq('recipient_id', me.id)
    .eq('type', template)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ ok: true, notification_id: latest?.id ?? null })
}
