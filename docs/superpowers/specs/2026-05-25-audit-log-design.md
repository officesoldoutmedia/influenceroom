# Sprint 15 — Faza 4 §5 audit log pentru modificări importante

**Data:** 2026-05-25
**Sursă:** `Influence_Room_prompt_actualizat.docx`, secțiunea 5 ("Cerințe tehnice și funcționale"), bullet "Să existe audit minim pentru modificările importante".
**Scop:** Adaugă audit log pentru modificări cost (campaign budget + participant fee) și schimbări ponderi scoring, pe modelul pattern-urilor existente (`influencer_rate_card_history` + `influencer_score_history`).

---

## 1. Context

Audit-ul preliminar (Faza 0, Agent C raport) a confirmat:
- ✅ `influencer_rate_card_history` (migration 040, Sprint 14b)
- ✅ `influencer_score_history` (migration 033, Sprint 10)
- ✅ `scoring_settings.updated_by/at` (timestamp only, fără diff)
- ❌ Cost campaign (`campaigns.total_budget`) — fără audit
- ❌ Cost participant (`campaign_participants.agreed_fee`) — fără audit
- ❌ Diff complet pentru weights changes (doar timestamp existent)

Per cerința Oanei (§5 docul actualizat), audit minim e necesar pentru:
1. ~~upload raport~~ — deferred Sprint 11 Reporting
2. **modificare cost** — TO IMPLEMENT
3. modificare scor manual — ✅ EXISTĂ deja
4. **schimbare ponderi** — TO IMPLEMENT (extindem timestamp la diff complet)

Decizii confirmate cu Stefan (2026-05-25 brainstorming):
- **Scope strict §5**: doar cost + ponderi (brand/status/PIN într-o Fază 4b dacă echipa cere)
- **Cost history**: un singur tabel `campaign_cost_history` cu enum `cost_change_type` (`total_budget` | `agreed_fee`) și CHECK constraint pentru consistency
- **UI cost history**: tab nou "Istoric" pe `/campaigns/[id]` (extinde Tabs primitive existent)
- **UI weights history**: section nouă pe `/admin/scoring-settings`

## 2. Cerințe funcționale

### 2.1 Cost history per campanie

Orice modificare la:
- `campaigns.total_budget` (PATCH `/api/campaigns/[id]`)
- `campaign_participants.agreed_fee` (PATCH `/api/campaigns/[id]/participants/[pid]`)

Generează un rând în `campaign_cost_history` cu:
- `campaign_id` — obligatoriu
- `participant_id` — NULL pentru `total_budget`, NOT NULL pentru `agreed_fee` (CHECK constraint enforce)
- `cost_type` — enum value
- `amount_before` / `amount_after` — numeric (null acceptat când valoarea era nesetată)
- `changed_by` — JWT `x-user-id` (FK la team_members, SET NULL on delete)
- `changed_at` — timestamptz default now()

**Idempotency**: insert se face DOAR dacă `before !== after` (după update). Re-save fără modificare reală = no-op.

**Failure tolerance**: insert e best-effort. Try/catch în handler; eșec audit → `console.error('[campaign cost audit]', err)` dar response-ul principal rămâne success. Update-ul de bază nu poate fi blocat de audit failure.

### 2.2 Weights history scoring

PATCH `/api/admin/scoring-settings` generează rând în `scoring_settings_history` cu:
- `weights_before` JSONB (cele 6 `weight_*` pre-update)
- `weights_after` JSONB (cele 6 post-update)
- `changes` JSONB cu diff: `{ "weight_engagement_rate": { "old": 25, "new": 30 }, ... }` (doar criteriile schimbate)
- `changed_by` / `changed_at`

Insert doar când `changes` non-empty (sum diff > 0).

### 2.3 UI tab "Istoric" pe campanie

Pe `/campaigns/[id]`, adăugăm a 6-a opțiune în `<Tabs>` (după "Tasks"): "Istoric".

Component `<CampaignAuditTab campaignId={...}>` fetch `/api/campaigns/[id]/cost-history` și redă tabel:

