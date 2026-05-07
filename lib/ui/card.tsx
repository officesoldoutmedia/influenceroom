import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from './cn'

const base =
  'bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)]'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Removes default padding so children control their own. */
  noPadding?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, noPadding, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(base, !noPadding && 'p-5 sm:p-6', className)}
      {...rest}
    >
      {children}
    </div>
  )
})

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500',
        className,
      )}
      {...rest}
    >
      {children}
    </h2>
  )
}

export function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-4 pt-4 border-t border-stone-100 flex items-center justify-end gap-2',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
