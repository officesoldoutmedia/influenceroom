export function formatFollowers(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'K'
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, '') + 'M'
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
}

/**
 * Canonical currency formatter for the app — every monetary column in the
 * schema is EUR (Sprint 9 Faza 1). Uses ro-RO grouping ("1.500"), no decimals
 * because influencer rates and campaign budgets round to whole euros in
 * practice. Returns "—" for null/NaN so it slots into table cells cleanly.
 */
export function formatEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `€${Number(n).toLocaleString('ro-RO', { maximumFractionDigits: 0 })}`
}
