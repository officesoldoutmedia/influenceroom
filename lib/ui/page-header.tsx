import { type ReactNode } from 'react'
import { cn } from './cn'

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700 mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-[1.05]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[15px] text-stone-600 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
