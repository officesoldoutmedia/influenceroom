# Campanii PDF + Month Filter §11 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă PDF export per campanie + filtru pe luni (overlap) pe lista de campanii + buton "Export raport PDF" care exportă lista filtrată ca summary.

**Architecture:** Storage bucket nou `campaign-pdfs` (mirror pattern `rate-cards` din Sprint 13b). Două generatoare PDF noi în `lib/campaigns/pdf-*.ts` reutilizând `pdf-lib` și paleta brand cu COLORS/wordmark duplicate din `lib/rate-cards/pdf-generator.ts` (justificare: minimal first-pass, evităm refactor pe cod stabil). Două endpoint-uri noi: `/api/campaigns/[id]/pdf` (single) și `/api/campaigns/report-pdf` (bulk). UI: buton "Export PDF" pe detail + 2 input-uri month pe FilterBar + buton "Export raport PDF" pe top bar.

**Tech Stack:** Supabase Postgres + Storage, `pdf-lib` 1.17.1 (deja instalat), Next.js 16 App Router server components, React state + URL params, Cloudflare Workers runtime via OpenNext.

**Spec:** `docs/superpowers/specs/2026-05-25-campaigns-pdf-month-filter-design.md`

---

## File Map

| Fișier | Acțiune | Responsabilitate |
|--------|---------|------------------|
| `supabase/migrations/042_campaign_pdfs_bucket.sql` | Create | Storage bucket + 3 RLS policies |
| `lib/campaigns/pdf-single.ts` | Create | Generator PDF per campanie (3-5 pagini complete) |
| `lib/campaigns/pdf-report.ts` | Create | Generator PDF bulk summary (1-2 pagini tabel) |
| `lib/campaigns/search.ts` | Modify | `monthFrom` + `monthTo` params + logică overlap |
| `app/campaigns/page.tsx` | Modify | Parse URL `?month_from=` `?month_to=` |
| `app/api/campaigns/[id]/pdf/route.ts` | Create | POST generate single + GET re-sign |
| `app/api/campaigns/report-pdf/route.ts` | Create | POST generate bulk cu hard limit 100 |
| `app/campaigns/[id]/campaign-pdf-button.tsx` | Create | Componenta button cu idle/loading/success/error |
| `app/campaigns/[id]/detail-ui.tsx` | Modify | Integrare buton în header actions |
| `app/campaigns/campaigns-ui.tsx` | Modify | Month picker în FilterBar + buton bulk export + state + serialize URL |

---

## Task 1: Migration 042 — storage bucket campaign-pdfs

**Files:**
- Create: `supabase/migrations/042_campaign_pdfs_bucket.sql`

**Context:** Mirror pattern bucket `rate-cards` din Sprint 13b. Bucket privat, file size limit 10MB, MIME doar PDF. Policies authenticated read/write/delete ca defense-in-depth — server-side codul folosește service_role și bypass-uiește RLS oricum.

- [ ] **Step 1: Creează migration file**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/supabase/migrations/042_campaign_pdfs_bucket.sql`:

```sql
-- Sprint 15 Faza 3 §11: bucket pentru PDF-urile generate per campanie + rapoarte bulk.
--
-- Path single: campaign-pdfs/<campaign_id>/<timestamp>-campaign.pdf
-- Path bulk:   campaign-pdfs/_reports/<timestamp>-<from>-<to>.pdf
--
-- Prune logic e în API handler (5 latest per campanie, 10 latest în _reports).
-- Policies: defense-in-depth, server-side foloseşte service_role (Path A).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-pdfs',
  'campaign-pdfs',
  false,
  10 * 1024 * 1024,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "campaign_pdfs_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'campaign-pdfs');

CREATE POLICY "campaign_pdfs_authenticated_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'campaign-pdfs');

CREATE POLICY "campaign_pdfs_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'campaign-pdfs');
```

- [ ] **Step 2: Aplică migration via Supabase MCP**

Folosește `mcp__claude_ai_Supabase__apply_migration` cu:
- `project_id`: `uhriwdjhzyorogvukcnv`
- `name`: `042_campaign_pdfs_bucket`
- `query`: conținutul SQL de mai sus

Expected: `{"success": true}`.

- [ ] **Step 3: Verifică bucket-ul**

Folosește `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'campaign-pdfs';
```

Expected: 1 rând cu `public=false`, `file_size_limit=10485760`, `allowed_mime_types={application/pdf}`.

- [ ] **Step 4: Verifică policies**

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE 'campaign_pdfs_%';
```

Expected: 3 rânduri (SELECT, INSERT, DELETE).

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/042_campaign_pdfs_bucket.sql
git commit -m "feat(db): migration 042 — bucket campaign-pdfs + 3 RLS policies"
```

---

## Task 2: Month filter în search.ts + page parsing

**Files:**
- Modify: `lib/campaigns/search.ts:7-31` (CampaignSearchParams) și ~54+ (logica filter)
- Modify: `app/campaigns/page.tsx` (parse URL params)
- Modify: `app/api/campaigns/route.ts:22-28` (GET handler passthrough)

**Context:** Adăugăm 2 params noi cu validare regex `/^\d{4}-\d{2}$/`. Logica overlap: dacă `monthFrom` setat → filter pe `end_date >= fromStart OR end_date IS NULL`. Dacă `monthTo` setat → filter pe `start_date <= toEnd`. Când oricare e setat, excludem `start_date IS NULL`.

- [ ] **Step 1: Extend CampaignSearchParams type**

În `lib/campaigns/search.ts`, înlocuiește definiția `CampaignSearchParams` (liniile 7-16):

```ts
export type CampaignSearchParams = {
  q?: string | null
  statuses?: string[]
  brand?: string | null
  owner?: string | null
  /** YYYY-MM — limita inferioară pentru overlap cu intervalul campaniei. */
  monthFrom?: string | null
  /** YYYY-MM — limita superioară pentru overlap. */
  monthTo?: string | null
  page?: number
  // Required at every call site; applied as a final WHERE so account managers
  // only see their own campaigns. Pass the result of getCurrentUser().
  user: UserContext
}
```

- [ ] **Step 2: Adaugă helper lastDayOfMonth + filter logic**

În aceeași funcție `listCampaigns`, după blocul de status filter (linia ~54), adaugă:

```ts
  // §11 month overlap filter. O campanie cu (start, end) overlap-uieste cu
  // intervalul [fromStart, toEnd] dacă start <= toEnd AND (end >= fromStart OR end IS NULL).
  const monthRegex = /^\d{4}-\d{2}$/
  const monthFrom = p.monthFrom && monthRegex.test(p.monthFrom) ? p.monthFrom : null
  const monthTo = p.monthTo && monthRegex.test(p.monthTo) ? p.monthTo : null

  if (monthFrom) {
    const fromStart = `${monthFrom}-01`
    query = query.or(`end_date.gte.${fromStart},end_date.is.null`)
  }
  if (monthTo) {
    const [y, m] = monthTo.split('-').map(Number)
    const nextMonth = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1))
    nextMonth.setUTCDate(nextMonth.getUTCDate() - 1)
    const toEnd = nextMonth.toISOString().slice(0, 10)
    query = query.lte('start_date', toEnd)
  }
  if (monthFrom || monthTo) {
    query = query.not('start_date', 'is', null)
  }
```

Plasează acest bloc imediat după:
```ts
  if (p.brand) query = query.eq('brand_id', p.brand)
  if (p.owner) query = query.eq('owner_id', p.owner)
