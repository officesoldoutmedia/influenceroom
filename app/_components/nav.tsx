import Link from 'next/link'
import { LogoutButton } from '../logout-button'

export type NavRole = 'owner' | 'manager' | 'account' | 'intern'

type LinkDef = { href: string; label: string; show?: boolean }

export function Nav({ name, role }: { name: string; role: NavRole }) {
  const links: LinkDef[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/brands', label: 'Brands' },
    { href: '/influencers', label: 'Influencers' },
    { href: '/admin/team', label: 'Team', show: role === 'owner' },
  ]

  return (
    <nav className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-6">
      <span className="text-sm font-semibold text-stone-900">Influencer Room</span>
      <div className="flex gap-5 flex-1">
        {links
          .filter((l) => l.show !== false)
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              {l.label}
            </Link>
          ))}
      </div>
      <span className="text-xs text-stone-500">
        {name} · <span className="uppercase tracking-wide">{role}</span>
      </span>
      <LogoutButton />
    </nav>
  )
}
