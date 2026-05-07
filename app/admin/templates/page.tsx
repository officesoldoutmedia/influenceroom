import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import type { CampaignTemplate, TemplateGroupDef } from '@/lib/campaigns/types'
import { TemplatesListUI } from './templates-list-ui'

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
    .select('id, name, description, default_duration_days, default_task_groups, active, created_at')
    .order('active', { ascending: false })
    .order('name', { ascending: true })

  const { data: usageRows } = await supabase
    .from('campaigns')
    .select('template_id')
    .not('template_id', 'is', null)

  const usage = new Map<string, number>()
  for (const r of (usageRows ?? []) as { template_id: string | null }[]) {
    if (!r.template_id) continue
    usage.set(r.template_id, (usage.get(r.template_id) ?? 0) + 1)
  }

  const items = ((templates ?? []) as CampaignTemplate[]).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    default_duration_days: t.default_duration_days,
    active: t.active,
    groups_count: (t.default_task_groups ?? []).length,
    tasks_count: totalTaskCount(t.default_task_groups ?? []),
    campaigns_count: usage.get(t.id) ?? 0,
  }))

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-stone-900">Templates</h1>
            {role === 'owner' && (
              <Link
                href="/admin/templates/new"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                + New Template
              </Link>
            )}
          </div>
          <TemplatesListUI items={items} role={role} />
        </div>
      </main>
    </>
  )
}
