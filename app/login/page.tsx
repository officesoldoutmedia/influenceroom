import { createClient } from '@supabase/supabase-js'
import { LoginUI, type LoginMember } from './login-ui'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, role, avatar_url')
    .eq('active', true)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold text-stone-900 mb-1 text-center">
          Influencer Room
        </h1>
        <p className="text-stone-500 text-sm mb-8 text-center">Selectează contul</p>
        <LoginUI members={(members ?? []) as LoginMember[]} next={sp.next ?? '/'} />
      </div>
    </main>
  )
}