```
și înainte de:
```ts
  query = scopeCampaignsRead(query, p.user)
```

- [ ] **Step 3: Update API GET route să paseze month params**

În `app/api/campaigns/route.ts`, în GET handler, înlocuiește (liniile ~22-28):

```ts
    const result = await listCampaigns({
      q: sp.get('q'),
      statuses: sp.getAll('status'),
      brand: sp.get('brand'),
      owner: sp.get('owner'),
      page: Number(sp.get('page') ?? '1'),
      user,
    })
```

Cu:

```ts
    const result = await listCampaigns({
      q: sp.get('q'),
      statuses: sp.getAll('status'),
      brand: sp.get('brand'),
      owner: sp.get('owner'),
      monthFrom: sp.get('month_from'),
      monthTo: sp.get('month_to'),
      page: Number(sp.get('page') ?? '1'),
      user,
    })
```

- [ ] **Step 4: Update app/campaigns/page.tsx să citească URL params**

Localizează `app/campaigns/page.tsx` și fișierul de parsing al searchParams. Caută unde se construiește obiectul de filters pentru `listCampaigns`. Adaugă `monthFrom` și `monthTo` în acel obiect, citindu-le din searchParams.

Run: `grep -n "listCampaigns\|searchParams" "app/campaigns/page.tsx" | head -10`

Dacă fișierul folosește pattern similar cu `app/influencers/page.tsx`, adaugă:
```ts
monthFrom: strParam(sp.month_from),
monthTo: strParam(sp.month_to),
```

În obiectul `filters`.

- [ ] **Step 5: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Smoke SQL — verifică logica overlap**

Folosește `mcp__claude_ai_Supabase__execute_sql`:
```sql
-- Simulează "campanii cu overlap în ianuarie 2026"
WITH params AS (
  SELECT '2026-01-01'::date AS from_start,
         '2026-01-31'::date AS to_end
)
SELECT c.name, c.start_date, c.end_date,
  CASE
    WHEN c.start_date IS NULL THEN 'excluded (null start)'
    WHEN c.start_date <= (SELECT to_end FROM params)
      AND (c.end_date >= (SELECT from_start FROM params) OR c.end_date IS NULL)
    THEN 'included'
    ELSE 'excluded'
  END AS in_window
FROM campaigns c
LIMIT 20;
```

Expected: rânduri marcate `included` corespund cu campanii care chiar overlap-uiesc cu ianuarie 2026.

- [ ] **Step 7: Commit backend filter**

```bash
git add lib/campaigns/search.ts app/api/campaigns/route.ts app/campaigns/page.tsx
git commit -m "feat(campaigns): filtru lunar cu overlap (monthFrom/monthTo, YYYY-MM)"
```

---

## Task 3: PDF generator single — lib/campaigns/pdf-single.ts

**Files:**
- Create: `lib/campaigns/pdf-single.ts`

**Context:** Reutilizăm pattern-ul integral din `lib/rate-cards/pdf-generator.ts` (Sprint 13b — funcțional, deployed). Citește acel fișier integral pentru: COLORS, PAGE/MARGIN/CONTENT_WIDTH constants, types Fonts/Assets, decodeWordmarkPng helper, drawTextRight + alți helpers. Duplicăm intentionat (vezi spec §4.3 — minimal first-pass, evităm refactor pe cod stabil).

Funcția exportată: `generateCampaignPDF(campaign, participants, deliverables, milestones): Promise<Uint8Array>`. Conținut pages: Cover → Detalii+Brief → Participanți → Livrabile → Milestones. 3-5 pagini cu page-break logic.

- [ ] **Step 1: Citește pattern-ul existent**

Read: `lib/rate-cards/pdf-generator.ts` (454 linii, citește integral). Notează:
- Imports din pdf-lib
- `decodeWordmarkPng` + wordmark assets
- `COLORS` palette
- `PAGE`/`MARGIN`/`CONTENT_WIDTH`
- Types `Fonts` + `Assets`
- Helpers `drawTextRight`, `drawTextCenter`, etc. (extrage la creare)
- Pattern `generateRateCardPDF`

Read: `lib/rate-cards/wordmark-asset.ts` (extrage `WORDMARK_PNG_BASE64`, `WORDMARK_ASPECT_RATIO`).

- [ ] **Step 2: Creează lib/campaigns/pdf-single.ts**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/lib/campaigns/pdf-single.ts`:

```ts
// Sprint 15 Faza 3 §11 — generator PDF pentru o campanie individuală.
//
// Conţinut: Cover (brand + perioadă) → Detalii + Brief → Participanţi (tabel) →
// Livrabile (tabel) → Milestones (tabel). 3-5 pagini cu paginare auto.
//
// Pattern duplicat intenţionat din lib/rate-cards/pdf-generator.ts pentru a
// nu atinge cod stabil livrat în Sprint 13b. Dacă vreodată apare a treia
// nevoie de PDF, extragem brand-assets într-un modul shared.

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { WORDMARK_ASPECT_RATIO, WORDMARK_PNG_BASE64 } from '@/lib/rate-cards/wordmark-asset'
import { formatEur } from '@/lib/influencers/format'

const COLORS = {
  obsidian: rgb(0x0a / 255, 0x0a / 255, 0x0b / 255),
  brand: rgb(0xc2 / 255, 0x41 / 255, 0x0c / 255),
  textMuted: rgb(0x57 / 255, 0x53 / 255, 0x4e / 255),
  textFaint: rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255),
  rule: rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255),
  rowAlt: rgb(0xfa / 255, 0xfa / 255, 0xf9 / 255),
}

const PAGE = { width: 595.28, height: 841.89 } // A4 in points
const MARGIN = { x: 56, y: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2

const WORDMARK_COVER_WIDTH = 120
const WORDMARK_COVER_HEIGHT = WORDMARK_COVER_WIDTH / WORDMARK_ASPECT_RATIO
const WORDMARK_FOOTER_WIDTH = 70
const WORDMARK_FOOTER_HEIGHT = WORDMARK_FOOTER_WIDTH / WORDMARK_ASPECT_RATIO

type Fonts = {
  serif: PDFFont
  serifBold: PDFFont
  sans: PDFFont
  sansBold: PDFFont
  mono: PDFFont
}
type Assets = Fonts & { wordmark: PDFImage }

export type CampaignForPdf = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  deliverables_count: number | null
  brief: string | null
  brand?: { name: string } | null
  owner?: { name: string } | null
}

export type ParticipantForPdf = {
  id: string
  platform: string
  account_handle: string | null
  status: string
  agreed_fee: number | null
  influencer?: { name: string } | null
  is_adhoc: boolean
}

export type DeliverableForPdf = {
  id: string
  type: string
  custom_type_label: string | null
  quantity: number
  post_date: string | null
  status: string
  published_url: string | null
  participant_id: string
}

export type MilestoneForPdf = {
  id: string
  type: string
  name: string | null
  due_date: string | null
  responsible: string
  responsible_name: string | null
  completed_at: string | null
}

function decodeWordmarkPng(): Uint8Array {
  const bin = atob(WORDMARK_PNG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']

function formatDateRo(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS_RO[m - 1]} ${y}`
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return 'Perioadă nedefinită'
  if (!end) return `din ${formatDateRo(start)}`
  return `${formatDateRo(start)} – ${formatDateRo(end)}`
}

