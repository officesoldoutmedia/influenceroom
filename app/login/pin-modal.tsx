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
        window.location.href = next || '/'
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
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm ${shake ? 'animate-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-900 text-center">{user.name}</h2>
        <p className="text-sm text-stone-500 text-center mb-6">Introdu PIN-ul</p>
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
              className="w-12 h-14 text-center text-2xl border border-stone-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-stone-100 disabled:text-stone-400"
            />
          ))}
        </div>
        <p className="h-5 text-sm text-rose-600 text-center mt-3">
          {error ?? ' '}
        </p>
      </div>
    </div>
  )
}
