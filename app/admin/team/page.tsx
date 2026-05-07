import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
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

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email, role, avatar_url, active, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <a href="/" className="text-sm text-stone-500 hover:text-stone-700">
              ← Dashboard
            </a>
            <h1 className="text-2xl font-semibold text-stone-900 mt-1">Team</h1>
          </div>
        </header>
        <TeamUI
          initialMembers={(members ?? []) as TeamMember[]}
          currentUserId={currentUserId}
        />
      </div>
    </main>
  )
}
