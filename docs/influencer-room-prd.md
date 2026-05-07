# Influencer Room — Internal Operations App

> Internal tool for an influencer marketing & artist management agency.
> Pattern modelled on Sold Out Media's Production Hub (Next.js + Supabase + PIN auth).

---

## 1. Overview

**Agency:** Influencer Room
**Type:** Internal-only (not customer-facing)
**Users:** ~3–10 team members (owner, managers, account managers, interns)
**Hosting:** Cloudflare Pages (default `*.pages.dev` URL — no custom domain in v1)

### Goals
1. Central database of influencers (CRM-style, with platforms/rates/contacts)
2. Brand/client tracking
3. Campaign lifecycle management with reusable templates
4. Task assignment, status tracking, deadlines
5. Email notifications + reminders (daily digest + T-3 / T-1 deadline alerts)
6. Reporting per campaign / team member / influencer

---

## 2. Tech Stack

| Layer       | Choice                                                         |
| ----------- | -------------------------------------------------------------- |
| Frontend    | Next.js 16 App Router + TypeScript                             |
| UI          | Tailwind CSS + shadcn/ui + lucide-react                        |
| Database    | Supabase (Postgres + RLS + Realtime)                           |
| Auth        | Custom PIN-based (same pattern as Production Hub) + signed JWT |
| Email       | Resend                                                         |
| Cron        | Cloudflare Cron Triggers (or Vercel Cron if Pages doesn't fit) |
| Hosting     | Cloudflare Pages                                               |
| Storage     | Supabase Storage (avatars, brand logos, briefs Phase 2)        |
| Linting     | ESLint + Prettier + TypeScript strict                          |

### Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_SENDER=notify@<TBD>
EMAIL_REPLY_TO=<TBD>
JWT_SECRET=
CRON_SECRET=
APP_URL=https://influencer-room.pages.dev
```

---

## 3. Authentication

PIN-based, identical to Production Hub:

1. `/login` shows list of active team members (avatar + name).
2. User clicks their card → modal asks for 4-digit PIN.
3. Server-side: `verify_pin(user_id, pin)` Supabase RPC compares against `pin_hash` (bcrypt, cost 10).
4. On success → signed JWT in HTTP-only cookie (`SameSite=Strict`, 30-day expiry).
5. Middleware validates cookie + maps to `team_members.id` via JWT claim.
6. **No email/password reset flow** — owner resets PIN from `/admin`.

PIN is 4 digits, stored as bcrypt hash. Lockout: 5 wrong attempts = 5-min cooldown per user_id.

---

## 4. Database Schema

```sql
-- ============================================================
-- TEAM
-- ============================================================
create table team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  pin_hash text not null,
  role text not null check (role in ('owner','manager','account','intern')),
  avatar_url text,
  active boolean default true,
  failed_pin_attempts int default 0,
  locked_until timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- BRANDS (clients)
-- ============================================================
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  contact_email text,
  contact_phone text,
  billing_data jsonb,         -- {entity, cui, reg, address, iban}
  logo_url text,
  notes text,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  created_by uuid references team_members(id)
);

