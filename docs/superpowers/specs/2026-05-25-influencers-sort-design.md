# Sprint 15 — Faza 2 §10: Sortare influenceri după categorie și followers

**Data:** 2026-05-25
**Sursă:** `Influence_Room_prompt_actualizat.docx`, secțiunea 10 ("Sortare și filtrare influenceri")
**Scop:** Adaugă sortare pe lista `/influencers` după tier (Macro & VIP → Nano), followers (ASC/DESC) și combinația tier + followers. Filtrarea există deja (tier chips, platform, range followers, reset) — nu o atingem.

---

## 1. Context

Audit-ul preliminar (Faza 0) a confirmat că **filtrele cerute de §10 există deja**:
- filtru tier (chips) în `influencers-ui.tsx:352-372`
- filtru platformă (dropdown) în același FilterBar
- filtru interval followers (fmin/fmax) în `lib/influencers/search.ts:85-89` (JSONB cast cu `->key::int`)
- buton reset filtre

**Ce lipsește (din §10):**
- Sort după tier (lista e mereu `created_at DESC`)
- Sort după followers ASC/DESC
- Combinare sort tier + followers

Decizii UX confirmate cu Stefan (2026-05-25 brainstorming):
- **UI sort**: dropdown unic cu 4 opțiuni preset (consolidat din 5 inițial — "Tier" include implicit followers ca tie-breaker)
- **Default sort**: `tier` (Macro & VIP → Nano + followers ↓ în interiorul fiecărui tier)
- **Sursă followers pentru sort**: MAX din toate cele 4 platforme (IG/TT/YT/FB) — reflectă "reach total" și e consistent cu logica tier auto-calc

## 2. Cerințe funcționale

### 2.1 Dropdown sort în FilterBar

În `app/influencers/influencers-ui.tsx`, FilterBar primește un `<select>` nou cu 4 opțiuni:

| value | Label (RO) | Comportament |
|-------|------------|--------------|
| `tier` (DEFAULT) | "Tier (Macro & VIP → Nano)" | `ORDER BY tier_rank ASC, max_followers DESC` |
| `recent` | "Cele mai noi" | `ORDER BY created_at DESC` (status quo) |
| `followers_desc` | "Followers ↓" | `ORDER BY max_followers DESC` |
| `followers_asc` | "Followers ↑" | `ORDER BY max_followers ASC` |

Notă: "Tier" include implicit tie-breaker pe followers descrescător. Asta acoperă cazul de uz "combinare tier + followers" din docul Oanei fără să adăugăm o opțiune redundantă în dropdown.

### 2.2 Default sort

Când URL nu conține `?sort=`, comportamentul este `tier`. Asta înlocuiește status quo `created_at DESC`. Pentru workflow-ul de adăugare recentă, opțiunea `recent` rămâne în dropdown.

### 2.3 URL synchronization

Cum funcționează filtrele actuale, sort se persistă în URL:
- `/influencers?sort=followers_desc` produce lista sortată descrescător
- Combinabil cu filtrele existente: `/influencers?tier=macro&sort=followers_desc`
- Page reset la 1 când se schimbă sort (ca la filtre)

### 2.4 Validare

Server-side, lista whitelist `SORT_KEYS` validează URL param. Valori necunoscute → fallback la `tier`. Asta previne erori 500 dacă cineva manipulează URL-ul.

### 2.5 Followers null/zero

Influencerii fără `social_handles` populate (max_followers = 0) ajung la finalul listei pe sort DESC și la început pe ASC. Asta e comportamentul natural cu `NULLS LAST` pe DESC. Pentru clarității în UI, lista deja arată "—" când nu există followers; nu schimbăm display-ul.

## 3. Schimbări DB (migration 041)

### 3.1 Coloane generate STORED

```sql
ALTER TABLE influencers
  ADD COLUMN tier_rank smallint GENERATED ALWAYS AS (
    CASE tier
      WHEN 'macro' THEN 1
      WHEN 'mid' THEN 2
      WHEN 'micro' THEN 3
      WHEN 'nano' THEN 4
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
```

### 3.2 Justificare GENERATED ALWAYS STORED

- **STORED** (nu VIRTUAL): PostgreSQL nu permite index pe coloane VIRTUAL. Avem nevoie de index pentru sort eficient.
- **GENERATED ALWAYS**: PostgreSQL recalculează automat când `tier` sau `social_handles` se schimbă. Zero cost runtime în API. Trigger-ul `trg_influencers_auto_tier` (migration 026) actualizează `tier` din `social_handles.MAX(followers)`, iar `tier_rank` se update-ează cascade.
- **Schimbare schema `social_handles`**: coloana `max_followers` extrage 4 chei JSONB hardcodate. Dacă în viitor adăugăm o platformă (ex: LinkedIn), regenerăm definiția. Acceptabil — lista platformelor e stabilă.