| Tip | Influencer / Detaliu | De la | La | Modificat de | Când |
|-----|---------------------|-------|----|--------------|------|
| Buget | — | 1.000 € | 1.500 € | Oana T. | acum 2h |
| Fee | Theo Rose (Instagram) | 800 € | 900 € | Ramona R. | ieri 14:23 |

Sort newest first. Empty state: "Niciun istoric pentru această campanie".

Path A scoping: `canReadCampaign` pe GET — owner/manager + account managers pe campaniile lor. Aceeași logică ca restul tab-urilor.

### 2.4 UI section "Istoric ponderi" pe admin

Pe `/admin/scoring-settings`, sub form-ul cu sliders, section nouă:

```
Istoric modificări ponderi

| Criterii schimbate                              | Modificat de | Când       |
|-------------------------------------------------|--------------|------------|
| Engagement: 25 → 30, CPV: 20 → 15               | Stefan       | acum 3h    |
| Audiență RO: 20 → 25                            | Oana T.      | ieri 10:15 |
```

Top 10 entries. Empty state: "Ponderile nu au fost modificate".

Vizibil doar owner (admin page e oricum owner-gated via `requireOwner()`).

### 2.5 GET endpoint nou

`GET /api/campaigns/[id]/cost-history` returnează:
```ts
{
  ok: true,
  entries: [
    {
      id: '...',
      cost_type: 'total_budget' | 'agreed_fee',
      amount_before: number | null,
      amount_after: number | null,
      changed_at: 'iso',
      changed_by: { id, name } | null,
      participant: { id, account_handle, platform, influencer: { name } } | null,
    },
    ...
  ]
}
```

Sort `changed_at DESC`. Limit 50 (suficient pentru o campanie tipică).

Path A: `canReadCampaign` cu fetch `owner_id`.

Pentru weights history, fetch direct din `/admin/scoring-settings` page (server component) — niciun endpoint nou.

## 3. Migration 043 — campaign_cost_history

```sql
-- Sprint 15 Faza 4 §5: audit pentru modificările de cost (campaign budget + participant fee).
--
-- Pattern oglindit după influencer_rate_card_history (Sprint 14b) / influencer_score_history
-- (Sprint 10): append-only, one row per real change, idempotent (insert doar la diff real).
--
-- Single table cu enum cost_change_type acoperă ambele cazuri (budget la nivel campanie +
-- fee la nivel participant) cu CHECK constraint care enforce consistency:
--   total_budget → participant_id IS NULL
--   agreed_fee   → participant_id IS NOT NULL

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_change_type') THEN
    CREATE TYPE cost_change_type AS ENUM ('total_budget', 'agreed_fee');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS campaign_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES campaign_participants(id) ON DELETE CASCADE,
  cost_type cost_change_type NOT NULL,
  amount_before numeric,
  amount_after numeric,
  changed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (cost_type = 'total_budget' AND participant_id IS NULL)
    OR (cost_type = 'agreed_fee' AND participant_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cost_history_campaign
  ON campaign_cost_history(campaign_id, changed_at DESC);

ALTER TABLE campaign_cost_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_history_read_authn ON campaign_cost_history;
CREATE POLICY cost_history_read_authn ON campaign_cost_history
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE campaign_cost_history IS
  'Audit append-only pentru modificările de cost. Un rând per (campaign, cost_type, [participant]) per modificare reală.';
```

## 4. Migration 044 — scoring_settings_history

```sql
-- Sprint 15 Faza 4 §5: audit pentru schimbările ponderilor scoring.
--
-- Extinde `scoring_settings.updated_by/at` (timestamp only) cu snapshot complet
-- before/after + diff calculat în API. Pattern identic cu influencer_rate_card_history.
--
-- changes jsonb shape (computed în API):
--   { "weight_engagement_rate": { "old": 25, "new": 30 },
--     "weight_cpv": { "old": 20, "new": 15 } }

CREATE TABLE IF NOT EXISTS scoring_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weights_before jsonb,
  weights_after jsonb,
  changes jsonb,
  changed_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_settings_history_time
  ON scoring_settings_history(changed_at DESC);

ALTER TABLE scoring_settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scoring_settings_history_read_authn ON scoring_settings_history;
CREATE POLICY scoring_settings_history_read_authn ON scoring_settings_history
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE scoring_settings_history IS
  'Audit append-only pentru schimbările ponderilor scoring. Insert doar la diff real.';
```