-- ============================================================
-- INFLUENCERS
-- ============================================================
create table influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_handle text,
  -- platforms: { instagram: {handle, followers, engagement_rate}, tiktok: {...}, youtube: {...}, twitch: {...} }
  platforms jsonb default '{}'::jsonb,
  niche_tags text[] default '{}',     -- ['fashion','beauty','fitness','tech','gaming','food','travel']
  tier text check (tier in ('nano','micro','mid','macro','mega')),
  language text default 'ro',
  location_city text,
  location_country text default 'Romania',
  rate_post numeric,
  rate_story numeric,
  rate_reel numeric,
  rate_video numeric,
  contact_email text,
  contact_phone text,
  agent_name text,
  agent_email text,
  fiscal_data jsonb,                  -- {entity_type, cui, address, iban}
  exclusive boolean default false,
  status text default 'active' check (status in ('active','inactive','blacklist')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on influencers using gin (niche_tags);
create index on influencers using gin (platforms);
create index on influencers (tier);
create index on influencers (status) where status = 'active';

-- ============================================================
-- CAMPAIGN TEMPLATES
-- ============================================================
create table campaign_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- default_task_groups: [
  --   { name, position, due_offset_days,
  --     tasks: [{ title, role_default, priority, description }] }
  -- ]
  default_task_groups jsonb not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  template_id uuid references campaign_templates(id) on delete set null,
  name text not null,
  brief text,
  status text default 'draft' check (status in ('draft','active','in_review','completed','cancelled')),
  start_date date,
  end_date date,
  total_budget numeric,
  deliverables_count int,
  internal_notes text,
  owner_id uuid references team_members(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on campaigns (status) where status in ('active','in_review');
create index on campaigns (brand_id);
create index on campaigns (owner_id);

-- ============================================================
-- CAMPAIGN × INFLUENCER (junction)
-- ============================================================
create table campaign_influencers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  influencer_id uuid references influencers(id) on delete restrict,
  agreed_fee numeric,
  deliverables text,
  status text default 'pitched' check (status in (
    'pitched','negotiating','confirmed','content_in_review','published','paid','cancelled'
  )),
  publish_date date,
  post_url text,
  performance jsonb default '{}'::jsonb,  -- {views, likes, saves, reach, comments, shares}
  notes text,
  created_at timestamptz default now(),
  unique(campaign_id, influencer_id)
);

create index on campaign_influencers (campaign_id);
create index on campaign_influencers (influencer_id);
create index on campaign_influencers (status);

-- ============================================================
-- TASK GROUPS (per campaign, generated from template)
-- ============================================================
create table task_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  position int not null,
  due_date date,
  created_at timestamptz default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  group_id uuid references task_groups(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references team_members(id),
  status text default 'todo' check (status in ('todo','in_progress','blocked','review','done')),
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid references team_members(id)
);

create index on tasks (assignee_id, status);
create index on tasks (campaign_id, group_id);
create index on tasks (due_date) where status not in ('done','blocked');

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,  -- task_assigned | task_status_changed | deadline_reminder | daily_digest | campaign_started
  recipient_id uuid references team_members(id),
  recipient_email text not null,
  subject text not null,
  body_html text,
  body_text text,
  related_task_id uuid references tasks(id) on delete set null,
  related_campaign_id uuid references campaigns(id) on delete set null,
  status text default 'queued' check (status in ('queued','sent','failed')),
  resend_message_id text,
  sent_at timestamptz,
  error text,
  retry_count int default 0,
  created_at timestamptz default now()
);

create index on notifications (status, created_at) where status = 'queued';

-- ============================================================
-- NOTIFICATION RULES (configurable toggles)
-- ============================================================
create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  event text not null unique,
  enabled boolean default true,
  config jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Seed defaults:
insert into notification_rules (event, enabled, config) values
  ('task_assigned', true, '{}'),
  ('task_status_changed', true, '{"only_for_roles": ["owner","manager"]}'),
  ('deadline_reminder', true, '{"days_before": [3, 1]}'),
  ('daily_digest', true, '{"send_at_hour_local": 9, "tz": "Europe/Bucharest"}'),
  ('campaign_started', true, '{}');
