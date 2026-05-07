# Influencer Room — Internal Operations App

Internal-only app for an influencer marketing & artist management agency
(Stefan's friend, agency name "Influencer Room").

## Read first
- **Single source of truth:** `docs/influencer-room-prd.md` (read top-to-bottom
  before making changes)
- **Tech stack:** Next.js 16 + TypeScript + Supabase (PIN auth + RLS) + Tailwind
  + shadcn/ui + Resend
- **Adapter:** `@opennextjs/cloudflare` (NOT `@cloudflare/next-on-pages` — deprecated)
- **Hosting:** Cloudflare Workers, deployed via **GitHub Actions**
  (`.github/workflows/deploy.yml`). NOT Workers Builds Git integration.
- **Repo:** github.com/officesoldoutmedia/influenceroom (private)
- **Live:** https://influenceroom.office-2e5.workers.dev

## Key conventions
- PIN auth: 4 digits, bcrypt (Postgres pgcrypto, cost 10), jose HS256 JWT
  in HttpOnly cookie `ir_session`, 30-day expiry, 5-attempt lockout
- Conventional commits (feat:, fix:, chore:, refactor:, docs:)
- `pnpm run typecheck` must pass before any commit
- Cron handlers gate to Europe/Bucharest local time in handler body
  (DST-safe), NOT in cron schedule

## Constraints
- Edge runtime is NOT supported by @opennextjs/cloudflare for API route
  handlers — use default Node runtime (no `export const runtime = 'edge'`)
- Worker size limit: 3 MiB Free / 10 MiB Paid (compressed) — keep deps lean
- Free plan: 5 cron triggers per account total. `[triggers]` block in
  `wrangler.toml` is currently disabled (Sprint 6 decision pending —
  upgrade to Paid \$5/mo or migrate to GitHub Actions cron).

## Lessons learned (gotchas — read before changing infra)

1. **Use `middleware.ts`, NOT `proxy.ts`.** Next 16 deprecates `middleware.ts`
   in favour of `proxy.ts`, but `@opennextjs/cloudflare` 1.19.7 only supports
   Edge-runtime middleware, while Next 16's proxy.ts is Node-only with no
   opt-in to Edge. Stay on `middleware.ts` and ignore the deprecation warning
   until OpenNext supports Node-runtime proxy.

2. **`wrangler deploy --keep-vars` is mandatory.** Without `--keep-vars`,
   wrangler wipes Worker Variables and Secrets on every deploy that doesn't
   declare them in `wrangler.toml`. We keep secrets in the dashboard / set via
   `wrangler secret put`, so the GHA workflow MUST pass `--keep-vars`.

3. **Deploy via GitHub Actions, NOT Workers Builds.** Cloudflare Workers
   Builds Git integration's OAuth flow was flaky on the `officesoldoutmedia`
   org — webhooks weren't auto-created, builds didn't trigger on push.
   `.github/workflows/deploy.yml` is the source of truth for production
   deploys. Keep Workers Builds disconnected.

4. **Worker secrets are runtime-only, not build-time.** `NEXT_PUBLIC_*` vars
   are conventionally inlined at build time. Currently all Supabase access is
   server-side, so we pass them at runtime via Worker secrets (see
   `wrangler secret put`). If we add browser-side Supabase usage, we must
   also pass `NEXT_PUBLIC_*` to the GHA build step env so they're inlined
   into the client bundle.

## Useful scripts
- `pnpm dev` — local Next.js dev (Node runtime)
- `pnpm preview` — local Workers runtime simulation via opennextjs-cloudflare
- `pnpm run build` — Next.js production build
- `pnpm run typecheck` — tsc --noEmit
- `pnpm run cf-typegen` — regenerate cloudflare-env.d.ts after wrangler.toml changes

## Sprint status
Sprint 1 Phase 2 complete. Auth flow live: `/login` user picker → 4-digit PIN
modal → JWT cookie → middleware enforces on all routes except `/login` and
`/api/auth/*`. PIN lockout (5 attempts → 5 min) verified end-to-end.
Next: Sprint 1 Phase 3 — `/admin/team` CRUD.

## Hand-off note
This app is intended for transfer to the agency owner ("Stefan's friend")
once stable. Keep the repo clean, well-commented, and self-contained —
no Sold Out Media or Stefan-specific code paths.
