# Design System — Influence Room

A workshop-editorial direction for an internal SaaS used daily by a 7-person
agency. Restrained, opinionated, *agency-adjacent* — not corporate, not
Vercel-clone. Two distinctive notes carry the personality:

1. **Fraunces** for display and headings — variable serif with optical sizing.
2. **Burnt amber** brand color (`#C2410C`) — energetic, distinctive, plays
   well with the warm stone neutrals already in use.

Body text stays on **Geist Sans** (already loaded via `next/font/google`) —
distinctive enough to escape the Inter/Roboto trap, neutral enough not to
fight the serif headlines.

---

## Aesthetic rationale

The skill explicitly warns against "generic AI aesthetics" — purple gradients,
Inter on white, evenly-distributed pastels. An internal SaaS for an
*influencer marketing agency* needs to feel like the people who use it: a bit
editorial, a bit creative-confident. Not a B2B SaaS template.

**Why amber over indigo?** Indigo at `#6366F1` is the most overused tech color
of the last five years — Stripe-knockoff territory. Burnt amber `#C2410C`
suggests print, ad agency, magazine. It contrasts beautifully against warm
stone backgrounds and reads as energetic without being aggressive.

**Why Fraunces?** Variable serif with optical sizing means headings at 36/40
get slightly different glyph proportions than 14/20 captions — typographic
craft rather than just "a font". Pairs naturally with a clean sans body. It
escapes the Inter/Geist/SpaceGrotesk SaaS template.

**What stays restrained:** spacing scale, motion (CSS-only, ease-out, 150ms
default), shadows (subtle, no neon glows), no gradient meshes or noise
textures. The goal is *agency-credible*, not maximalist editorial.

---

## Tokens

### Color

| Role | Token | Hex | Use |
|---|---|---|---|
| Brand 50 | `brand.50` | `#FFF7ED` | hover wash, backdrop tint |
| Brand 100 | `brand.100` | `#FFEDD5` | selected chip background |
| Brand 500 | `brand.500` | `#F97316` | accent strokes, focus ring |
| Brand 600 | `brand.600` | `#EA580C` | primary button |
| **Brand 700** | `brand.700` | `#C2410C` | **canonical brand, hover state, links** |
| Brand 800 | `brand.800` | `#9A3412` | active state, on-amber text |

Neutrals: Tailwind's `stone-*` palette (`50 → 950`) — already in use, kept.

Semantic:
| Role | 50 | 500 | 700 |
|---|---|---|---|
| success | `emerald-50` | `emerald-500` | `emerald-700` |
| warning | `amber-50` | `amber-500` | `amber-700` |
| error | `rose-50` | `rose-500` | `rose-700` |
| info | `sky-50` | `sky-500` | `sky-700` |

### Typography

- **Display** — Fraunces 600/700, optical-size 36+, slight negative tracking
  (`-0.02em`) on 4xl/3xl, italic available
- **Heading** — Fraunces 500/600, optical-size 24, used for card headers
- **Body** — Geist Sans 400/500, baseline `text-sm` (14px) and `text-base`
  (16px) for primary content
- **Mono** — Geist Mono 500 — code, IDs, IBANs, technical chips
- **Label** — Geist Sans 600 uppercase tracking-`[0.06em]` — small caps style
  for section labels and table headers

Sizes (Tailwind native): `xs 12 / sm 14 / base 16 / lg 18 / xl 20 / 2xl 24 /
3xl 30 / 4xl 36`.

### Spacing

Tailwind scale (4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px) —
already what the app uses. Codify as `space.1 → space.24` tokens for clarity.

### Radius

| Token | px | Use |
|---|---|---|
| `radius.sm` | 4 | chips, small buttons |
| `radius.md` | 8 | inputs, default buttons |
| `radius.lg` | 12 | small cards, modals |
| `radius.xl` | 16 | page-level cards |
| `radius.2xl` | 24 | hero cards (rare) |
| `radius.full` | 9999 | avatars, pills |

### Shadow

| Token | Use |
|---|---|
| `shadow.sm` | resting cards, list rows |
| `shadow.md` | hovered cards, dropdowns |
| `shadow.lg` | open modals |
| `shadow.xl` | toasts |

Avoid intense shadows — `shadow-sm` ≈ `0 1px 2px rgba(0,0,0,0.04)`.

### Motion

- `transition.fast` — 120ms ease-out (hover, color)
- `transition.base` — 200ms ease-out (modals enter, drawer slide)
- `transition.slow` — 320ms ease-out (page-level transitions, rare)

Easing always `cubic-bezier(0.16, 1, 0.3, 1)` for entry, `cubic-bezier(0.7, 0,
0.84, 0)` for exit. CSS-only, no Motion library — keeps the bundle thin.

### Layout

- Page max-width: `max-w-6xl` (1152px) for list pages, `max-w-3xl` for
  detail/forms
- Mobile-first: every component checks `sm` (640px) and `lg` (1024px) at
  minimum. No `xl` breakpoints unless visually necessary.
- Tap-target minimum **44×44 px** — buttons, icon buttons, table-row clicks.
- Safe-area insets applied on the root layout for iOS PWA standalone.

---

## Token implementation

See `lib/ui/tokens.ts` for the TypeScript constants. Tailwind classes that
reference these tokens use the literal hex values inside the components,
because Tailwind 4 reads from `@theme` in CSS. Tokens drive component
authoring; `@theme` in `globals.css` mirrors them for utility classes.

---

## Component library

See `lib/ui/`:

- `button.tsx` — variants: `primary | secondary | ghost | destructive |
  outline`, sizes `sm | md | lg`, loading state with spinner, icon support
- `input.tsx`, `textarea.tsx`, `select.tsx` — `<Field>` wrapper provides
  label, helper text, error state
- `checkbox.tsx`, `radio.tsx`, `switch.tsx` — accessible primitives
- `card.tsx` — `Card.Header / Card.Body / Card.Footer` composition
- `badge.tsx` — variants `default | brand | success | warning | error | info`
- `avatar.tsx` — `avatar_url` with initials fallback, sizes `sm | md | lg`
- `dialog.tsx` — modal with backdrop, focus trap, ESC-to-close
- `toast.tsx` — auto-dismiss notifications
- `skeleton.tsx` — pulsing placeholders for lists/cards
- `empty-state.tsx` — title + description + optional CTA
- `page-header.tsx` — consistent title / subtitle / action-bar across pages

Every primitive: forwards `ref`, accepts `className`, has tap targets ≥ 44px.