```

---

## 5. RLS Policies

Enable RLS on all tables. Policies driven by `auth.jwt() ->> 'user_id'` mapping to `team_members.id`.

| Role      | team_members | brands | influencers | campaigns | tasks                                   | notifications |
| --------- | ------------ | ------ | ----------- | --------- | --------------------------------------- | ------------- |
| `owner`   | RW           | RW     | RW          | RW        | RW                                      | RW (own + all)|
| `manager` | R            | RW     | RW          | RW        | RW                                      | R own         |
| `account` | R (active)   | R      | RW          | RW (owned)| RW (assigned/created); R rest           | R own         |
| `intern`  | R (active)   | R      | R           | R (assigned campaigns) | RW own assigned tasks      | R own         |

Service role key (`SUPABASE_SERVICE_ROLE_KEY`) used only by API server-side — bypasses RLS for cron jobs and admin operations.

---

## 6. Routes

### Public
- `GET /login` — user picker + PIN entry

### Authenticated
| Route                              | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `/`                                | Dashboard (active campaigns, my tasks, KPIs)  |
| `/influencers`                     | List + search + filters                       |
| `/influencers/new`                 | Create form                                   |
| `/influencers/[id]`                | Profile (history, performance, contact)       |
| `/influencers/[id]/edit`           | Edit form                                     |
| `/brands`                          | List                                          |
| `/brands/new`                      | Create                                        |
| `/brands/[id]`                     | Detail (campaigns history)                    |
| `/campaigns`                       | List + filters                                |
| `/campaigns/new`                   | Create from template (brand, dates, customize)|
| `/campaigns/[id]`                  | Overview + task board                         |
| `/campaigns/[id]/influencers`     | Roster + status workflow                      |
| `/campaigns/[id]/report`           | Performance + costs report                    |
| `/tasks`                           | My tasks (or all if owner/manager)            |
| `/reports`                         | Team workload, influencer YTD, brand revenue  |
| `/admin/team`                      | Owner only — manage users + reset PINs        |
| `/admin/templates`                 | Owner only — manage campaign templates        |
| `/admin/notifications`             | Owner only — toggle notification rules        |
| `/admin/import`                    | Owner only — CSV import (influencers/brands)  |

### API
| Method | Path                                  | Notes                                    |
| ------ | ------------------------------------- | ---------------------------------------- |
| POST   | `/api/auth/login`                     | { user_id, pin } → cookie                |
| POST   | `/api/auth/logout`                    |                                          |
| GET    | `/api/influencers`                    | search, filter, paginate                 |
| POST   | `/api/influencers`                    |                                          |
| PATCH  | `/api/influencers/[id]`               |                                          |
| DELETE | `/api/influencers/[id]`               | soft-delete = `status='inactive'`        |
| ...    | (same CRUD shape for brands/campaigns/tasks)                                     |
| POST   | `/api/campaigns/[id]/from-template`   | apply template → generate task_groups + tasks |
| POST   | `/api/notifications/test`             | owner only                               |
| POST   | `/api/cron/daily-reminders`           | header `x-cron-secret` required          |
| POST   | `/api/cron/process-queue`             | flush queued notifications via Resend    |

---

## 7. Email System

### Sender
- **Provider:** Resend
- **From:** `notify@<DOMAIN>` (TBD — set via `EMAIL_SENDER` env var)
- **Reply-To:** `EMAIL_REPLY_TO` env var (probably the founder's email)
- **From name:** "Influencer Room"

### Templates (React Email or simple HTML)
1. **`task-assigned`**
   - Subject: `New task: {task.title}`
   - Body: who assigned, campaign, due date, description, CTA → task link
2. **`task-status-changed`** (manager + owner only by default)
   - Subject: `{task.title} → {new_status}`
3. **`deadline-reminder`** (T-3 and T-1)
   - Subject: `Reminder: {task.title} due in {N} days`
   - Sent only if status not in (done, cancelled)
4. **`daily-digest`**
   - Subject: `Today's plan — {date}`
   - Body: overdue tasks, due today, due this week, active campaigns
5. **`campaign-started`**
   - Subject: `Campaign live: {campaign.name}`
   - Body: brand, dates, owner, count of confirmed influencers

### Send flow
- Triggers (DB triggers or app-side) write a row into `notifications` with `status='queued'`
- Cron worker `/api/cron/process-queue` runs every 5 min:
  - Picks 50 queued notifications, oldest first
  - Sends via Resend
  - On success: status='sent', resend_message_id
  - On failure: retry_count++, exponential backoff (5min, 30min, 2h), max 3 retries → status='failed'

---

## 8. Cron Jobs

> **Status (Sprint 0):** Cron triggers are **deferred to Sprint 6**. The `[triggers]`
> block has been removed from `wrangler.toml` because the Cloudflare account is on
> the Workers Free plan (5 cron triggers per account total) and existing Workers
> already use the available slots. At Sprint 6 (email reminders + queue worker go
> live), decide between: upgrade to Workers Paid (\$5/mo for 250 cron triggers),
> audit existing account crons for free slots, or use an alternative scheduler
> (GitHub Actions cron, external webhook).

Cloudflare Cron Triggers configured in `wrangler.toml` **(target config — not yet active):**

```
0   *  *  *  *    →  /api/cron/daily-reminders   (hourly; handler short-circuits unless local hour == 9)
*/5 *  *  *  *    →  /api/cron/process-queue
```

