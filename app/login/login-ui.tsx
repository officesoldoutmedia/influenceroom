'use client'

import { useState } from 'react'
import { PinModal } from './pin-modal'
import { Avatar, Badge, EmptyState, cn } from '@/lib/ui'

export type LoginMember = {
  id: string
  name: string
  role: 'owner' | 'manager' | 'account' | 'intern'
  avatar_url: string | null
}

const ROLE_LABEL: Record<LoginMember['role'], string> = {
  owner: 'Owner',
  manager: 'Manager',
  account: 'Account',
  intern: 'Intern',
}

const ROLE_VARIANT: Record<
  LoginMember['role'],
  'brand' | 'info' | 'neutral'
> = {
  owner: 'brand',
  manager: 'info',
  account: 'info',
  intern: 'neutral',
}

export function LoginUI({ members, next }: { members: LoginMember[]; next: string }) {
  const [selected, setSelected] = useState<LoginMember | null>(null)

  if (members.length === 0) {
    return (
      <EmptyState
        title="Niciun cont activ"
        description="Contactează administratorul pentru a primi acces."
      />
    )
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setSelected(m)}
              className={cn(
                'group w-full bg-white border border-stone-200 rounded-2xl',
                'shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)]',
                'hover:border-brand-300 hover:shadow-[0_8px_24px_-6px_rgb(0_0_0_/_0.08)]',
                'transition-all duration-150',
                'p-5 sm:p-6 flex flex-col items-center text-center',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2',
              )}
            >
              <Avatar name={m.name} src={m.avatar_url} size="lg" />
              <p className="mt-3 text-sm font-medium text-stone-900 truncate w-full">
                {m.name}
              </p>
              <div className="mt-2">
                <Badge variant={ROLE_VARIANT[m.role]} size="sm">
                  {ROLE_LABEL[m.role]}
                </Badge>
              </div>
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
