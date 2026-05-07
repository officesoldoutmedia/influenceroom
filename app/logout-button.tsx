'use client'

import { useState } from 'react'
import { Button } from '@/lib/ui'

export function LogoutButton() {
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <Button
      type="button"
      onClick={logout}
      loading={busy}
      variant="ghost"
      size="sm"
      className="hidden sm:inline-flex"
    >
      Ieșire
    </Button>
  )
}
