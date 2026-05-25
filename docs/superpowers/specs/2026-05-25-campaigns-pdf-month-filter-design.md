# Sprint 15 — Faza 3 §11: Export PDF campanii + filtrare pe luni

**Data:** 2026-05-25
**Sursă:** `Influence_Room_prompt_actualizat.docx`, secțiunea 11 ("Export campanie în PDF și selecție pe luni")
**Scop:** Trei sub-features pe modulul Campanii — buton "Export PDF" pe campanie individuală, filtrare pe luni în lista campanii, buton "Export raport PDF" pentru lista filtrată (summary).

---

## 1. Context

Echipa Influence Room are nevoie să trimită campanii client-ilor și să facă arhivă lunară/trimestrială fără să copieze manual datele. Avem deja pattern-ul de PDF din Sprint 13b (rate cards — `lib/rate-cards/pdf-generator.ts`) cu `pdf-lib`, branding burnt-amber/serif, signed URL 1h și prune-to-N pe Supabase Storage. Reutilizăm scaffold-ul, schimbăm doar conținutul.

Decizii confirmate cu Stefan (2026-05-25):
- **Scope**: tot §11 într-o singură fază (single PDF + month filter + bulk summary PDF)
- **Filtru luni**: overlap (o campanie 15 ian → 10 feb apare în AMBELE luni)
- **Month picker UX**: 2 input-uri `<input type="month">` (range YYYY-MM)
- **Single PDF content**: complet (cover + brief + participanți + livrabile + milestones)
- **Bulk PDF content**: summary 1-2 pagini cu cover interval + tabel one-row-per-campaign

## 2. Cerințe funcționale

### 2.1 Export PDF campanie individuală

Buton "Export PDF" în header-ul `/campaigns/[id]`, lângă "Edit". Componentă similară cu `RateCardPdfButton`:
- Idle: buton text "Export PDF"
- Loading: spinner inline cu text "Se generează..."
- Success: deschide signed URL în tab nou
- Error: afișează mesaj scurt în loc de buton 5 secunde, apoi revine la idle

Comportament backend (`POST /api/campaigns/[id]/pdf`):
1. Authz Path A: `requireCampaignWriter(id)`
2. Fetch campaign + brand + owner (din join existent)
3. Fetch `campaign_participants` cu influencer join
4. Fetch `campaign_deliverables` cu participant join
5. Fetch `campaign_milestones`
6. `generateCampaignPDF()` produce bytes
7. Upload la `campaign-pdfs/<campaign_id>/<timestamp>-campaign.pdf`
8. Prune la 5 cele mai recente per campanie
9. Returnează `{ ok, signedUrl, path, generatedAt }`

Re-sign: `GET /api/campaigns/[id]/pdf?path=...` cu `canReadCampaign` + guard că `path` începe cu `<campaign_id>/`.

### 2.2 Filtru lunar pe lista campanii

În FilterBar de pe `/campaigns`, 2 input-uri noi:
- "De la luna" — `<input type="month">` (format YYYY-MM)
- "Până la luna" — același

URL params: `?month_from=2026-01&month_to=2026-03`

Logică overlap pe backend (`lib/campaigns/search.ts`):
- Calcul intervale: `from_start = month_from + '-01'`, `to_end = ultima zi a month_to` (folosim `date_trunc('month', date) + interval '1 month - 1 day'` în SQL)
- Filtru: `campaign.start_date <= to_end AND (campaign.end_date >= from_start OR campaign.end_date IS NULL)`
- Campaniile cu `start_date IS NULL` sunt EXCLUSE (nu pot determina apartenența)
- Campaniile cu `end_date IS NULL` (ongoing) sunt INCLUSE dacă `start_date <= to_end`

Edge cases:
- Doar `month_from` setat → echivalent cu "din luna X înainte" (`to_end = NULL`, devine no-op)
- Doar `month_to` setat → "până în luna Y" (`from_start = NULL`, devine no-op pe partea stângă)
- `month_from > month_to` → rezultate 0 (validat client-side cu mesaj, dar backend acceptă)
- Reset filtre → goleste ambele input-uri

### 2.3 Bulk export raport PDF

Buton "Export raport PDF" în top-bar `/campaigns`, lângă "+ Adaugă campanie". Vizibil întotdeauna, dar exportă DOAR campaniile potrivite filtrelor curente (incluse month filter + status + brand + owner + search).

Backend `POST /api/campaigns/report-pdf`:
1. Authz: `requireWriter` (owner/manager/account)
2. Citește filtrele din body (same shape ca URL params)
3. `listCampaigns()` cu acele filtre, `page` ignorat (returnăm toate până la max 100)
4. Dacă `total > 100` → 422 cu `error: 'too_many_campaigns'` și mesaj clar
5. `generateCampaignReportPDF(campaigns, range, filters)` produce bytes
6. Upload la `campaign-pdfs/_reports/<timestamp>-<from>-<to>.pdf` (sau `_reports/<timestamp>-all.pdf` dacă nu e month range)
7. Prune la 10 cele mai recente în `_reports/`
8. Returnează signed URL

