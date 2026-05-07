'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from './cn'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const triggeredFocusRef = useRef<HTMLElement | null>(null)

  // Focus trap + ESC handling. Lightweight implementation; for very deep
  // accessibility we'd reach for @radix-ui/react-dialog but this stays vanilla.
  useEffect(() => {
    if (!open) return
    triggeredFocusRef.current = (document.activeElement as HTMLElement | null) ?? null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    // Move focus into the dialog
    queueMicrotask(() => {
      const first = ref.current?.querySelector<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    })
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      triggeredFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const sizeCls = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto bg-stone-900/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full bg-white rounded-2xl shadow-[0_16px_40px_-8px_rgb(0_0_0_/_0.18),0_6px_16px_-6px_rgb(0_0_0_/_0.10)] p-6 my-6 sm:my-12',
          sizeCls,
          className,
        )}
      >
        {(title || description) && (
          <div className="mb-4">
            {title && (
              <h2 id="dialog-title" className="font-display text-xl text-stone-900">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
