import { type HTMLAttributes } from 'react'
import { cn } from './cn'

type Variant = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  brand: 'bg-brand-50 text-brand-800',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
}

const SIZE: Record<Size, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-[11px] px-2 py-0.5',
}

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant
  size?: Size
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  className,
  children,
  ...rest
}: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium uppercase tracking-[0.06em] rounded-full',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
