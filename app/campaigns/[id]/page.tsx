import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import {
  type CampaignWithJoins,
  type CampaignStatus,
  type TaskGroup,
  type CampaignParticipantJoined,
  type CampaignDeliverable,
  type CampaignMilestone,
} from '@/lib/campaigns/types'
import { CampaignDetailUI, type SimpleBrand, type SimpleMember } from './detail-ui'
import { BoardUI, type TaskWithAssignee } from './board-ui'
import { ParticipantsUI } from './participants-ui'
import { DeliverablesUI } from './deliverables-ui'
import { MilestonesUI } from './milestones-ui'
import { CampaignTabsShell } from './tabs-shell'
import { formatEur } from '@/lib/influencers/format'
import { canReadCampaign } from '@/lib/auth/scope'

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
  // Read-side scoping mirrors the list view: owner/manager bypass, account
  // sees only own campaigns. Surface as 404 (not 403) so probing users
  // can't tell which campaign IDs exist outside their scope.
  if (!canReadCampaign({ id: userId, role }, { owner_id: campaign.owner_id })) notFound()

  const [
    { data: groups },
    { data: tasks },
    { data: brands },
    { data: members },
    { data: participants },
    { data: activeInfluencers },
    { data: deliverables },
    { data: milestones },
  ] = await Promise.all([
    supabase.from('task_groups').select('*').eq('campaign_id', id).order('position'),
    supabase
      .from('tasks')
      .select('*, assignee:team_members!tasks_assignee_id_fkey(id, name, avatar_url)')
      .eq('campaign_id', id)
      .order('position', { ascending: true }),
    supabase.from('brands').select('id, name').eq('status', 'active').order('name'),
    supabase.from('team_members').select('id, name, role').eq('active', true).order('name'),
    supabase
      .from('campaign_participants')
      .select('*, influencer:influencers(id, name, tier, social_handles)')
      .eq('campaign_id', id)
      .order('added_at', { ascending: true }),
    supabase
      .from('influencers')
      .select('id, name, social_handles')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('campaign_deliverables')
      .select('*, participant:campaign_participants!inner(id, campaign_id)')
      .eq('participant.campaign_id', id)
      .order('position', { ascending: true }),
    supabase
      .from('campaign_milestones')
      .select('*')
      .eq('campaign_id', id)
      .order('due_date', { ascending: true }),
  ])

  const participantsArr = (participants ?? []) as CampaignParticipantJoined[]
  const deliverablesArr = (deliverables ?? []) as CampaignDeliverable[]
  const milestonesArr = (milestones ?? []) as CampaignMilestone[]
  const groupsArr = (groups ?? []) as TaskGroup[]
  const tasksArr = (tasks ?? []) as TaskWithAssignee[]

  const canEdit =
    role === 'owner' || role === 'manager' || (role === 'account' && campaign.owner_id === userId)

  const totalAgreedFee = participantsArr.reduce((acc, p) => acc + Number(p.agreed_fee ?? 0), 0)

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4">
            <Link href="/campaigns" className="text-sm text-stone-500 hover:text-stone-800">← Campanii</Link>
          </div>

          <header className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl text-stone-900">{campaign.name}</h1>
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
                  {campaign.total_budget != null && ` · buget ${formatEur(campaign.total_budget)}`}
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

          <CampaignTabsShell
            details={
              <DetailsTab
                campaign={campaign}
                participantsCount={participantsArr.length}
                totalAgreedFee={totalAgreedFee}
              />
            }
            participants={
              <ParticipantsUI
                campaignId={id}
                initialItems={participantsArr}
                influencers={(activeInfluencers ?? []) as Array<{
                  id: string
                  name: string
                  social_handles: Record<string, { handle: string; url: string; followers: number }>
                }>}
                canEdit={canEdit}
              />
            }
            deliverables={
              <DeliverablesUI
                campaignId={id}
                participants={participantsArr}
                initialItems={deliverablesArr}
                canEdit={canEdit}
              />
            }
            milestones={
              <MilestonesUI
                campaignId={id}
                initialItems={milestonesArr}
                canEdit={canEdit}
              />
            }
            tasks={
              <BoardUI
                campaignId={id}
                initialGroups={groupsArr}
                initialTasks={tasksArr}
                members={(members ?? []) as { id: string; name: string; role: string; avatar_url: string | null }[]}
                canEdit={canEdit}
                currentUserId={userId}
              />
            }
          />
        </div>
      </main>
    </>
  )
}

function DetailsTab({
  campaign,
  participantsCount,
  totalAgreedFee,
}: {
  campaign: CampaignWithJoins
  participantsCount: number
  totalAgreedFee: number
}) {
  return (
    <div className="space-y-4">
      {(campaign.brief || campaign.internal_notes) && (
        <section className="bg-white rounded-2xl shadow-sm p-6 grid md:grid-cols-2 gap-4">
          {campaign.brief && (
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-2">Brief</h2>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{campaign.brief}</p>
            </div>
          )}
          {campaign.internal_notes && (
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-2">Note interne</h2>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{campaign.internal_notes}</p>
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-3">
          Sumar financiar
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-stone-500">Buget total</dt>
            <dd className="text-stone-900 font-medium tabular-nums">
              {campaign.total_budget != null ? formatEur(campaign.total_budget) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Sumă agreată cu participanți</dt>
            <dd className="text-stone-900 font-medium tabular-nums">
              {totalAgreedFee > 0 ? formatEur(totalAgreedFee) : '—'}
              {participantsCount > 0 && (
                <span className="text-xs text-stone-500 ml-2">({participantsCount} participanți)</span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
