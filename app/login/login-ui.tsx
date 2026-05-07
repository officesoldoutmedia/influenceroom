'use client'

import { useState } from 'react'
import { PinModal } from './pin-modal'

export type LoginMember = {
  id: string
  name: string
  role: 'owner' | 'manager' | 'account' | 'intern'
  avatar_url: string | null
}

const ROLE_BADGE: Record<LoginMember['role'], string> = {
  owner: 'bg-indigo-100 text-indigo-700',
  manager: 'bg-blue-100 text-blue-700',
  account: 'bg-cyan-100 text-cyan-700',
  intern: 'bg-stone-200 text-stone-700',
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
}

export function LoginUI({ members, next }: { members: LoginMember[]; next: string }) {
  const [selected, setSelected] = useState<LoginMember | null>(null)

  if (members.length === 0) {
    return (
      <p className="text-center text-stone-500 text-sm">
        Niciun cont activ. Contactează administratorul.
      </p>
    )
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setSelected(m)}
              className="w-full bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col items-center text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-lg font-semibold overflow-hidden">
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials(m.name)
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-stone-900">{m.name}</p>
              <span className={`mt-2 text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[m.role]}`}>
                {m.role}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <PinModal user={selected} next={next} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
