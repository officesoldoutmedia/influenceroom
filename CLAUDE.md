# Influence Room — Internal Operations App

Internal-only app for an influencer marketing & artist management agency
(Stefan's friend, agency name "Influence Room").

## Read first
- **Single source of truth:** `docs/influencer-room-prd.md` (read top-to-bottom
  before making changes)
- **End-user walkthrough (Romanian):** `docs/WALKTHROUGH.md`
- **Tech stack:** Next.js 16 + TypeScript + Supabase (PIN auth + RLS) + Tailwind
  + Resend
- **Adapter:** `@opennextjs/cloudflare` (NOT `@cloudflare/next-on-pages` — deprecated)
- **Hosting:** Cloudflare Workers, deployed via **GitHub Actions**
  (`.github/workflows/deploy.yml`). NOT Workers Builds Git integration.
- **Repo:** github.com/officesoldoutmedia/influenceroom (private)
- **Live:** https://influenceroom.office-2e5.workers.dev

## Sprint status
**All 7 sprints complete. Production-ready, in beta testing with Influence Room team.**

Sprint 1 — auth + team CRUD · Sprint 2 — brands + influencers · Sprint 3 —
campaigns + tasks + roster · Sprint 4 (folded into 3) — task board · Sprint 5
— email infrastructure + queue · Sprint 6 (cron deferred — see "Pending
pre-public-launch" below) · Sprint 7 — drag-and-drop, real owner seed,
walkthrough doc, lint cleanup. Sprint 8 Phase 1 — input contrast fix
(removed system dark-mode override that washed out form text), real team
seeded.

**Team seeded (7 active members, all `@influenceroom.ro` except Stefan):**
- Stefan Sprianu — owner (maintenance/support)
- Oana Trascu — owner (real agency owner)
- Ramona Romanov, Pufeh, Elisabeta Dragulschi, Ofelia Bordeianu, Antonia Lita
  — all `account` role

All 6 newly-seeded users have **initial PIN `0000`** and should change it on
first login (owner can reset via `/admin/team` → Reset PIN). Stefan and Oana
both have owner-level access; either can manage the team.

## Email delivery model
The notifications table is a queue: every email-producing action (task assigned,
status changed, deadline reminder, daily digest, campaign started, broadcast)
inserts a row with `status='queued'`. Actual SMTP delivery via Resend happens in
`lib/email/queue-worker.ts → processQueueBatch()`. Two paths invoke it, both
LIVE:

1. **Cron** — `*/5 * * * *` (Workers Paid). The cron fires `scheduled()` on the
   Worker; `worker-entry.mjs` wraps the OpenNext-built worker and adds a
   scheduled handler that calls `/api/cron/process-queue` internally with the
   `x-cron-secret` header. Drains FIFO up to 50 rows per tick.
2. **Auto-flush** — `/api/admin/broadcast` collects the IDs it just enqueued and
   calls `processQueueBatch({notification_ids})` inside `ctx.waitUntil(...)` from
   `getCloudflareContext()`. Response returns to the UI immediately; emails land
   ~200ms later. Only broadcasts get this — broadcasts must feel instant; the
   other 5 types are fine with the 5-min cron lag.

`/admin/notifications` → "Run worker now" still exists as a manual override
(prompts for CRON_SECRET) — useful if cron is paused or you want to flush
on demand. The same page also has "Run scheduler now" which fires the
deadline scheduler manually (see Deadline notification model below).

## Deadline notification model (Sprint 9 Faza 6)
Daily cron `0 5 * * *` (05:00 UTC = 08:00 Bucharest summer / 07:00 winter)
fires `/api/cron/deadline-scheduler`, which calls
`scheduleDeadlineNotifications()` in `lib/notifications/deadline-scheduler.ts`.

For each of the 4 reminder windows the scheduler scans the relevant table:
- **`7d`** — post_date / due_date is exactly today + 7 days
- **`3d`** — exactly today + 3 days
- **`1d`** — today **OR** today + 1 day. Subject reads "AZI" when the
  deadline is today (driven by an `isToday` flag in the templates) and "mâine"
  otherwise. The `reminder_kind` written to `deadline_reminder_log` stays
  `'1d'` for both days so a row that got the "tomorrow" warning yesterday
  is not pinged again as the "today" warning — idempotency carries across.
- **`overdue`** — strictly before today (and not yet completed/published/cancelled)

Recipients (Opțiunea A):
| Resource | Account manager (campaign.owner_id) | Influencer (participant.influencer.contact_email) |
|---|---|---|
| `campaign_deliverables` (post_date) | 7d / 3d / 1d / overdue | 3d / 1d / overdue (skipped if ad-hoc or email null) |
| `campaign_milestones` (due_date) | 7d / 3d / 1d / overdue | not notified (milestones are internal) |

**Idempotency** is enforced by the UNIQUE index on
`deadline_reminder_log(resource_type, resource_id, reminder_kind,
recipient_type, recipient_email)` — re-running the scheduler in the same
day is a no-op for already-sent reminders. Each successful send writes a
log row + enqueues a notification row + (for account managers with active
push subs) fans out a web-push best-effort.

The recipient's `team_members.notification_prefs.deadline_reminder` flag
gates email + push; missing prefs default to opt-in. (Influencers don't
have prefs because they aren't team members; they're notified whenever a
contact_email is on file.)

Email templates: `lib/email/templates/deadline-reminder-deliverable.ts`
and `deadline-reminder-milestone.ts` — Romanian, HTML-escape user input,
4 subject variants per kind. Renders inline (not via `renderEmail`)
because the scheduler is a backend pipeline that builds + inserts the
notification row directly.

## Scoring system (Sprint 10)
Hybrid auto + manual scoring on a 0..100 scale across 6 criteria, banded
into 4 categories (`low <=40`, `medium <=65`, `high <=85`, `top_performer`).
Migrations 030–034.

**Tables**
- `scoring_settings` (singleton, `id=1`) — six `weight_*` integers (0..100)
  + `updated_by/at`. Defaults `25/20/20/15/10/10`.
- `influencer_scores` (one row per influencer, `UNIQUE(influencer_id)`) —
  4 manual fields (`score_engagement_rate`, `score_cpv`,
  `score_audience_ro`, `score_deliverable_quality`), 2 auto fields
  (`score_punctuality`, `score_collaboration_history`) — all six are
  `numeric(5,2)` since migration 037 (Oana feedback 2026-05-08), which
  means PostgREST returns them as **strings** (e.g. `"87.50"`) so the
  client coerces via `coerceScore()` at read-time. `total_score` stays
  `integer` — `recalc_influencer_score` rounds the weighted average so
  badges and category banding use whole numbers; per-criterion scores
  retain decimals for finer manual control. Derived
  `total_score` + `category` + `explanation`, audit (`updated_by/at`,
  `last_calculated_at`).
- `influencer_score_history` — append-only audit. One row per
  `total_score` change with `change_reason ∈
  ('manual_update','auto_recalc','weights_changed')`.

**Functions** (migration 034)
- `calc_punctuality_score(influencer_id)` → percent of published
  deliverables with `published_at::date <= post_date`. NULL when the
  influencer has no published deliverables yet (so the weight is dropped
  from the average). `published_at` is stamped automatically by the
  trigger added in migration 030 on the `status -> 'published'` transition.
- `calc_collaboration_history_score(influencer_id)` →
  `0/20/40/60/80/100` from `COUNT(DISTINCT campaign_id)` where
  `campaigns.status = 'completed'` (capped at 5+). Always non-NULL — a
  zero-history influencer gets 0, weighted in fully.
- `recalc_influencer_score(influencer_id, changed_by, reason)` —
  re-derives the auto criteria, computes the weighted average over
  criteria with non-NULL scores **re-normalising by the sum of active
  weights** (so unrated manual criteria don't drag the total down),
  bands into category, UPSERTs the row, and inserts an
  `influencer_score_history` entry only when `total_score` actually
  changes (`IS DISTINCT FROM` guard preserves idempotency).

**Why re-normalisation, not "missing = 0":** an unrated criterion is
"unknown", not "bad". Counting it as 0 would make any new influencer
look low forever, even with strong auto signals. Re-normalising means
the score reflects the criteria we *do* know — and naturally rises as
manual ratings get filled in.

**API surface**
- `GET  /api/influencers/[id]/score` — score row + last 10 history.
- `PATCH /api/influencers/[id]/score` — UPSERT manual fields, then
  `recalc_influencer_score(reason='manual_update')`. Path A scoping.
- `POST /api/influencers/[id]/score/recalculate` — force a fresh
  recompute (used after publishing/completing). Path A scoping.
- `GET/PATCH /api/admin/scoring-settings` — owner-only. PATCH fans out
  `recalc_influencer_score` over every influencer with
  `reason='weights_changed'` and returns the count.

**UI**
- `/influencers/[id]` — score section with circle (total), category
  badge, 6 criterion cards (auto vs manual marker), explanation,
  history (last 10), recalculate + edit-manual buttons.
- `/influencers` — score column + `score_category` URL filter
  (`?score_category=high` etc.). Sortable column header is *deferred*
  for now — the category band already clusters meaningfully.
- `/admin/scoring-settings` — owner-only weight sliders, sum indicator,
  confirm-modal before saving (recalculates every influencer
  synchronously; the team is small enough for that to be a feature, not
  a flaw).

**Sprint 11 (Reporting) hook:** when post-campaign reporting lands, the
4 currently-manual criteria can be re-fed automatically (engagement_rate,
cpv, audience_ro from analytics dumps; deliverable_quality stays manual).
The `recalc_influencer_score` function won't need to change — only the
input source for those 4 columns.

## Pending pre-public-launch (Stefan-controlled, not blocking beta)
- **Resend account + verified sender domain** — DONE. `notify@influenceroom.ro`
  is verified in Resend (region eu-west-1). Worker has `RESEND_API_KEY`,
  `EMAIL_SENDER`, `EMAIL_REPLY_TO` set as secrets.
- **Workers Paid plan + cron** — DONE. Plan upgraded; `[triggers]` restored in
  `wrangler.toml` with `crons = ["*/5 * * * *"]`. Worker entry is now
  `worker-entry.mjs` (wraps `.open-next/worker.js` and adds the scheduled
  handler — OpenNext only exports `fetch`). Account currently uses 6 of 30
  cron slots.

## Rate cards model (Sprint 13a)
Per-platform tariffs replacing the old flat `rate_post/story/reel/video`
columns (which were ambiguous — "video" was sometimes a Reel, sometimes
Usage Rights). Migration 035 added `influencers.rate_cards jsonb NOT
NULL DEFAULT '{}'` with a GIN index, backfilled SPEAK's existing data
into `rate_cards.instagram` (`post→photo`, `story→story_set`,
`reel→video`, `video→ur_30d`), and dropped the four legacy columns.

**Shape:**
```jsonc
{
  "facebook":  { "photo": n, "video": n, "story_set": n, "ur_30d": n },
  "instagram": { "photo": n, "video": n, "story_set": n, "ur_30d": n },
  "tiktok":    { "video": n, "boost_7d": n, "boost_15d": n,
                 "boost_30d": n, "ur_30d": n },
  "youtube":   { "video_insert": n, "shorts": n, "dedicated": n,
                 "ur_30d": n }
}
```
All keys optional; `n` is EUR (numeric) or absent. UR-30 = Usage Rights
30 days (right to use the influencer's content in brand assets) and is
the only universal rate type across platforms.

**Validation** lives in `lib/rate-cards/types.ts → RATE_TYPES_PER_PLATFORM`
and `lib/influencers/validate.ts → validateRateCards`. The DB column
itself is permissive (no CHECK on keys) so adding new rate types doesn't
need a migration — just extend `RATE_TYPES_PER_PLATFORM` and the API
will accept them. Unknown platforms / rate types per platform / negative
values get typed errors (`invalid_rate_platform_X`,
`invalid_rate_type_X_Y`, `invalid_rate_value_X_Y`) so the form can
pinpoint the offender.

**UI:** the form has a collapsible card per platform (auto-expanded if
any rate is set). The detail page renders one table per non-empty
platform with rate→fee rows + subtotal, walking
`RATE_TYPES_PER_PLATFORM` so order is canonical (UR-30 always last).

## Rate card PDF generation (Sprint 13b)
On-demand branded PDF export from `rate_cards`. Migration 036 created the
`rate-cards` Supabase Storage bucket (private) plus three
`*_authenticated_*` RLS policies (defence-in-depth — server-side code uses
service_role and bypasses RLS, same Path A pattern as the rest of the
schema).

**Library:** `pdf-lib` (1.17.1, ~340 KB). Picked over `@react-pdf/renderer`
because it's pure JS, has zero native deps, and bundles cleanly into the
@opennextjs/cloudflare worker without fontkit-in-Workers fragility. Standard
14 PDF fonts (Times-Roman / Helvetica / Courier-Bold) ship inline so the
generator has no external asset fetch — keeps cold-start fast and the
Worker bundle lean.

**Design** (`lib/rate-cards/pdf-generator.ts`): A4 portrait, 56pt margins.
Cover page = "INFLUENCE ROOM" wordmark + "MEDIA KIT 2026" right-aligned +
brand-amber divider, centered influencer name (auto-shrinks if it overflows
content width: 48 → 42 → 36 → 30 → 24 → 22 pt), tier strap-line
(`TIER_LABELS_RANGE` uppercased in burnt amber), primary handle, then a
horizontal stats row (one cell per platform with > 0 followers, label in
sans + count in Courier-Bold 22pt). Rate pages = one block per non-empty
platform with `RATE_TYPES_PER_PLATFORM` order preserved (UR-30 always
last), subtotal in burnt amber. Closing page has the contact line + "© 2026
Influence Room" footer. Page-break logic estimates the next block's height
and starts a fresh page when it would clip the footer.

**API** `/api/influencers/[id]/rate-card-pdf`:
- `POST` → render PDF, upload to
  `rate-cards/<influencer_id>/<timestamp>-rate-card.pdf`, prune to the
  latest 5 versions for that influencer, return a 1h signed URL +
  `path` + `generatedAt`. Returns `422 no_rates_to_export` when
  `hasAnyRate(rate_cards)` is false. Path A: `requireInfluencerWriter`.
- `GET ?path=...` → re-mint a 1h signed URL for an existing path.
  Path A: `canReadInfluencer` + path-prefix guard (the requested
  `path` must start with `<influencer_id>/` — defends against signing
  someone else's PDF if the user has read access to influencer A but
  not B).

**UI:** `RateCardPdfButton` (`app/influencers/[id]/rate-card-pdf-button.tsx`)
sits in the Rate Cards section header. Idle / loading / success / error
states; opens the signed URL in a new tab on success. Disabled with a
tooltip ("Adaugă rate-uri înainte de a genera PDF") when `hasAnyRate` is
false, so the affordance is visible even when not actionable.

**Cleanup policy:** keep 5 most-recent versions per influencer, drop the
rest. Pruning runs in the POST flow after upload — failures are
non-blocking (the user already has their fresh signed URL). Supabase
Storage list is sorted by `name DESC` and timestamp-prefixed filenames
mean lexical order matches chronological order.

## Known limitations (deferred to Phase 2 / future sprints)
- **Custom domain not configured** — using default `*.workers.dev` URL.
- **No file uploads** (briefs/contracts/screenshots) — Supabase Storage with
  signed URLs is in PRD §11 backlog.
- **No public read-only campaign page** for clients (token-based shareable link).
- **No CSV bulk import** — Stefan adds influencers/brands manually via UI.
- **Image optimization disabled** — using `<img>` instead of `next/image`. To
  enable, configure remote patterns in `next.config.mjs` and switch UI components.
- **Drag-and-drop is same-container only** — task moves between groups via
  Edit modal → Group dropdown (the dropdown is in the existing edit form).
  Multi-container DnD adds ~300 lines for an edge case the dropdown solves.

## Key conventions
- PIN auth: 4 digits, bcrypt (Postgres pgcrypto, cost 10), jose HS256 JWT
  in HttpOnly cookie `ir_session`, 30-day expiry, 5-attempt lockout
- **Authorization is app-layer (Path A), not RLS.** Every server-side Supabase
  client uses `service_role` and bypasses RLS. We instead filter at the
  API/page layer via `lib/auth/scope.ts`:
    - `getCurrentUser()` — reads `x-user-id` / `x-user-role` middleware headers
    - `isOwnerOrManager(user)` — bypass check
    - `scopeCampaignsRead(query, user)` — appends `owner_id = user.id` for
      account/intern, no-op for owner/manager
    - `scopeInfluencersRead(query, user)` — appends `(account_manager_id =
      user.id OR account_manager_id IS NULL)`
    - `canReadCampaign` / `canReadInfluencer` — single-row predicates (use
      `notFound()` on miss, not 403, so account users can't enumerate ids)
    - `requireInfluencerWriter(id)` — write-side mirror; campaigns already
      have `requireCampaignWriter` in `lib/auth/campaign.ts`
  Why not real RLS: spec called for `auth.uid()`-based policies, but the app
  uses custom HS256 JWT (not Supabase Auth), so `auth.uid()` is null and
  service_role bypasses every policy. Real RLS would require minting a
  Supabase JWT per request and switching server clients to anon key —
  significant rewrite. Existing "authenticated read all" RLS policies stay
  as defense-in-depth + intent documentation.
- Conventional commits (feat:, fix:, chore:, refactor:, docs:)
- `pnpm run typecheck` + `pnpm run lint` must pass before any commit
- Cron handlers gate to Europe/Bucharest local time in handler body
  (DST-safe), NOT in cron schedule
- **All monetary values are EUR.** Schema columns store as numeric without
  currency suffix (`influencers.rate_post/story/reel/video`,
  `campaigns.total_budget`, `campaign_influencers.agreed_fee`). Display
  format: `formatEur()` from `lib/influencers/format.ts` — `€` prefix,
  `ro-RO` locale grouping, no decimals.
- **Influencer tier enum: `nano`, `micro`, `mid`, `macro`** (4 values, DB
  CHECK enforces). Display variants in `lib/influencers/tiers.ts`:
  `TIER_LABELS_SHORT` ("Middle"), `TIER_LABELS_RANGE` ("Middle · 100k–500k"
  — used on filter pills + form dropdown per Oana 2026-05-08 feedback),
  `TIER_LABELS_FULL` ("Middle (community size 100k–500k)"). Mega tier was
  consolidated into macro on 2026-05-08 (migration 019).
- **Tier auto-calc** (Sprint 9 Faza 3c, migration 026): tier is derived
  by trigger `trg_influencers_auto_tier` from `MAX(followers)` across the
  4 platforms in `social_handles`. Thresholds in `TIER_THRESHOLDS`
  (mirrored in DB function `calc_influencer_tier`): nano <25k, micro
  <100k, mid <500k, macro 500k+. The `tier_manual_override` flag on
  `influencers` bypasses the trigger so a human pick stays sticky — the
  form has a checkbox + dropdown for this. Existing rows from before the
  migration were marked `tier_manual_override=true` to preserve the
  values the team had set manually.
- **Social handles model** (Sprint 9 Faza 3c, migration 025; ER added
  2026-05-11 — no migration, JSONB is permissive): `influencers.social_handles
  jsonb` stores per-platform handle/url/followers/engagement_rate in shape
  `{instagram?, tiktok?, youtube?, facebook?: {handle, url, followers,
  engagement_rate?}}`. `engagement_rate` is the real ER as percent
  (0..100, two decimals); distinct from `influencer_scores.score_engagement_rate`
  which is the team's 0..100 quality rating — the two coexist on purpose so
  the rating layer doesn't lock the team into a single quantitative source.
  Agency-standard banding from `engagementLevelFromRate()` in
  `lib/influencers/social.ts`: `<1 → low`, `<3 → medium`, `<6 → good`,
  `<10 → very_good`, `≥10 → excellent`. The old `platforms` JSONB (which
  carried a numeric `engagement_rate` on a different shape) and the
  standalone `primary_handle` text column were dropped — handles are now
  structured per-platform with explicit URLs for safe `target=_blank`
  linking. Helpers in `lib/influencers/social.ts`: `inferUrl(platform,
  handle)`, `validateUrl(platform, url)` (HTTPS + domain match),
  `normalizeHandle` (strips `@`), `maxFollowers`, `primaryHandle` (first
  populated platform in canonical order), `engagementLevelFromRate`,
  `formatEngagementRate`.
- **No campaign templates.** Campaigns start with zero task_groups and zero
  tasks (migration 018 dropped `campaign_templates`, `campaigns.template_id`,
  and the materialising RPC). Each campaign owner adds groups + tasks
  manually after seeing what the brief actually needs. Starter packs may
  return after 10–20 real campaigns inform the pattern.
- **Campaign participants model** (Sprint 9 Faza 3a, migration 021): the
  old `campaign_influencers` junction (one row per campaign × influencer)
  was replaced by `campaign_participants` — one row per
  **campaign × influencer × platform**. Each row carries `platform`
  (`social_platform` ENUM: instagram/tiktok/youtube/facebook),
  `account_handle`, `is_adhoc` (true when `influencer_id` is NULL — used
  for partners that don't have an influencer profile, like the brand
  itself co-posting), `agreed_fee` (EUR), `status` (`participant_status`
  ENUM, same 7 values as the old junction), `publish_date`, `post_url`.
  CHECK enforces `(influencer_id IS NULL) = is_adhoc`. UI surface is
  unified on `/campaigns/[id]` — the separate `/campaigns/[id]/influencers`
  route was removed; types `CampaignInfluencer*` / `JunctionStatus` were
  replaced by `CampaignParticipant*` / `ParticipantStatus`.
- **Brand inline create**: `/campaigns/new` uses a `<Combobox>` from
  `lib/ui/combobox.tsx` with type-ahead + a "+ Crează brand nou" footer
  that POSTs to `/api/brands` and selects the new brand inline — no need
  to leave the campaign form to register an unfamiliar brand.
- **Campaign deliverables and milestones model** (Sprint 9 Faza 3b,
  migrations 023 + 024):
  - `campaign_deliverables` — one row per concrete piece of content owed
    by a participant (cascade-deletes when the participant goes). Carries
    `type` (`deliverable_type` ENUM: story/reel/tiktok/carousel/post/
    youtube_long/youtube_short/live/custom), `quantity` (≥1),
    `custom_type_label` (required when type=custom), `post_date`,
    `collab_handles[]`, `hashtags[]`, `brief`, `caption`, `notes`,
    `status` (`deliverable_status` ENUM: draft/sent_to_influencer/
    content_in_review/approved/published/cancelled), `published_url`,
    `position`. CHECK enforces `published` requires both
    `published_url` AND `post_date`.
  - `campaign_milestones` — campaign-level checkpoints (cascade-deletes
    with the campaign). Carries `type` (`milestone_type` ENUM:
    brief_sent/materials_approved/content_draft_submitted/
    final_content_approved/links_submitted/report_delivered/
    payment_processed/other), `name` (required when type=other),
    `due_date`, `responsible` (`milestone_responsible` ENUM:
    account_manager/influencer/brand/other), `responsible_name`
    (required when responsible=other), `completed_at` + `completed_by`
    (auto-stamped from JWT when the API toggles completion), `notes`,
    `position`.
  - `/campaigns/[id]` is now organised into 5 tabs via the new
    `<Tabs>` primitive in `lib/ui/tabs.tsx`: **Detalii** (brief +
    internal notes + financial summary), **Participanți** (Faza 3a UI),
    **Livrabile**, **Etape**, **Tasks** (existing dnd board). Tab list
    is sticky under the nav and horizontally-scrollable on mobile via
    snap-x.

## Constraints
- Edge runtime is NOT supported by @opennextjs/cloudflare for API route
  handlers — use default Node runtime (no `export const runtime = 'edge'`)
- Worker size limit: 3 MiB Free / 10 MiB Paid (compressed) — keep deps lean
- Free plan: 5 cron triggers per account total (see Pending pre-public-launch)

## Lessons learned (gotchas — read before changing infra)

1. **Use `middleware.ts`, NOT `proxy.ts`.** Next 16 deprecates `middleware.ts`
   in favour of `proxy.ts`, but `@opennextjs/cloudflare` 1.19.7 only supports
   Edge-runtime middleware, while Next 16's proxy.ts is Node-only with no
   opt-in to Edge. Stay on `middleware.ts` and ignore the deprecation warning
   until OpenNext supports Node-runtime proxy.

2. **`wrangler deploy --keep-vars` is mandatory.** Without `--keep-vars`,
   wrangler wipes Worker Variables and Secrets on every deploy that doesn't
   declare them in `wrangler.toml`. We keep secrets via `wrangler secret put`,
   so the GHA workflow MUST pass `--keep-vars`.

3. **Deploy via GitHub Actions, NOT Workers Builds.** Cloudflare Workers
   Builds Git integration's OAuth flow was flaky on the `officesoldoutmedia`
   org — webhooks weren't auto-created, builds didn't trigger on push.
   `.github/workflows/deploy.yml` is the source of truth for production
   deploys. Keep Workers Builds disconnected.

4. **Worker secrets are runtime-only, not build-time.** `NEXT_PUBLIC_*` vars
   are conventionally inlined at build time. Currently all Supabase access is
   server-side, so we pass them at runtime via Worker secrets.

5. **PostgREST JSONB numeric filter syntax is `->key::int`, not `->>key::numeric`.**
   The text-arrow (`->>`) returns text and the cast to numeric silently fails
   to filter — returns 0 rows without error. Use single-arrow (`->`) to keep
   JSONB type, then cast. See `lib/influencers/search.ts`.

6. **`/api/cron/*` excluded from middleware matcher.** Cron endpoints
   authenticate via `x-cron-secret` header, not session cookie. Adding new
   cron endpoints requires no middleware change since the matcher already
   excludes the prefix.

## Useful scripts
- `pnpm dev` — local Next.js dev (Node runtime)
- `pnpm preview` — local Workers runtime simulation via opennextjs-cloudflare
- `pnpm run build` — Next.js production build
- `pnpm run typecheck` — tsc --noEmit
- `pnpm run lint` — ESLint
- `pnpm run cf-typegen` — regenerate cloudflare-env.d.ts after wrangler.toml changes
- `npx tsx scripts/smoke-email.ts` — render all 5 templates with mock data

## Hand-off note
This app is intended for transfer to the agency owner ("Stefan's friend")
once stable. Keep the repo clean, well-commented, and self-contained —
no Sold Out Media or Stefan-specific code paths.
