# Sprint 11 Faza A — Reporting: upload rapoarte + manual KPI

**Data:** 2026-05-25
**Sursă:** `Influence_Room_prompt_actualizat.docx`, secțiunea 5 ("Cerințe tehnice și funcționale") — bullet-urile despre rapoarte și KPI.
**Scop:** Adaugă upload rapoarte (PDF/Excel/CSV/screenshot) per participant cu metadata + entry manuală pe câmpuri KPI standard, plus istoricul cross-context (per campanie + per influencer). Zero auto-extract în această fază.

---

## 1. Context

Sprint 11 Reporting acoperă trei sub-features distincte:
1. **Faza A (acest spec)** — upload + manual KPI entry
2. **Faza B (deferred)** — auto-extract din CSV/Excel cu mapping configurabil
3. **Faza C (deferred)** — OCR PDF/screenshot

Decizia de a sparge în faze ține de scope cap: full pipeline (auto-extract + OCR) costă 5-7 zile + cost recurent API (OpenAI Vision). Faza A livrează valoarea de bază (echipa salvează rapoartele brute + extrage manual KPI) într-o zi-două, fără infrastructure cost.

Decizii confirmate cu Stefan (2026-05-25 brainstorming):
- **Scope**: Faza 11a strict (upload + manual)
- **KPI shape**: set unificat fix (7 câmpuri standard, toate optionale, numeric)
- **Domeniu raport**: per (influencer × campanie) — FK obligatoriu la `campaign_participants` (care leagă deja influencer + platform + campanie)

Pattern-uri reutilizate din proiect:
- Storage bucket + signed URLs (Sprint 13b `rate-cards`, Sprint 14b PDF, Sprint 15 `campaign-pdfs`)
- Path A scoping (`requireWriter` + `canReadCampaign`)
- Best-effort error handling în endpoint-uri

## 2. Cerințe funcționale

### 2.1 Upload raport per participant

User-ul (owner / manager / account assigned) deschide modal-ul `<ReportUploadModal>` dintr-un context care leagă la un participant specific (`/campaigns/[id]` tab "Rapoarte" → buton "+ Upload raport" per participant card).

Modal acceptă:
- **File input**: click-to-upload (drag-drop optional pentru first-pass). Whitelist MIME server-side: `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/vnd.ms-excel` (xls), `text/csv`, `image/png`, `image/jpeg`, `image/webp`. Limita 10MB enforce la bucket level + UI validate înainte de POST.
- **7 KPI inputs** numerice, toate optionale: `kpi_views`, `kpi_reach`, `kpi_engagement` (likes + comments + shares aggregate), `kpi_saves`, `kpi_profile_visits`, `kpi_link_clicks`, `kpi_watch_time_sec`
- **Notes** textarea pentru observații libere
- **Submit** button: single POST multipart cu file + metadata + KPI

Flow:
1. UI validate (file present + < 10MB + KPI fields all numeric or empty)
2. POST `/api/reports/upload` cu FormData
3. Backend: upload file la Storage, INSERT DB row, return raport complet cu signed URL
4. UI: close modal + refresh list

### 2.2 Edit raport existent

Click pe row în lista de rapoarte → modal Edit:
- File-ul nu se schimbă (re-upload = șterge + creează nou)
- KPI fields + notes editabile
- Submit → PATCH `/api/reports/[id]`
- `updated_by` + `updated_at` se actualizează

### 2.3 Delete raport

Buton delete pe row (cu confirm modal reutilizat `<ConfirmModal>`) → DELETE `/api/reports/[id]`:
- DB row delete (CASCADE pe relations cleanup automat)
- Storage file delete best-effort (eșec → log warning, DB row deja dispărut)

### 2.4 Listare rapoarte

Două context-uri:

**Per campanie** (`/campaigns/[id]` tab "Rapoarte"):
- Grup pe participant (un card per influencer × platform)
- Sub fiecare card: lista rapoartelor (newest first, max 10 vizibile, "Vezi toate" pentru extindere)
- Buton "+ Upload" per card

**Per influencer** (`/influencers/[id]` section "Rapoarte campanii"):
- Lista cross-campanii a rapoartelor pentru acest influencer
- Last 20 sortate desc
- Coloana extra "Campanie" cu link la `/campaigns/[id]`

### 2.5 Download fișier

Click pe `file_name` → fetch signed URL via `GET /api/reports/[id]/file` → window.open în tab nou.

Alternativ, lista include signed URL direct în response (TTL 1h) pentru click direct fără API call extra.

### 2.6 KPI display

Pe row în listă:
- Coloana "KPI" cu summary compact: `R 12.5K · E 850 · V 8.2K` (Reach · Engagement · Views) când sunt prezente
- `—` când lipsesc complet
- Tooltip cu toate cele 7 fields pe hover

