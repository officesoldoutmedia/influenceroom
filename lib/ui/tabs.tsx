'use client'

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { cn } from './cn'

type Ctx = {
  value: string
  setValue: (v: string) => void
}
const TabsCtx = createContext<Ctx | null>(null)

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
}) {
  const [internal, setInternal] = useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value! : internal
  const setValue = (v: string) => {
    if (!isControlled) setInternal(v)
    onValueChange?.(v)
  }
  return (
    <TabsCtx.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        // Mobile: horizontal scroll with snap; desktop: regular flex.
        'flex gap-1 overflow-x-auto sm:overflow-visible -mx-4 sm:mx-0 px-4 sm:px-0',
        'border-b border-stone-200',
        'snap-x snap-mandatory sm:snap-none',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('TabsTrigger must be used inside <Tabs>')
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cn(
        'whitespace-nowrap snap-start',
        'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-brand-700 text-brand-800'
          : 'border-transparent text-stone-500 hover:text-stone-800',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(TabsCtx)
  if (!ctx) throw new Error('TabsContent must be used inside <Tabs>')
  if (ctx.value !== value) return null
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  )
}
