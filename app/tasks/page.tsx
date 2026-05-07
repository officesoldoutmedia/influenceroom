import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { TasksUI, type TaskWithCampaign } from './tasks-ui'

export const dynamic = 'force-dynamic'

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const all = sp.all === '1'
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')

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

  const showAllToggle = role === 'owner' || role === 'manager'
  const showAll = all && showAllToggle

  let query = supabase
    .from('tasks')
    .select(
      `
        id, title, status, priority, due_date, completed_at,
        campaign_id, assignee_id,
        campaign:campaigns(id, name),
        assignee:team_members!tasks_assignee_id_fkey(id, name)
      `,
    )
    .not('status', 'in', '(done,cancelled)')

  if (!showAll) query = query.eq('assignee_id', userId)

  const { data: tasks } = await query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-stone-900">My Tasks</h1>
            {showAllToggle && (
              <a
                href={showAll ? '/tasks' : '/tasks?all=1'}
                className={`px-3 py-1.5 rounded-lg text-xs ${showAll ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              >
                {showAll ? 'Showing all · click for mine' : 'Show all tasks'}
              </a>
            )}
          </div>
          <TasksUI
            initialItems={(tasks ?? []) as unknown as TaskWithCampaign[]}
            currentUserId={userId}
            role={role}
          />
        </div>
      </main>
    </>
  )
}