## 3. Migration 045

```sql
-- Sprint 11 Faza A: storage bucket + table pentru rapoarte campanie.
--
-- Bucket privat 10MB cu MIME whitelist. Path: report-uploads/<participant_id>/<timestamp>-<filename>.
-- Tabel denormalizează campaign_id + influencer_id pentru query rapid + retenție
-- după delete participant (SET NULL acolo, CASCADE pe participant_id pentru cleanup).

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
  'Rapoarte încărcate per (influencer × campanie). KPI manual entry în faza A; auto-extract în faza B+.';
```

Denormalizare `campaign_id` + `influencer_id`:
- Fill-uite în `POST /api/reports/upload` din participant fetch (un singur round-trip)
- CASCADE pe `participant_id` → cleanup automat când participantul e șters
- SET NULL pe celelalte → istoric păstrat chiar dacă campania e ștearsă (rar; raportul rămâne ca artefact)

## 4. Backend API

### 4.1 `POST /api/reports/upload`

```
Content-Type: multipart/form-data
Body:
  file: File (max 10MB, MIME whitelist)
  participant_id: uuid (obligatoriu)
  kpi_views: int? | empty
  kpi_reach: int? | empty
  ...alte 5 KPI
  notes: string? | empty
```

Flow:
1. `requireWriter` (denied → 401/403 din helper)
2. Parse FormData
3. Fetch participant + campaign + influencer pentru scope check + denormalizare:
   ```ts
   const { data: participant } = await supabase
     .from('campaign_participants')
     .select('id, campaign_id, influencer_id, campaign:campaigns(owner_id)')
     .eq('id', participantId)
     .maybeSingle()
   ```
4. Scope check: `canReadCampaign(user, { owner_id: participant.campaign.owner_id })` → 404 dacă out-of-scope (Path A)
5. Validate file (size + MIME)
6. Upload file la Storage: path = `${participantId}/${Date.now()}-${file.name}` (normaliza filename: strip non-ASCII, max 100 chars)
7. INSERT row în `report_uploads` cu file metadata + KPI + denormalizate
8. Dacă INSERT eșuează → cleanup Storage upload (best-effort)
9. Return `{ ok, report, signedUrl }` (signed URL TTL 1h)

### 4.2 `PATCH /api/reports/[id]`

```ts
Body: { kpi_views?, kpi_reach?, ..., notes? }
```

1. Fetch raport + participant + campaign owner_id
2. `requireWriter` + scope check
3. Validate KPI values (numeric ≥ 0 sau null)
4. UPDATE row cu fields prezente + `updated_by` + `updated_at = now()`
5. Return `{ ok, report }`

### 4.3 `DELETE /api/reports/[id]`

1. Fetch raport + scope check
2. Storage delete (best-effort)
3. DB delete
4. Return `{ ok }`

### 4.4 `GET /api/reports`

Query params (exact 1 din cele 3 obligatoriu):
- `?participant_id=<uuid>` — lista pentru un participant specific
- `?campaign_id=<uuid>` — toate rapoartele dintr-o campanie (grup logic pe participant în UI)
- `?influencer_id=<uuid>` — cross-campanii pentru un influencer

Limit 20 pe response, sort `uploaded_at DESC`.

Path A scoping:
- `participant_id` → fetch participant.campaign.owner_id → `canReadCampaign`
- `campaign_id` → fetch owner_id direct → `canReadCampaign`
- `influencer_id` → `canReadInfluencer`

Response include signed URL pentru fiecare entry (TTL 1h).

### 4.5 `GET /api/reports/[id]/file?path=...`

Re-sign URL pentru download. Same Path A scoping ca PATCH. Path prefix guard: `path` trebuie să înceapă cu `<participant_id>/` (nu permitem cross-participant access).

## 5. UI components

### 5.1 `<ReportUploadModal>` (nou — `app/_components/report-upload-modal.tsx`)

Props:
```ts
{
  participantId: string
  participantLabel: string  // pentru context (ex: "Theo Rose · instagram")
  onClose: () => void
  onUploaded: (report: ReportEntry) => void  // pentru refresh parent list
}
```

State machine: `idle` → `uploading` → (`success` | `error`) → close/reset.

JSX:
- Header: "Upload raport — {participantLabel}"
- File input cu live preview (filename + size + "Schimbă" button)
- Grid 2-col cu 7 KPI inputs numerice + labels RO
- Notes textarea
- Footer: Cancel + "Salvează" (disabled until file present)

### 5.2 `<ReportRow>` (nou — `app/_components/report-row.tsx`)

