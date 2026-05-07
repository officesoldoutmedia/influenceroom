import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import {
  type CampaignWithJoins,
  type CampaignStatus,
  type Task,
  type TaskGroup,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/campaigns/types'
import { CampaignDetailUI, type SimpleBrand, type SimpleMember } from './detail-ui'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<CampaignStatus, string> = {
  draft: 'bg-stone-200 text-stone-700',
  active: 'bg-emerald-100 text-emerald-700',
  in_review: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-stone-200 text-stone-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-amber-100 text-amber-800',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-stone-100 text-stone-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-rose-100 text-rose-700',
}

type TaskWithAssignee = Task & {
  assignee: { id: string; name: string; avatar_url: string | null } | null
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(
      `
        *,
        brand:brands(id, name, logo_url),
        owner:team_members!campaigns_owner_id_fkey(id, name, role, avatar_url)
      `,
    )
    .eq('id', id)
    .maybeSingle<CampaignWithJoins>()

  if (!campaign) notFound()

  const [{ data: groups }, { data: tasks }, { data: brands }, { data: members }] = await Promise.all([
    supabase.from('task_groups').select('*').eq('campaign_id', id).order('position'),
    supabase
      .from('tasks')
      .select('*, assignee:team_members!tasks_assignee_id_fkey(id, name, avatar_url)')
      .eq('campaign_id', id)
      .order('created_at'),
    supabase.from('brands').select('id, name').eq('status', 'active').order('name'),
    supabase.from('team_members').select('id, name, role').eq('active', true).order('name'),
  ])

  const groupsArr = (groups ?? []) as TaskGroup[]
  const tasksArr = (tasks ?? []) as TaskWithAssignee[]

  const tasksByGroup = new Map<string, TaskWithAssignee[]>()
  for (const t of tasksArr) {
    const key = t.group_id ?? '__ungrouped__'
    const arr = tasksByGroup.get(key) ?? []
    arr.push(t)
    tasksByGroup.set(key, arr)
  }

  const canEdit =
    role === 'owner' || role === 'manager' || (role === 'account' && campaign.owner_id === userId)
  const ungrouped = tasksByGroup.get('__ungrouped__') ?? []

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4">
            <Link href="/campaigns" className="text-sm text-stone-500 hover:text-stone-800">← Campaigns</Link>
          </div>

          <header className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-semibold text-stone-900">{campaign.name}</h1>
                  <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[campaign.status]}`}>
                    {campaign.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-stone-600">
                  Brand:{' '}
                  {campaign.brand ? (
                    <Link href={`/brands`} className="text-indigo-700 hover:underline">{campaign.brand.name}</Link>
                  ) : '—'}
                  {campaign.owner && <> · Owner: <span className="text-stone-700">{campaign.owner.name}</span></>}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {campaign.start_date ?? '?'} → {campaign.end_date ?? '?'}
                  {campaign.deliverables_count != null && ` · ${campaign.deliverables_count} deliverables`}
                  {campaign.total_budget != null && ` · ${campaign.total_budget.toLocaleString('ro-RO')} RON`}
                </p>
              </div>
              {canEdit && (
                <CampaignDetailUI
                  campaign={campaign}
                  brands={(brands ?? []) as SimpleBrand[]}
                  members={(members ?? []) as SimpleMember[]}
                  currentUserId={userId}
                  role={role}
                />
              )}
            </div>
          </header>

          {(campaign.brief || campaign.internal_notes) && (
            <section className="bg-white rounded-2xl shadow-sm p-6 mb-4 grid md:grid-cols-2 gap-4">
              {campaign.brief && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Brief</h2>
                  <p className="text-sm text-stone-700 whitespace-pre-wrap">{campaign.brief}</p>
                </div>
              )}
              {campaign.internal_notes && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Internal notes</h2>
                  <p className="text-sm text-stone-700 whitespace-pre-wrap">{campaign.internal_notes}</p>
                </div>
              )}
            </section>
          )}

          <section className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-900">Tasks</h2>
              {groupsArr.length === 0 && (
                <div className="flex gap-2">
                  <button type="button" disabled className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-400 text-xs cursor-not-allowed">
                    + Add group (Phase 4)
                  </button>
                </div>
              )}
            </div>
            {groupsArr.length === 0 && ungrouped.length === 0 ? (
              <p className="text-sm text-stone-400">Niciun task. Atașează un template la creare sau adaugă manual (Phase 4).</p>
            ) : (
              <div className="space-y-5">
                {groupsArr.map((g) => {
                  const groupTasks = tasksByGroup.get(g.id) ?? []
                  return (
                    <div key={g.id}>
                      <header className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1">
                        <h3 className="text-sm font-semibold text-stone-900">
                          {g.position}. {g.name}
                        </h3>
                        <span className="text-xs text-stone-500">due {g.due_date ?? '—'}</span>
                      </header>
                      <ul className="divide-y divide-stone-100">
                        {groupTasks.map((t) => (
                          <li key={t.id} className="py-2 flex items-center gap-3">
                            <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TASK_STATUS_BADGE[t.status]}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                            <span className="flex-1 text-sm text-stone-900">{t.title}</span>
                            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority]}`}>
                              {t.priority}
                            </span>
                            <span className="text-xs text-stone-500 w-32 text-right">
                              {t.assignee?.name ?? <span className="italic">Neasignat</span>}
                            </span>
                            <span className="text-xs text-stone-500 w-24 text-right">
                              {t.due_date ?? '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                {ungrouped.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900 mb-2">Other tasks</h3>
                    <ul className="divide-y divide-stone-100">
                      {ungrouped.map((t) => (
                        <li key={t.id} className="py-2 flex items-center gap-3">
                          <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TASK_STATUS_BADGE[t.status]}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                          <span className="flex-1 text-sm text-stone-900">{t.title}</span>
                          <span className="text-xs text-stone-500">{t.due_date ?? '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
