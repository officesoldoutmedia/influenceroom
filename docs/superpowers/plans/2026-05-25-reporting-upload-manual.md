# Sprint 11 Faza A Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă upload rapoarte (PDF/Excel/CSV/screenshot) per (influencer × campanie) cu manual KPI entry, plus istoric pe `/campaigns/[id]` (tab nou "Rapoarte") și `/influencers/[id]` (section "Rapoarte campanii").

**Architecture:** Storage bucket nou `report-uploads` cu MIME whitelist + 10MB limit. Tabel `report_uploads` cu FK la `campaign_participants` (CASCADE) + denormalizat `campaign_id` + `influencer_id` pentru query rapid. 5 API endpoints (upload multipart, patch KPI, delete, list, re-sign file). 3 componente UI reutilizabile + 2 integrări pe pagini detail.

**Tech Stack:** Supabase Storage + Postgres + RLS, Next.js 16 App Router server + client components, multipart/form-data parsing nativ, signed URLs 1h TTL.

**Spec:** `docs/superpowers/specs/2026-05-25-reporting-upload-manual-design.md`

---

## File Map

| Fișier | Acțiune | Responsabilitate |
|--------|---------|------------------|
| `supabase/migrations/045_report_uploads.sql` | Create | Bucket + 3 policies storage + tabel + 3 indecși + 1 RLS policy DB |
| `lib/reports/types.ts` | Create | Types `ReportEntry`, `KpiFields`, `ReportListParams` |
| `app/api/reports/upload/route.ts` | Create | POST multipart |
| `app/api/reports/[id]/route.ts` | Create | PATCH + DELETE |
| `app/api/reports/[id]/file/route.ts` | Create | GET re-sign URL |
| `app/api/reports/route.ts` | Create | GET list cu 3 mode filter |
| `app/_components/report-upload-modal.tsx` | Create | Modal cu file + KPI + notes |
| `app/_components/report-edit-modal.tsx` | Create | Modal Edit KPI |
| `app/_components/report-row.tsx` | Create | Row reutilizabil cu actions |
| `app/campaigns/[id]/campaign-reports-tab.tsx` | Create | Client component cu fetch + grup per participant |
| `app/campaigns/[id]/tabs-shell.tsx` | Modify | Add tab "Rapoarte" |
| `app/campaigns/[id]/page.tsx` | Modify | Pass `reports` slot |
| `app/influencers/[id]/influencer-reports-section.tsx` | Create | Section cross-campanii |
| `app/influencers/[id]/page.tsx` | Modify | Render section |

---

## Task 1: Migration 045 — storage bucket + tabel

**Files:**
- Create: `supabase/migrations/045_report_uploads.sql`

**Context:** Mirror pattern bucket `campaign-pdfs` (Sprint 15 §11) + tabel `influencer_rate_card_history` (Sprint 14b). Bucket privat 10MB cu MIME whitelist; tabel cu CASCADE pe participant_id, SET NULL pe campaign/influencer pentru retenție istoric.

- [ ] **Step 1: Create migration file**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/supabase/migrations/045_report_uploads.sql`:

```sql
-- Sprint 11 Faza A: storage bucket + table pentru rapoarte campanie.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-uploads', 'report-uploads', false, 10 * 1024 * 1024,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "report_uploads_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-uploads');
CREATE POLICY "report_uploads_authenticated_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-uploads');
CREATE POLICY "report_uploads_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-uploads');