### 3.3 Migration size

Tabel mic (~50 rânduri în prod, mai puține în dev). ALTER TABLE pe 2 coloane + 2 indecși = sub 1 secundă. Compatibil cu beta în derulare (no downtime relevant).

## 4. Schimbări backend (`lib/influencers/search.ts`)

### 4.1 Tip nou + constantă

```ts
export const SORT_KEYS = ['tier', 'recent', 'followers_desc', 'followers_asc'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export const DEFAULT_SORT: SortKey = 'tier'
```

### 4.2 Param nou în `SearchParams`

```ts
export type SearchParams = {
  ...
  sortBy?: SortKey
  ...
}
```

### 4.3 Logică sort în `searchInfluencers`

Înlocuiește linia 56:
```ts
.order('created_at', { ascending: false })
```

Cu un switch după inițializare query:
```ts
const sortBy: SortKey = (SORT_KEYS as readonly string[]).includes(p.sortBy ?? '')
  ? (p.sortBy as SortKey)
  : DEFAULT_SORT

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

## 5. Schimbări page (`app/influencers/page.tsx`)

### 5.1 Parse URL param

În obiectul `filters` (linia 53-64), adaugă:
```ts
sortBy: strParam(sp.sort) ?? null,
```

Pasează la `searchInfluencers({ ...filters, user })`. Validarea se face server-side (whitelist).

## 6. Schimbări UI (`app/influencers/influencers-ui.tsx`)

### 6.1 Type `Filters`

Adaugă `sort: string | null` în tipul Filters.

### 6.2 State + UI

În FilterBar, adaugă state local:
```ts
const [sort, setSort] = useState<string>(filters.sort ?? 'tier')
```

Și UI dropdown plasat lângă chips-urile de tier:
```tsx
<select
  value={sort}
  onChange={(e) => { setSort(e.target.value); onApply({ sort: e.target.value, page: 1 }) }}
  className={inputCls}
>
  <option value="tier">Tier (Macro & VIP → Nano)</option>
  <option value="recent">Cele mai noi</option>
  <option value="followers_desc">Followers ↓</option>
  <option value="followers_asc">Followers ↑</option>
</select>
```

### 6.3 `pushFilters`

Actualizează `pushFilters` să serializeze sort în URL când diferă de default:
```ts
if (merged.sort && merged.sort !== 'tier') params.set('sort', merged.sort)
```

### 6.4 Reset

Funcția `reset()` setează `sort = 'tier'` (default).

## 7. Non-goals (out of scope)

- ❌ Sort per platformă individuală (doar MAX agregat)
- ❌ Sort după scor (există deja filtru `score_category`)
- ❌ Salvare preferință sort în profilul user-ului
- ❌ Coloane sortabile click-on-header
- ❌ Sort în paginile detail (`/influencers/[id]`)
- ❌ Refactor general al FilterBar

## 8. Risc & mitigare

| Risc | Mitigare |
|------|----------|
| ALTER TABLE blochează rândurile | Tabel mic <50 rânduri, sub-secundă |
| `social_handles` shape se schimbă → max_followers rupt | Coloana e STORED, regenerăm migrare la nevoie |
| URL sort manipulat de user | Whitelist `SORT_KEYS` + fallback default |
| Sort `followers_*` cu max=0 ordonare confuzii | `NULLS LAST` + valorile 0 sunt sortate consistent |
| Default schimbat din `recent` în `tier_followers` confuzează echipa | Mesaj la /admin sau în walkthrough; opțiunea `recent` rămâne accessible în dropdown |

## 9. Definition of done

- [ ] Migration 041 aplicată în Supabase prod (via MCP `apply_migration`)
- [ ] `tier_rank` + `max_followers` coloane prezente cu valori populate
- [ ] Indexuri `idx_influencers_tier_rank` + `idx_influencers_max_followers` create
- [ ] `lib/influencers/search.ts` cu `SORT_KEYS` + `sortBy` param + switch logic
- [ ] `app/influencers/page.tsx` parse `?sort=` URL param
- [ ] Dropdown UI în FilterBar cu 5 opțiuni
- [ ] URL sync funcțional + reset
- [ ] `pnpm run typecheck` + `pnpm run lint` clean
- [ ] `pnpm run build` clean
- [ ] Smoke matrix (5 opțiuni) verificat manual
- [ ] Commit conventional + push + GHA deploy verificat

## 10. Out of scope (next phases)

- **Faza 2b:** §4 quick-win pe listă (links clickable, badge-uri platforme, ER badges)
- **Faza 3:** §11 PDF export campanie + month filter
- **Faza 4 (deferred):** §5 audit cost/status, Sprint 11 Reporting, Sprint 12 Missive
