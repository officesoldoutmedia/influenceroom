import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import type { CampaignTemplate } from '@/lib/campaigns/types'
import { TemplateForm } from '../../template-form'

export const dynamic = 'force-dynamic'

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const h = await headers()
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  const userId = h.get('x-user-id')
  if (!role || !userId) redirect('/login')
  if (role !== 'owner') redirect('/admin/templates')

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
    .select('id, name, description, default_duration_days, default_task_groups, active, created_at')
    .eq('id', id)
    .maybeSingle<CampaignTemplate>()

  if (!template) notFound()

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href={`/admin/templates/${id}`} className="text-sm text-stone-500 hover:text-stone-800">← Template</Link>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-6 sm:mb-8">Edit {template.name}</h1>
          <TemplateForm isEdit initialTemplate={template} />
        </div>
      </main>
    </>
  )
}
