import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import type { CampaignTemplate, TaskPriority } from '@/lib/campaigns/types'

export const dynamic = 'force-dynamic'

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-stone-100 text-stone-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-rose-100 text-rose-700',
}

function offsetLabel(days: number): string {
  if (days === 0) return 'T+0'
  return days > 0 ? `T+${days}` : `T${days}`
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: template } = await supabase
    .from('campaign_templates')
    .select('id, name, description, default_task_groups, active, created_at')
    .eq('id', id)
    .maybeSingle<CampaignTemplate>()

  if (!template) notFound()

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/admin/templates" className="text-sm text-stone-500 hover:text-stone-800">← Templates</Link>
          </div>
          <header className="bg-white rounded-2xl shadow-sm p-6 mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-stone-900">{template.name}</h1>
                <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${template.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
                  {template.active ? 'active' : 'inactive'}
                </span>
              </div>
              {template.description && <p className="text-sm text-stone-500 mt-2">{template.description}</p>}
              <p className="text-xs text-stone-500 mt-2">
                Durată standard: {template.default_duration_days} zile · {template.default_task_groups.length} grupuri
              </p>
            </div>
            {role === 'owner' && (
              <div className="flex gap-2 shrink-0">
                <Link href={`/admin/templates/${id}/edit`} className="px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs hover:bg-brand-800">
                  Edit
                </Link>
              </div>
            )}
          </header>

          <div className="space-y-3">
            {template.default_task_groups
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((g) => (
                <section key={g.position} className="bg-white rounded-2xl shadow-sm p-5">
                  <header className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-stone-900">
                      {g.position}. {g.name}
                    </h2>
                    <span className="text-xs font-mono text-stone-500">{offsetLabel(g.due_offset_days)}</span>
                  </header>
                  <ul className="divide-y divide-stone-100">
                    {(g.tasks ?? []).map((t, i) => (
                      <li key={i} className="py-2 flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm text-stone-900">{t.title}</div>
                          {t.description && <div className="text-xs text-stone-500 mt-0.5">{t.description}</div>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {t.role_default && (
                            <span className="text-[10px] uppercase tracking-wide bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                              {t.role_default}
                            </span>
                          )}
                          {t.priority && (
                            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority]}`}>
                              {t.priority}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        </div>
      </main>
    </>
  )
}