## 5. Backend schimbări

### 5.1 `lib/campaigns/audit.ts` (nou)

```ts
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export type CostType = 'total_budget' | 'agreed_fee'

export async function logCostChange(params: {
  campaignId: string
  participantId?: string | null
  costType: CostType
  before: number | null
  after: number | null
  changedBy: string | null
}): Promise<void> {
  // Idempotency: skip insert dacă before === after
  if (params.before === params.after) return

  try {
    const supabase = admin()
    await supabase.from('campaign_cost_history').insert({
      campaign_id: params.campaignId,
      participant_id: params.participantId ?? null,
      cost_type: params.costType,
      amount_before: params.before,
      amount_after: params.after,
      changed_by: params.changedBy,
    })
  } catch (err) {
    console.error('[campaign cost audit]', err)
    // NU re-throw — update-ul principal nu trebuie blocat de audit failure
  }
}
```

### 5.2 `lib/scoring/audit.ts` (nou)

```ts
import { createClient } from '@supabase/supabase-js'

const WEIGHT_KEYS = [
  'weight_engagement_rate',
  'weight_cpv',
  'weight_audience_ro',
  'weight_punctuality',
  'weight_deliverable_quality',
  'weight_collaboration_history',
] as const

type WeightKey = (typeof WEIGHT_KEYS)[number]
export type Weights = Record<WeightKey, number>

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export function diffWeights(before: Weights, after: Weights): Record<string, { old: number; new: number }> {
  const changes: Record<string, { old: number; new: number }> = {}
  for (const k of WEIGHT_KEYS) {
    if (before[k] !== after[k]) {
      changes[k] = { old: before[k], new: after[k] }
    }
  }
  return changes
}

export async function logWeightsChange(params: {
  before: Weights
  after: Weights
  changedBy: string | null
}): Promise<void> {
  const changes = diffWeights(params.before, params.after)
  if (Object.keys(changes).length === 0) return // no-op pe save fără diferenţe

  try {
    const supabase = admin()
    await supabase.from('scoring_settings_history').insert({
      weights_before: params.before,
      weights_after: params.after,
      changes,
      changed_by: params.changedBy,
    })
  } catch (err) {
    console.error('[scoring weights audit]', err)
  }
}
```

### 5.3 Wrapping în PATCH endpoints

**`app/api/campaigns/[id]/route.ts` PATCH** — extinde block-ul de update existent:

1. Înainte de update, fetch `prev.total_budget`
2. După update success cu `data.total_budget`, apelează `logCostChange({ campaignId, costType: 'total_budget', before: prev.total_budget, after: data.total_budget, changedBy: userId })` doar dacă `body.total_budget !== undefined`

**`app/api/campaigns/[id]/participants/[pid]/route.ts` PATCH** — idem:

1. Fetch `prev.agreed_fee`
2. După update cu `data.agreed_fee`, apelează `logCostChange({ ..., costType: 'agreed_fee', participantId: pid, ... })`

**`app/api/admin/scoring-settings/route.ts` PATCH** — extinde:

1. Fetch current `scoring_settings` ca `weightsBefore`
2. Construct `weightsAfter` din body
3. După update success, apelează `logWeightsChange({ before, after, changedBy })`

### 5.4 GET endpoint nou

