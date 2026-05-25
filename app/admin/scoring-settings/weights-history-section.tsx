type Entry = {
  id: string
  changes: Record<string, { old: number; new: number }> | null
  changed_at: string
  changed_by: { id: string; name: string } | null
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMin = Math.round((now - date.getTime()) / 60000)
  if (diffMin < 1) return 'acum câteva secunde'
  if (diffMin < 60) return `acum ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `acum ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `acum ${diffD} zile`
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Local label map — mirrors CRITERION_LABELS in lib/scoring/types.ts but
// keyed by the `weight_*` audit column names. Kept inline (6 entries) so
// this section is self-contained and doesn't require an import dance for
// a server component.
const WEIGHT_LABELS_RO: Record<string, string> = {
  weight_engagement_rate: 'Engagement rate',
  weight_cpv: 'CPV (cost-per-view)',
  weight_audience_ro: 'Audiență România',
  weight_punctuality: 'Punctualitate',
  weight_deliverable_quality: 'Calitate livrabile',
  weight_collaboration_history: 'Istoric colaborări',
}

function formatChanges(changes: Record<string, { old: number; new: number }> | null): string {
  if (!changes) return '—'
  const parts: string[] = []
  for (const [key, val] of Object.entries(changes)) {
    const label = WEIGHT_LABELS_RO[key] ?? key.replace(/^weight_/, '').replace(/_/g, ' ')
    parts.push(`${label}: ${val.old} → ${val.new}`)
  }
  return parts.join(', ')
}

export function WeightsHistorySection({ entries }: { entries: Entry[] }) {
  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6 mt-6">
      <h2 className="font-display text-lg text-stone-900 mb-4">Istoric modificări ponderi</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-500">Ponderile nu au fost modificate.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
              <th className="py-2">Criterii schimbate</th>
              <th className="py-2">Modificat de</th>
              <th className="py-2">Când</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="py-2 text-stone-700">{formatChanges(e.changes)}</td>
                <td className="py-2 text-stone-600">{e.changed_by?.name ?? '—'}</td>
                <td className="py-2 text-stone-500" title={new Date(e.changed_at).toLocaleString('ro-RO')}>
                  {formatRelative(e.changed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
