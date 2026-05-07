import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { ProfileForm, type ProfileData } from './profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data } = await supabase
    .from('team_members')
    .select('id, name, email, role, avatar_url, notification_prefs')
    .eq('id', userId)
    .maybeSingle<ProfileData>()

  if (!data) redirect('/login')

  return (
    <>
      <Nav name={data.name} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold text-stone-900 mb-6">Profil</h1>
          <ProfileForm initial={data} />
        </div>
      </main>
    </>
  )
}