const STATUS_LABELS_RO: Record<string, string> = {
  draft: 'Draft',
  active: 'Activă',
  in_review: 'În review',
  completed: 'Finalizată',
  cancelled: 'Anulată',
  invited: 'Invitat',
  confirmed: 'Confirmat',
  declined: 'Refuzat',
  in_progress: 'În lucru',
  content_in_review: 'Content în review',
  approved: 'Aprobat',
  published: 'Publicat',
  sent_to_influencer: 'Trimis influencer',
}

function statusLabel(s: string): string {
  return STATUS_LABELS_RO[s] ?? s
}

const DELIVERABLE_LABELS: Record<string, string> = {
  story: 'Story',
  reel: 'Reel',
  tiktok: 'TikTok',
  carousel: 'Carousel',
  post: 'Post',
  youtube_long: 'YouTube long',
  youtube_short: 'YouTube Short',
  live: 'Live',
  custom: 'Custom',
}

function deliverableTypeLabel(type: string, custom_label: string | null): string {
  if (type === 'custom' && custom_label) return custom_label
  return DELIVERABLE_LABELS[type] ?? type
}

const MILESTONE_LABELS: Record<string, string> = {
  brief_sent: 'Brief trimis',
  materials_approved: 'Materiale aprobate',
  content_draft_submitted: 'Draft trimis',
  final_content_approved: 'Conţinut final aprobat',
  links_submitted: 'Link-uri trimise',
  report_delivered: 'Raport livrat',
  payment_processed: 'Plată procesată',
  other: 'Altă etapă',
}

function milestoneTypeLabel(type: string, name: string | null): string {
  if (type === 'other' && name) return name
  return MILESTONE_LABELS[type] ?? type
}

// Helpers de desenare — adaptate din lib/rate-cards/pdf-generator.ts.

function drawTextRight(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size) + (opts.tracking ?? 0) * (text.length - 1)
  page.drawText(text, {
    x: opts.x - w,
    y: opts.y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
    ...(opts.tracking ? { characterSpacing: opts.tracking } : {}),
  })
}

