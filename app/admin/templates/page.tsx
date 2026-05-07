import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import type { CampaignTemplate, TemplateGroupDef } from '@/lib/campaigns/types'

export const dynamic = 'force-dynamic'

function totalTaskCount(groups: TemplateGroupDef[]): number {
  return groups.reduce((acc, g) => acc + (g.tasks?.length ?? 0), 0)
}

export default async function TemplatesPage() {
  const h = await headers()
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  const userId = h.get('x-user-id')
  if (!role || !userId) redirect('/login')
  if (role !== 'owner' && role !== 'manager') redirect('/')

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

  const { data: templates } = await supabase
    .from('campaign_templates')
    .select('id, name, description, default_task_groups, active, created_at')
    .eq('active', true)
    .order('name', { ascending: true })

  const items = (templates ?? []) as CampaignTemplate[]

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold text-stone-900 mb-6">Templates</h1>
          {items.length === 0 ? (
            <p className="text-stone-500 text-sm">Niciun template activ.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/templates/${t.id}`}
                  className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5"
                >
                  <h2 className="text-base font-semibold text-stone-900 mb-1">{t.name}</h2>
                  {t.description && (
                    <p className="text-sm text-stone-500 mb-3 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex gap-3 text-xs text-stone-500">
                    <span>{t.default_task_groups.length} groups</span>
                    <span>·</span>
                    <span>{totalTaskCount(t.default_task_groups)} tasks</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
