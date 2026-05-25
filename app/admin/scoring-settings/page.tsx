import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Nav, type NavRole } from '@/app/_components/nav'
import { ScoringSettingsUI } from './scoring-settings-ui'
import { WeightsHistorySection } from './weights-history-section'
import type { ScoringSettings } from '@/lib/scoring/types'

export const dynamic = 'force-dynamic'

export default async function AdminScoringSettingsPage() {
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

  const [
    { data: me },
    { data: settings },
    { count: influencerCount },
    { data: updater },
    { data: history },
  ] = await Promise.all([
    supabase.from('team_members').select('name').eq('id', userId).maybeSingle(),
    supabase.from('scoring_settings').select('*').eq('id', 1).maybeSingle<ScoringSettings>(),
    supabase.from('influencers').select('id', { count: 'exact', head: true }),
    // Look up the human name for the audit line. We do this in parallel and
    // bind below so the UI doesn't need a second round-trip.
    supabase
      .from('scoring_settings')
      .select('updated_by, updater:team_members!scoring_settings_updated_by_fkey(name)')
      .eq('id', 1)
      .maybeSingle(),
    // Last 10 weight-change audit entries. `changed_by` join may resolve as
    // either an object or single-element array depending on PostgREST FK
    // alias detection — normalised below before passing to the section.
    supabase
      .from('scoring_settings_history')
      .select('id, changes, changed_at, changed_by:team_members(id, name)')
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  // The FK alias above isn't guaranteed to exist by name; fall back to a
  // direct lookup if it didn't resolve. Cheap and keeps the page robust to
  // schema drift on team_members FKs.
  let updaterName: string | null = null
  const u = (updater as { updater?: { name: string } | null } | null)?.updater
  if (u?.name) {
    updaterName = u.name
  } else if (settings?.updated_by) {
    const { data: tm } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', settings.updated_by)
      .maybeSingle()
    updaterName = tm?.name ?? null
  }

  // Normalise the audit join: PostgREST may give us `changed_by` as either a
  // single object or a one-element array depending on FK alias resolution.
  type HistoryRow = {
    id: string
    changes: Record<string, { old: number; new: number }> | null
    changed_at: string
    changed_by:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
  }
  const mappedHistory = ((history ?? []) as HistoryRow[]).map((h) => ({
    id: h.id,
    changes: h.changes,
    changed_at: h.changed_at,
    changed_by: Array.isArray(h.changed_by) ? h.changed_by[0] ?? null : h.changed_by,
  }))

  return (
    <>
      <Nav name={me?.name ?? ''} role={role} />
      <main className="bg-stone-50 px-4 sm:px-6 py-6 sm:py-10 pwa-safe-bottom">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05] mb-2">
            Setări scoring
          </h1>
          <p className="text-sm text-stone-600 mb-6">
            Reglează cât cântăresc cele 6 criterii în scorul total. Schimbarea
            ponderilor recalculează scorurile pentru toți cei {influencerCount ?? 0} influenceri.
          </p>
          <ScoringSettingsUI
            initialSettings={(settings ?? null) as ScoringSettings | null}
            influencerCount={influencerCount ?? 0}
            updaterName={updaterName}
          />
          <WeightsHistorySection entries={mappedHistory} />
        </div>
      </main>
    </>
  )
}
