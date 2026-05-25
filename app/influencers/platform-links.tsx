'use client'

import type { ReactElement } from 'react'
import { PLATFORMS, PLATFORM_LABEL, type Platform, type SocialHandles } from '@/lib/influencers/types'
import { inferUrl, validateUrl } from '@/lib/influencers/social'

function InstagramIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11.5" cy="4.5" r="0.8" />
    </svg>
  )
}

function TiktokIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M10 1.5v7.5a2.5 2.5 0 1 1-2.5-2.5c.17 0 .34.02.5.05V4.5a4.5 4.5 0 1 0 4 4.5v-5a3.5 3.5 0 0 0 3 1.7V3.2a2.5 2.5 0 0 1-2-1.7Z" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <rect x="1" y="3.5" width="14" height="9" rx="1.5" ry="1.5" />
      <path d="M6.5 6L10 8L6.5 10Z" fill="white" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M9.2 13V8.5h1.5l.2-1.8H9.2v-1c0-.5.2-.9.9-.9h.8v-1.6c-.4-.05-.9-.1-1.5-.1-1.5 0-2.6.9-2.6 2.5v1.1H5.4v1.8h1.4V13h2.4Z" fill="white" />
    </svg>
  )
}

const PLATFORM_ICONS: Record<Platform, () => ReactElement> = {
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  youtube: YoutubeIcon,
  facebook: FacebookIcon,
}

export function PlatformLinks({
  social_handles,
  name,
  showEmptyPlaceholder = false,
}: {
  social_handles: SocialHandles | null | undefined
  name?: string
  /** True pe desktop table cell ca să afişăm "—" când nu există platforme. */
  showEmptyPlaceholder?: boolean
}) {
  const links: ReactElement[] = []
  if (social_handles) {
    for (const p of PLATFORMS) {
      const entry = social_handles[p]
      if (!entry?.handle) continue
      const url = entry.url || inferUrl(p, entry.handle)
      if (!validateUrl(p, url)) continue
      const Icon = PLATFORM_ICONS[p]
      const label = `@${entry.handle} pe ${PLATFORM_LABEL[p]}${name ? ` (${name})` : ''}`
      links.push(
        <a
          key={p}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-500 hover:bg-brand-700/10 hover:text-brand-700 transition-colors"
        >
          <Icon />
        </a>,
      )
    }
  }

  if (links.length === 0) {
    return showEmptyPlaceholder ? <span className="text-stone-400">—</span> : null
  }

  return <div className="flex gap-1.5">{links}</div>
}
