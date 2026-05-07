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

  // Wrapper-based hide: the inner Button declares its own `inline-flex` which
  // would otherwise win over a sibling `hidden` utility on the same element
  // (Tailwind v4 sort order). Wrapping moves the display rule onto a parent
  // that has no competing utilities.
  return (
    <div className="hidden sm:block">
      <Button type="button" onClick={logout} loading={busy} variant="ghost" size="sm">
        Ieșire
      </Button>
    </div>
  )
}
