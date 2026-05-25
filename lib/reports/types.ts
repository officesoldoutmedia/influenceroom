// Sprint 11 Faza A — types pentru report_uploads.
// KPI fields: toate optionale, numeric ≥ 0. Validat în API + UI.

export const KPI_KEYS = [
  'kpi_views',
  'kpi_reach',
  'kpi_engagement',
  'kpi_saves',
  'kpi_profile_visits',
  'kpi_link_clicks',
  'kpi_watch_time_sec',
] as const

export type KpiKey = (typeof KPI_KEYS)[number]
export type KpiFields = Partial<Record<KpiKey, number | null>>

export const KPI_LABELS_RO: Record<KpiKey, string> = {
  kpi_views: 'Views',
  kpi_reach: 'Reach',
  kpi_engagement: 'Engagement (likes+comments+shares)',
  kpi_saves: 'Saves',
  kpi_profile_visits: 'Profile visits',
  kpi_link_clicks: 'Link clicks',
  kpi_watch_time_sec: 'Watch time (sec)',
}

/** Compact summary pentru row UI: "R 12.5K · E 850 · V 8.2K" */
export const KPI_SUMMARY_ORDER: Array<{ key: 'kpi_reach' | 'kpi_engagement' | 'kpi_views'; short: string }> = [
  { key: 'kpi_reach', short: 'R' },
  { key: 'kpi_engagement', short: 'E' },
  { key: 'kpi_views', short: 'V' },
]

export type ReportEntry = {
  id: string
  participant_id: string
  campaign_id: string | null
  influencer_id: string | null
  file_path: string
  file_name: string
  file_size_bytes: number | null
  file_mime: string | null
  kpi_views: number | null
  kpi_reach: number | null
  kpi_engagement: number | null
  kpi_saves: number | null
  kpi_profile_visits: number | null
  kpi_link_clicks: number | null
  kpi_watch_time_sec: number | null
  notes: string | null
  uploaded_by: { id: string; name: string } | { id: string; name: string }[] | null
  uploaded_at: string
  updated_by: { id: string; name: string } | { id: string; name: string }[] | null
  updated_at: string
  signedUrl?: string | null
  // Optional joined data pentru list endpoints
  participant?: {
    id: string
    platform: string
    account_handle: string | null
    influencer: { id: string; name: string } | { id: string; name: string }[] | null
  } | { id: string; platform: string; account_handle: string | null; influencer: unknown }[] | null
  campaign?: { id: string; name: string } | { id: string; name: string }[] | null
}

export const ACCEPTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Compact format: 12500 → "12.5K", 1500000 → "1.5M" */
export function formatKpiNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatKpiSummary(report: Pick<ReportEntry, 'kpi_views' | 'kpi_reach' | 'kpi_engagement'>): string {
  const parts: string[] = []
  for (const { key, short } of KPI_SUMMARY_ORDER) {
    const val = report[key]
    if (val != null) parts.push(`${short} ${formatKpiNumber(val)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/** Strip non-ASCII, replace problematic chars, truncate la 100. */
export function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^\x20-\x7e]/g, '') // strip non-ASCII
    .replace(/[/\\?%*:|"<>]/g, '_') // replace path-unsafe chars
    .trim()
    .slice(0, 100) || 'file'
}
