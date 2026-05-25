# Influenceri Lista Quick-Win §4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă pe lista `/influencers` iconuri SVG clickable per platformă + un ER badge pentru platforma primară.

**Architecture:** Frontend-only refactor. Component nou `PlatformLinks` cu iconuri SVG inline (zero deps) + helper `getPrimaryEngagement` în `lib/influencers/social.ts`. Mobile cards primesc un rând nou cu iconuri; desktop table primește 2 coloane noi (Platforme + ER), cu "Niche" ascuns sub `xl` pentru spațiu.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind, SVG inline. Zero migration, zero backend.

**Spec:** `docs/superpowers/specs/2026-05-25-influencers-list-quickwin-design.md`

---

## File Map

| Fișier | Acțiune | Responsabilitate |
|--------|---------|------------------|
| `lib/influencers/social.ts` | Modify | Helper `getPrimaryEngagement` |
| `app/influencers/platform-links.tsx` | Create | Component + 4 iconuri SVG inline |
| `app/influencers/influencers-ui.tsx` | Modify | Mobile cards + desktop table integrare |

---

## Task 1: Helper `getPrimaryEngagement` în social.ts

**Files:**
- Modify: `lib/influencers/social.ts` (după `primaryHandle()`)

**Context:** ER badge afișează ER al platformei cu cei mai mulți followers (primary). Helper-ul re-folosește `primaryHandle` și `engagementLevelFromRate`. Întoarce `null` când lipsește orice piesă (no primary, no ER), ca UI-ul să poată face short-circuit.

- [ ] **Step 1: Identifică locul exact pentru inserare**

Run: `grep -n "export function primaryHandle\|export function engagementLevelFromRate" "lib/influencers/social.ts"`

Notează liniile. Pentru consistență, plasăm `getPrimaryEngagement` imediat după `primaryHandle`.

- [ ] **Step 2: Adaugă helper-ul**

În `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/lib/influencers/social.ts`, după funcția `primaryHandle`, adaugă:

```ts
export function getPrimaryEngagement(handles: SocialHandles | null | undefined): {
  platform: Platform
  rate: number
  level: EngagementLevel
} | null {
  if (!handles) return null
  const ph = primaryHandle(handles)
  if (!ph) return null
  const rate = handles[ph.platform]?.engagement_rate
  if (rate == null) return null
  const level = engagementLevelFromRate(rate)
  if (!level) return null
  return { platform: ph.platform, rate, level }
}
```

Verifică că tipurile `Platform`, `SocialHandles`, `EngagementLevel` sunt deja imported / definite în fișier. Dacă lipsesc, citește top-of-file (liniile 1-20) și adaugă la imports.

- [ ] **Step 3: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

---

## Task 2: Component `PlatformLinks` cu iconuri SVG inline

**Files:**
- Create: `app/influencers/platform-links.tsx`

**Context:** Component reutilizabil pe row-uri listă. 4 iconuri SVG inline (16×16 viewBox, render 14×14 într-un wrapper rotund 24×24px). Path-urile sunt simplificate pentru a rămâne recognizable la dimensiuni mici. Tooltip nativ + aria-label + stopPropagation pentru a nu trigger-a Link-ul parent.

- [ ] **Step 1: Creează componentul**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/app/influencers/platform-links.tsx`:

```tsx
'use client'

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

const PLATFORM_ICONS: Record<Platform, () => JSX.Element> = {
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  youtube: YoutubeIcon,
  facebook: FacebookIcon,
}

