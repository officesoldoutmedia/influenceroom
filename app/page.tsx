import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { LogoutButton } from './logout-button'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const h = await headers()
  const userId = h.get('x-user-id')
  if (!userId) redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: user } = await supabase
    .from('team_members')
    .select('id, name, role')
    .eq('id', userId)
    .maybeSingle()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-stone-900">Welcome, {user.name}</h1>
          <LogoutButton />
        </div>
        <p className="text-stone-500 text-sm">Sprint 1 in progress.</p>
        {user.role === 'owner' && (
          <nav className="mt-6">
            <a
              href="/admin/team"
              className="inline-block px-4 py-2 rounded-lg bg-white shadow-sm text-sm text-stone-900 hover:shadow-md"
            >
              Team →
            </a>
          </nav>
        )}
      </div>
    </main>
  )
}
