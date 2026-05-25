# Sprint 15 — Faza 2b §3+§4 quick-win lista influenceri

**Data:** 2026-05-25
**Sursă:** `Influence_Room_prompt_actualizat.docx`, secțiunile 3 (Social media direct links) și 4 (Cerințe UX/UI per influencer).
**Scop:** Adaugă pe lista `/influencers` iconuri clickable per platformă (IG/TT/YT/FB) și un ER badge pentru platforma primară, fără să atingem backend-ul.

---

## 1. Context

Audit-ul preliminar (Faza 0) a confirmat:
- §3 — links clickable + hover preview cu "Open Profile" există pe `/influencers/[id]` (commit 3df6f7c), dar **NU pe lista** `/influencers` (doar text `@handle · Platform`)
- §4 — lista nu arată: badge-uri vizuale per platformă, ER badge, links clickable

Decizii confirmate cu Stefan (2026-05-25 brainstorming):
- **Platforme**: iconuri SVG rotunde clickable, una per platformă activă, cu tooltip nativ + target=_blank
- **ER badge**: pentru platforma primară (max followers, consistent cu logica tier auto-calc) — un singur indicator clar pe row
- **Scope**: strict §3 + §4 quick-win. Rate cards summary și campanii anterioare pe listă rămân pentru o Fază 2c separată dacă echipa cere.

Stack:
- Frontend-only (zero backend, zero migration)
- Component nou + 2 helpers existente refolosite
- Iconuri SVG inline (zero deps, identic cu pattern-ul `TrashIcon` din §12)

## 2. Cerințe funcționale

### 2.1 Iconuri clickable per platformă

Componenta nouă `PlatformLinks` (în `app/influencers/platform-links.tsx`):
- Primește prop `social_handles: SocialHandles` (tipul existent din `lib/influencers/types.ts`) și `name?: string` (pentru aria-label)
- Iterează ordinea canonică `['instagram', 'tiktok', 'youtube', 'facebook']`
- Pentru fiecare platformă cu `handle` populate și URL valid (`validateUrl(platform, url)`):
  - Redă un `<a>` cu icon SVG rotund 24×24px
  - `href = url` (fallback la `inferUrl(platform, handle)` dacă lipsește)
  - `target="_blank"` + `rel="noopener noreferrer"`
  - `title="@<handle> pe <Platform>"` (tooltip nativ)
  - `aria-label` identic
  - `onClick: e.stopPropagation()` ca să nu trigger-eze Link-ul de pe row
- Layout: `flex gap-1.5`
- Stil: `bg-stone-100 text-stone-500 hover:bg-brand-700/10 hover:text-brand-700 rounded-full`
- Hit area min 24×24px pentru touch (testat pe iPhone PWA)

Iconurile SVG (inline, 16×16 inside 24×24 wrapper):
- **Instagram**: pătrat rotund cu cerc înăuntru (simplified Instagram glyph)
- **TikTok**: notă muzicală cu shadow
- **YouTube**: rectangle cu play triangle
- **Facebook**: literă "f" stilizată

Le definim în același fișier ca componente mici (`InstagramIcon`, `TiktokIcon`, etc.). Sunt path-uri simple, ~10 linii fiecare. Folosim aceeași abordare ca `TrashIcon` din `campaigns-ui.tsx`.

### 2.2 ER badge pentru primary platform

Helper nou `getPrimaryEngagement(social_handles)` în `lib/influencers/social.ts`:
- Re-folosește `primaryHandle()` (cea cu max followers)
- Întoarce `{ platform, rate, level } | null`
- `level` derivat cu `engagementLevelFromRate()` existent

UI pe row:
- Pill mic cu format `ER · X.X%` (ex: "ER · 5.2%")
- Background: `ENGAGEMENT_LEVEL_COLORS[level]`
- Text: uppercase tracking 0.06em (consistent cu tier badge)
- Display: `inline-block px-2 py-0.5 rounded-full text-[10px] font-medium`
- Tooltip nativ: `title="<level RO> · <platform> · <rate>%"` (ex: "Excelent · Instagram · 12.3%")
- Nu apare dacă `engagement_rate` lipsește pe primary

