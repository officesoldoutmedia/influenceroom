import { cn } from './cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-stone-200 rounded animate-pulse-subtle',
        className,
      )}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-3 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}
