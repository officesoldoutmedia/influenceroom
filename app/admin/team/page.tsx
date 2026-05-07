import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { TeamUI, type TeamMember } from './team-ui'

export const dynamic = 'force-dynamic'

export default async function AdminTeamPage() {
  const h = await headers()
  if (h.get('x-user-role') !== 'owner') redirect('/')
  const currentUserId = h.get('x-user-id') ?? ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: me } = await supabase
    .from('team_members')
    .select('name, role')
    .eq('id', currentUserId)
    .maybeSingle()

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email, role, avatar_url, active, created_at')
    .order('created_at', { ascending: false })

  return (
    <>
      <Nav name={me?.name ?? ''} role={(me?.role ?? 'owner') as NavRole} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-6 sm:mb-8">Echipă</h1>
          <TeamUI
            initialMembers={(members ?? []) as TeamMember[]}
            currentUserId={currentUserId}
          />
        </div>
      </main>
    </>
  )
}