### 2.3 Mobile cards (`md:hidden`)

Actuala structură (linia 147-189 în `influencers-ui.tsx`):
```
Avatar | Nume + tier_badge
        @handle · Platform
        Manager | Scor + Followers
```

Noua structură:
```
Avatar | Nume + tier_badge
        @handle (text, fără platform suffix)
        <PlatformLinks>           ← rând nou
        Manager | ER + Scor + Followers
```

ER badge se mută lângă Scor în zona de dreapta-jos. Spațiul vertical crește cu ~28px per card; acceptabil pentru valoarea adăugată.

### 2.4 Desktop table (`hidden md:block`)

Actuala structură (linia 192-298): 8 coloane (Nume, Handle, Tier, Manager, Niche, Followers, Scor, Status).

Noua structură: 10 coloane (Nume, Handle, **Platforme**, Tier, Manager, Niche, Followers, **ER**, Scor, Status).

Pe ecrane mai înguste (sub `lg`), ascundem coloana "Niche" (`hidden xl:table-cell`) ca să eliberăm spațiu. Pe `xl+` toate vizibile. Tier rămâne mereu vizibil.

Lățimi indicative (sunt auto, dar verificăm dacă tabela rupe layout-ul):
- Platforme: ~120px (4 iconuri × 24px + 3 gap-uri × 6px)
- ER: ~80px

### 2.5 Hover preview

Pe listă folosim **doar tooltip nativ** (`title=`). Hover preview elaborat cu buton "Open Profile" rămâne pe detail page (commit 3df6f7c). Justificare: per-row spațiul e prea mic, iar tooltip nativ acoperă nevoia de a vedea handle-ul fără click.

## 3. Schimbări fișiere

### 3.1 `app/influencers/platform-links.tsx` (nou)

Path-urile SVG pentru cele 4 iconuri sunt 16×16 viewBox, simplificate ca să arate recognizable la 14×14 rendered size (margine în wrapper 24×24). Pattern-ul exact:

- **Instagram**: rounded square outline + cerc central + dot top-right (camera lens). Aproximativ 4 path elements.
- **TikTok**: notă muzicală + skew shadow în culoare brand-amber light. 2 path elements.
- **YouTube**: rectangle rotunjit + triangle play interior. 2 path elements.
- **Facebook**: cerc + literă "f" inverted. 2 path elements.

Sursă vizuală: am folosit `simple-icons` brand glyphs (simplificate manual să rămână recognizable la 14px). Le inline-uim — fără dependency pe `simple-icons`/`lucide`.

```tsx
'use client'

import { PLATFORMS, PLATFORM_LABEL, type Platform, type SocialHandles } from '@/lib/influencers/types'
import { inferUrl, validateUrl } from '@/lib/influencers/social'

// 4 funcţii Icon — fiecare returnează un <svg> 16x16 cu path-uri simplificate
// pentru glyph-ul brandului. La execution time, copiem path-urile din
// simple-icons.org/?q=<platform> şi le simplificăm dacă e nevoie pentru claritate
// la 14px display size.
function InstagramIcon() { /* svg cu rounded square + cerc + dot */ }
function TiktokIcon()    { /* svg cu notă muzicală */ }
function YoutubeIcon()   { /* svg cu rectangle + triangle play */ }
function FacebookIcon()  { /* svg cu cerc + literă f */ }

const PLATFORM_ICONS: Record<Platform, () => JSX.Element> = {
  instagram: InstagramIcon, tiktok: TiktokIcon, youtube: YoutubeIcon, facebook: FacebookIcon,
}

export function PlatformLinks({ social_handles, name }: {
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
          <a key={p} href={url} target="_blank" rel="noopener noreferrer"
             title={label} aria-label={label}
             onClick={(e) => e.stopPropagation()}
             className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-500 hover:bg-brand-700/10 hover:text-brand-700 transition-colors">
            <Icon />
          </a>
        )
      })}
    </div>
  )
}
```

