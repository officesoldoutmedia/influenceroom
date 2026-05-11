# Sprint 14 — Close non-deferred feedback gap-uri

Sprint 14 închide ultimele 4 gap-uri non-deferred din feedback echipa
(8 mai 2026). 90%+ era deja LIVE, restul = micro-features, ~2h total.

## Sub-faze

| Faza | Scop |
|------|------|
| 14a | Brand schema extension (company + industry) + UI modal inline complet |
| 14b | Audit log pentru modificările rate cards (migration 040 + UI history) |
| 14c | "Campanii anterioare" section pe profile influencer |
| 14d | Hover preview cu "Open Profile" button pe social cards |

## Migrations

| # | Scop |
|---|------|
| 039 | `brands.company text` + `brands.industry text`, ambele optional |
| 040 | `influencer_rate_card_history` (audit append-only) + RLS authn-read |

## 14a — Brand schema

- `POST /api/brands` + `PATCH /api/brands/[id]` acceptă `company` + `industry`
- `/brands` list afișează sub-line "company · industry" sub numele brandului
- `/campaigns/new` inline brand-create: Combobox `onCreate` deschide acum
  un nested mini-dialog cu cele 5 fields (name prefilled din search query);
  Combobox await-ește promise-ul → snap-back când user-ul salvează

**Smoke** (live SQL): full 5-field insert, name-only insert, PATCH industry
update → toate round-trip. Cleanup 0 lingering rows.

## 14b — Rate card audit

- `compareRateCards(before, after)` în `lib/rate-cards/types.ts` — diff
  flat: keys "platform.rate_type", values `{old, new}`. Empty când
  before == after.
- `PATCH /api/influencers/[id]` capătă audit hook: când payload-ul
  include `rate_cards`, citim valoarea pre-update, diff post-update, și
  inserăm o row în `influencer_rate_card_history` doar dacă diff-ul nu e
  gol. Failures la insert audit warn în console — nu fail user edit-ul.
- UI: `<RateCardHistorySection>` collapsible pe `/influencers/[id]`,
  vizibil doar pentru owner/manager (Path A scope: `isOwnerOrManager(user)`).
  Per row: timestamp + nume actor + sub-rows "platform.rate_type:
  oldEUR → newEUR".

**Smoke** (live SQL): insert history row, FK cascade-delete via DROP
influencer → 0 lingering. Idempotency confirmed by mental walkthrough
of `compareRateCards`: identical before/after produces empty map →
`hasRateCardChanges` returns false → no insert.

## 14c — Campanii anterioare

- Server-side aggregation pe `/influencers/[id]/page.tsx`: query
  `campaign_participants` cu nested-select pe `campaigns` + `brands`,
  apoi colapsăm rows în per-campaign objects cu platforms[] union.
  Path A scoping: `canReadCampaign(user, { owner_id })` filtru pe
  fiecare row — account users văd doar propriile campanii.
- Endpoint REST companion: `GET /api/influencers/[id]/campaigns` cu
  același logic (pentru flow-uri client-side / PWA / extern).
- UI: section "Campanii anterioare (N)" sub Rate Cards, cap la 10
  rows. Per row: name · brand · platforms (IG/TT/YT/FB) + range start
  → end + status localizat. Click → `/campaigns/[id]`.
- Empty state: "Niciun istoric campanii".

## 14d — Hover "Open Profile" button

- Social media card-urile pe `/influencers/[id]` câștigă un buton
  explicit "Open Profile ↗" centrat în josul cardului. Default
  `opacity-0`; `group-hover:opacity-100` pe desktop;
  `[@media(hover:none)]:opacity-100` pentru touch (Tailwind arbitrary
  variant) ca să rămână vizibil permanent.
- Cardul rămâne un singur `<a>` — butonul e doar styling vizual peste
  același anchor, deci click-anywhere comportament păstrat.

## Status final

Sprint 14 = ultimul sprint din feedback-ul echipei non-deferred.

**Rămase pe roadmap:**
- Sprint 11 Reporting (deferred — scope incomplet, așteaptă format
  raport care vine din real campaign data)
- Sprint 12 Missive (deferred final, scope clarificat de Stefan
  înainte de start)

## Commits

```
3df6f7c feat(ui): hover preview cu "Open Profile" button pe social cards (feedback echipa)
6a1bb1a feat(influencers): "Campanii anterioare" section pe profil
f7fe1ce feat(influencers): audit log pentru modificările rate cards (migration 040)
0e09aaa feat(brands): extend schema cu company + industry + UI modal inline complet
```