Props:
```ts
{
  report: ReportEntry
  showCampaign?: boolean  // true pe /influencers/[id] cross-campanii
  onEdit?: (report: ReportEntry) => void
  onDelete?: (report: ReportEntry) => void
}
```

Render row cu: file_name (link), KPI summary compact, uploaded_at relative, uploaded_by, action buttons (edit + delete).

### 5.3 `<ReportEditModal>` (nou)

Similar cu Upload modal dar:
- File input absent (read-only display nume + dimensiune)
- KPI + notes pre-populate cu valori curente
- Submit → PATCH

### 5.4 Tab "Rapoarte" pe `/campaigns/[id]`

Extinde `CampaignTabsShell` cu a 7-a tab (după "Istoric"):

```tsx
<TabsTrigger value="reports">Rapoarte</TabsTrigger>
<TabsContent value="reports">{reports}</TabsContent>
```

Component nou `<CampaignReportsTab campaignId={id} participants={participants}>`:
- Fetch `/api/reports?campaign_id=...` on mount
- Grup pe participant_id
- Pentru fiecare participant: card cu lista de rapoarte + buton "+ Upload"
- Empty card: "Niciun raport pentru acest participant"
- Modaluri open/close pentru upload + edit + delete

### 5.5 Section "Rapoarte campanii" pe `/influencers/[id]`

Component nou `<InfluencerReportsSection influencerId={id}>`:
- Fetch `/api/reports?influencer_id=...`
- Tabel cu coloane: File, Campanie (link), KPI, Uploaded, By
- Empty state: "Niciun raport pentru acest influencer"

## 6. Non-goals (Faza 11b+)

- ❌ Auto-extract CSV/Excel cu mapping → Faza 11b
- ❌ OCR PDF/screenshot → Faza 11c
- ❌ Bulk multi-file upload
- ❌ Drag-drop file (click-to-upload primary; drag-drop e quality-of-life pentru 11d)
- ❌ Auto-recalc scoring după upload (deconectat de scoring; manual rămâne primary)
- ❌ Versioning multiple per raport (re-upload = delete + create nou)
- ❌ Export raport KPI ca PDF separat (Faza 11d)
- ❌ Charts / vizualizări KPI (numerele brute pe row sunt suficiente acum)
- ❌ Audit log pentru upload/edit/delete raport (Faza 4b extensie)

## 7. Risc & mitigare

| Risc | Mitigare |
|------|----------|
| File mare → timeout Worker | 10MB limit bucket + UI validate pre-POST |
| MIME spoofing (.exe rebrandat .pdf) | Whitelist server cu MIME din content + magic bytes la upload Storage |
| Storage upload OK + DB INSERT fail → orphan file | Cleanup Storage în catch (best-effort log dacă cleanup eșuează) |
| Cross-participant data leak via path manipulation | Path prefix guard pe GET /file (`startsWith('<participant_id>/')`) |
| Filename cu caractere problematice (Unicode, /) | Normaliza la upload: strip non-ASCII, replace `/` cu `_`, truncate la 100 chars |
| Storage bucket umflat de rapoarte vechi | Manual cleanup ad-hoc; nu auto-prune (rapoartele sunt arhivă) |
| Concurrent upload pe acelaşi participant → collision | Path are timestamp `Date.now()` — improbabil race în beta cu 7 useri |

## 8. Definition of done

- [ ] Migration 045 aplicată (bucket + tabel + 3 indecși + 3 policies storage + 1 policy DB)
- [ ] POST /api/reports/upload funcţional cu multipart parsing
- [ ] PATCH /api/reports/[id] cu validare KPI
- [ ] DELETE /api/reports/[id] cu Storage cleanup
- [ ] GET /api/reports?participant_id|campaign_id|influencer_id cu Path A
- [ ] GET /api/reports/[id]/file pentru re-sign
- [ ] ReportUploadModal funcţional (file + KPI + notes)
- [ ] ReportEditModal funcţional
- [ ] Tab "Rapoarte" pe /campaigns/[id] cu grup per participant
- [ ] Section "Rapoarte campanii" pe /influencers/[id]
- [ ] Confirm modal pentru delete (reuse `<ConfirmModal>`)
- [ ] typecheck + lint + build clean
- [ ] Smoke: upload PDF cu KPI → vizibil pe ambele view-uri; edit KPI → vede valori noi; download → fişier deschis în tab nou; delete → row dispare + storage cleanup verified

## 9. Out of scope (next phases)

- **Faza 11b**: auto-extract CSV/Excel cu column mapping + manual override
- **Faza 11c**: OCR PDF/screenshot (Tesseract.js sau OpenAI Vision)
- **Faza 11d**: drag-drop + bulk upload + export raport
- **Sprint 12 Missive**: integrare email (separat)