UX: buton deschide signed URL în tab nou (similar single PDF). Loading state vizibil "Generăm raportul..." cu spinner.

### 2.4 Conținut PDF single campanie

Reutilizăm paleta brand + fonturi din `lib/rate-cards/pdf-generator.ts` (Times/Helvetica/Courier, COLORS.brand burnt amber, COLORS.obsidian, COLORS.textMuted).

**Cover** (pagina 1):
- Wordmark Influence Room top-left
- "RAPORT CAMPANIE" right-aligned, text mic uppercase
- Nume campanie centrat, font mare 36pt (auto-shrink la 24pt dacă > content width)
- Linie brand-amber accent
- Brand sub nume: "pentru <brand_name>"
- Perioadă centrat: "15 ian 2026 – 10 mar 2026" (sau "din 15 ian 2026" dacă end null)
- Status badge cu culoare per status
- "Generat la <data>" footer

**Detalii** (pagina 2):
- Heading "Detalii"
- Grid 2-col cu pairs: Status, Owner, Buget total, Deliverables count, Început, Final
- Heading "Brief"
- Brief text wrapped (max 3000 caractere; truncate cu "..." dacă mai lung)

**Participanți** (pagina 3 sau continuare):
- Heading "Participanți (N)"
- Tabel: Nume influencer | Platformă | Handle | Status | Fee (€)
- Border subtil, rânduri zebra, paginare auto dacă >15 rânduri
- Sub tabel: "Total fee: X €"

**Livrabile** (pagina 4 sau continuare):
- Heading "Livrabile (N)"
- Tabel: Influencer | Tip | Qty | Data post | Status | Link (dacă published)
- Status badge color-coded

**Milestones** (pagina 5 sau continuare):
- Heading "Etape (N)"
- Tabel: Tip | Deadline | Responsabil | Completat la | Note

**Footer** pe fiecare pagină:
- "© 2026 Influence Room" + wordmark mic + numărul paginii right-aligned

### 2.5 Conținut PDF bulk raport

**Cover** (pagina 1):
- Wordmark
- Titlu "RAPORT CAMPANII"
- Interval centrat (ex: "Ianuarie 2026 – Martie 2026" sau "Toate campaniile" dacă fără filtru lună)
- Filtre aplicate listate sub interval (ex: "Status: Active, Draft · Brand: Coca-Cola")
- "Total: N campanii" — count vizibil
- Generat la <data>

**Summary** (pagina 2+):
- Tabel one-row-per-campaign:
  - Nume | Brand | Status | Perioadă | # Participanți | Buget (€)
- Paginare auto la 25 rânduri/pagină
- Footer total general: "Total general: X campanii · Buget cumulat: Y €"

## 3. Migration 042

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-pdfs',
  'campaign-pdfs',
  false,
  10 * 1024 * 1024, -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Defence-in-depth policies. Server-side codul foloseşte service_role
-- şi bypass-uieşte RLS (Path A) — la fel ca rate-cards.
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

## 4. Schimbări backend

### 4.1 `lib/campaigns/search.ts`

Adaugă param-i:
```ts
export type CampaignSearchParams = {
  ...
  monthFrom?: string | null  // YYYY-MM
  monthTo?: string | null    // YYYY-MM
  ...
}
```

În `listCampaigns()`, după filtrele existente:
```ts
const monthFrom = p.monthFrom && /^\d{4}-\d{2}$/.test(p.monthFrom) ? p.monthFrom : null
const monthTo = p.monthTo && /^\d{4}-\d{2}$/.test(p.monthTo) ? p.monthTo : null

if (monthFrom) {
  const fromStart = `${monthFrom}-01`
  // campaign.end_date >= fromStart OR end_date IS NULL
  query = query.or(`end_date.gte.${fromStart},end_date.is.null`)
}
if (monthTo) {
  // last day of monthTo: parse "YYYY-MM", add 1 month, subtract 1 day
  const [y, m] = monthTo.split('-').map(Number)
  const nextMonth = m === 12 ? new Date(y + 1, 0, 1) : new Date(y, m, 1)
  nextMonth.setDate(nextMonth.getDate() - 1)
  const toEnd = nextMonth.toISOString().slice(0, 10)
  query = query.lte('start_date', toEnd)
}
// Exclude campaigns without start_date when month filter active
if (monthFrom || monthTo) {
  query = query.not('start_date', 'is', null)
}
```

### 4.2 `app/campaigns/page.tsx`

Parse URL params `month_from` + `month_to`, pasează la `listCampaigns`.