CREATE TABLE IF NOT EXISTS report_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  influencer_id uuid REFERENCES influencers(id) ON DELETE SET NULL,

  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes int,
  file_mime text,

  kpi_views int,
  kpi_reach int,
  kpi_engagement int,
  kpi_saves int,
  kpi_profile_visits int,
  kpi_link_clicks int,
  kpi_watch_time_sec int,

  notes text,

  uploaded_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (kpi_views IS NULL OR kpi_views >= 0) AND
    (kpi_reach IS NULL OR kpi_reach >= 0) AND
    (kpi_engagement IS NULL OR kpi_engagement >= 0) AND
    (kpi_saves IS NULL OR kpi_saves >= 0) AND
    (kpi_profile_visits IS NULL OR kpi_profile_visits >= 0) AND
    (kpi_link_clicks IS NULL OR kpi_link_clicks >= 0) AND
    (kpi_watch_time_sec IS NULL OR kpi_watch_time_sec >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_report_uploads_participant
  ON report_uploads(participant_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_uploads_campaign
  ON report_uploads(campaign_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_uploads_influencer
  ON report_uploads(influencer_id, uploaded_at DESC);

ALTER TABLE report_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_uploads_read_authn ON report_uploads;
CREATE POLICY report_uploads_read_authn ON report_uploads
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE report_uploads IS
  'Rapoarte incarcate per (influencer x campanie). KPI manual entry in faza A.';
```

- [ ] **Step 2: Apply via Supabase MCP**

Folosește `mcp__claude_ai_Supabase__apply_migration`:
- `project_id`: `uhriwdjhzyorogvukcnv`
- `name`: `045_report_uploads`
- `query`: SQL fără comentariile (păstrează SQL executabil)

Expected: `{"success": true}`.

- [ ] **Step 3: Verify**

```sql
SELECT
  (SELECT count(*) FROM storage.buckets WHERE id='report-uploads') AS bucket,
  (SELECT count(*) FROM information_schema.tables WHERE table_name='report_uploads') AS table_,
  (SELECT count(*) FROM pg_indexes WHERE tablename='report_uploads') AS indexes,
  (SELECT count(*) FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'report_uploads_%') AS storage_policies;
```

Expected: bucket=1, table_=1, indexes=4 (3 noi + PK), storage_policies=3.

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/045_report_uploads.sql
git commit -m "feat(db): migration 045 — bucket report-uploads + table report_uploads"
```

---

## Task 2: Types module

**Files:**
- Create: `lib/reports/types.ts`

**Context:** Tipuri shared între API + UI. Match cu DB schema strict.

- [ ] **Step 1: Create types**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/lib/reports/types.ts`:

```ts
// Sprint 11 Faza A — types pentru report_uploads.
// KPI fields: toate optionale, numeric ≥ 0. Validat în API + UI.

export const KPI_KEYS = [
  'kpi_views',
  'kpi_reach',
  'kpi_engagement',
  'kpi_saves',
  'kpi_profile_visits',
  'kpi_link_clicks',
  'kpi_watch_time_sec',
] as const

export type KpiKey = (typeof KPI_KEYS)[number]
export type KpiFields = Partial<Record<KpiKey, number | null>>

export const KPI_LABELS_RO: Record<KpiKey, string> = {
  kpi_views: 'Views',
  kpi_reach: 'Reach',
  kpi_engagement: 'Engagement (likes+comments+shares)',
  kpi_saves: 'Saves',
  kpi_profile_visits: 'Profile visits',
  kpi_link_clicks: 'Link clicks',
  kpi_watch_time_sec: 'Watch time (sec)',
}

/** Compact summary pentru row UI: "R 12.5K · E 850 · V 8.2K" */
export const KPI_SUMMARY_ORDER: Array<{ key: KpiKey; short: string }> = [
  { key: 'kpi_reach', short: 'R' },
  { key: 'kpi_engagement', short: 'E' },
  { key: 'kpi_views', short: 'V' },
]

export type ReportEntry = {
  id: string
  participant_id: string
  campaign_id: string | null
  influencer_id: string | null
  file_path: string
  file_name: string
  file_size_bytes: number | null
  file_mime: string | null
  kpi_views: number | null
  kpi_reach: number | null
  kpi_engagement: number | null
  kpi_saves: number | null
  kpi_profile_visits: number | null
  kpi_link_clicks: number | null
  kpi_watch_time_sec: number | null
  notes: string | null
  uploaded_by: { id: string; name: string } | null
  uploaded_at: string
  updated_by: { id: string; name: string } | null
  updated_at: string
  signedUrl?: string
  // Optional joined data pentru list endpoints
  participant?: {
    id: string
    platform: string
    account_handle: string | null
    influencer: { id: string; name: string } | null
  } | null
  campaign?: { id: string; name: string } | null
}

export const ACCEPTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Compact format: 12500 → "12.5K", 1500000 → "1.5M" */
export function formatKpiNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatKpiSummary(report: Pick<ReportEntry, 'kpi_views' | 'kpi_reach' | 'kpi_engagement'>): string {
  const parts: string[] = []
  for (const { key, short } of KPI_SUMMARY_ORDER) {
    const val = report[key as 'kpi_views' | 'kpi_reach' | 'kpi_engagement']
    if (val != null) parts.push(`${short} ${formatKpiNumber(val)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/** Strip non-ASCII, replace problematic chars, truncate la 100. */
export function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^\x20-\x7e]/g, '') // strip non-ASCII
    .replace(/[/\\?%*:|"<>]/g, '_') // replace path-unsafe chars
    .trim()
    .slice(0, 100) || 'file'
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/reports/types.ts
git commit -m "feat(reports): types module cu KpiFields + format helpers"
```

---

## Task 3: API — POST upload + GET file re-sign

**Files:**
- Create: `app/api/reports/upload/route.ts`
- Create: `app/api/reports/[id]/file/route.ts`

**Context:** POST face multipart parsing, scope check via participant→campaign, Storage upload, DB INSERT cu denormalizate, signed URL. GET file re-sign cu path prefix guard.

- [ ] **Step 1: Make directories**

```bash
mkdir -p "app/api/reports/upload" "app/api/reports/[id]/file"
```

- [ ] **Step 2: Create `app/api/reports/upload/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'
import {
  ACCEPTED_MIMES,
  MAX_FILE_SIZE_BYTES,
  KPI_KEYS,
  sanitizeFilename,
  type KpiKey,
} from '@/lib/reports/types'

const BUCKET = 'report-uploads'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function parseKpi(value: FormDataEntryValue | null): number | null {
  if (value == null || value === '') return null
  const s = typeof value === 'string' ? value.trim() : ''
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_form' }, { status: 400 })
  }

  const participantId = form.get('participant_id')
  if (typeof participantId !== 'string' || participantId.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_participant' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'missing_file' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'file_too_large', limit: MAX_FILE_SIZE_BYTES },
      { status: 422 },
    )
  }
  if (!(ACCEPTED_MIMES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_mime', mime: file.type },
      { status: 422 },
    )
  }

  const supabase = admin()

  // Scope check: participant → campaign owner
  const { data: participant } = await supabase
    .from('campaign_participants')
    .select('id, campaign_id, influencer_id, campaign:campaigns(owner_id)')
    .eq('id', participantId)
    .maybeSingle<{
      id: string
      campaign_id: string
      influencer_id: string | null
      campaign: { owner_id: string | null }[] | { owner_id: string | null } | null
    }>()
  if (!participant) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  const camp = Array.isArray(participant.campaign)
    ? participant.campaign[0] ?? null
    : participant.campaign
  if (!canReadCampaign(user, { owner_id: camp?.owner_id ?? null })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Upload Storage
  const timestamp = Date.now()
  const safeName = sanitizeFilename(file.name)
  const path = `${participantId}/${timestamp}-${safeName}`
  const fileBuf = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuf, { contentType: file.type, upsert: false })
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: 'upload_failed', detail: uploadErr.message },
      { status: 500 },
    )
  }

  // Build KPI row
  const kpi: Record<string, number | null> = {}
  for (const k of KPI_KEYS) {
    kpi[k] = parseKpi(form.get(k))
  }
  const notesRaw = form.get('notes')
  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null

  // INSERT row
  const insertPayload = {
    participant_id: participantId,
    campaign_id: participant.campaign_id,
    influencer_id: participant.influencer_id,
    file_path: path,
    file_name: file.name,
    file_size_bytes: file.size,
    file_mime: file.type,
    notes,
    uploaded_by: user.id,
    updated_by: user.id,
    ...kpi,
  }

  const { data: row, error: insertErr } = await supabase
    .from('report_uploads')
    .insert(insertPayload)
    .select('*')
    .maybeSingle()

  if (insertErr || !row) {
    // Best-effort cleanup Storage
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    return NextResponse.json(
      { ok: false, error: 'insert_failed', detail: insertErr?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  // Sign URL
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  return NextResponse.json({
    ok: true,
    report: { ...row, signedUrl: signed?.signedUrl },
  })
}

// Unused import guard pentru parseKpi (păstrăm reference la KPI_KEYS chiar dacă type-narrowing nu îl detectează)
void (KPI_KEYS as readonly KpiKey[])
```

Notă: ultima linie `void (KPI_KEYS as readonly KpiKey[])` previne warning "unused import" pe `KpiKey` dacă apare la lint. Verifică după typecheck; șterge linia dacă nu e nevoie.

- [ ] **Step 3: Create `app/api/reports/[id]/file/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'

const BUCKET = 'report-uploads'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()

  const { data: row } = await supabase
    .from('report_uploads')
    .select('id, file_path, participant_id, campaign:campaigns(owner_id)')
    .eq('id', id)
    .maybeSingle<{
      id: string
      file_path: string
      participant_id: string
      campaign: { owner_id: string | null }[] | { owner_id: string | null } | null
    }>()
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  const camp = Array.isArray(row.campaign) ? row.campaign[0] ?? null : row.campaign
  if (!canReadCampaign(user, { owner_id: camp?.owner_id ?? null })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Path prefix guard
  const expectedPrefix = `${row.participant_id}/`
  if (!row.file_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS)
  if (error || !signed) {
    return NextResponse.json({ ok: false, error: 'sign_failed', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, signedUrl: signed.signedUrl })
}
```

Notă: query "campaign:campaigns(owner_id)" depinde de FK indirect. Dacă PostgREST nu poate face joinul prin participant, schimbă la 2 queries (fetch report → fetch participant → fetch campaign).

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm run typecheck`
Expected: 0 errors. Dacă query-ul "campaign:campaigns(owner_id)" eșuează (PostgREST nu se poate auto-join cross-FK), schimbă la:

```ts
const { data: row } = await supabase
  .from('report_uploads')
  .select('id, file_path, participant_id, campaign_id')
  .eq('id', id)
  .maybeSingle<{ id: string; file_path: string; participant_id: string; campaign_id: string | null }>()
if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

let ownerId: string | null = null
if (row.campaign_id) {
  const { data: c } = await supabase
    .from('campaigns')
    .select('owner_id')
    .eq('id', row.campaign_id)
    .maybeSingle<{ owner_id: string | null }>()
  ownerId = c?.owner_id ?? null
}
if (!canReadCampaign(user, { owner_id: ownerId })) { ... }
```

Run: `pnpm run lint`
Expected: 0 errors.

---

## Task 4: API — PATCH + DELETE + GET list

**Files:**
- Create: `app/api/reports/[id]/route.ts`
- Create: `app/api/reports/route.ts`

- [ ] **Step 1: Create `app/api/reports/[id]/route.ts` (PATCH + DELETE)**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'
import { KPI_KEYS } from '@/lib/reports/types'

const BUCKET = 'report-uploads'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function fetchOwnerId(supabase: ReturnType<typeof admin>, reportId: string): Promise<{
  ownerId: string | null
  filePath: string
  participantId: string
} | null> {
  const { data: row } = await supabase
    .from('report_uploads')
    .select('id, file_path, participant_id, campaign_id')
    .eq('id', reportId)
    .maybeSingle<{ id: string; file_path: string; participant_id: string; campaign_id: string | null }>()
  if (!row) return null
  let ownerId: string | null = null
  if (row.campaign_id) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('owner_id')
      .eq('id', row.campaign_id)
      .maybeSingle<{ owner_id: string | null }>()
    ownerId = c?.owner_id ?? null
  }
  return { ownerId, filePath: row.file_path, participantId: row.participant_id }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const meta = await fetchOwnerId(supabase, id)
  if (!meta) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!canReadCampaign(user, { owner_id: meta.ownerId })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const k of KPI_KEYS) {
    if (!(k in body)) continue
    const v = body[k]
    if (v === null || v === '') {
      update[k] = null
      continue
    }
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
      return NextResponse.json({ ok: false, error: 'invalid_kpi', field: k }, { status: 422 })
    }
    update[k] = v
  }
  if ('notes' in body) {
    const n = body.notes
    update.notes = typeof n === 'string' && n.trim() ? n.trim() : null
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }
  update.updated_by = user.id
  update.updated_at = new Date().toISOString()

  const { data: row, error } = await supabase
    .from('report_uploads')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error || !row) {
    return NextResponse.json(
      { ok: false, error: 'update_failed', detail: error?.message ?? 'not_found' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, report: row })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = admin()
  const meta = await fetchOwnerId(supabase, id)
  if (!meta) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!canReadCampaign(user, { owner_id: meta.ownerId })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Storage delete best-effort
  await supabase.storage.from(BUCKET).remove([meta.filePath]).catch((err) => {
    console.error('[report delete storage]', err)
  })

  const { error } = await supabase.from('report_uploads').delete().eq('id', id)
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'delete_failed', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create `app/api/reports/route.ts` (GET list)**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadCampaign, canReadInfluencer } from '@/lib/auth/scope'

const BUCKET = 'report-uploads'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const LIST_LIMIT = 20

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const participantId = sp.get('participant_id')
  const campaignId = sp.get('campaign_id')
  const influencerId = sp.get('influencer_id')

  // Exact one filter required
  const filterCount = [participantId, campaignId, influencerId].filter((v) => v && v.length > 0).length
  if (filterCount !== 1) {
    return NextResponse.json(
      { ok: false, error: 'one_filter_required' },
      { status: 400 },
    )
  }

  const supabase = admin()

  // Scope check
  if (campaignId) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('owner_id')
      .eq('id', campaignId)
      .maybeSingle<{ owner_id: string | null }>()
    if (!c) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    if (!canReadCampaign(user, { owner_id: c.owner_id })) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
  } else if (participantId) {
    const { data: p } = await supabase
      .from('campaign_participants')
      .select('campaign:campaigns(owner_id)')
      .eq('id', participantId)
      .maybeSingle<{ campaign: { owner_id: string | null }[] | { owner_id: string | null } | null }>()
    if (!p) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    const camp = Array.isArray(p.campaign) ? p.campaign[0] ?? null : p.campaign
    if (!canReadCampaign(user, { owner_id: camp?.owner_id ?? null })) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
  } else if (influencerId) {
    const { data: i } = await supabase
      .from('influencers')
      .select('account_manager_id')
      .eq('id', influencerId)
      .maybeSingle<{ account_manager_id: string | null }>()
    if (!i) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    if (!canReadInfluencer(user, { account_manager_id: i.account_manager_id })) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
  }

  // Build query
  let query = supabase
    .from('report_uploads')
    .select(`
      *,
      uploaded_by:team_members!report_uploads_uploaded_by_fkey(id, name),
      updated_by:team_members!report_uploads_updated_by_fkey(id, name),
      participant:campaign_participants(id, platform, account_handle, influencer:influencers(id, name)),
      campaign:campaigns(id, name)
    `)
    .order('uploaded_at', { ascending: false })
    .limit(LIST_LIMIT)

  if (participantId) query = query.eq('participant_id', participantId)
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (influencerId) query = query.eq('influencer_id', influencerId)

  const { data: entries, error } = await query
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', detail: error.message },
      { status: 500 },
    )
  }

  // Sign URLs for each entry
  const withUrls = await Promise.all(
    (entries ?? []).map(async (e) => {
      const filePath = (e as { file_path: string }).file_path
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
      return { ...e, signedUrl: signed?.signedUrl ?? null }
    }),
  )

  return NextResponse.json({ ok: true, entries: withUrls })
}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm run typecheck`
Expected: 0 errors. Dacă FK constraint names sunt different decât Postgres defaults (`report_uploads_uploaded_by_fkey` și `report_uploads_updated_by_fkey`), verifică via:

```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'report_uploads'::regclass AND contype = 'f';
```

Și înlocuiește în query.

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit API**

```bash
git add app/api/reports/upload app/api/reports/[id] app/api/reports/route.ts
git commit -m "feat(api/reports): upload multipart + PATCH/DELETE/GET endpoints"
```

---

## Task 5: UI components — modals + row

**Files:**
- Create: `app/_components/report-upload-modal.tsx`
- Create: `app/_components/report-edit-modal.tsx`
- Create: `app/_components/report-row.tsx`

**Context:** Components reutilizabile. Upload + Edit împart majoritatea form-ului (KPI inputs + notes), dar upload include file input. Pattern similar cu `RateCardPdfButton` (Sprint 13b) și `CampaignPdfButton` (§11).

- [ ] **Step 1: Create `app/_components/report-upload-modal.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import {
  ACCEPTED_MIMES,
  KPI_KEYS,
  KPI_LABELS_RO,
  MAX_FILE_SIZE_BYTES,
  type KpiKey,
  type ReportEntry,
} from '@/lib/reports/types'

type State = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; message: string }

export function ReportUploadModal({
  participantId,
  participantLabel,
  onClose,
  onUploaded,
}: {
  participantId: string
  participantLabel: string
  onClose: () => void
  onUploaded: (report: ReportEntry) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [kpi, setKpi] = useState<Record<KpiKey, string>>(() => {
    const init = {} as Record<KpiKey, string>
    for (const k of KPI_KEYS) init[k] = ''
    return init
  })
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setState({ kind: 'error', message: 'Selectează un fişier' })
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({ kind: 'error', message: 'Fişier prea mare (max 10MB)' })
      return
    }
    if (!(ACCEPTED_MIMES as readonly string[]).includes(file.type)) {
      setState({ kind: 'error', message: 'Tip de fişier neacceptat' })
      return
    }
    setState({ kind: 'submitting' })

    const form = new FormData()
    form.append('participant_id', participantId)
    form.append('file', file)
    for (const k of KPI_KEYS) {
      if (kpi[k] !== '') form.append(k, kpi[k])
    }
    if (notes.trim()) form.append('notes', notes.trim())

    try {
      const res = await fetch('/api/reports/upload', { method: 'POST', body: form })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; report?: ReportEntry; error?: string; detail?: string }
      if (res.ok && data.report) {
        onUploaded(data.report)
        onClose()
      } else {
        setState({ kind: 'error', message: data.detail || data.error || 'eroare necunoscută' })
      }
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'eroare reţea' })
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={state.kind === 'submitting' ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-stone-900 mb-1">Upload raport</h2>
        <p className="text-sm text-stone-500 mb-4">{participantLabel}</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">Fişier *</label>
            <input
              type="file"
              accept={ACCEPTED_MIMES.join(',')}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
            {file && (
              <p className="text-xs text-stone-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {KPI_KEYS.map((k) => (
              <div key={k}>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">
                  {KPI_LABELS_RO[k]}
                </label>
                <input
                  type="number"
                  min={0}
                  value={kpi[k]}
                  onChange={(e) => setKpi({ ...kpi, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm min-h-[60px]"
            />
          </div>

          {state.kind === 'error' && <p className="text-sm text-rose-600">{state.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={state.kind === 'submitting'} className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 disabled:opacity-60">
              Anulează
            </button>
            <button type="submit" disabled={state.kind === 'submitting'} className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60">
              {state.kind === 'submitting' ? 'Se încarcă...' : 'Salvează raport'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/_components/report-edit-modal.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { KPI_KEYS, KPI_LABELS_RO, type KpiKey, type ReportEntry } from '@/lib/reports/types'

type State = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; message: string }

export function ReportEditModal({
  report,
  onClose,
  onSaved,
}: {
  report: ReportEntry
  onClose: () => void
  onSaved: (report: ReportEntry) => void
}) {
  const [kpi, setKpi] = useState<Record<KpiKey, string>>(() => {
    const init = {} as Record<KpiKey, string>
    for (const k of KPI_KEYS) {
      const v = report[k]
      init[k] = v != null ? String(v) : ''
    }
    return init
  })
  const [notes, setNotes] = useState(report.notes ?? '')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'submitting' })

    const body: Record<string, unknown> = {}
    for (const k of KPI_KEYS) {
      const raw = kpi[k]
      if (raw === '') {
        body[k] = null
      } else {
        const n = Number(raw)
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          setState({ kind: 'error', message: `Valoare invalidă: ${KPI_LABELS_RO[k]}` })
          return
        }
        body[k] = n
      }
    }
    body.notes = notes

    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; report?: ReportEntry; error?: string; detail?: string }
      if (res.ok && data.report) {
        onSaved(data.report)
        onClose()
      } else {
        setState({ kind: 'error', message: data.detail || data.error || 'eroare necunoscută' })
      }
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'eroare reţea' })
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-stone-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={state.kind === 'submitting' ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-stone-900 mb-1">Editează raport</h2>
        <p className="text-sm text-stone-500 mb-4">{report.file_name}</p>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {KPI_KEYS.map((k) => (
              <div key={k}>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">
                  {KPI_LABELS_RO[k]}
                </label>
                <input
                  type="number"
                  min={0}
                  value={kpi[k]}
                  onChange={(e) => setKpi({ ...kpi, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm min-h-[60px]"
            />
          </div>

          {state.kind === 'error' && <p className="text-sm text-rose-600">{state.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={state.kind === 'submitting'} className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 disabled:opacity-60">
              Anulează
            </button>
            <button type="submit" disabled={state.kind === 'submitting'} className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60">
              {state.kind === 'submitting' ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/_components/report-row.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { formatKpiSummary, type ReportEntry } from '@/lib/reports/types'

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'acum câteva secunde'
  if (diffMin < 60) return `acum ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `acum ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `acum ${diffD} zile`
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ReportRow({
  report,
  showCampaign = false,
  onEdit,
  onDelete,
}: {
  report: ReportEntry
  showCampaign?: boolean
  onEdit: (report: ReportEntry) => void
  onDelete: (report: ReportEntry) => void
}) {
  const uploadedBy = pickOne(report.uploaded_by)
  const campaign = pickOne(report.campaign)

  return (
    <tr className="hover:bg-stone-50 transition-colors">
      <td className="px-4 py-3">
        {report.signedUrl ? (
          <a href={report.signedUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-stone-900 hover:text-brand-700 underline-offset-2 hover:underline">
            {report.file_name}
          </a>
        ) : (
          <span className="text-stone-600">{report.file_name}</span>
        )}
        {report.file_size_bytes != null && (
          <span className="text-xs text-stone-400 ml-2">({(report.file_size_bytes / 1024).toFixed(1)} KB)</span>
        )}
      </td>
      {showCampaign && (
        <td className="px-4 py-3 text-stone-600">
          {campaign ? (
            <Link href={`/campaigns/${campaign.id}`} className="hover:text-brand-700 underline-offset-2 hover:underline">
              {campaign.name}
            </Link>
          ) : (
            '—'
          )}
        </td>
      )}
      <td className="px-4 py-3 text-stone-600 tabular-nums">{formatKpiSummary(report)}</td>
      <td className="px-4 py-3 text-stone-500" title={new Date(report.uploaded_at).toLocaleString('ro-RO')}>
        {formatRelative(report.uploaded_at)}
      </td>
      <td className="px-4 py-3 text-stone-600">{uploadedBy?.name ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={() => onEdit(report)} className="text-xs text-stone-600 hover:text-brand-700 mr-2">
          Edit
        </button>
        <button type="button" onClick={() => onDelete(report)} className="text-xs text-rose-600 hover:text-rose-800">
          Şterge
        </button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm run typecheck`
Expected: 0 errors.

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit components**

```bash
git add app/_components/report-upload-modal.tsx app/_components/report-edit-modal.tsx app/_components/report-row.tsx
git commit -m "feat(reports): UI components ReportUploadModal + ReportEditModal + ReportRow"
```

---

## Task 6: Integration — tab campanie + section influencer

**Files:**
- Create: `app/campaigns/[id]/campaign-reports-tab.tsx`
- Modify: `app/campaigns/[id]/tabs-shell.tsx`
- Modify: `app/campaigns/[id]/page.tsx`
- Create: `app/influencers/[id]/influencer-reports-section.tsx`
- Modify: `app/influencers/[id]/page.tsx`

**Context:** Extend tabs-shell cu a 7-a opțiune "Rapoarte". Adaugă section nouă pe influencer detail. Folosesc patterns existente (tabs-shell pattern + section pattern din rate cards history).

- [ ] **Step 1: Create `app/campaigns/[id]/campaign-reports-tab.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ConfirmModal } from '@/lib/ui/confirm-modal'
import { ReportUploadModal } from '@/app/_components/report-upload-modal'
import { ReportEditModal } from '@/app/_components/report-edit-modal'
import { ReportRow } from '@/app/_components/report-row'
import type { ReportEntry } from '@/lib/reports/types'

type Participant = {
  id: string
  platform: string
  account_handle: string | null
  is_adhoc: boolean
  influencer?: { name: string } | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; entries: ReportEntry[] }
  | { kind: 'error'; message: string }

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export function CampaignReportsTab({
  campaignId,
  participants,
}: {
  campaignId: string
  participants: Participant[]
}) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [uploadFor, setUploadFor] = useState<Participant | null>(null)
  const [editing, setEditing] = useState<ReportEntry | null>(null)
  const [deleteFor, setDeleteFor] = useState<ReportEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function reload() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/reports?campaign_id=${campaignId}`)
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; entries?: ReportEntry[]; error?: string }
      if (res.ok && data.entries) {
        setState({ kind: 'ok', entries: data.entries })
      } else {
        setState({ kind: 'error', message: data.error ?? 'server_error' })
      }
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' })
    }
  }

  useEffect(() => { reload() }, [campaignId])

  async function confirmDelete() {
    if (!deleteFor) return
    setDeleting(true)
    const res = await fetch(`/api/reports/${deleteFor.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteFor(null)
    if (res.ok) {
      await reload()
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'unknown'}`)
    }
  }

  if (state.kind === 'loading') return <div className="text-sm text-stone-500">Se încarcă...</div>
  if (state.kind === 'error') return <div className="text-sm text-rose-600">Eroare: {state.message}</div>

  const grouped = new Map<string, ReportEntry[]>()
  for (const r of state.entries) grouped.set(r.participant_id, [...(grouped.get(r.participant_id) ?? []), r])

  return (
    <div className="space-y-4">
      {participants.map((p) => {
        const reports = grouped.get(p.id) ?? []
        const label = `${p.influencer?.name ?? (p.is_adhoc ? 'Ad-hoc' : '—')} · ${p.platform}`
        return (
          <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base text-stone-900">{label}</h3>
              <button
                type="button"
                onClick={() => setUploadFor(p)}
                className="px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs hover:bg-brand-800"
              >
                + Upload raport
              </button>
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-stone-500">Niciun raport.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
                    <th className="px-4 py-2">Fişier</th>
                    <th className="px-4 py-2">KPI</th>
                    <th className="px-4 py-2">Când</th>
                    <th className="px-4 py-2">De</th>
                    <th className="px-4 py-2 text-right">Acţiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reports.map((r) => (
                    <ReportRow
                      key={r.id}
                      report={r}
                      onEdit={(rep) => setEditing(rep)}
                      onDelete={(rep) => setDeleteFor(rep)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {uploadFor && (
        <ReportUploadModal
          participantId={uploadFor.id}
          participantLabel={`${uploadFor.influencer?.name ?? (uploadFor.is_adhoc ? 'Ad-hoc' : '—')} · ${uploadFor.platform}`}
          onClose={() => setUploadFor(null)}
          onUploaded={() => reload()}
        />
      )}

      {editing && (
        <ReportEditModal
          report={editing}
          onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}

      {deleteFor && (
        <ConfirmModal
          title="Şterge raport?"
          description={`"${deleteFor.file_name}" va fi şters definitiv (DB + Storage).`}
          confirmLabel="Şterge definitiv"
          variant="danger"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteFor(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `app/campaigns/[id]/tabs-shell.tsx`**

Înlocuiește integral cu (adaugă tab "Rapoarte" la final):

```tsx
'use client'

import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/lib/ui'

export function CampaignTabsShell({
  details,
  participants,
  deliverables,
  milestones,
  tasks,
  audit,
  reports,
}: {
  details: ReactNode
  participants: ReactNode
  deliverables: ReactNode
  milestones: ReactNode
  tasks: ReactNode
  audit: ReactNode
  reports: ReactNode
}) {
  return (
    <Tabs defaultValue="details" className="space-y-6">
      <div className="sticky top-14 z-10 -mx-4 sm:mx-0 bg-stone-50/85 backdrop-blur-md">
        <TabsList>
          <TabsTrigger value="details">Detalii</TabsTrigger>
          <TabsTrigger value="participants">Participanți</TabsTrigger>
          <TabsTrigger value="deliverables">Livrabile</TabsTrigger>
          <TabsTrigger value="milestones">Etape</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="reports">Rapoarte</TabsTrigger>
          <TabsTrigger value="audit">Istoric</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="details">{details}</TabsContent>
      <TabsContent value="participants">{participants}</TabsContent>
      <TabsContent value="deliverables">{deliverables}</TabsContent>
      <TabsContent value="milestones">{milestones}</TabsContent>
      <TabsContent value="tasks">{tasks}</TabsContent>
      <TabsContent value="reports">{reports}</TabsContent>
      <TabsContent value="audit">{audit}</TabsContent>
    </Tabs>
  )
}
```

Notă: am pus tab "Rapoarte" ÎNAINTE de "Istoric" — rapoartele sunt active feature, Istoric e meta-tracking pasiv.

- [ ] **Step 3: Update `app/campaigns/[id]/page.tsx`**

Localizează unde se folosește `<CampaignTabsShell>`. Adaugă import + prop:

```tsx
import { CampaignReportsTab } from './campaign-reports-tab'
```

Pasează prop nou:
```tsx
<CampaignTabsShell
  details={...}
  participants={...}
  deliverables={...}
  milestones={...}
  tasks={...}
  audit={<CampaignAuditTab campaignId={campaign.id} />}
  reports={<CampaignReportsTab campaignId={campaign.id} participants={participants ?? []} />}
/>
```

Notă: `participants` e variabila locală pre-fetch în page.tsx; folosește numele exact (verifică cu grep).

- [ ] **Step 4: Create `app/influencers/[id]/influencer-reports-section.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ConfirmModal } from '@/lib/ui/confirm-modal'
import { ReportEditModal } from '@/app/_components/report-edit-modal'
import { ReportRow } from '@/app/_components/report-row'
import type { ReportEntry } from '@/lib/reports/types'

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; entries: ReportEntry[] }
  | { kind: 'error'; message: string }

export function InfluencerReportsSection({ influencerId }: { influencerId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [editing, setEditing] = useState<ReportEntry | null>(null)
  const [deleteFor, setDeleteFor] = useState<ReportEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function reload() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/reports?influencer_id=${influencerId}`)
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; entries?: ReportEntry[]; error?: string }
      if (res.ok && data.entries) {
        setState({ kind: 'ok', entries: data.entries })
      } else {
        setState({ kind: 'error', message: data.error ?? 'server_error' })
      }
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' })
    }
  }

  useEffect(() => { reload() }, [influencerId])

  async function confirmDelete() {
    if (!deleteFor) return
    setDeleting(true)
    const res = await fetch(`/api/reports/${deleteFor.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteFor(null)
    if (res.ok) {
      await reload()
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${data.error ?? 'unknown'}`)
    }
  }

  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6 mt-6">
      <h2 className="font-display text-lg text-stone-900 mb-4">Rapoarte campanii</h2>

      {state.kind === 'loading' && <p className="text-sm text-stone-500">Se încarcă...</p>}
      {state.kind === 'error' && <p className="text-sm text-rose-600">Eroare: {state.message}</p>}
      {state.kind === 'ok' && state.entries.length === 0 && (
        <p className="text-sm text-stone-500">Niciun raport pentru acest influencer.</p>
      )}
      {state.kind === 'ok' && state.entries.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">
              <th className="px-4 py-2">Fişier</th>
              <th className="px-4 py-2">Campanie</th>
              <th className="px-4 py-2">KPI</th>
              <th className="px-4 py-2">Când</th>
              <th className="px-4 py-2">De</th>
              <th className="px-4 py-2 text-right">Acţiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {state.entries.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                showCampaign
                onEdit={(rep) => setEditing(rep)}
                onDelete={(rep) => setDeleteFor(rep)}
              />
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ReportEditModal
          report={editing}
          onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}

      {deleteFor && (
        <ConfirmModal
          title="Şterge raport?"
          description={`"${deleteFor.file_name}" va fi şters definitiv.`}
          confirmLabel="Şterge definitiv"
          variant="danger"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteFor(null)}
        />
      )}
    </section>
  )
}
```

- [ ] **Step 5: Update `app/influencers/[id]/page.tsx`**

Localizează page-ul + adaugă import:
```tsx
import { InfluencerReportsSection } from './influencer-reports-section'
```

În JSX, după ultima section existentă (rate cards history sau previous campaigns), adaugă:
```tsx
<InfluencerReportsSection influencerId={influencer.id} />
```

Folosește variabila locală pentru id (probabil `influencer.id` sau `params.id` — verifică cu grep).

- [ ] **Step 6: Verify typecheck + lint + build**

Run: `pnpm run typecheck`
Expected: 0 errors.

Run: `pnpm run lint`
Expected: 0 errors.

Run: `pnpm run build`
Expected: success.

- [ ] **Step 7: Commit integration**

```bash
git add app/campaigns/[id]/campaign-reports-tab.tsx app/campaigns/[id]/tabs-shell.tsx app/campaigns/[id]/page.tsx app/influencers/[id]/influencer-reports-section.tsx app/influencers/[id]/page.tsx
git commit -m "feat(reports): tab Rapoarte pe campanie + section pe influencer"
```

---

## Task 7: Verificare finală + push

**Files:**
- N/A

- [ ] **Step 1: Commit docs**

```bash
git add docs/superpowers/specs/2026-05-25-reporting-upload-manual-design.md docs/superpowers/plans/2026-05-25-reporting-upload-manual.md
git commit -m "docs(superpowers): spec + plan Sprint 11 Faza A reporting upload + manual KPI"
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Watch GHA**

```bash
gh run list --limit 1 --workflow=deploy.yml --json databaseId,status
# apoi
gh run watch <id> --exit-status
```

Expected: success ~2 min.

- [ ] **Step 4: Smoke live pe iPhone PWA**

Pe https://influenceroom.office-2e5.workers.dev:
- `/campaigns/[id]` → click tab "Rapoarte" → vezi cards per participant cu empty state
- Click "+ Upload raport" pe un participant → modal upload
- Upload PDF + completează 2 KPI (Reach + Views) → Salvează
- Card cu participantul respectiv arată row nou cu file link + KPI summary
- Click pe nume fişier → download tab nou
- Click "Edit" → modificare valori KPI → Salvează
- Click "Şterge" → confirm modal → Şterge definitiv
- `/influencers/[id]` → scroll jos → section "Rapoarte campanii" cu raportul tot acolo (cross-campanii)
- Login cu account user → încearcă upload pe campanie a altui owner → 404

---

## Self-Review

**Spec coverage:**
- §2.1 Upload + scope check → Task 3 Step 2
- §2.2 Edit raport → Task 4 Step 1 (PATCH) + Task 5 Step 2 (modal)
- §2.3 Delete raport → Task 4 Step 1 (DELETE) + Task 6 (confirm modal)
- §2.4 Listare per context → Task 4 Step 2 (GET cu 3 mode) + Task 6 (consume)
- §2.5 Download → Task 3 Step 3 (GET file) + Task 5 Step 3 (link direct)
- §2.6 KPI display → Task 2 (formatKpiSummary) + Task 5 Step 3 (ReportRow)
- §3 Migration → Task 1
- §4 Backend → Tasks 3 + 4
- §5 UI components + integrare → Tasks 5 + 6

**Placeholder scan:** Niciun TBD. Task 4 Step 3 menționează "dacă FK constraint names sunt different, verifică" — acceptabil pentru ajustare de PostgREST string, e instrucțiune verificabilă cu grep, nu placeholder.

**Type consistency:**
- `KPI_KEYS`, `KpiKey`, `KpiFields`, `ReportEntry`, `formatKpiSummary`, `sanitizeFilename` definite în Task 2, folosite consistent în Tasks 3-6 ✅
- `pickOne` helper duplicat în 2 locuri (Task 3 + Task 5/6) — acceptabil pentru first-pass; promovat dacă apare 3rd usage
- `formatRelative` în ReportRow — dacă apare deja în CampaignAuditTab + WeightsHistorySection, considerăm shared helper în Faza ulterioară

**Risk reminder:** spec §7 — Storage cleanup pe INSERT fail (best-effort), MIME whitelist server-side, path prefix guard pe GET file.

**Migration ordering:** Task 1 (DB) PRECEDĂ tot. Task 2 (types) PRECEDĂ Tasks 3-6. Plan respectă ordinea.
