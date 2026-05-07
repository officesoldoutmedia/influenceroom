'use client'

import { useState } from 'react'

export function LogoutButton() {
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="px-4 py-2 rounded-lg bg-stone-900 text-white text-sm hover:bg-stone-800 disabled:opacity-60"
    >
      Sign out
    </button>
  )
}