function drawTextCenter(
  page: PDFPage,
  text: string,
  opts: { y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size) + (opts.tracking ?? 0) * (text.length - 1)
  page.drawText(text, {
    x: (PAGE.width - w) / 2,
    y: opts.y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
    ...(opts.tracking ? { characterSpacing: opts.tracking } : {}),
  })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(probe, size) <= maxWidth) {
      cur = probe
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function drawFooter(page: PDFPage, assets: Assets, pageNo: number, totalPages: number): void {
  const y = MARGIN.y - 24
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: y - WORDMARK_FOOTER_HEIGHT / 2,
    width: WORDMARK_FOOTER_WIDTH,
    height: WORDMARK_FOOTER_HEIGHT,
  })
  drawTextRight(page, `${pageNo} / ${totalPages}`, {
    x: PAGE.width - MARGIN.x,
    y: y - 3,
    font: assets.sans,
    size: 8,
    color: COLORS.textFaint,
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry
// ────────────────────────────────────────────────────────────────────────────

export async function generateCampaignPDF(
  campaign: CampaignForPdf,
  participants: ParticipantForPdf[],
  deliverables: DeliverableForPdf[],
  milestones: MilestoneForPdf[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Campanie — ${campaign.name}`)
  doc.setAuthor('Influence Room')
  doc.setProducer('Influence Room app')
  doc.setCreator('influenceroom.ro')

  const fonts: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.CourierBold),
  }
  const wordmark = await doc.embedPng(decodeWordmarkPng())
  const assets: Assets = { ...fonts, wordmark }

  // 1. Cover
  drawCoverPage(doc, assets, campaign)

  // 2. Detalii + Brief
  drawDetailsPage(doc, assets, campaign)

  // 3. Participanţi
  drawParticipantsPage(doc, assets, participants)

  // 4. Livrabile
  drawDeliverablesPage(doc, assets, deliverables, participants)

  // 5. Milestones
  drawMilestonesPage(doc, assets, milestones)

  // Footer pages
  const pages = doc.getPages()
  const total = pages.length
  pages.forEach((p, i) => drawFooter(p, assets, i + 1, total))

  return doc.save()
}

export function getCampaignPdfStoragePath(campaignId: string, timestamp: number): string {
  return `${campaignId}/${timestamp}-campaign.pdf`
}

// ────────────────────────────────────────────────────────────────────────────
// Page renderers
// ────────────────────────────────────────────────────────────────────────────

function drawCoverPage(doc: PDFDocument, assets: Assets, campaign: CampaignForPdf): void {
  const page = doc.addPage([PAGE.width, PAGE.height])

  const wordmarkBottom = PAGE.height - MARGIN.y - WORDMARK_COVER_HEIGHT
  page.drawImage(assets.wordmark, {
    x: MARGIN.x, y: wordmarkBottom,
    width: WORDMARK_COVER_WIDTH, height: WORDMARK_COVER_HEIGHT,
  })
  drawTextRight(page, 'RAPORT CAMPANIE', {
    x: PAGE.width - MARGIN.x,
    y: wordmarkBottom + (WORDMARK_COVER_HEIGHT - 9) / 2 + 1,
    font: assets.sansBold,
    size: 9,
    color: COLORS.textFaint,
    tracking: 1.5,
  })

  // Title — auto-shrink
  const titleY = PAGE.height / 2 + 60
  let titleSize = 36
  while (titleSize > 18 && assets.serifBold.widthOfTextAtSize(campaign.name, titleSize) > CONTENT_WIDTH) {
    titleSize -= 2
  }
  drawTextCenter(page, campaign.name, {
    y: titleY,
    font: assets.serifBold,
    size: titleSize,
    color: COLORS.obsidian,
  })

  // Accent rule
  page.drawRectangle({
    x: (PAGE.width - 80) / 2,
    y: titleY - 18,
    width: 80,
    height: 2,
    color: COLORS.brand,
  })

  // Brand
  if (campaign.brand?.name) {
    drawTextCenter(page, `pentru ${campaign.brand.name}`, {
      y: titleY - 44,
      font: assets.sans,
      size: 14,
      color: COLORS.textMuted,
    })
  }

  // Period
  drawTextCenter(page, formatPeriod(campaign.start_date, campaign.end_date), {
    y: titleY - 72,
    font: assets.serif,
    size: 12,
    color: COLORS.textMuted,
  })

  // Status badge
  const statusText = statusLabel(campaign.status).toUpperCase()
  const statusW = assets.sansBold.widthOfTextAtSize(statusText, 10) + 24
  const statusX = (PAGE.width - statusW) / 2
  page.drawRectangle({
    x: statusX, y: titleY - 110,
    width: statusW, height: 22,
    color: COLORS.brand,
  })
  page.drawText(statusText, {
    x: statusX + 12, y: titleY - 104,
    font: assets.sansBold,
    size: 10,
    color: rgb(1, 1, 1),
    characterSpacing: 1.2,
  })

  // Generated at
  const now = new Date().toISOString().slice(0, 10)
  drawTextCenter(page, `Generat la ${formatDateRo(now)}`, {
    y: MARGIN.y + 20,
    font: assets.sans,
    size: 9,
    color: COLORS.textFaint,
  })
}

function drawDetailsPage(doc: PDFDocument, assets: Assets, campaign: CampaignForPdf): void {
  const page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  // Heading
  page.drawText('Detalii', {
    x: MARGIN.x, y: y - 20,
    font: assets.serifBold, size: 22, color: COLORS.obsidian,
  })
  y -= 50

  // 2-col grid
  const pairs: Array<[string, string]> = [
    ['Status', statusLabel(campaign.status)],
    ['Owner', campaign.owner?.name ?? '—'],
    ['Brand', campaign.brand?.name ?? '—'],
    ['Buget total', campaign.total_budget != null ? formatEur(campaign.total_budget) : '—'],
    ['Început', formatDateRo(campaign.start_date)],
    ['Final', formatDateRo(campaign.end_date)],
    ['Deliverables', String(campaign.deliverables_count ?? '—')],
  ]
  const colW = CONTENT_WIDTH / 2
  for (let i = 0; i < pairs.length; i++) {
    const [label, value] = pairs[i]
    const col = i % 2
    const x = MARGIN.x + col * colW
    if (col === 0 && i > 0) y -= 36
    page.drawText(label, {
      x, y: y - 4,
      font: assets.sans, size: 9, color: COLORS.textFaint,
    })
    page.drawText(value, {
      x, y: y - 20,
      font: assets.sansBold, size: 12, color: COLORS.obsidian,
    })
  }
  y -= 56

  // Brief heading
  page.drawText('Brief', {
    x: MARGIN.x, y: y - 20,
    font: assets.serifBold, size: 18, color: COLORS.obsidian,
  })
  y -= 36

  // Brief body (truncate la 3000 caractere)
  const briefRaw = (campaign.brief ?? '').trim()
  const brief = briefRaw.length > 3000 ? briefRaw.slice(0, 3000) + '…' : briefRaw
  if (!brief) {
    page.drawText('—', { x: MARGIN.x, y: y - 12, font: assets.sans, size: 11, color: COLORS.textMuted })
  } else {
    const lines = wrapText(brief, assets.sans, 11, CONTENT_WIDTH)
    for (const line of lines) {
      if (y < MARGIN.y + 40) break // protejează footer-ul
      page.drawText(line, {
        x: MARGIN.x, y: y - 12,
        font: assets.sans, size: 11, color: COLORS.obsidian,
      })
      y -= 16
    }
  }
}

function drawParticipantsPage(doc: PDFDocument, assets: Assets, participants: ParticipantForPdf[]): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText(`Participanţi (${participants.length})`, {
    x: MARGIN.x, y: y - 20,
    font: assets.serifBold, size: 22, color: COLORS.obsidian,
  })
  y -= 50

  if (participants.length === 0) {
    page.drawText('Niciun participant.', { x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted })
    return
  }

  // Header row
  const cols = [
    { label: 'Influencer', w: 150 },
    { label: 'Platformă', w: 70 },
    { label: 'Handle', w: 100 },
    { label: 'Status', w: 80 },
    { label: 'Fee (€)', w: 80 },
  ]
  const drawHeader = (yy: number) => {
    let cx = MARGIN.x
    page.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      page.drawText(c.label.toUpperCase(), {
        x: cx + 6, y: yy + 4,
        font: assets.sansBold, size: 8, color: COLORS.textMuted,
        characterSpacing: 0.6,
      })
      cx += c.w
    }
  }
  drawHeader(y)
  y -= 18

  let totalFee = 0
  let row = 0
  for (const p of participants) {
    if (y < MARGIN.y + 40) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const values = [
      p.influencer?.name ?? (p.is_adhoc ? 'Ad-hoc' : '—'),
      p.platform,
      p.account_handle ?? '—',
      statusLabel(p.status),
      p.agreed_fee != null ? formatEur(p.agreed_fee).replace('€', '') : '—',
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6, y: y,
        font: assets.sans, size: 10, color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    if (p.agreed_fee != null) totalFee += p.agreed_fee
    y -= 18
    row++
  }

  y -= 12
  drawTextRight(page, `Total fee: ${formatEur(totalFee)}`, {
    x: PAGE.width - MARGIN.x,
    y,
    font: assets.sansBold,
    size: 11,
    color: COLORS.brand,
  })
}

function drawDeliverablesPage(
  doc: PDFDocument,
  assets: Assets,
  deliverables: DeliverableForPdf[],
  participants: ParticipantForPdf[],
): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText(`Livrabile (${deliverables.length})`, {
    x: MARGIN.x, y: y - 20,
    font: assets.serifBold, size: 22, color: COLORS.obsidian,
  })
  y -= 50

  if (deliverables.length === 0) {
    page.drawText('Niciun livrabil.', { x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted })
    return
  }

  const participantMap = new Map(participants.map((p) => [p.id, p.influencer?.name ?? 'Ad-hoc']))

  const cols = [
    { label: 'Influencer', w: 130 },
    { label: 'Tip', w: 110 },
    { label: 'Qty', w: 40 },
    { label: 'Data', w: 80 },
    { label: 'Status', w: 120 },
  ]
  const drawHeader = (yy: number) => {
    let cx = MARGIN.x
    page.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      page.drawText(c.label.toUpperCase(), {
        x: cx + 6, y: yy + 4,
        font: assets.sansBold, size: 8, color: COLORS.textMuted,
        characterSpacing: 0.6,
      })
      cx += c.w
    }
  }
  drawHeader(y)
  y -= 18

  let row = 0
  for (const d of deliverables) {
    if (y < MARGIN.y + 40) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const values = [
      participantMap.get(d.participant_id) ?? '—',
      deliverableTypeLabel(d.type, d.custom_type_label),
      String(d.quantity),
      formatDateRo(d.post_date),
      statusLabel(d.status),
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6, y: y,
        font: assets.sans, size: 10, color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    y -= 18
    row++
  }
}

function drawMilestonesPage(doc: PDFDocument, assets: Assets, milestones: MilestoneForPdf[]): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText(`Etape (${milestones.length})`, {
    x: MARGIN.x, y: y - 20,
    font: assets.serifBold, size: 22, color: COLORS.obsidian,
  })
  y -= 50

  if (milestones.length === 0) {
    page.drawText('Nicio etapă.', { x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted })
    return
  }

  const RESP_LABELS: Record<string, string> = {
    account_manager: 'Account manager',
    influencer: 'Influencer',
    brand: 'Brand',
    other: 'Alt responsabil',
  }

  const cols = [
    { label: 'Tip', w: 160 },
    { label: 'Deadline', w: 90 },
    { label: 'Responsabil', w: 130 },
    { label: 'Completat', w: 100 },
  ]
  const drawHeader = (yy: number) => {
    let cx = MARGIN.x
    page.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      page.drawText(c.label.toUpperCase(), {
        x: cx + 6, y: yy + 4,
        font: assets.sansBold, size: 8, color: COLORS.textMuted,
        characterSpacing: 0.6,
      })
      cx += c.w
    }
  }
  drawHeader(y)
  y -= 18

  let row = 0
  for (const m of milestones) {
    if (y < MARGIN.y + 40) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const respLabel = m.responsible === 'other' && m.responsible_name
      ? m.responsible_name
      : RESP_LABELS[m.responsible] ?? m.responsible
    const values = [
      milestoneTypeLabel(m.type, m.name),
      formatDateRo(m.due_date),
      respLabel,
      m.completed_at ? formatDateRo(m.completed_at) : '—',
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6, y: y,
        font: assets.sans, size: 10, color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    y -= 18
    row++
  }
}
```

- [ ] **Step 3: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit generator single**

```bash
git add lib/campaigns/pdf-single.ts
git commit -m "feat(campaigns): generator PDF per campanie (cover + detalii + tabele)"
```

---

## Task 4: PDF generator bulk — lib/campaigns/pdf-report.ts

**Files:**
- Create: `lib/campaigns/pdf-report.ts`

**Context:** Generator pentru raport multi-campanii. 1-2 pagini cu cover interval + tabel one-row-per-campaign. Reutilizează ACELAȘI pattern de helpers + constants ca în Task 3 — duplicate prin import (NU re-define) pentru consistență vizuală.

- [ ] **Step 1: Creează lib/campaigns/pdf-report.ts**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/lib/campaigns/pdf-report.ts`:

```ts
// Sprint 15 Faza 3 §11 — generator PDF bulk summary pentru lista campanii filtrate.
//
// Conţinut: Cover cu interval (ex: "Ian – Mar 2026") → tabel one-row-per-campaign
// cu Nume / Brand / Status / Perioadă / # Participanţi / Buget. Paginare auto
// la 25 rânduri/pagină. Total general la final.

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { WORDMARK_ASPECT_RATIO, WORDMARK_PNG_BASE64 } from '@/lib/rate-cards/wordmark-asset'
import { formatEur } from '@/lib/influencers/format'

const COLORS = {
  obsidian: rgb(0x0a / 255, 0x0a / 255, 0x0b / 255),
  brand: rgb(0xc2 / 255, 0x41 / 255, 0x0c / 255),
  textMuted: rgb(0x57 / 255, 0x53 / 255, 0x4e / 255),
  textFaint: rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255),
  rule: rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255),
  rowAlt: rgb(0xfa / 255, 0xfa / 255, 0xf9 / 255),
}
const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = { x: 56, y: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2
const WORDMARK_W = 120
const WORDMARK_H = WORDMARK_W / WORDMARK_ASPECT_RATIO
const FOOTER_W = 70
const FOOTER_H = FOOTER_W / WORDMARK_ASPECT_RATIO

type Fonts = { serif: PDFFont; serifBold: PDFFont; sans: PDFFont; sansBold: PDFFont }
type Assets = Fonts & { wordmark: PDFImage }

export type ReportCampaign = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  brand_name: string | null
  participants_count: number
}

export type ReportFilters = {
  monthFrom?: string | null
  monthTo?: string | null
  statuses?: string[]
  brandName?: string | null
  ownerName?: string | null
  search?: string | null
}

function decodeWordmarkPng(): Uint8Array {
  const bin = atob(WORDMARK_PNG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']
function formatDateRo(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS_RO[m - 1]} ${y}`
}
function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return 'Perioadă nedefinită'
  if (!end) return `din ${formatDateRo(start)}`
  return `${formatDateRo(start)} – ${formatDateRo(end)}`
}
function formatMonthRange(from: string | null | undefined, to: string | null | undefined): string {
  function fmt(s: string): string {
    const [y, m] = s.split('-').map(Number)
    return `${MONTHS_RO[m - 1]} ${y}`
  }
  if (from && to) return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
  if (from) return `din ${fmt(from)}`
  if (to) return `până în ${fmt(to)}`
  return 'Toate campaniile'
}

const STATUS_LABELS_RO: Record<string, string> = {
  draft: 'Draft',
  active: 'Activă',
  in_review: 'În review',
  completed: 'Finalizată',
  cancelled: 'Anulată',
}
function statusLabel(s: string): string {
  return STATUS_LABELS_RO[s] ?? s
}

function drawTextRight(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size) + (opts.tracking ?? 0) * (text.length - 1)
  page.drawText(text, {
    x: opts.x - w, y: opts.y,
    font: opts.font, size: opts.size, color: opts.color,
    ...(opts.tracking ? { characterSpacing: opts.tracking } : {}),
  })
}
function drawTextCenter(
  page: PDFPage,
  text: string,
  opts: { y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size) + (opts.tracking ?? 0) * (text.length - 1)
  page.drawText(text, {
    x: (PAGE.width - w) / 2, y: opts.y,
    font: opts.font, size: opts.size, color: opts.color,
    ...(opts.tracking ? { characterSpacing: opts.tracking } : {}),
  })
}
function drawFooter(page: PDFPage, assets: Assets, pageNo: number, totalPages: number): void {
  const y = MARGIN.y - 24
  page.drawImage(assets.wordmark, {
    x: MARGIN.x, y: y - FOOTER_H / 2,
    width: FOOTER_W, height: FOOTER_H,
  })
  drawTextRight(page, `${pageNo} / ${totalPages}`, {
    x: PAGE.width - MARGIN.x, y: y - 3,
    font: assets.sans, size: 8, color: COLORS.textFaint,
  })
}

export async function generateCampaignReportPDF(
  campaigns: ReportCampaign[],
  filters: ReportFilters,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Raport campanii — Influence Room')
  doc.setAuthor('Influence Room')
  doc.setProducer('Influence Room app')

  const fonts: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  const wordmark = await doc.embedPng(decodeWordmarkPng())
  const assets: Assets = { ...fonts, wordmark }

  drawCover(doc, assets, campaigns, filters)
  drawTable(doc, assets, campaigns)

  // Footer pe toate paginile
  const pages = doc.getPages()
  const total = pages.length
  pages.forEach((p, i) => drawFooter(p, assets, i + 1, total))

  return doc.save()
}

export function getCampaignReportStoragePath(timestamp: number, from: string | null, to: string | null): string {
  const slug = from && to ? `${from}-${to}` : from ? `${from}-onwards` : to ? `until-${to}` : 'all'
  return `_reports/${timestamp}-${slug}.pdf`
}

function drawCover(
  doc: PDFDocument,
  assets: Assets,
  campaigns: ReportCampaign[],
  filters: ReportFilters,
): void {
  const page = doc.addPage([PAGE.width, PAGE.height])

  const wordmarkBottom = PAGE.height - MARGIN.y - WORDMARK_H
  page.drawImage(assets.wordmark, {
    x: MARGIN.x, y: wordmarkBottom,
    width: WORDMARK_W, height: WORDMARK_H,
  })
  drawTextRight(page, 'RAPORT CAMPANII', {
    x: PAGE.width - MARGIN.x,
    y: wordmarkBottom + (WORDMARK_H - 9) / 2 + 1,
    font: assets.sansBold, size: 9, color: COLORS.textFaint, tracking: 1.5,
  })

  const titleY = PAGE.height / 2 + 80
  drawTextCenter(page, formatMonthRange(filters.monthFrom, filters.monthTo), {
    y: titleY,
    font: assets.serifBold, size: 30, color: COLORS.obsidian,
  })

  page.drawRectangle({
    x: (PAGE.width - 80) / 2, y: titleY - 18,
    width: 80, height: 2, color: COLORS.brand,
  })

  // Filters summary
  const lines: string[] = []
  if (filters.statuses && filters.statuses.length > 0) {
    lines.push(`Status: ${filters.statuses.map(statusLabel).join(', ')}`)
  }
  if (filters.brandName) lines.push(`Brand: ${filters.brandName}`)
  if (filters.ownerName) lines.push(`Owner: ${filters.ownerName}`)
  if (filters.search) lines.push(`Căutare: "${filters.search}"`)

  let y = titleY - 50
  for (const line of lines) {
    drawTextCenter(page, line, {
      y, font: assets.sans, size: 11, color: COLORS.textMuted,
    })
    y -= 16
  }

  // Total count
  drawTextCenter(page, `Total: ${campaigns.length} ${campaigns.length === 1 ? 'campanie' : 'campanii'}`, {
    y: y - 30,
    font: assets.sansBold, size: 16, color: COLORS.brand,
  })

  // Generated
  const now = new Date().toISOString().slice(0, 10)
  drawTextCenter(page, `Generat la ${formatDateRo(now)}`, {
    y: MARGIN.y + 20,
    font: assets.sans, size: 9, color: COLORS.textFaint,
  })
}

function drawTable(doc: PDFDocument, assets: Assets, campaigns: ReportCampaign[]): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText('Campanii', {
    x: MARGIN.x, y: y - 20,
    font: assets.serifBold, size: 22, color: COLORS.obsidian,
  })
  y -= 50

  if (campaigns.length === 0) {
    page.drawText('Nicio campanie potrivită filtrelor.', {
      x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted,
    })
    return
  }

  const cols = [
    { label: 'Nume', w: 140 },
    { label: 'Brand', w: 90 },
    { label: 'Status', w: 70 },
    { label: 'Perioadă', w: 110 },
    { label: '# Part.', w: 50 },
    { label: 'Buget', w: 80 },
  ]
  const drawHeader = (yy: number) => {
    let cx = MARGIN.x
    page.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      page.drawText(c.label.toUpperCase(), {
        x: cx + 6, y: yy + 4,
        font: assets.sansBold, size: 8, color: COLORS.textMuted,
        characterSpacing: 0.6,
      })
      cx += c.w
    }
  }
  drawHeader(y)
  y -= 18

  let totalBudget = 0
  let row = 0
  for (const c of campaigns) {
    if (y < MARGIN.y + 60) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const values = [
      c.name.length > 22 ? c.name.slice(0, 21) + '…' : c.name,
      c.brand_name ?? '—',
      statusLabel(c.status),
      formatPeriod(c.start_date, c.end_date),
      String(c.participants_count),
      c.total_budget != null ? formatEur(c.total_budget) : '—',
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6, y: y,
        font: assets.sans, size: 10, color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    if (c.total_budget != null) totalBudget += c.total_budget
    y -= 18
    row++
  }

  y -= 12
  drawTextRight(page, `Buget cumulat: ${formatEur(totalBudget)}`, {
    x: PAGE.width - MARGIN.x, y,
    font: assets.sansBold, size: 12, color: COLORS.brand,
  })
}
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit generator bulk**

```bash
git add lib/campaigns/pdf-report.ts
git commit -m "feat(campaigns): generator PDF raport bulk cu cover interval + tabel summary"
```

---

## Task 5: API routes — single + bulk PDF

**Files:**
- Create: `app/api/campaigns/[id]/pdf/route.ts`
- Create: `app/api/campaigns/report-pdf/route.ts`

**Context:** Mirror integral pattern din `app/api/influencers/[id]/rate-card-pdf/route.ts` (Sprint 13b — read full ca referință). POST = generate + upload + prune + signed URL 1h. GET = re-sign existing path cu prefix guard.

- [ ] **Step 1: Read pattern existent**

Read: `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/app/api/influencers/[id]/rate-card-pdf/route.ts` (184 linii). Notează:
- Imports + `admin()` helper
- `BUCKET` + `KEEP_LATEST` + `SIGNED_URL_TTL_SECONDS` constants
- POST: authz → fetch entity → generate PDF → upload → prune → sign → return
- GET: authz → path prefix guard → sign existing → return

- [ ] **Step 2: Creează app/api/campaigns/[id]/pdf/route.ts**

Fișier nou:

```ts
// /api/campaigns/[id]/pdf
//   POST → render PDF, upload, prune to 5 latest, return signed URL.
//   GET  → re-sign existing path (?path=...) cu guard că path-ul aparţine
//          campaniei.
//
// Path A scoping: requireCampaignWriter pentru POST (echivalent cu PATCH),
// canReadCampaign pentru GET (read-only re-sign).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCampaignWriter } from '@/lib/auth/campaign'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'
import {
  generateCampaignPDF,
  getCampaignPdfStoragePath,
  type CampaignForPdf,
  type ParticipantForPdf,
  type DeliverableForPdf,
  type MilestoneForPdf,
} from '@/lib/campaigns/pdf-single'

const BUCKET = 'campaign-pdfs'
const KEEP_LATEST = 5
const SIGNED_URL_TTL_SECONDS = 60 * 60

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const supabase = admin()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(`
      id, name, status, start_date, end_date, total_budget, deliverables_count, brief,
      brand:brands(name),
      owner:team_members!campaigns_owner_id_fkey(name)
    `)
    .eq('id', id)
    .maybeSingle<CampaignForPdf>()

  if (!campaign) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const [{ data: participants }, { data: deliverables }, { data: milestones }] = await Promise.all([
    supabase
      .from('campaign_participants')
      .select('id, platform, account_handle, status, agreed_fee, is_adhoc, influencer:influencers(name)')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('campaign_deliverables')
      .select('id, type, custom_type_label, quantity, post_date, status, published_url, participant_id, participant:campaign_participants!inner(campaign_id)')
      .eq('participant.campaign_id', id)
      .order('post_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('campaign_milestones')
      .select('id, type, name, due_date, responsible, responsible_name, completed_at')
      .eq('campaign_id', id)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateCampaignPDF(
      campaign,
      (participants ?? []) as ParticipantForPdf[],
      (deliverables ?? []) as DeliverableForPdf[],
      (milestones ?? []) as MilestoneForPdf[],
    )
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { ok: false, error: 'pdf_render_failed', detail },
      { status: 500 },
    )
  }

  const timestamp = Date.now()
  const path = getCampaignPdfStoragePath(id, timestamp)

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: 'upload_failed', detail: uploadErr.message },
      { status: 500 },
    )
  }

  // Prune
  try {
    const { data: list } = await supabase.storage.from(BUCKET).list(id, {
      sortBy: { column: 'name', order: 'desc' },
    })
    const old = (list ?? []).slice(KEEP_LATEST)
    if (old.length > 0) {
      await supabase.storage.from(BUCKET).remove(old.map((o) => `${id}/${o.name}`))
    }
  } catch (err) {
    console.error('[campaign pdf prune]', err)
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) {
    return NextResponse.json(
      { ok: false, error: 'sign_failed', detail: signErr?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    path,
    generatedAt: new Date(timestamp).toISOString(),
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const can = await canReadCampaign(user, { id, owner_id: null })
  if (!can) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path) {
    return NextResponse.json({ ok: false, error: 'missing_path' }, { status: 400 })
  }
  // Path prefix guard
  if (!path.startsWith(`${id}/`)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const supabase = admin()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'sign_failed', detail: error?.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, signedUrl: data.signedUrl, path })
}
```

- [ ] **Step 3: Creează app/api/campaigns/report-pdf/route.ts**

Fișier nou:

```ts
// /api/campaigns/report-pdf
//   POST { monthFrom?, monthTo?, statuses?, brand?, owner?, q? }
//   → fetch filtered campaigns (limit 100), generate summary PDF, upload,
//     prune _reports/ to 10 latest, return signed URL.
//
// Path A scoping: requireWriter (owner/manager/account/intern din writer-list).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireWriter } from '@/lib/auth/require'
import { getCurrentUser } from '@/lib/auth/scope'
import { listCampaigns } from '@/lib/campaigns/search'
import {
  generateCampaignReportPDF,
  getCampaignReportStoragePath,
  type ReportCampaign,
  type ReportFilters,
} from '@/lib/campaigns/pdf-report'

const BUCKET = 'campaign-pdfs'
const REPORTS_PREFIX = '_reports'
const KEEP_LATEST = 10
const SIGNED_URL_TTL_SECONDS = 60 * 60
const MAX_CAMPAIGNS = 100

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type Body = {
  monthFrom?: string | null
  monthTo?: string | null
  statuses?: string[]
  brand?: string | null
  owner?: string | null
  q?: string | null
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    // empty body OK — toate filtre null = toate campaniile (cu cap 100)
  }

  // Fetch up to MAX_CAMPAIGNS+1 ca să detectăm depăşirea limitei.
  const supabase = admin()
  // listCampaigns are pageSize fix; iterăm dacă e nevoie. Pentru simplitate
  // şi limita 100, facem 5 page-uri × 20 până ajungem la MAX_CAMPAIGNS.
  const collected: ReportCampaign[] = []
  let page = 1
  const pageSize = 20
  while (collected.length < MAX_CAMPAIGNS + 1 && page <= 6) {
    const res = await listCampaigns({
      q: body.q ?? null,
      statuses: body.statuses ?? [],
      brand: body.brand ?? null,
      owner: body.owner ?? null,
      monthFrom: body.monthFrom ?? null,
      monthTo: body.monthTo ?? null,
      page,
      user,
    })
    for (const c of res.items) {
      collected.push({
        id: c.id,
        name: c.name,
        status: c.status,
        start_date: c.start_date,
        end_date: c.end_date,
        total_budget: c.total_budget,
        brand_name: c.brand?.name ?? null,
        participants_count: 0, // populat în pasul următor
      })
    }
    if (res.items.length < pageSize) break
    page++
  }

  if (collected.length > MAX_CAMPAIGNS) {
    return NextResponse.json(
      {
        ok: false,
        error: 'too_many_campaigns',
        limit: MAX_CAMPAIGNS,
        message: `Filtrele curente returnează peste ${MAX_CAMPAIGNS} campanii. Restrângeţi filtrele.`,
      },
      { status: 422 },
    )
  }

  // Populate participants_count
  if (collected.length > 0) {
    const ids = collected.map((c) => c.id)
    const { data: counts } = await supabase
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', ids)
    const countMap = new Map<string, number>()
    for (const row of counts ?? []) {
      const cid = (row as { campaign_id: string }).campaign_id
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1)
    }
    for (const c of collected) {
      c.participants_count = countMap.get(c.id) ?? 0
    }
  }

  // Resolve brand/owner names for cover summary
  let brandName: string | null = null
  let ownerName: string | null = null
  if (body.brand) {
    const { data } = await supabase.from('brands').select('name').eq('id', body.brand).maybeSingle<{ name: string }>()
    brandName = data?.name ?? null
  }
  if (body.owner) {
    const { data } = await supabase.from('team_members').select('name').eq('id', body.owner).maybeSingle<{ name: string }>()
    ownerName = data?.name ?? null
  }

  const filters: ReportFilters = {
    monthFrom: body.monthFrom ?? null,
    monthTo: body.monthTo ?? null,
    statuses: body.statuses ?? [],
    brandName,
    ownerName,
    search: body.q ?? null,
  }

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateCampaignReportPDF(collected, filters)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { ok: false, error: 'pdf_render_failed', detail },
      { status: 500 },
    )
  }

  const timestamp = Date.now()
  const path = getCampaignReportStoragePath(timestamp, body.monthFrom ?? null, body.monthTo ?? null)

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: 'upload_failed', detail: uploadErr.message },
      { status: 500 },
    )
  }

  // Prune _reports/
  try {
    const { data: list } = await supabase.storage.from(BUCKET).list(REPORTS_PREFIX, {
      sortBy: { column: 'name', order: 'desc' },
    })
    const old = (list ?? []).slice(KEEP_LATEST)
    if (old.length > 0) {
      await supabase.storage.from(BUCKET).remove(old.map((o) => `${REPORTS_PREFIX}/${o.name}`))
    }
  } catch (err) {
    console.error('[report pdf prune]', err)
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) {
    return NextResponse.json(
      { ok: false, error: 'sign_failed', detail: signErr?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    path,
    count: collected.length,
    generatedAt: new Date(timestamp).toISOString(),
  })
}
```

- [ ] **Step 4: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors. Dacă `canReadCampaign` signature nu match-uieşte (folosesc placeholder `{ id, owner_id: null }`), citeşte `lib/auth/scope.ts` şi ajustează apelul în GET handler conform semnăturii reale.

- [ ] **Step 5: Verifică lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit API routes**

```bash
git add app/api/campaigns/[id]/pdf/route.ts app/api/campaigns/report-pdf/route.ts
git commit -m "feat(api/campaigns): rute PDF single (POST/GET) + bulk report (POST) cu Storage"
```

---

## Task 6: UI — button single + month picker + bulk export button

**Files:**
- Create: `app/campaigns/[id]/campaign-pdf-button.tsx`
- Modify: `app/campaigns/[id]/detail-ui.tsx` (integrare buton)
- Modify: `app/campaigns/campaigns-ui.tsx` (month picker + bulk button + state)

**Context:** Reutilizăm pattern-ul `RateCardPdfButton` (read `app/influencers/[id]/rate-card-pdf-button.tsx` ca template). State machine: idle → loading → success (open URL) → idle, sau error message inline.

- [ ] **Step 1: Read pattern existent**

Read: `app/influencers/[id]/rate-card-pdf-button.tsx` integral.

- [ ] **Step 2: Creează app/campaigns/[id]/campaign-pdf-button.tsx**

Fișier nou:

```tsx
'use client'

