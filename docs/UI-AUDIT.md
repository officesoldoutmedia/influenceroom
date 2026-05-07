# UI Audit — Sprint 9 Phase 0

Code-driven audit (no live screenshots provided). Severity:
- **P0** — broken / embarrassing for beta
- **P1** — looks unprofessional, hurts trust
- **P2** — polish, nice-to-have

---

## Cross-cutting issues (apply to every page)

- **P0** `app/globals.css:19` — `body { font-family: Arial, Helvetica, sans-serif }` overrides the Geist font that's loaded via `next/font`. The whole app falls back to Arial. **This single line explains most of the "arată groaznic" perception.**
- **P0** `app/_components/nav.tsx` — top nav has 6–10 inline links, **zero responsive treatment**. At 375px viewport, links overflow horizontally without wrapping or hamburger menu. Confirmed by grep: only 3 `sm:`/`md:` Tailwind breakpoints across the entire `app/` folder.
- **P0** `<table>` elements (`app/influencers/influencers-ui.tsx`, `app/admin/team/team-ui.tsx`, `app/brands/brands-ui.tsx`, `app/admin/notifications/notifications-ui.tsx`, `app/admin/broadcast/broadcast-ui.tsx`) — fixed-column tables, no overflow handling, no card fallback below `sm`. Will cause horizontal page scroll on mobile.
- **P0** No `safe-area-inset` anywhere — iOS PWA in standalone mode will clip content under the notch and home-indicator bar.
- **P1** `btnPrimary` / `btnSecondary` / `inputCls` redeclared in **10 separate files** with slight drift (some have focus rings, some don't; some use `disabled:opacity-60`, some don't). No single source of truth.
- **P1** No loading skeletons anywhere (0 grep hits). Server components render fully or not at all — feels janky on slow connections.
- **P1** No empty-state component — empty lists show bare `<p>` text in a card. Inconsistent across pages (`Niciun influencer găsit`, `No campaigns yet`, `Niciun broadcast încă`).
- **P1** Mixed Romanian/English everywhere. Column headers English (`Name`, `Tier`, `Manager`), buttons mostly Romanian (`Salvează`, `Anulează`), pagination English (`Prev`/`Next`/`of`), errors mostly Romanian. Choose one — Romanian — and translate the rest.
- **P1** Hardcoded indigo `#6366F1` / `bg-indigo-*` everywhere — no token layer. Theme color change requires sweeping refactor.
- **P2** Modal overlays (`role="dialog"`) have no enter/exit animation, no focus trap, no `Escape`-to-close beyond what we manually wired. Accessibility gaps.
- **P2** `<img>` tags with `// eslint-disable-next-line @next/next/no-img-element` everywhere; image optimization disabled (per CLAUDE.md). OK for beta.

---

## /login

- **P1** `LoginUI` (`app/login/login-ui.tsx:17`) hardcoded role badge color: `owner: 'bg-indigo-100'`, `manager: 'bg-blue-100'` etc. Won't track theme color change.
- **P1** Role labels rendered raw lowercase (`owner`, `manager`, `account`, `intern`) — no localization, no capitalization.
- **P1** PIN modal (`pin-modal.tsx`) — no auto-focus on first PIN digit input on open; user has to tap.
- **P2** Avatar fallback uses `bg-indigo-50 text-indigo-700` — same pattern repeated across 8+ files (`influencers-ui`, `detail-ui`, `profile-form`, `nav`, etc.). Should be one `<Avatar>` component.
- **P2** Page has no header/branding above the grid — just "Influencer Room" + "Selectează contul" centered. No logo/logomark.

## / (dashboard)

- **P0** `app/page.tsx:35` — placeholder text "**Sprint 2 in progress.**" still rendered to users. After 8 sprints. Beta-blocker.
- **P0** Dashboard has zero actual content beyond the welcome message. No widgets, no quick stats, no recent activity feed, no quick links to recent campaigns. The most-frequent landing page is essentially empty.
- **P1** `Welcome, {user.name}` — string interpolation un-escaped (small XSS surface if name contains `<`; React escapes by default but worth flagging).

## /tasks

- **P1** `app/tasks/tasks-ui.tsx:159` lines, no breakpoint variants — task cards stack OK on mobile but filter bar at top crowds.
- **P1** Status badges hardcoded (`bg-stone-200 text-stone-700` etc.) — should be a `<Badge>` component with a status-mapped variant.
- **P1** No empty state when user has zero assigned tasks. Just blank space.

## /campaigns (list)

- **P1** Cards/table mix unclear — uses table but with avatar column. Won't collapse cleanly to mobile.
- **P1** Status filter chips and add-button on same row — will wrap awkwardly below 640px.
- **P1** Stage badges (`Planning`, `Active`, etc.) — color tokens not aligned with status semantic palette.

## /campaigns/[id] (detail + board)

- **P0** `board-ui.tsx` — 810 lines, drag-and-drop board. No mobile breakpoint at all. At 375px the multi-column board will horizontal-scroll painfully and dnd-kit pointer sensor will fight with native scroll.
- **P1** Modal forms inline in this same file (edit task, edit group, add task) — three different modal shapes, slight UX drift between them.
- **P1** Task cards show 6+ fields stacked (title, assignee, status, priority, due date, comments-count) — too dense. No visual hierarchy showing which is primary (title).
- **P1** Drag handle UX is the whole card → conflicts with click-to-edit. Common dnd-kit footgun.
- **P2** No collapsed-group preview — when a group is collapsed, you only see name + count, no summary.

