import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { NotificationsUI, type NotificationRow, type Rule } from './notifications-ui'

export const dynamic = 'force-dynamic'

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filterStatus = typeof sp.status === 'string' ? sp.status : null

  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')
  if (role !== 'owner') redirect('/')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: me } = await supabase
    .from('team_members')
    .select('name')
    .eq('id', userId)
    .maybeSingle()

  const { data: rules } = await supabase
    .from('notification_rules')
    .select('id, event, enabled, config, updated_at')
    .order('event', { ascending: true })

  let notifQuery = supabase
    .from('notifications')
    .select(
      `
        id, type, recipient_email, subject, status, retry_count, error,
        sent_at, resend_message_id, created_at,
        recipient:team_members(id, name)
      `,
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (filterStatus && ['queued', 'sent', 'failed'].includes(filterStatus)) {
    notifQuery = notifQuery.eq('status', filterStatus)
  }
  const { data: notifs } = await notifQuery

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-6 sm:mb-8">Notifications</h1>
          <NotificationsUI
            initialRules={(rules ?? []) as Rule[]}
            initialNotifications={(notifs ?? []) as unknown as NotificationRow[]}
            initialFilterStatus={filterStatus}
          />
        </div>
      </main>
    </>
  )
}