### 3.2 `lib/influencers/social.ts`

Adaugă (după `primaryHandle()`):

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

### 3.3 `app/influencers/influencers-ui.tsx`

Imports adăugate:
```ts
import { PlatformLinks } from './platform-links'
import { getPrimaryEngagement, ENGAGEMENT_LEVEL_COLORS, ENGAGEMENT_LEVEL_LABELS } from '@/lib/influencers/social'
```

Helper inline:
```tsx
function ErBadge({ social_handles }: { social_handles: SocialHandles | null | undefined }) {
  const er = getPrimaryEngagement(social_handles)
  if (!er) return null
  const title = `${ENGAGEMENT_LEVEL_LABELS[er.level]} · ${PLATFORM_LABEL[er.platform]} · ${er.rate.toFixed(1)}%`
  return (
    <span title={title}
          className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium ${ENGAGEMENT_LEVEL_COLORS[er.level]}`}>
      ER · {er.rate.toFixed(1)}%
    </span>
  )
}
```

Mobile cards: în secțiunea cu `@handle · Platform`, eliminăm sufix-ul `· Platform`. Sub `@handle`, adăugăm `<PlatformLinks social_handles={i.social_handles} name={i.name} />`. În zona de dreapta-jos, adăugăm `<ErBadge social_handles={i.social_handles} />` înainte de scor.

Desktop table:
- Header: după "Handle" → `<th>Platforme</th>`, după "Followers" → `<th>ER</th>`
- Niche cell + header: schimbă `<td>`/`<th>` să folosească clasa `hidden xl:table-cell`
- Row: după "Handle" cell → `<td><PlatformLinks ... /></td>`, după "Followers" cell → `<td><ErBadge ... /></td>`

## 4. Non-goals

- ❌ Hover preview complex pe listă (component overlay) — tooltip nativ e suficient
- ❌ Rate cards summary pe listă (Faza 2c dacă apare nevoie)
- ❌ Campanii anterioare în listă (există doar pe detail; idem Faza 2c)
- ❌ Sort/filter după ER (sort există pe followers; ER e signal secundar)
- ❌ ER per platformă în listă (doar primary; per-platformă rămâne pe detail page)
- ❌ Refactor general al `influencers-ui.tsx` (focus strict pe quick-win)

## 5. Risc & mitigare

| Risc | Mitigare |
|------|----------|
| Tabela 10 coloane prea îngustă pe md | Ascundem "Niche" la sub-xl (`hidden xl:table-cell`) |
| Iconul mic greu de tap pe mobile | Wrapper 24×24px = hit area suficient pentru Apple HIG (minim 44pt rec, dar 24 cu padding implicit OK) |
| URL invalid în social_handles | `validateUrl` returnează false → iconul nu apare |
| `engagement_rate` lipsă pe majoritate | ER badge pur și simplu nu apare → fără placeholder zgomotos |
| Iconurile SVG arată inconsistente pe Safari iOS | Test pe iPhone PWA; fallback la text uppercase dacă apare problemă |

## 6. Definition of done

- [ ] `app/influencers/platform-links.tsx` cu component + 4 iconuri SVG inline
- [ ] `lib/influencers/social.ts` cu helper `getPrimaryEngagement`
- [ ] Mobile cards: rând `<PlatformLinks>` + `<ErBadge>` lângă scor
- [ ] Desktop table: 2 coloane noi (Platforme + ER), Niche ascuns sub xl
- [ ] Tooltip nativ pe iconuri (`title=` + `aria-label`)
- [ ] `pnpm run typecheck` + `pnpm run lint` clean
- [ ] `pnpm run build` clean
- [ ] Smoke: 1 influencer cu IG+TT+YT populate + ER → afișează corect pe ambele view-uri
- [ ] Commit conventional + push + GHA deploy verificat

## 7. Out of scope (Faza 2c / next phases)

- **Faza 2c (opțional):** rate cards summary pe listă (rate min/max), count campanii anterioare
- **Faza 4 (deferred):** §5 audit cost/status/brand, Sprint 11 Reporting, Sprint 12 Missive
