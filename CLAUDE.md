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
on demand.

## Pending pre-public-launch (Stefan-controlled, not blocking beta)
- **Resend account + verified sender domain** — DONE. `notify@influenceroom.ro`
  is verified in Resend (region eu-west-1). Worker has `RESEND_API_KEY`,
  `EMAIL_SENDER`, `EMAIL_REPLY_TO` set as secrets.
- **Workers Paid plan + cron** — DONE. Plan upgraded; `[triggers]` restored in
  `wrangler.toml` with `crons = ["*/5 * * * *"]`. Worker entry is now
  `worker-entry.mjs` (wraps `.open-next/worker.js` and adds the scheduled
  handler — OpenNext only exports `fetch`). Account currently uses 6 of 30
  cron slots.

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
- Conventional commits (feat:, fix:, chore:, refactor:, docs:)
- `pnpm run typecheck` + `pnpm run lint` must pass before any commit
- Cron handlers gate to Europe/Bucharest local time in handler body
  (DST-safe), NOT in cron schedule
- **All monetary values are EUR.** Schema columns store as numeric without
  currency suffix (`influencers.rate_post/story/reel/video`,
  `campaigns.total_budget`, `campaign_influencers.agreed_fee`). Display
  format: `formatEur()` from `lib/influencers/format.ts` — `€` prefix,
  `ro-RO` locale grouping, no decimals.

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
