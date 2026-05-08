import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import {
  type CampaignWithJoins,
  type CampaignStatus,
  type TaskGroup,
} from '@/lib/campaigns/types'
import { CampaignDetailUI, type SimpleBrand, type SimpleMember } from './detail-ui'
import { BoardUI, type TaskWithAssignee } from './board-ui'
import { formatEur } from '@/lib/influencers/format'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<CampaignStatus, string> = {
  draft: 'bg-stone-200 text-stone-700',
  active: 'bg-emerald-100 text-emerald-700',
  in_review: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-rose-100 text-rose-700',
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

  const [{ data: groups }, { data: tasks }, { data: brands }, { data: members }, { data: junctions }] = await Promise.all([
    supabase.from('task_groups').select('*').eq('campaign_id', id).order('position'),
    supabase
      .from('tasks')
      .select('*, assignee:team_members!tasks_assignee_id_fkey(id, name, avatar_url)')
      .eq('campaign_id', id)
      .order('position', { ascending: true }),
    supabase.from('brands').select('id, name').eq('status', 'active').order('name'),
    supabase.from('team_members').select('id, name, role').eq('active', true).order('name'),
    supabase
      .from('campaign_influencers')
      .select('id, status, agreed_fee')
      .eq('campaign_id', id),
  ])

  const junctionsArr = (junctions ?? []) as { status: string; agreed_fee: number | null }[]
  const junctionConfirmed = junctionsArr.filter((j) => j.status === 'confirmed').length
  const junctionPublished = junctionsArr.filter((j) => j.status === 'published' || j.status === 'paid').length
  const junctionTotalFee = junctionsArr.reduce((acc, j) => acc + (j.agreed_fee ?? 0), 0)

  const groupsArr = (groups ?? []) as TaskGroup[]
  const tasksArr = (tasks ?? []) as TaskWithAssignee[]

  const canEdit =
    role === 'owner' || role === 'manager' || (role === 'account' && campaign.owner_id === userId)

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
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
                    <Link href={`/brands`} className="text-brand-800 hover:underline">{campaign.brand.name}</Link>
                  ) : '—'}
                  {campaign.owner && <> · Owner: <span className="text-stone-700">{campaign.owner.name}</span></>}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {campaign.start_date ?? '?'} → {campaign.end_date ?? '?'}
                  {campaign.deliverables_count != null && ` · ${campaign.deliverables_count} deliverables`}
                  {campaign.total_budget != null && ` · ${formatEur(campaign.total_budget)}`}
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

          <section className="bg-white rounded-2xl shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Influencers</h2>
                <p className="text-xs text-stone-500 mt-1">
                  {junctionsArr.length} în roster
                  {junctionConfirmed > 0 && ` · ${junctionConfirmed} confirmed`}
                  {junctionPublished > 0 && ` · ${junctionPublished} published`}
                  {junctionTotalFee > 0 && ` · total ${formatEur(junctionTotalFee)}`}
                </p>
              </div>
              <Link
                href={`/campaigns/${campaign.id}/influencers`}
                className="px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs hover:bg-brand-800"
              >
                Open roster →
              </Link>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Tasks</h2>
            <BoardUI
              campaignId={id}
              initialGroups={groupsArr}
              initialTasks={tasksArr}
              members={(members ?? []) as { id: string; name: string; role: string; avatar_url: string | null }[]}
              canEdit={canEdit}
              currentUserId={userId}
            />
          </section>
        </div>
      </main>
    </>
  )
}
