import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from './_components/nav'

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
    <>
      <Nav name={user.name} role={user.role as NavRole} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            Welcome, {user.name}
          </h1>
          <p className="text-stone-500 text-sm">Sprint 2 in progress.</p>
        </div>
      </main>
    </>
  )
}
