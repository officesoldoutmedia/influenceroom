'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LogoutButton } from '../logout-button'
import { Avatar, cn } from '@/lib/ui'

export type NavRole = 'owner' | 'manager' | 'account' | 'intern'

type LinkDef = { href: string; label: string; show?: boolean }

export function Nav({ name, role }: { name: string; role: NavRole }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links: LinkDef[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/tasks', label: 'Taskuri' },
    { href: '/campaigns', label: 'Campanii' },
    { href: '/influencers', label: 'Influenceri' },
    { href: '/brands', label: 'Branduri' },
    { href: '/profile', label: 'Profil' },
    { href: '/admin/notifications', label: 'Notificări', show: role === 'owner' },
    { href: '/admin/scoring-settings', label: 'Setări scoring', show: role === 'owner' },
    { href: '/admin/broadcast', label: 'Broadcast', show: role === 'owner' },
    { href: '/admin/team', label: 'Echipă', show: role === 'owner' },
  ]

  const visibleLinks = links.filter((l) => l.show !== false)
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <nav
        className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-stone-200 pwa-safe-top"
        aria-label="Navigare principală"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            aria-label="Influence Room — către Dashboard"
            className="flex items-center -mx-1 px-1 py-1 rounded-md hover:bg-stone-100 transition-colors"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-wordmark.svg"
              alt="Influence Room"
              width={158}
              height={13}
              className="h-3.5 sm:h-[14px] w-auto select-none"
              draggable={false}
            />
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1 flex-1 ml-4">
            {visibleLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                  isActive(l.href)
                    ? 'text-brand-800 bg-brand-50'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100',
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex-1 lg:hidden" />

          {/* User pill */}
          <div className="hidden sm:flex items-center gap-2 text-[13px] text-stone-600">
            <Avatar name={name} size="xs" />
            <span className="truncate max-w-[140px]">{name}</span>
            <span className="text-stone-400">·</span>
            <span className="uppercase tracking-[0.08em] text-[10px] text-stone-500">{role}</span>
          </div>
          <LogoutButton />

          {/* Mobile burger */}
          <button
            type="button"
            aria-label={open ? 'Închide meniul' : 'Deschide meniul'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden h-10 w-10 -mr-1 rounded-md text-stone-700 hover:bg-stone-100 inline-flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {open ? (
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3 6h14M3 10h14M3 14h14"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="lg:hidden border-t border-stone-200 bg-white">
            <div className="px-4 py-3 max-w-7xl mx-auto">
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-stone-100 sm:hidden">
                <Avatar name={name} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{name}</div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
                    {role}
                  </div>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-1">
                {visibleLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block px-3 py-2.5 rounded-md text-sm font-medium',
                        isActive(l.href)
                          ? 'text-brand-800 bg-brand-50'
                          : 'text-stone-700 hover:bg-stone-100',
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
                    window.location.assign('/login')
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  Ieșire
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