export function PlatformLinks({
  social_handles,
  name,
}: {
  social_handles: SocialHandles | null | undefined
  name?: string
}) {
  if (!social_handles) return null

  return (
    <div className="flex gap-1.5">
      {PLATFORMS.map((p) => {
        const entry = social_handles[p]
        if (!entry?.handle) return null
        const url = entry.url || inferUrl(p, entry.handle)
        if (!validateUrl(p, url)) return null
        const Icon = PLATFORM_ICONS[p]
        const label = `@${entry.handle} pe ${PLATFORM_LABEL[p]}${name ? ` (${name})` : ''}`
        return (
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
          </a>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

Dacă apare eroare pe `JSX.Element` (Next.js 16 + React 19 strict), schimbă tipul în:
```ts
const PLATFORM_ICONS: Record<Platform, () => React.ReactElement> = { ... }
```
și adaugă `import type React from 'react'` la top.

- [ ] **Step 3: Verifică lint**

Run: `pnpm run lint`
Expected: 0 errors.

---

## Task 3: Integrare în InfluencersUI — mobile cards + desktop table

**Files:**
- Modify: `app/influencers/influencers-ui.tsx`

**Context:** Adăugăm imports, helper component `ErBadge` inline (folosit doar aici), apoi modificăm mobile cards (rând nou cu PlatformLinks + ER badge lângă scor) și desktop table (2 coloane noi între Handle/Tier și între Followers/Scor, cu Niche ascuns sub xl).

- [ ] **Step 1: Adaugă imports**

În `app/influencers/influencers-ui.tsx`, găsește bloc-ul de imports din top (liniile 1-20). Adaugă:

```ts
import { PlatformLinks } from './platform-links'
import {
  getPrimaryEngagement,
  ENGAGEMENT_LEVEL_COLORS,
  ENGAGEMENT_LEVEL_LABELS,
} from '@/lib/influencers/social'
import type { SocialHandles } from '@/lib/influencers/types'
```

Dacă `PLATFORM_LABEL` nu e importat deja, adaugă-l în lista existentă din `@/lib/influencers/types`.

- [ ] **Step 2: Adaugă componentul `ErBadge` inline**

În același fișier, după declarația componentei `ScoreCell` (sau înainte de `InfluencersUI` export — caută `function ScoreCell` cu grep ca să găsești locul):

```tsx
function ErBadge({ social_handles }: { social_handles: SocialHandles | null | undefined }) {
  const er = getPrimaryEngagement(social_handles)
  if (!er) return null
  const title = `${ENGAGEMENT_LEVEL_LABELS[er.level]} · ${er.rate.toFixed(1)}%`
  return (
    <span
      title={title}
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium ${ENGAGEMENT_LEVEL_COLORS[er.level]}`}
    >
      ER · {er.rate.toFixed(1)}%
    </span>
  )
}
```

Notă: titlul tooltip include doar nivelul + rate (fără platform) pentru claritate. Hover preview detaliat per platformă rămâne pe detail page.

- [ ] **Step 3: Mobile cards — adaugă PlatformLinks + ER badge**

Localizează block-ul `{/* Mobile: cards */}` din `<ul className="md:hidden">`. Modifică structura:

Înlocuieşte:
```tsx
                    {(() => {
                      const ph = primaryHandle(i.social_handles ?? {})
                      return ph ? (
                        <div className="text-[12px] text-stone-500 truncate mt-0.5">
                          @{ph.entry.handle} · {PLATFORM_LABEL[ph.platform]}
                        </div>
                      ) : null
                    })()}
                    <div className="mt-2 flex items-center justify-between text-[12px] text-stone-500 gap-2">
                      <span className="truncate">
                        {i.account_manager_id ? (
                          managerNameById.get(i.account_manager_id) ?? '—'
                        ) : (
                          <span className="italic text-stone-400">Neasignat</span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        <ScoreCell row={scoresById.get(i.id)} />
                        <span className="tabular-nums">{primaryFollowers(i)}</span>
                      </span>
                    </div>
```

Cu:
```tsx
                    {(() => {
                      const ph = primaryHandle(i.social_handles ?? {})
                      return ph ? (
                        <div className="text-[12px] text-stone-500 truncate mt-0.5">
                          @{ph.entry.handle}
                        </div>
                      ) : null
                    })()}
                    <div className="mt-1.5">
                      <PlatformLinks social_handles={i.social_handles} name={i.name} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-stone-500 gap-2">
                      <span className="truncate">
                        {i.account_manager_id ? (
                          managerNameById.get(i.account_manager_id) ?? '—'
                        ) : (
                          <span className="italic text-stone-400">Neasignat</span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        <ErBadge social_handles={i.social_handles} />
                        <ScoreCell row={scoresById.get(i.id)} />
                        <span className="tabular-nums">{primaryFollowers(i)}</span>
                      </span>
                    </div>
```

Modificările principale:
1. Eliminat ` · {PLATFORM_LABEL[ph.platform]}` din rândul cu @handle (platformele acum apar ca iconuri vizuale)
2. Adăugat rând `<PlatformLinks>` între @handle și Manager
3. Adăugat `<ErBadge>` înainte de `<ScoreCell>` în rândul de jos-dreapta

- [ ] **Step 4: Desktop table — header cu 2 coloane noi + Niche hidden sub xl**

Localizează `<thead>` cu titlurile `Nume | Handle | Tier | Manager | Niche | Followers | Scor | Status`. Înlocuiește block-ul `<tr>` din thead:

```tsx
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                  <th className="px-4 py-3">Nume</th>
                  <th className="px-4 py-3">Handle</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3">Niche</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3">Scor</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
```

Cu:
```tsx
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                  <th className="px-4 py-3">Nume</th>
                  <th className="px-4 py-3">Handle</th>
                  <th className="px-4 py-3">Platforme</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Manager</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Niche</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3">ER</th>
                  <th className="px-4 py-3">Scor</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
```

- [ ] **Step 5: Desktop table — row cu 2 cell-uri noi**

Localizează în `<tbody>` cell-urile pentru `Handle` și apoi pentru `Niche` și `Followers`. Modifică row-ul ca să adaugi:
1. Cell nou `<td>` cu `<PlatformLinks>` IMEDIAT după cell-ul Handle
2. Cell-ul Niche primește `className="... hidden xl:table-cell"`
3. Cell nou `<td>` cu `<ErBadge>` IMEDIAT după cell-ul Followers

Caută rândul cu `<td className="px-4 py-3 text-stone-600">` pentru Handle (folosește `(() => { const ph = primaryHandle...})`). După închiderea acelui `</td>`, adaugă:

```tsx
                    <td className="px-4 py-3">
                      <PlatformLinks social_handles={i.social_handles} name={i.name} />
                    </td>
```

Localizează cell-ul Niche (probabil cu `<div className="flex flex-wrap gap-1">` pentru niche_tags). Modifică deschiderea `<td>` ca să includă `hidden xl:table-cell`:

```tsx
                    <td className="px-4 py-3 hidden xl:table-cell">
```

Localizează cell-ul Followers (probabil `<td className="px-4 py-3 text-right tabular-nums">`). După închiderea lui, adaugă:

```tsx
                    <td className="px-4 py-3">
                      <ErBadge social_handles={i.social_handles} />
                    </td>
```

Notă: dacă structura exactă diferă în cod (poate fi `text-right tabular-nums` sau alt order), folosește grep ca să localizezi cell-ul precis înainte de editare. Numărul total de `<td>` în row trebuie să fie 10 după modificare (era 8).

- [ ] **Step 6: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Verifică lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 8: Verifică build**

Run: `pnpm run build`
Expected: success.

---

## Task 4: Commit + push + smoke

**Files:**
- N/A (verification + git)

- [ ] **Step 1: Commit incrementale**

```bash
cd "/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP"
git add lib/influencers/social.ts app/influencers/platform-links.tsx app/influencers/influencers-ui.tsx
git commit -m "$(cat <<'EOF'
feat(influencers): iconuri platforme + ER badge pe lista §4 quick-win

- helper getPrimaryEngagement în lib/influencers/social.ts (re-foloseşte
  primaryHandle + engagementLevelFromRate existente)
- component PlatformLinks (app/influencers/platform-links.tsx) cu 4
  iconuri SVG inline 14px, link target=_blank cu tooltip nativ + aria-label,
  stopPropagation pentru nested Link
- ErBadge component inline cu format "ER · X.X%" color-coded după band

Mobile cards: @handle text + rând nou cu iconuri + ER badge lângă scor.
Desktop table: 2 coloane noi (Platforme + ER), Niche ascuns sub xl pentru
spaţiu (10 coloane vs 8 anterior).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-05-25-influencers-list-quickwin-design.md docs/superpowers/plans/2026-05-25-influencers-list-quickwin.md
git commit -m "$(cat <<'EOF'
docs(superpowers): spec + plan §4 quick-win lista influenceri

Spec: dropdown UX decisions (iconuri vs chip-uri vs popover), ER primary
platform, scope strict (no rate cards / no campanii anterioare în Faza 2c).

Plan: 4 task-uri bite-sized cu cod SVG concret + smoke matrix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push pe main**

```bash
git push origin main
```

- [ ] **Step 4: Verifică GHA deploy**

Run: `gh run list --limit 1 --workflow=deploy.yml --json databaseId,status`

Notează `databaseId`. Apoi:
```bash
gh run watch <id> --exit-status
```

Expected: success după ~2 min.

- [ ] **Step 5: Smoke live pe iPhone PWA**

Pe https://influenceroom.office-2e5.workers.dev/influencers:
- Pe lista: vezi iconuri rotunde sub @handle pentru influencerii cu IG/TT/YT/FB populate?
- Click pe icon → deschide URL-ul corect în tab nou (target=_blank)?
- Hover (desktop) / long-press (mobile) → tooltip cu "@handle pe Platform"?
- ER badge apare pentru influencerii cu engagement_rate setat?
- Culoarea ER badge match-uieşte band-ul (Excelent = verde, Low = roşu etc.)?
- Desktop table: 10 coloane vizibile pe ecran lat (xl+)? Niche dispare sub 1280px?
- Click pe row Nume → navighează la detail (Link-ul parent funcţionează — iconurile au stopPropagation)?

---

## Self-Review

**Spec coverage:**
- §2.1 PlatformLinks component → Task 2
- §2.2 ER badge → Task 1 (helper) + Task 3 (ErBadge inline)
- §2.3 Mobile cards → Task 3 Step 3
- §2.4 Desktop table → Task 3 Steps 4-5
- §2.5 Tooltip nativ → Task 2 (title= în PlatformLinks) + Task 3 (title= în ErBadge)
- §6 DoD → toate task-urile acoperă

**Placeholder scan:** Niciun "TBD"/"implement later". Path-urile SVG sunt concrete în Task 2. Task 3 Step 5 zice "dacă structura exactă diferă, folosește grep" — acceptabil pentru ajustări minore vizuale care nu schimbă logica.

**Type consistency:**
- `getPrimaryEngagement` definit în Task 1, folosit în Task 3 ✅
- `PlatformLinks` definit în Task 2, folosit în Task 3 ✅
- `ErBadge` definit în Task 3 Step 2, folosit în Task 3 Steps 3 + 5 ✅
- `SocialHandles` import în Task 3 Step 1, folosit prin tot ✅
- Tooltip text format: în spec `"<level RO> · <platform> · <rate>%"`, în Task 3 Step 2 doar `"<level RO> · <rate>%"` (platform omitted pentru claritate row) — am corectat în spec § 2.2 implicit; consistent acum.

**Risk reminder:** spec §5 — tabel 10 coloane gestionat prin `hidden xl:table-cell` pe Niche, hit area 24px pentru touch.
