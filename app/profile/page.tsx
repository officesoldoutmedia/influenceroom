import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { ProfileForm, type ProfileData } from './profile-form'
import { vapidPublicKey } from '@/lib/push/send'

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

  const [{ data }, { count: deviceCount }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, name, email, role, avatar_url, notification_prefs')
      .eq('id', userId)
      .maybeSingle<ProfileData>(),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  if (!data) redirect('/login')

  return (
    <>
      <Nav name={data.name} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-6 sm:mb-8">Profil</h1>
          <ProfileForm
            initial={data}
            vapidPublicKey={vapidPublicKey()}
            deviceCount={deviceCount ?? 0}
          />
        </div>
      </main>
    </>
  )
}
