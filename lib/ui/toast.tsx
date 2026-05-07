'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { cn } from './cn'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: ToastKind; message: string }

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(
  null,
)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, message }])
    // Auto-dismiss after 3.5s
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-3 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pwa-safe-top pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastBubble key={t.id} toast={t} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function ToastBubble({ toast }: { toast: Toast }) {
  const [enter, setEnter] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnter(true)
  }, [])
  const color =
    toast.kind === 'success'
      ? 'bg-emerald-700 text-white'
      : toast.kind === 'error'
        ? 'bg-rose-700 text-white'
        : 'bg-stone-900 text-white'
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto max-w-sm w-full px-4 py-3 rounded-lg text-sm font-medium shadow-lg',
        color,
        'transform transition-all duration-200',
        enter ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}
    >
      {toast.message}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) {
    // Fallback no-op so components don't crash if Provider absent.
    return { push: (_k: ToastKind, _m: string) => {} }
  }
  return ctx
}
