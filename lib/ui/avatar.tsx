import { cn } from './cn'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<Size, { box: string; text: string }> = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]' },
  sm: { box: 'w-8 h-8', text: 'text-[11px]' },
  md: { box: 'w-10 h-10', text: 'text-sm' },
  lg: { box: 'w-14 h-14', text: 'text-lg' },
  xl: { box: 'w-16 h-16', text: 'text-xl' },
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
  return (
    <div
      aria-label={name}
      className={cn(
        s.box,
        s.text,
        'rounded-full bg-brand-50 text-brand-800 flex items-center justify-center font-semibold uppercase tracking-tight',
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}