## /campaigns/[id]/influencers (roster)

- **P1** Same patterns as /campaigns list — table-heavy, no mobile collapse.
- **P1** Add-influencer search/picker modal: dropdown, no keyboard navigation, no debounced search.

## /campaigns/new

- **P1** Form is a single column of inputs, no progressive disclosure for optional fields. Long forms feel tedious especially on mobile.

## /influencers (list)

- **P0** Table with 7 columns at 375px → guaranteed horizontal scroll catastrophe. Must collapse to cards.
- **P1** FilterBar (`app/influencers/influencers-ui.tsx:247`) — search + 6 filter dropdowns/checkbox-rows on a `flex gap-3`. On mobile this is a wall of stacked controls without an "Show filters" toggle.
- **P1** Niche tag chips truncate at 3 + "+N" — fine on desktop, too cramped on mobile cell where text already wraps.
- **P1** Status text (`active`, `blacklist`, `archived`) in raw lowercase. Status badges inconsistent across list/detail.
- **P2** Pagination strings English (`Prev`/`Next`).

## /influencers/[id] (detail)

- **P1** 222-line page component renders inline cards with hardcoded indigo avatar fallback. Break into `<Card>` + reuse `<Avatar>`.
- **P1** Section labels (`Platforms`, `Rates (RON)`, `Contact`, `Fiscal`) — `text-sm uppercase tracking-wide` repeated each section. Should be a single `<SectionHeading>` token.
- **P1** "Rates (RON)" — currency hardcoded in label; Sprint 9 plan calls for RON→EUR migration. Must come from a constant.
- **P1** Edit modal (`detail-ui.tsx:64`) — same modal pattern duplicated from list page; differs in shadow / padding.

## /influencers/new

- Form imported from `influencer-form.tsx` (384 lines) — same shape as edit modal but as full page. Fine, just inherits the form-styling drift from cross-cutting issues.

## /brands (list)

- **P1** Same table-on-mobile P0; same modal pattern; same color drift.
- **P1** "Brand" cards have no logo column despite Brands being a logo-heavy entity. Hardcoded letter avatar like influencers — visually identical, semantically not.

## /brands/[id] (detail)

- N/A — no separate page detected. List-only entity? (verify if intended.)

## /profile

- **P1** `profile-form.tsx` — 588 lines, 4 stacked cards (Header / Detalii / Schimbă PIN / Notificări / Push). Header card avatar reuses inline indigo fallback.
- **P1** PIN inputs stack vertically with full-width — could be 4 small digit inputs side-by-side for nicer entry UX, like an OTP field.
- **P1** Toggle component custom-rolled inline. Should be `<Switch>` primitive.
- **P2** "Notificări push" card UI flickers between "..." (loading) and active state — could use a stable initial render without the flash.

## /admin/team

- **P1** Table with 5 columns, modal for add/edit. Same patterns.
- **P1** "Reset PIN" button is destructive but styled like primary. Should be `<Button variant="destructive">`.
- **P2** Active/inactive toggle: same custom-rolled toggle problem.

## /admin/templates (list)

- **P1** Cards with task-group nested lists. No empty state for "no templates yet" beyond bare text.
- **P1** Drag-reorder inside templates uses dnd-kit — same multi-column-on-mobile concern.

## /admin/templates/new + /admin/templates/[id]/edit

- **P1** Long form with nested groups + tasks. Mobile UX especially painful — no breakpoint adjustments.

## /admin/notifications

- **P1** History table dense. Resend button inline, "Run worker now" button prompts via `prompt()` — accessibility and UX both poor (`prompt()` styling can't be customized).
- **P1** Status badges (queued/sent/failed) hardcoded color classes; semantic tokens needed.
- **P2** Detail modal opens on row click but no visual indicator (cursor:pointer is set but no hover affordance).

## /admin/broadcast

- **P1** Compose card OK on desktop; recipient picker collapses awkwardly on mobile (specific-users list inside a `max-h-40 overflow-y-auto` — fine, but the surrounding form is dense).
- **P1** History table same dense-pattern.
- **P1** Recipient count + methods badges in summary row use icons only via `+` separator — could use semantic icons (📧 / 🔔). Skipping icons stays restrained, but the visual hierarchy of "Va fi trimis către X persoane" needs more emphasis.

---

## Priority sequence for the polish pass

Given scope and the explicit "stop at 50% if needed" rule, I'm targeting (in order):

1. Kill `body { font-family: Arial }` in globals.css — single biggest perceived-quality fix
2. Token layer + `<Button>`/`<Input>`/`<Card>`/`<Badge>`/`<PageHeader>`/`<EmptyState>`/`<Avatar>`/`<Skeleton>` primitives
3. Fix dashboard placeholder + nav mobile responsiveness + safe-area on root layout
4. Refactor 5 high-traffic pages: /login, /, /tasks, /campaigns, /influencers (list)
5. PWA manifest theme color + heading-font swap to Fraunces
6. Stretch: campaign detail board mobile (this is the biggest job — defer if time runs out)
