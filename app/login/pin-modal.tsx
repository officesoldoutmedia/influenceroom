'use client'

import { useEffect, useRef, useState } from 'react'
import type { LoginMember } from './login-ui'

type Props = {
  user: LoginMember
  next: string
  onClose: () => void
}

export function PinModal({ user, next, onClose }: Props) {
  const [digits, setDigits] = useState<string[]>(['', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [locked, setLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    refs[0].current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(pin: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, pin }),
      })

      if (res.ok) {
        window.location.assign(next || '/')
        return
      }

      if (res.status === 423) {
        setLocked(true)
        setError('Cont blocat — încearcă din nou în 5 minute')
        return
      }

      setShake(true)
      setError('PIN greșit')
      setTimeout(() => setShake(false), 400)
      setDigits(['', '', '', ''])
      refs[0].current?.focus()
    } catch {
      setError('Eroare de conexiune')
    } finally {
      setSubmitting(false)
    }
  }

  function onChange(i: number, val: string) {
    if (locked || submitting) return
    const d = val.replace(/\D/g, '').slice(-1)
    const updated = [...digits]
    updated[i] = d
    setDigits(updated)
    setError(null)
    if (d && i < 3) refs[i + 1].current?.focus()
    if (updated.every((x) => x.length === 1)) submit(updated.join(''))
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-user-name"
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-[0_16px_40px_-8px_rgb(0_0_0_/_0.18)] p-7 sm:p-8 w-full max-w-sm ${shake ? 'animate-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pin-user-name" className="font-display text-xl text-stone-900 text-center">{user.name}</h2>
        <p className="text-sm text-stone-500 text-center mt-1 mb-6">Introdu PIN-ul</p>
        <div className="flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              disabled={locked || submitting}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              aria-label={`Cifra ${i + 1}`}
              className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-display font-medium border border-stone-300 rounded-lg focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20 disabled:bg-stone-100 disabled:text-stone-400 transition-colors"
            />
          ))}
        </div>
        <p className="min-h-[20px] text-sm text-rose-600 text-center mt-4">
          {error ?? ' '}
        </p>
      </div>
    </div>
  )
}