**`app/api/campaigns/[id]/cost-history/route.ts`:**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, canReadCampaign } from '@/lib/auth/scope'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = admin()
  const { data: row } = await supabase
    .from('campaigns').select('owner_id').eq('id', id).maybeSingle<{ owner_id: string | null }>()
  if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  if (!canReadCampaign(user, { owner_id: row.owner_id })) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: entries, error } = await supabase
    .from('campaign_cost_history')
    .select(`
      id, cost_type, amount_before, amount_after, changed_at,
      changed_by:team_members!campaign_cost_history_changed_by_fkey(id, name),
      participant:campaign_participants(id, account_handle, platform, influencer:influencers(name))
    `)
    .eq('campaign_id', id)
    .order('changed_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, entries: entries ?? [] })
}
```

## 6. UI schimbări

### 6.1 Tab "Istoric" pe `/campaigns/[id]`

Localizează `<Tabs>` în `app/campaigns/[id]/page.tsx` sau component related. Adaugă a 6-a opțiune `'Istoric'`.

Component `<CampaignAuditTab>` în `app/campaigns/[id]/campaign-audit-tab.tsx`:
- Client component, fetch on mount via `useEffect`
- State: `entries: AuditEntry[] | null | 'error'`
- Render tabel cu coloane + empty state + loading state
- Format: `formatEur()` existent pentru sume, `Intl.RelativeTimeFormat` pentru timpi (cu tooltip absolut)

Tipul AuditEntry oglindește response API.

### 6.2 Section "Istoric ponderi" pe `/admin/scoring-settings`

Fetch server-side în `app/admin/scoring-settings/page.tsx` (deja server component):
```ts
const { data: history } = await supabase
  .from('scoring_settings_history')
  .select('id, changes, changed_at, changed_by:team_members(id, name)')
  .order('changed_at', { ascending: false })
  .limit(10)
```

Pasează la component nou `<WeightsHistorySection entries={history ?? []} />` sub form-ul de sliders.

Format compact "Criterii schimbate": iterează `entry.changes` keys, mapează la label-uri RO (din `lib/scoring/types.ts`), join cu virgulă. Ex: "Engagement: 25 → 30, CPV: 20 → 15".

## 7. Non-goals

- ❌ Brand edits audit (industry, company, contact) — Faza 4b dacă echipa cere
- ❌ Campaign status changes audit — Faza 4b
- ❌ Deliverable status changes audit — Faza 4b
- ❌ PIN changes/resets audit — Faza 4b
- ❌ Export PDF al istoricului
- ❌ Filter/search pe istoric
- ❌ Notificări email la modificări (audit e read-only oversight)
- ❌ Rollback/revert din UI (audit e read-only, modificările se fac normal)

## 8. Risc & mitigare

| Risc | Mitigare |
|------|----------|
| Insert audit eşuează → blochează update | try/catch + console.error în helpers; răspuns API rămâne success |
| Spam istoric la save fără modificări | Helpers fac short-circuit dacă before === after (cost) sau changes empty (weights) |
| ENUM `cost_change_type` conflict la re-apply migration | `DO $$ ... IF NOT EXISTS ... $$` guard |
| Race condition la concurrent updates pe acelaşi câmp | Pattern existent în rate-cards audit (fetch-then-update sub req) acceptabil pentru beta cu 7 useri |
| Index pe `(campaign_id, changed_at DESC)` insuficient | Adăugăm second index dacă query-uri admin globale apar (out of scope acum) |
| Tab nou perceput ca overhead | Tab vizibil mereu, dar afişează empty state când lista e goală |

## 9. Definition of done

- [ ] Migration 043 + 044 aplicate în prod via Supabase MCP
- [ ] `lib/campaigns/audit.ts` + `lib/scoring/audit.ts` cu helpers + diff
- [ ] PATCH endpoints wrapate cu audit logging (3 endpoint-uri)
- [ ] GET `/api/campaigns/[id]/cost-history` cu Path A scoping
- [ ] Tab "Istoric" pe `/campaigns/[id]` cu tabel + empty state
- [ ] Section "Istoric ponderi" pe `/admin/scoring-settings`
- [ ] `pnpm run typecheck` + `pnpm run lint` clean
- [ ] `pnpm run build` clean
- [ ] Smoke: modific buget campanie → văd entry în tab Istoric; modific ponderi → văd în admin section
- [ ] Commit conventional + push + GHA deploy verificat
- [ ] Smoke live pe iPhone PWA

## 10. Out of scope

- **Faza 4b (opţional):** brand edits, status changes, PIN audit
- **Faza 5+ (deferred):** Sprint 11 Reporting (mapping PDF/Excel/CSV → KPI + istoric upload-uri raport), Sprint 12 Missive
- **Refuzat:** §9 self-service PIN reset (status quo)