**Why hourly + handler-side gate (not a single daily cron):** Cloudflare Cron Triggers
run in UTC and have no native timezone awareness. A fixed UTC time would drift by one
hour across DST transitions in Europe/Bucharest (EET ↔ EEST). Running hourly and
gating in code is DST-safe and adds negligible cost (23/24 invocations short-circuit
in <50ms).

`/api/cron/daily-reminders` handler shape (edge runtime, DST-safe):

```ts
// app/api/cron/daily-reminders/route.ts
export const runtime = 'edge'

export async function POST(req: Request) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }
  const localHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Bucharest',
      hour: 'numeric',
      hour12: false,
    })
  )
  if (localHour !== 9) return Response.json({ skipped: true, hour: localHour })

  // 1. Get all active users
  // 2. For each: build digest of (overdue tasks) + (due today) + (due this week)
  // 3. If non-empty → enqueue `daily-digest` notification
  // 4. Separately: query tasks due in exactly 3 or 1 day (status != done)
  //    → enqueue `deadline-reminder` to assignee
}
```

`/api/cron/process-queue` runs every 5 minutes, picks ≤50 queued notifications oldest-first,
sends via Resend, updates status. Validates `x-cron-secret` header.

---

## 9. Sample Campaign Templates

Seed three starter templates (owner can edit/duplicate later from `/admin/templates`):

### Template 1: "Brand Collab Standard (IG)"
*Default total span: ~28 days from kickoff to wrap.*

| Group                      | Offset (days from start) | Tasks                                                                                              |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| 1. Pitch & Negotiation     | T-21                     | Identify targets · Draft pitch email · Send pitch · Negotiate fee · Sign contract                  |
| 2. Brief & Creative        | T-14                     | Deliver brief to creator · Mood-board approved by brand · Captions/scripts approved                |
| 3. Production              | T-7                      | Shoot scheduled · Content received · Brand approval cycle                                          |
| 4. Publishing              | T+0                      | Scheduled in Meta · Live monitoring first 2h · (optional) Paid boost                                |
| 5. Reporting & Wrap        | T+7                      | Collect metrics · Screenshots · Draft report · Send report to client · Issue invoice               |

### Template 2: "TikTok Challenge"
*Faster turnaround, ~14 days.*

| Group              | Offset | Tasks                                                                  |
| ------------------ | ------ | ---------------------------------------------------------------------- |
| 1. Concept & Cast  | T-10   | Define hashtag · Cast 3-5 creators · Confirm participation             |
| 2. Brief           | T-7    | Send creative brief · Approve sounds · Approve outfits/props           |
| 3. Production      | T-3    | Receive content · Brand approval                                       |
| 4. Launch          | T+0    | Coordinated post window · Boost top-performer at +24h                  |
| 5. Wrap            | T+5    | Collect metrics · Report · Invoice                                     |

### Template 3: "YouTube Long-form Sponsorship"
*Extended timeline, ~56 days.*

| Group           | Offset | Tasks                                                                            |
| --------------- | ------ | -------------------------------------------------------------------------------- |
| 1. Outreach     | T-49   | Pitch creators · Negotiate flat + CPM · Contract signed                          |
| 2. Brief        | T-35   | Brief delivered · Talking points approved · Disclosures aligned                  |
| 3. Production   | T-21   | Script approved · Rough cut received · Brand revisions · Final cut approved      |
| 4. Publishing   | T+0    | Video live · Pinned comment · Cross-promo on Shorts                              |
| 5. Reporting    | T+14   | 14-day metrics · Audience demo · Report · Invoice                                |

---

## 10. UI Patterns

- **Color palette:** clean white + signature accent (TBD when she gives branding). Use neutral grays as base + one accent color.
- **Typography:** Inter for UI, IBM Plex Mono for code/IDs.
- **Components:** shadcn/ui — Card, Table, Dialog, Sheet, Tabs, Select, Combobox, Calendar, Badge, Toast.
- **Status pills:** colored badges per status (todo=gray, in_progress=blue, blocked=amber, review=purple, done=green).
- **Tier badges (influencers):** nano (gray), micro (blue), mid (cyan), macro (purple), mega (gold).
- **Realtime updates:** Supabase Realtime subscriptions on `tasks` table for live status changes on the campaign board.
- **Mobile:** responsive but desktop-first (heavy table views).

