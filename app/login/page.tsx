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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            aria-hidden="true"
            className="mx-auto w-16 h-16 rounded-2xl mb-6 shadow-[0_4px_14px_-4px_rgb(194_65_12_/_0.35)]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-wordmark.svg"
            alt="Influencer Room"
            className="mx-auto h-5 sm:h-6 w-auto mb-4"
          />
          <p className="text-stone-600 text-[15px]">Selectează contul tău pentru a continua.</p>
        </div>
        <LoginUI members={(members ?? []) as LoginMember[]} next={sp.next ?? '/'} />
      </div>
    </main>
  )
}
