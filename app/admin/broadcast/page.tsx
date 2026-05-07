import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { BroadcastUI, type BroadcastRow, type MemberOption } from './broadcast-ui'

export const dynamic = 'force-dynamic'

export default async function AdminBroadcastPage() {
  const h = await headers()
  const userId = h.get('x-user-id')
  const role = (h.get('x-user-role') as NavRole | null) ?? null
  if (!userId || !role) redirect('/login')
  if (role !== 'owner') redirect('/')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const [{ data: me }, { data: members }, { data: broadcasts }] = await Promise.all([
    supabase.from('team_members').select('name').eq('id', userId).maybeSingle(),
    supabase
      .from('team_members')
      .select('id, name, role')
      .eq('active', true)
      .order('name'),
    supabase
      .from('broadcasts')
      .select(
        'id, sender_id, subject, body, recipient_filter, resolved_recipient_ids, methods, email_success_count, email_fail_count, push_success_count, push_fail_count, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Resolve sender names for the history table.
  const senderIds = Array.from(
    new Set((broadcasts ?? []).map((b) => b.sender_id).filter(Boolean) as string[]),
  )
  const { data: senders } = senderIds.length
    ? await supabase
        .from('team_members')
        .select('id, name')
        .in('id', senderIds)
    : { data: [] as { id: string; name: string }[] }

  const senderMap = new Map<string, string>(
    (senders ?? []).map((s) => [s.id, s.name]),
  )

  const history: BroadcastRow[] = (broadcasts ?? []).map((b) => ({
    id: b.id,
    sender_name: b.sender_id ? senderMap.get(b.sender_id) ?? '—' : '—',
    subject: b.subject,
    body: b.body,
    recipient_count: (b.resolved_recipient_ids ?? []).length,
    methods: b.methods,
    email_success: b.email_success_count,
    email_fail: b.email_fail_count,
    push_success: b.push_success_count,
    push_fail: b.push_fail_count,
    created_at: b.created_at,
  }))

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="min-h-[calc(100vh-49px)] bg-stone-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-stone-900 mb-6">Broadcast</h1>
          <BroadcastUI
            members={(members ?? []) as MemberOption[]}
            history={history}
          />
        </div>
      </main>
    </>
  )
}
