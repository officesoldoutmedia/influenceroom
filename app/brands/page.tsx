import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { BrandsUI, type Brand } from './brands-ui'

export const dynamic = 'force-dynamic'

export default async function BrandsPage() {
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

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, contact_person, contact_email, contact_phone, logo_url, notes, billing_data, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-stone-900 mb-6">Brands</h1>
          <BrandsUI initialBrands={(brands ?? []) as Brand[]} role={role} />
        </div>
      </main>
    </>
  )
}
