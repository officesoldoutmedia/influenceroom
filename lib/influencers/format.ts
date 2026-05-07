export function formatFollowers(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'K'
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, '') + 'M'
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
}
