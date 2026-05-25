'use client'

import { useEffect } from 'react'

export type ConfirmModalProps = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Anulează',
  variant = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const confirmCls =
    variant === 'danger'
      ? 'px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-60'
      : 'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-stone-900 mb-2">{title}</h2>
        {description && <p className="text-sm text-stone-600 mb-5">{description}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmCls}>
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
