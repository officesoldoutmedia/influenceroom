# Influenceri Sort §10 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaugă pe `/influencers` un dropdown de sortare cu 4 opțiuni (Tier default / Cele mai noi / Followers ↓ / Followers ↑), persistat în URL, fără să atingem filtrele existente.

**Architecture:** Coloane generate STORED în Postgres (`tier_rank` + `max_followers`) cu indecși pentru sort eficient. Backend whitelist `SORT_KEYS` în `lib/influencers/search.ts` cu switch pe `query.order()`. UI dropdown nou în FilterBar cu URL sync prin `pushFilters`.

**Tech Stack:** Supabase Postgres (GENERATED ALWAYS STORED), PostgREST `.order()`, Next.js 16 App Router cu server components, React state local + URL params.

**Spec:** `docs/superpowers/specs/2026-05-25-influencers-sort-design.md`

---

## File Map

| Fișier | Acțiune | Responsabilitate |
|--------|---------|------------------|
| `supabase/migrations/041_influencer_sort_columns.sql` | Create | 2 coloane generate STORED + 2 indecși |
| `lib/influencers/search.ts` | Modify | `SORT_KEYS` const, `SortKey` type, `sortBy` param, switch pe order() |
| `app/influencers/page.tsx` | Modify | Parse `?sort=` URL param, pasează la searchInfluencers |
| `app/influencers/influencers-ui.tsx` | Modify | Dropdown sort în FilterBar, URL sync, default reset |

---

## Task 1: Migration 041 — coloane generate + indecși

**Files:**
- Create: `supabase/migrations/041_influencer_sort_columns.sql`

**Context:** Sortarea după tier (Macro & VIP → Nano) și MAX(followers) cere ORDER BY cu CASE și GREATEST. PostgREST nu suportă direct expresii custom în `.order()`, deci adăugăm coloane derivate populate automat. `GENERATED ALWAYS STORED` recalculează când `tier` sau `social_handles` se schimbă, și permite index pe coloană.

- [ ] **Step 1: Creează migration file**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/supabase/migrations/041_influencer_sort_columns.sql`:

```sql
-- Sprint 15 Faza 2 §10: coloane derivate pentru sortarea listei /influencers.
--
-- tier_rank   = rank numeric din enum-ul tier (macro=1 → nano=4) ca să putem
--               face ORDER BY ASC fără CASE în query.
-- max_followers = GREATEST din followers-urile per platformă (IG/TT/YT/FB).
--                 Reflectă "reach total" — același semnal pe care îl folosește
--                 trigger-ul trg_influencers_auto_tier (migration 026) pentru
--                 a determina automat tier-ul.
--
-- Ambele sunt GENERATED ALWAYS STORED → recalculate automat la UPDATE pe
-- coloanele sursă. STORED (nu VIRTUAL) e obligatoriu ca să putem crea index.

ALTER TABLE influencers
  ADD COLUMN tier_rank smallint GENERATED ALWAYS AS (
    CASE tier
      WHEN 'macro' THEN 1
      WHEN 'mid'   THEN 2
      WHEN 'micro' THEN 3
      WHEN 'nano'  THEN 4
    END
  ) STORED;

ALTER TABLE influencers
  ADD COLUMN max_followers integer GENERATED ALWAYS AS (
    GREATEST(
      COALESCE((social_handles->'instagram'->>'followers')::int, 0),
      COALESCE((social_handles->'tiktok'->>'followers')::int, 0),
      COALESCE((social_handles->'youtube'->>'followers')::int, 0),
      COALESCE((social_handles->'facebook'->>'followers')::int, 0)
    )
  ) STORED;

CREATE INDEX idx_influencers_tier_rank ON influencers(tier_rank);
CREATE INDEX idx_influencers_max_followers ON influencers(max_followers DESC NULLS LAST);

COMMENT ON COLUMN influencers.tier_rank IS
  'Rank numeric pentru sortare ASC: macro=1, mid=2, micro=3, nano=4. Generated din tier.';
COMMENT ON COLUMN influencers.max_followers IS
  'MAX(followers) din social_handles pe IG/TT/YT/FB. 0 dacă niciuna populat. Generated.';