### 4.3 `lib/campaigns/pdf-single.ts` (nou)

Export `generateCampaignPDF(campaign, participants, deliverables, milestones): Promise<Uint8Array>`. Asincron pentru `PDFDocument.create`/`embedFont`. Reutilizează `COLORS` și wordmark din rate-cards (mutat în `lib/ui/brand-assets.ts` sau duplicat — ne decidem la execuție).

### 4.4 `lib/campaigns/pdf-report.ts` (nou)

Export `generateCampaignReportPDF(campaigns, range, filters): Promise<Uint8Array>`. Tabel paginare automată.

### 4.5 API routes

**`app/api/campaigns/[id]/pdf/route.ts` (nou):**
- POST: generate + upload + prune + sign
- GET: re-sign existing path

**`app/api/campaigns/report-pdf/route.ts` (nou):**
- POST: filter + generate + upload + prune + sign
- Limit hard 100 campaigns; >100 → 422

## 5. Schimbări UI

### 5.1 `app/campaigns/[id]/detail-ui.tsx`

Buton nou "Export PDF" în header actions, după "Edit", înainte de butoanele de status. Component nou `<CampaignPdfButton campaignId={...} />` în `app/campaigns/[id]/campaign-pdf-button.tsx` cu state idle/loading/success/error (copy din `RateCardPdfButton`).

### 5.2 `app/campaigns/campaigns-ui.tsx`

**FilterBar:**
- 2 input-uri `<input type="month">` într-un nou rând sub Row 2 (sau în Row 2 dacă spațiu)
- State `monthFrom`/`monthTo`, onBlur trigger commit ca `commitRange`

**Top bar:**
- Buton "Export raport PDF" lângă "+ Adaugă campanie" (canCreate users)
- Apel `POST /api/campaigns/report-pdf` cu filtrele curente din state

**`pushFilters`:**
- Adaugă serializare month_from / month_to

## 6. Non-goals

- ❌ PDF customization per campanie (logo brand client, template-uri custom)
- ❌ Email PDF direct din app (user descarcă manual, trimite via Missive/email)
- ❌ Audit log pentru export-uri PDF (separat dacă echipa cere)
- ❌ Sortare în PDF (folosim ordinea din lista filtrată)
- ❌ Preview PDF în iframe înainte de download (simplu open în tab nou)
- ❌ Edit PDF după export (regenerează dacă datele s-au schimbat)

## 7. Risc & mitigare

| Risc | Mitigare |
|------|----------|
| Worker bundle crește cu pdf-lib | Deja inclus pentru rate cards; reutilizare, nu re-bundle |
| PDF mare pentru campanii cu 50+ livrabile | Paginare auto + zebra rows + page-break la N rânduri |
| Bulk export pe 100 campanii consum CPU | Limit hard 100 + mesaj clar; alternative: paginare PDF |
| Filtru overlap cu end_date NULL inconsistent | Tratat explicit ca "ongoing" → inclus dacă start <= to_end |
| Storage bucket umflat de export-uri vechi | Prune la 5 latest/campanie + 10 latest/_reports |
| User concurrent export → race conditions | Storage path are timestamp; nu colide |
| PDF render fail în Worker | Try/catch în route, returnează 500 cu detail, UI fallback la mesaj |

## 8. Definition of done

- [ ] Migration 042 aplicată în prod (bucket + 3 policies)
- [ ] `lib/campaigns/search.ts` cu `monthFrom`/`monthTo` + overlap logic
- [ ] `app/campaigns/page.tsx` parse URL params
- [ ] `lib/campaigns/pdf-single.ts` cu generator funcțional
- [ ] `lib/campaigns/pdf-report.ts` cu generator summary
- [ ] `app/api/campaigns/[id]/pdf/route.ts` POST + GET
- [ ] `app/api/campaigns/report-pdf/route.ts` POST cu limit 100
- [ ] `app/campaigns/[id]/campaign-pdf-button.tsx` componentă
- [ ] FilterBar: 2 input-uri month + state + serialize
- [ ] Top bar: buton "Export raport PDF"
- [ ] `pnpm run typecheck` + `pnpm run lint` clean
- [ ] `pnpm run build` clean, bundle size verificat
- [ ] Smoke: 1 PDF single + 1 PDF bulk generate cu succes pe local
- [ ] Commit-uri logice + push + GHA deploy verificat
- [ ] Smoke live pe iPhone PWA

## 9. Out of scope (next phases)

- **Faza 4 (deferred):** Sprint 11 Reporting (mapping date din PDF/Excel/CSV pe câmpuri KPI), Sprint 12 Missive
- **Faza 2b (pending):** §4 quick-win pe listă (links clickable, badge-uri platforme, ER badges)
- **Refuzat:** §9 self-service PIN reset (status quo)
