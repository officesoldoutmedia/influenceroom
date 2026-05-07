# Influencer Room — Internal Operations App

Internal-only app for an influencer marketing & artist management agency
(Stefan's friend, agency name "Influencer Room").

## Read first
- **Single source of truth:** `docs/influencer-room-prd.md` (read top-to-bottom
  before making changes)
- **Tech stack:** Next.js 16 + TypeScript + Supabase (PIN auth + RLS) + Tailwind
  + shadcn/ui + Resend
- **Adapter:** `@opennextjs/cloudflare` (NOT `@cloudflare/next-on-pages` — deprecated)
- **Hosting:** Cloudflare Workers via Workers Builds Git integration
  (auto-deploy on push to main)
- **Repo:** github.com/officesoldoutmedia/influenceroom (private)

## Key conventions
- PIN auth: 4 digits, bcryptjs cost 10, jose HS256 JWT in HttpOnly cookie,
  30-day expiry, 5-attempt lockout
- Conventional commits (feat:, fix:, chore:, refactor:, docs:)
- `pnpm run typecheck` must pass before any commit
- `pnpm run preview` to test Workers runtime locally before push
- Cron handlers gate to Europe/Bucharest local time in handler body
  (DST-safe), NOT in cron schedule

## Constraints
- Edge runtime is NOT supported by @opennextjs/cloudflare — use default Node runtime
- Worker size limit: 3 MiB Free / 10 MiB Paid (compressed) — keep deps lean
- All API routes use default runtime (no `export const runtime = 'edge'`)

## Useful scripts
- `pnpm dev` — local Next.js dev (Node runtime)
- `pnpm preview` — local Workers runtime simulation via opennextjs-cloudflare
- `pnpm run build` — Next.js production build
- `pnpm run typecheck` — tsc --noEmit
- `pnpm run cf-typegen` — regenerate cloudflare-env.d.ts after wrangler.toml changes

## Sprint status
Currently at Sprint 0 (scaffold complete). Next: Sprint 1 (auth + team_members).

## Hand-off note
This app is intended for transfer to the agency owner ("Stefan's friend")
once stable. Keep the repo clean, well-commented, and self-contained —
no Sold Out Media or Stefan-specific code paths.