---

## 11. Phase 2 Backlog

Deferred from MVP:
- File uploads (briefs, contracts, screenshots) → Supabase Storage with signed URLs
- Public read-only campaign page (token-based link for clients to see progress)
- Calendar view (FullCalendar) for all campaign deadlines
- WhatsApp / Slack notifications (in addition to email)
- Influencer self-service portal (separate auth, very limited scope)
- CSV bulk import wizard with field-mapping UI
- Email-to-task ingestion (forward an email → creates a task)
- Search across everything (Postgres full-text)

---

## 12. Build Order (Sprint Plan for Claude Code)

**Sprint 0 — Scaffolding (~1h)**
- Next.js 14 + TS strict + Tailwind + shadcn/ui
- Supabase client setup (server + browser)
- Middleware skeleton

**Sprint 1 — Auth (~2h)**
- `team_members` table + seed (owner only)
- `/login` user picker + PIN entry
- JWT cookie session
- Middleware enforcement
- `/admin/team` CRUD

**Sprint 2 — Core Entities (~3h)**
- Brands CRUD
- Influencers CRUD with platforms/tags/tier filters
- Search + pagination

**Sprint 3 — Campaigns + Templates (~4h)**
- `campaign_templates` seed (3 starters)
- Campaigns CRUD
- "Create from template" flow → auto-generate task_groups + tasks
- Campaign × Influencer junction with status workflow

**Sprint 4 — Tasks (~3h)**
- Task board (grouped list with drag-to-status)
- Task CRUD
- Assignment + due dates
- `/tasks` "my tasks" view
- Realtime subscription

**Sprint 5 — Email (~3h)**
- Resend integration
- Notification queue + worker
- 5 templates (HTML + text)
- DB triggers / app hooks to enqueue on events

**Sprint 6 — Cron + Reports (~2h)**
- Cloudflare Cron Triggers
- Daily reminders endpoint
- Queue processor endpoint
- Dashboard cards + reports page

**Sprint 7 — Polish + Deploy (~1h)**
- Cloudflare Pages deploy
- Smoke test checklist
- Owner walkthrough doc

**Total estimate: 12–18h** for MVP feature-complete.

---

## 13. Open Items Before Kickoff

- [ ] Email sender domain (Stefan will confirm later)
- [ ] Logo / brand palette / fonts (Influencer Room visual identity)
- [ ] Initial team list (names + emails + roles)
- [ ] Initial brand list (top 5 to import as seed)
- [ ] Initial influencer DB (CSV import or manual)
- [ ] Confirm Cloudflare Cron Triggers vs Vercel Cron (depends on hosting choice — Pages = Cloudflare Cron)
- [ ] Confirm Supabase project: new project under TUNE SCORE org? Or separate org for hand-off later?

---

## 14. Hand-off Notes for Claude Code

When starting the build:

1. Read this PRD top-to-bottom.
2. Start with `pnpm create next-app@latest` (TS, Tailwind, App Router, ESLint).
3. Install: `@supabase/supabase-js @supabase/ssr resend bcryptjs jose lucide-react @radix-ui/react-* class-variance-authority clsx tailwind-merge`.
4. Install shadcn/ui components incrementally per sprint.
5. Apply migrations in order — each sprint = one migration file.
6. Commit per sprint with conventional commits.
7. After each sprint: run `tsc --noEmit` clean before moving on.
8. Production Hub repo at `~/openclaw-data/03-apps-development/production-hub/` is the reference for auth patterns + UI conventions.

---

*Document version: v1.0 — drafted by Claude for Stefan, 7 May 2026.*
*Revision: §8 cron schedule replaced with hourly + handler-side gate (DST-safe) — 7 May 2026.*
*Revision: §2 Next.js 14 → Next.js 16; adapter is `@opennextjs/cloudflare` deployed as a Cloudflare Worker (not Pages) — 7 May 2026.*
*Revision: §8 cron triggers deferred to Sprint 6 (Workers Free plan 5-cron limit hit during initial deploy) — 7 May 2026.*
