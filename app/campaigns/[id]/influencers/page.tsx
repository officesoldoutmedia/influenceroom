import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import type { CampaignInfluencerJoined, CampaignWithJoins } from '@/lib/campaigns/types'
import { RosterUI } from './roster-ui'

export const dynamic = 'force-dynamic'

export default async function CampaignInfluencersPage({
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

  const { data: items } = await supabase
    .from('campaign_influencers')
    .select(
      `
        *,
        influencer:influencers(id, name, primary_handle, tier, platforms)
      `,
    )
    .eq('campaign_id', id)
    .order('created_at')

  const canWrite =
    role === 'owner' || role === 'manager' || (role === 'account' && campaign.owner_id === userId)

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 text-sm text-stone-500">
            <Link href="/campaigns" className="hover:text-stone-800">Campaigns</Link>
            <span className="mx-2">›</span>
            <Link href={`/campaigns/${id}`} className="hover:text-stone-800">{campaign.name}</Link>
            <span className="mx-2">›</span>
            <span className="text-stone-700">Influencers</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-6 sm:mb-8">Roster — {campaign.name}</h1>
          <RosterUI
            campaignId={id}
            initialItems={(items ?? []) as CampaignInfluencerJoined[]}
            canWrite={canWrite}
          />
        </div>
      </main>
    </>
  )
}
