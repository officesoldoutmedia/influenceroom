import { type ReactNode } from 'react'
import { cn } from './cn'

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-white border border-stone-200 rounded-xl py-12 px-6 sm:py-16 text-center',
        className,
      )}
    >
      <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center">
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
          className="text-brand-700"
        >
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <path
            d="M6.5 9h5M9 6.5v5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="font-display text-lg text-stone-900">{title}</p>
      {description && <p className="mt-1.5 text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
