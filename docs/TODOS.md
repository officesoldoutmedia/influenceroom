# TODOs (post-Sprint 7)

Tracked here so future contributors don't have to grep the codebase. None of these
block beta testing — they're improvements and Phase 2 scope.

## Pre-public-launch (infra, Stefan-controlled)

- [ ] Buy/configure custom domain (e.g. `app.influenceroom.ro`) and set Worker
      route in `wrangler.toml`.
- [ ] Create Resend account, add + verify sender domain (e.g. `notify@influenceroom.ro`).
      Then `wrangler secret put RESEND_API_KEY`, `EMAIL_SENDER`, `EMAIL_REPLY_TO`.
      Notification queue stops simulating and actually sends.
- [ ] Upgrade Cloudflare account to Workers Paid ($5/mo) for cron triggers
      (Free plan account already has 5 triggers used by other workers). Then
      restore `[triggers]` block in `wrangler.toml` (current placeholder
      comment shows the original config) and push.

## Sprint 7 deferred (UX polish)

- [ ] **Cross-group drag-and-drop for tasks.** Currently same-container only.
      Multi-container pattern in dnd-kit takes ~300 lines for an edge case the
      Edit modal Group dropdown already solves. Worth doing if users complain.
- [ ] **Reorder groups via drag** on the templates UI (currently read-only).

## Phase 2 backlog (PRD §11)

- [ ] **File uploads** for briefs/contracts/screenshots → Supabase Storage with
      signed URLs. Update brand + influencer + campaign forms with file picker.
      Add `attachments` jsonb column tracking storage paths.
- [ ] **Public read-only campaign page** for clients (token-based shareable
      link). New table `campaign_share_tokens` with expiry + scope.
- [ ] **Calendar view** for all campaign deadlines (FullCalendar or custom).
- [ ] **WhatsApp / Slack notifications** in addition to email. Add channel
      selector to `notification_rules.config`.
- [ ] **Influencer self-service portal** (separate auth, very limited scope:
      view their own deliverables + upload content).
- [ ] **CSV bulk import** wizard with field-mapping UI for influencers + brands.
- [ ] **Email-to-task ingestion** — forward an email → creates a task. Needs
      inbound email parsing (Resend supports this in newer versions).
- [ ] **Postgres full-text search** across influencers + brands + campaigns +
      tasks. Add tsvector columns + GIN indexes.

## Quality / refactor

- [ ] **Edit/duplicate templates** — `/admin/templates` is currently read-only.
      Buttons exist but disabled with "Sprint 7" labels (now stale — update
      to "Phase 2" or wire them up).
- [ ] **Realtime subscriptions** on tasks table for live status changes on the
      campaign board (per PRD §10). Currently relies on `router.refresh()`
      after mutations. Use Supabase Realtime for true collaborative feel.
- [ ] **Image optimization.** Switch `<img>` to `next/image` and configure
      remote patterns for Supabase Storage URLs (after file uploads land).
- [ ] **Smoke test promoted to real test harness** (Vitest or Playwright).
      `scripts/smoke-email.ts` works as a quick check; not enough for CI.
- [ ] **Reports page** (PRD §6 `/reports`) — team workload, influencer YTD
      stats, brand revenue summary. Originally Sprint 6 scope.
- [ ] **Daily-reminders cron handler** (`/api/cron/daily-reminders`) — endpoint
      exists conceptually but not implemented. Should iterate active members,
      build digest of their overdue/today/week tasks, enqueue daily-digest
      notification. Wired once cron is enabled (see pre-public-launch).
- [ ] **Deadline reminder cron** — query tasks due in exactly 1 or 3 days where
      status ∉ {done, cancelled}, enqueue deadline_reminder per task assignee.
      Same prereq as daily-reminders.

## Documentation stragglers

- [ ] Optional: add screenshots to `docs/WALKTHROUGH.md` (currently text-only).
- [ ] Document `requireOwner` / `requireWriter` / `requireCampaignWriter`
      helper tree in `docs/AUTH.md` for future contributors.
