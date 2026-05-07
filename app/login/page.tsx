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
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 py-10 sm:py-16 pwa-safe-top pwa-safe-bottom">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-700" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Internal access
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-stone-900 leading-[1.05] mb-3">
            Influencer Room
          </h1>
          <p className="text-stone-600 text-[15px]">Selectează contul tău pentru a continua.</p>
        </div>
        <LoginUI members={(members ?? []) as LoginMember[]} next={sp.next ?? '/'} />
      </div>
    </main>
  )
}