```

- [ ] **Step 2: Aplică migration via Supabase MCP**

Folosește `mcp__claude_ai_Supabase__apply_migration` cu:
- `project_id`: `uhriwdjhzyorogvukcnv`
- `name`: `041_influencer_sort_columns`
- `query`: conținutul SQL de mai sus

Expected: success (~1 secundă pe tabel mic).

- [ ] **Step 3: Verifică coloane populate**

Folosește `mcp__claude_ai_Supabase__execute_sql` cu:
```sql
SELECT id, name, tier, tier_rank, max_followers
FROM influencers
ORDER BY tier_rank ASC, max_followers DESC
LIMIT 10;
```

Expected: rânduri cu `tier_rank` între 1-4 (corespunde tier-ului), `max_followers` număr ≥ 0. Ordine: Macro-urile cu cei mai mulți followers înainte.

- [ ] **Step 4: Verifică indecșii**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'influencers' AND indexname IN ('idx_influencers_tier_rank', 'idx_influencers_max_followers');
```

Expected: 2 rânduri returnate.

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/041_influencer_sort_columns.sql
git commit -m "feat(db): migration 041 — tier_rank + max_followers coloane generate pentru sort"
```

---

## Task 2: Backend — SortKey types în search.ts

**Files:**
- Modify: `lib/influencers/search.ts`

**Context:** Adăugăm whitelist + type + default ca să avem o singură sursă de adevăr pentru valorile valide. Backend validează la primire ca să nu accepte URL params manipulate.

- [ ] **Step 1: Adaugă SORT_KEYS + tip + DEFAULT_SORT după declarația existentă SCORE_CATEGORIES**

În `lib/influencers/search.ts`, după linia 8 (`type ScoreCategoryFilter = ...`), adaugă:

```ts
export const SORT_KEYS = ['tier', 'recent', 'followers_desc', 'followers_asc'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export const DEFAULT_SORT: SortKey = 'tier'
```

- [ ] **Step 2: Adaugă `sortBy` în `SearchParams`**

În `SearchParams` (liniile 10-30), înainte de `page?: number`, adaugă:

```ts
  /** Sort dimension whitelist; fallback la 'tier' dacă lipsește/invalid. */
  sortBy?: string | null
```

- [ ] **Step 3: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

---

## Task 3: Backend — switch logic în searchInfluencers

**Files:**
- Modify: `lib/influencers/search.ts:53-56`

**Context:** Înlocuiește `.order('created_at', { ascending: false })` hardcoded cu switch pe sortBy. Coloanele `tier_rank` + `max_followers` din migration 041 trebuie să existe în prod înainte de aplicare.

- [ ] **Step 1: Înlocuiește block-ul de query initialization**

Găsește în `lib/influencers/search.ts`:

```ts
  let query = supabase
    .from('influencers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
```

Înlocuiește cu:

```ts
  const sortBy: SortKey = (SORT_KEYS as readonly string[]).includes(p.sortBy ?? '')
    ? (p.sortBy as SortKey)
    : DEFAULT_SORT

  let query = supabase
    .from('influencers')
    .select('*', { count: 'exact' })

  switch (sortBy) {
    case 'recent':
      query = query.order('created_at', { ascending: false })
      break
    case 'tier':
      query = query
        .order('tier_rank', { ascending: true, nullsFirst: false })
        .order('max_followers', { ascending: false, nullsFirst: false })
      break
    case 'followers_desc':
      query = query.order('max_followers', { ascending: false, nullsFirst: false })
      break
    case 'followers_asc':
      query = query.order('max_followers', { ascending: true, nullsFirst: false })
      break
  }
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Verifică lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit backend changes**

```bash
git add lib/influencers/search.ts
git commit -m "feat(influencers): sortBy param cu 4 valori (tier/recent/followers_asc/followers_desc)"
```

---

## Task 4: Page — parse `?sort=` URL param

**Files:**
- Modify: `app/influencers/page.tsx:53-64`

**Context:** App Router page citește searchParams și le pasează în `searchInfluencers`. Validarea finală e în backend, aici doar extragem.

- [ ] **Step 1: Adaugă `sortBy` în obiectul filters**

Găsește în `app/influencers/page.tsx`:

```ts
  const filters = {
    q: strParam(sp.q),
    tiers: arrayParam(sp.tier),
    platform: strParam(sp.platform),
    fmin: numParam(sp.fmin),
    fmax: numParam(sp.fmax),
    tags: arrayParam(sp.tag),
    status: strParam(sp.status),
    manager: strParam(sp.manager),
    scoreCategory: strParam(sp.score_category),
    page: numParam(sp.page) ?? 1,
  }
```

Înlocuiește cu:

```ts
  const filters = {
    q: strParam(sp.q),
    tiers: arrayParam(sp.tier),
    platform: strParam(sp.platform),
    fmin: numParam(sp.fmin),
    fmax: numParam(sp.fmax),
    tags: arrayParam(sp.tag),
    status: strParam(sp.status),
    manager: strParam(sp.manager),
    scoreCategory: strParam(sp.score_category),
    sortBy: strParam(sp.sort),
    page: numParam(sp.page) ?? 1,
  }
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

---

## Task 5: UI — dropdown sort + URL sync în InfluencersUI

**Files:**
- Modify: `app/influencers/influencers-ui.tsx` (Filters type, pushFilters, FilterBar)

**Context:** UI-ul gestionează state local sincronizat cu URL prin `pushFilters`. Dropdown nou plasat în FilterBar (lângă chips-urile de tier). Default `tier` nu se serializează în URL pentru a păstra URL-ul curat.

- [ ] **Step 1: Localizează tipul Filters și pushFilters**

Run: `grep -n "type Filters\|function pushFilters\|FilterBar(" "app/influencers/influencers-ui.tsx" | head -10`

Notează liniile pentru editare în pașii următori.

- [ ] **Step 2: Adaugă `sort` în tipul Filters**

Găsește definiția `type Filters` și adaugă câmpul `sort: string | null`. Exemplu (tipul exact depinde de codul actual — adaptează):

```ts
type Filters = {
  q: string | null
  tiers: string[]
  platform: string | null
  // ... câmpuri existente
  sort: string | null
  page: number
}
```

- [ ] **Step 3: Adaugă serializare sort în pushFilters**

În funcția `pushFilters` (creează URL search params), adaugă după ultimul filter existent (înainte de `page`):

```ts
if (merged.sort && merged.sort !== 'tier') params.set('sort', merged.sort)
```

Notă: nu serializăm valoarea default `tier` ca să păstrăm URL-ul curat când userul nu a schimbat sort-ul.

- [ ] **Step 4: Adaugă state + dropdown în FilterBar**

În componenta `FilterBar`, după state-urile existente (q, tiers, brand, etc.), adaugă:

```ts
const [sort, setSort] = useState<string>(filters.sort ?? 'tier')
```

Apoi în JSX, undeva în filter row (recomandat: lângă chips-urile de tier, pentru context UX), adaugă:

```tsx
<select
  value={sort}
  onChange={(e) => {
    setSort(e.target.value)
    onApply({ sort: e.target.value, page: 1 })
  }}
  className={inputCls}
  aria-label="Sortare"
>
  <option value="tier">Tier (Macro & VIP → Nano)</option>
  <option value="recent">Cele mai noi</option>
  <option value="followers_desc">Followers ↓</option>
  <option value="followers_asc">Followers ↑</option>
</select>
```

- [ ] **Step 5: Adaugă sort în funcția reset**

Localizează funcția `reset()` (linia ~330 în InfluencersUI sau FilterBar). Adaugă la finalul ei:

```ts
setSort('tier')
```

Și în `onApply({ ... })` din reset, adaugă:

```ts
sort: null,  // setează la null ca pushFilters să omită serializarea
```

- [ ] **Step 6: Tip Filters pe initialFilters**

În `app/influencers/page.tsx`, asigură-te că `filters` (linia ~53 din Task 4) e tipat consistent cu Filters din UI. Dacă există un cast explicit sau type-check failure după Step 2, mapează `sortBy` → `sort` în props-ul pasat la `<InfluencersUI initialFilters={...} />`.

Verifică Read pe `app/influencers/page.tsx` linia unde se pasează `initialFilters` — dacă forma e diferită, ajustează ca să se potrivească.

- [ ] **Step 7: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 8: Verifică lint**

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 9: Commit UI changes**

```bash
git add app/influencers/influencers-ui.tsx app/influencers/page.tsx
git commit -m "feat(influencers): dropdown sort în FilterBar cu URL sync (tier default)"
```

---

## Task 6: Verificare finală + smoke + push

**Files:**
- N/A (verification only)

- [ ] **Step 1: Build production**

Run: `pnpm run build`
Expected: success, fără erori.

- [ ] **Step 2: Smoke matrix automated via Supabase SQL**

Pentru fiecare opțiune de sort, verifică ordinea așteptată cu SQL direct:

```sql
-- Tier (default): macro cu max followers înainte
SELECT name, tier, max_followers
FROM influencers
ORDER BY tier_rank ASC NULLS LAST, max_followers DESC NULLS LAST
LIMIT 5;

-- Followers desc
SELECT name, tier, max_followers
FROM influencers
ORDER BY max_followers DESC NULLS LAST
LIMIT 5;

-- Followers asc
SELECT name, tier, max_followers
FROM influencers
ORDER BY max_followers ASC NULLS LAST
LIMIT 5;

-- Recent
SELECT name, created_at
FROM influencers
ORDER BY created_at DESC
LIMIT 5;
```

Verifică prin Supabase MCP `execute_sql`. Expected: fiecare ordine diferă unde se așteaptă.

- [ ] **Step 3: Push pe main**

```bash
git push origin main
```

- [ ] **Step 4: Verifică GHA deploy**

Run: `gh run list --limit 1 --workflow=deploy.yml`
Expected: status queued/in_progress → success după ~2 min.

Folosește `gh run watch <id> --exit-status` pentru a aștepta finalizarea fără polling manual.

- [ ] **Step 5: Smoke live pe browser (după deploy success)**

Manual pe https://influenceroom.office-2e5.workers.dev/influencers:
- Default load: ordine Macro → Nano + followers desc?
- Dropdown "Cele mai noi" → schimbă ordinea?
- "Followers ↓" → max followers înainte?
- "Followers ↑" → min înainte (zero-uri primele)?
- URL conține `?sort=...` doar când diferă de tier?
- Combinație cu filtru tier (chip "macro" + sort "followers_asc") → doar macro, ascending?
- Reset filtre → revine la default tier?

---

## Self-Review

**Spec coverage:**
- §2.1 Dropdown 4 opțiuni → Task 5
- §2.2 Default tier → Task 2 (`DEFAULT_SORT`) + Task 5 (UI default `'tier'`)
- §2.3 URL sync → Task 4 (parse) + Task 5 (serialize via pushFilters)
- §2.4 Validare whitelist → Task 2 (SORT_KEYS) + Task 3 (includes check cu fallback)
- §2.5 Followers null/zero → `NULLS LAST` în Task 3 + coalesce 0 în Task 1
- §3 DB → Task 1 (migration + apply + verify)
- §4 Backend → Task 2 + Task 3
- §5 Page parse → Task 4
- §6 UI → Task 5
- §9 DoD checklist → Task 6 acoperă toate punctele

**Placeholder scan:** Niciun TBD/TODO/"implement later". Task 5 Step 6 zice "adaptează dacă forma e diferită" — acceptabil pentru că depinde de structura actuală a `Filters` care variază (deja există în cod, nu inventez). Step-ul instructează clar să folosească Read pentru verificare.

**Type consistency:**
- `SORT_KEYS` definit în Task 2, folosit în Task 3 ✅
- `SortKey` type folosit consistent ✅
- `DEFAULT_SORT = 'tier'` folosit în Task 2, Task 3 (fallback), Task 5 (UI default + reset) ✅
- URL param numit `sort`, prop numit `sortBy` în backend (e o discrepanță voluntară pentru claritate: URL e public, prop e intern); Task 4 face mapping-ul explicit (`sortBy: strParam(sp.sort)`) ✅
- În UI `Filters.sort` (consistent cu URL), iar Task 5 Step 6 trimite la mapping la page → backend (`sort` în Filters UI ↔ `sortBy` în SearchParams) — instrucțiune clară

**Migration ordering:** Task 1 (migration) trebuie completată ÎNAINTE de Task 3 (backend folosește coloanele). Task 3 face referință la coloanele care nu există încă în prod dacă migration nu e aplicată. Ordinea de execuție din plan respectă această dependență.

**Risk reminder:** spec §8 — migration ALTER TABLE rulează pe tabel mic, sub-secundă, no downtime. Coloanele generate sunt populate retroactiv automat de Postgres.