import { useState } from 'react'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

export function CampaignPdfButton({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function exportPdf() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pdf`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        signedUrl?: string
        error?: string
        detail?: string
      }
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener')
        setState({ kind: 'idle' })
        return
      }
      const msg = data.detail || data.error || 'eroare necunoscută'
      setState({ kind: 'error', message: msg })
      setTimeout(() => setState({ kind: 'idle' }), 5000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'eroare reţea'
      setState({ kind: 'error', message })
      setTimeout(() => setState({ kind: 'idle' }), 5000)
    }
  }

  if (state.kind === 'error') {
    return (
      <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
        {state.message}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      disabled={state.kind === 'loading'}
      className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-60"
    >
      {state.kind === 'loading' ? 'Generez PDF...' : 'Export PDF'}
    </button>
  )
}
```

- [ ] **Step 3: Integrează butonul în detail-ui.tsx**

În `app/campaigns/[id]/detail-ui.tsx`, import-uri (după linia 5):

```tsx
import { CampaignPdfButton } from './campaign-pdf-button'
```

În JSX-ul header-ului, după `<button>Edit</button>` și înainte de butoanele status (linia ~106):

```tsx
<CampaignPdfButton campaignId={campaign.id} />
```

- [ ] **Step 4: Adaugă month picker în FilterBar (campaigns-ui.tsx)**

În `app/campaigns/campaigns-ui.tsx`, găseşte tipul `Filters` şi adaugă:

```ts
monthFrom: string | null
monthTo: string | null
```

În FilterBar, după state-urile existente, adaugă:

```ts
const [monthFrom, setMonthFrom] = useState<string>(filters.monthFrom ?? '')
const [monthTo, setMonthTo] = useState<string>(filters.monthTo ?? '')

function commitMonths() {
  onApply({
    monthFrom: monthFrom || null,
    monthTo: monthTo || null,
  })
}
```

În JSX-ul FilterBar, undeva în rândul de filtre (lângă status sau ca rând separat), adaugă:

```tsx
<input
  type="month"
  value={monthFrom}
  onChange={(e) => setMonthFrom(e.target.value)}
  onBlur={commitMonths}
  placeholder="De la luna"
  className={inputCls}
  aria-label="De la luna"
/>
<input
  type="month"
  value={monthTo}
  onChange={(e) => setMonthTo(e.target.value)}
  onBlur={commitMonths}
  placeholder="Până la luna"
  className={inputCls}
  aria-label="Până la luna"
/>
```

Locul exact: după chips-urile de status în FilterBar, ca rând nou. Adapt structura HTML după convenția existentă.

- [ ] **Step 5: Serialize month în pushFilters**

În `pushFilters`, după filtrele existente, înainte de page:

```ts
if (merged.monthFrom) params.set('month_from', merged.monthFrom)
if (merged.monthTo) params.set('month_to', merged.monthTo)
```

- [ ] **Step 6: Reset month în reset()**

În funcția `reset()`, înlocuieşte sau extinde apelul `onApply` ca să includă:

```ts
setMonthFrom('')
setMonthTo('')
// ... şi în onApply object:
monthFrom: null,
monthTo: null,
```

- [ ] **Step 7: Adaugă buton "Export raport PDF" în top-bar**

În CampaignsUI, găseşte FilterBar `<button>+ Adaugă campanie</button>` şi adaugă alături un buton bulk export. Dacă FilterBar e separat de top-bar, plasează în CampaignsUI top, lângă pagination sau în header.

Adaugă state în CampaignsUI:

```tsx
const [reportState, setReportState] = useState<{ kind: 'idle' | 'loading' } | { kind: 'error'; message: string }>({ kind: 'idle' })

async function exportReport() {
  setReportState({ kind: 'loading' })
  try {
    const res = await fetch('/api/campaigns/report-pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: initialFilters.q,
        statuses: initialFilters.statuses,
        brand: initialFilters.brand,
        owner: initialFilters.owner,
        monthFrom: initialFilters.monthFrom,
        monthTo: initialFilters.monthTo,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean; signedUrl?: string; error?: string; detail?: string; message?: string
    }
    if (res.ok && data.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener')
      setReportState({ kind: 'idle' })
      return
    }
    setReportState({ kind: 'error', message: data.message || data.detail || data.error || 'eroare necunoscută' })
    setTimeout(() => setReportState({ kind: 'idle' }), 5000)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'eroare reţea'
    setReportState({ kind: 'error', message })
    setTimeout(() => setReportState({ kind: 'idle' }), 5000)
  }
}
```

Şi buton lângă "+ Adaugă campanie":

```tsx
<button
  type="button"
  onClick={exportReport}
  disabled={reportState.kind === 'loading'}
  className="h-11 px-4 rounded-md border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 whitespace-nowrap shrink-0 disabled:opacity-60"
>
  {reportState.kind === 'loading' ? 'Generez raport...' : 'Export raport PDF'}
</button>
{reportState.kind === 'error' && (
  <span className="text-xs text-rose-700">{reportState.message}</span>
)}
```

- [ ] **Step 8: Update app/campaigns/page.tsx să paseze month la initialFilters**

În `app/campaigns/page.tsx`, asigură-te că `filters` (sau echivalent) include monthFrom + monthTo (din Task 2 Step 4). Pasează la `<CampaignsUI initialFilters={filters} ...>`.

- [ ] **Step 9: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 10: Verifică lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 11: Commit UI**

```bash
git add app/campaigns/[id]/campaign-pdf-button.tsx app/campaigns/[id]/detail-ui.tsx app/campaigns/campaigns-ui.tsx
git commit -m "feat(campaigns): UI Export PDF + month picker + Export raport PDF"
```

---

## Task 7: Verificare finală + push

**Files:**
- N/A (verification only)

- [ ] **Step 1: Build production**

Run: `pnpm run build`
Expected: success. Notează size-ul output.

- [ ] **Step 2: Smoke API local — single PDF**

`pnpm dev`. În browser dev tools console (după login):

```js
fetch('/api/campaigns/<id-campanie-existentă>/pdf', { method: 'POST' })
  .then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, signedUrl: 'https://...', path: '<id>/...', generatedAt: '...' }`. Deschide signedUrl în tab nou — vezi PDF cu cover + detalii + tabele.

- [ ] **Step 3: Smoke API local — bulk report**

```js
fetch('/api/campaigns/report-pdf', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ monthFrom: '2026-01', monthTo: '2026-12' }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, signedUrl: '...', count: N, ... }`. PDF cu cover interval + tabel.

- [ ] **Step 4: Push pe main**

```bash
git push origin main
```

- [ ] **Step 5: Verifică GHA deploy**

Run: `gh run list --limit 1 --workflow=deploy.yml --json databaseId,status,conclusion`

Folosește `gh run watch <id> --exit-status` să aştepţi finalizarea.

- [ ] **Step 6: Smoke live pe iPhone PWA**

- /campaigns: vezi 2 input-uri "De la luna" + "Până la luna" în FilterBar?
- Setează month_from = 2026-01, month_to = 2026-03 → lista filtrează corect?
- Buton "Export raport PDF" generează PDF cu interval afișat?
- Deschide o campanie cu participanţi → buton "Export PDF" în header → PDF cu 3-5 pagini?
- Filter combinat: status=active + month_from=2026-01 → raport conţine doar acele?

---

## Self-Review

**Spec coverage:**
- §2.1 Single PDF button + flow → Task 5 + Task 6
- §2.2 Month filter overlap → Task 2
- §2.3 Bulk export → Task 5 + Task 6
- §2.4 Single PDF content (cover/detalii/participanţi/livrabile/milestones) → Task 3
- §2.5 Bulk PDF content (cover interval + tabel) → Task 4
- §3 Migration 042 → Task 1
- §4 Backend changes → Task 2 + Task 5
- §5 UI changes → Task 6
- §8 DoD checklist → acoperit de toate task-urile + Task 7

**Placeholder scan:** Niciun TBD/TODO. Task 5 Step 4 zice "ajustează apelul în GET handler conform semnăturii reale" — acceptabil pentru că `canReadCampaign` semnătura e definită în cod existent (nu inventez), engineer-ul verifică un singur fişier şi adaptează. Task 6 Step 4 zice "adapt structura HTML după convenția existentă" — acceptabil pentru ajustări minore vizuale care nu schimbă logica.

**Type consistency:**
- `CampaignForPdf`, `ParticipantForPdf`, `DeliverableForPdf`, `MilestoneForPdf` definite în Task 3, folosite în Task 5 ✅
- `ReportCampaign`, `ReportFilters` definite în Task 4, folosite în Task 5 ✅
- `monthFrom`/`monthTo` (camelCase backend) ↔ `month_from`/`month_to` (snake_case URL) — Task 2 face mapping-ul explicit ✅
- `getCampaignPdfStoragePath`, `getCampaignReportStoragePath` folosite cross-task ✅

**Risk reminder:** spec §7 — limit hard 100 campanii în bulk (Task 5), prune auto pe storage (Task 5), filtru overlap explicit pentru NULL end_date (Task 2).

**Migration ordering:** Task 1 (migration storage) → Task 5 (API foloseşte BUCKET). Toate task-urile UI după Task 5 (API gata). Plan respectă această ordine.
