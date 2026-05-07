import { cn } from './cn'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<Size, { box: string; text: string }> = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]' },
  sm: { box: 'w-8 h-8', text: 'text-[11px]' },
  md: { box: 'w-10 h-10', text: 'text-sm' },
  lg: { box: 'w-14 h-14', text: 'text-lg' },
  xl: { box: 'w-16 h-16', text: 'text-xl' },
}

// Curated 8-tint palette. Each entry pairs a 100-tier surface with a 700/800-tier
// glyph color so contrast stays AA on stone-50 backgrounds — no pale outliers.
// Hash on name to pick deterministically.
const PALETTE = [
  'bg-orange-100 text-orange-800',     // brand-adjacent (matches burnt amber identity)
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-emerald-100 text-emerald-800',
  'bg-teal-100 text-teal-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-stone-200 text-stone-800',
] as const

function hashIndex(name: string, mod: number): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return h % mod
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: Size
  className?: string
}) {
  const s = SIZE[size]
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(s.box, 'rounded-full object-cover bg-stone-100', className)}
      />
    )
  }
  const tone = PALETTE[hashIndex(name, PALETTE.length)]
  return (
    <div
      aria-label={name}
      className={cn(
        s.box,
        s.text,
        tone,
        'rounded-full flex items-center justify-center font-semibold uppercase tracking-tight shrink-0',
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}
