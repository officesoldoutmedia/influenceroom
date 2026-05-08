# Sprint 10 — Influencer Scoring MVP (hybrid auto/manual)

Source: feedback echipa Influence Room §2 — modul scoring 1–100 cu 6 criterii
configurabile, categorii Low / Medium / High / Top Performer + audit.

## Decizii confirmate

| # | Decizie |
|---|---------|
| 1 | 6 criterii: 4 manual (engagement_rate, cpv, audience_ro, deliverable_quality) + 2 auto (punctuality, collaboration_history) |
| 2 | Ponderi configurabile owner-only via singleton `scoring_settings` (defaults 25/20/20/15/10/10). Sum-100 NU obligatoriu — recalc re-normalizează după ponderile criteriilor active |
| 3 | Categorii: low ≤40, medium ≤65, high ≤85, top_performer 86+ |
| 4 | Punctualitate auto = % livrabile publicate la sau înainte de `post_date`. Necesită un timestamp adevărat → migration 030 adaugă `campaign_deliverables.published_at` cu trigger pe status='published' |
| 5 | Istoric colaborări = 0/20/40/60/80/100 din `COUNT(DISTINCT campaign_id)` cu `campaigns.status = 'completed'` (cap la 5+). NB: schema NU are status `'archived'` (doar draft/active/in_review/completed/cancelled), spec fixed la single-status check |
| 6 | Audit pe `influencer_score_history` cu reason ∈ {manual_update, auto_recalc, weights_changed}; o singură intrare pe schimbare reală de `total_score` (`IS DISTINCT FROM` guard) |

## Migrations

| # | Scop |
|---|------|
| 030 | `campaign_deliverables.published_at` + trigger `trg_stamp_published_at` (BEFORE UPDATE). Backfill rândurile deja `published` cu `updated_at` |
| 031 | `scoring_settings` singleton (id=1 enforced) + 6 `weight_*` |
| 032 | `influencer_scores` (UNIQUE per influencer, 4 manual + 2 auto + total + category + explanation + audit) |
| 033 | `influencer_score_history` (append-only audit) |
| 034 | Functii: `calc_punctuality_score`, `calc_collaboration_history_score`, `recalc_influencer_score(p_influencer_id, p_changed_by, p_reason)` |

## API

| Endpoint | Acces | Comportament |
|---|---|---|
| `GET /api/influencers/[id]/score` | Path A read | Returnează scorul curent + ultimele 10 entries istoric |
| `PATCH /api/influencers/[id]/score` | Path A write (`requireInfluencerWriter`) | UPSERT 4 câmpuri manuale → `recalc(reason='manual_update')` |
| `POST /api/influencers/[id]/score/recalculate` | Path A write | Recalc forțat (după publish / completare campanie) cu `reason='auto_recalc'` |
| `GET /api/admin/scoring-settings` | Owner-only | Returnează singleton |
| `PATCH /api/admin/scoring-settings` | Owner-only | Update ponderi → bulk `recalc(reason='weights_changed')` peste toți influencerii (sincron, returnează count) |

## UI

- `/influencers/[id]` — secțiune Scor (circle + category + 6 criterii grid +
  istoric ultimele 10 + butoane Recalculează / Editează manuale). Modal
  cu 4 sliders pentru manualele.
- `/influencers` — coloană Scor (number + category badge) + filtru
  dropdown `?score_category=`. **Sort by total_score: deferred** — gruparea
  pe categorie clustereazã deja.
- `/admin/scoring-settings` — owner-only, 6 sliders, sum indicator,
  confirm modal („Asta va recalcula scorurile pentru toți cei N
  influenceri”). Link sidebar nav „Setări scoring” (sub Notificări).

## Math validation (smoke executat 2026-05-08)

Scenariu: `ScoreTest` cu 2 campanii completed (collab=40), 1 campanie active
cu 3 livrabile publicate (2 on-time + 1 late → punctualitate=67%).

Manual: engagement=80, cpv=60, audience_ro=75, deliverable_quality=70.
Default weights 25/20/20/15/10/10.

```
weighted_sum = 80*25 + 60*20 + 75*20 + 67*15 + 70*10 + 40*10
            = 2000 + 1200 + 1500 + 1005 + 700 + 400 = 6805
sum_weight   = 100
total        = 68 → category 'high'   ✓ matches DB output
```

After bumping `weight_punctuality` 15→30:
```
weighted_sum = 80*25 + 60*20 + 75*20 + 67*30 + 70*10 + 40*10 = 7810
sum_weight   = 115
total        = 7810/115 ≈ 67.91 → 68 (PostgreSQL int cast rounds toward zero) → 'high'
```

Idempotency check: re-running recalc with same inputs → no new history row
(guarded by `old_total IS DISTINCT FROM total`). Verified.

## Pending / deferred

- Sortable score column header on `/influencers` (deferred — needs IDs
  pre-sorted by score then re-paginated; scope cap pushed it out)
- `function_search_path_mutable` advisor warning on the 3 new SQL
  functions + the published_at trigger (consistent with existing
  `touch_*` / `calc_influencer_tier` pattern; sweep when project
  hardens all functions together)
- Sprint 11 Reporting will feed engagement_rate / cpv / audience_ro
  automatically; `recalc_influencer_score` doesn't need to change
- After 10–20 real scored influencers, revisit category thresholds with
  Oana

## Stefan-side smoke after deploy

- Login owner → `/admin/scoring-settings` afișează cele 6 sliders +
  defaults 25/20/20/15/10/10 + total 100% verde
- `/influencers/[id]` pe oricare → secțiune Scor cu „nescorat”/„0/100”
  înainte de prima editare; modal manual save → total se actualizează
- Schimbă weight_punctuality 15→20 în /admin/scoring-settings → confirm
  modal cu „N influenceri” → toast cu count recalculat
- Filter pe `/influencers?score_category=high` → vede doar high/top
