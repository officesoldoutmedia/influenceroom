# Sprint 13 — Rate Cards (split a + b)

Source: feedback Oana 2026-05-08 — vechiul model `rate_post/story/reel/video`
era ambiguu (`rate_video` = uneori Reel, uneori UR, uneori YT insert). Vor
rate cards SEPARATE per platformă cu rate types specifice + UR-30 universal.

## 13a — Schema + UI ✅

| # | Item |
|---|------|
| 1 | Migration 035: `influencers.rate_cards jsonb NOT NULL DEFAULT '{}'` + GIN index. Backfill SPEAK din `rate_post/story/reel/video` în `rate_cards.instagram`. DROP cele 4 coloane legacy |
| 2 | `lib/rate-cards/types.ts` — `RATE_TYPES_PER_PLATFORM` whitelist, labels RO, descriptions, helpers |
| 3 | `lib/influencers/validate.ts` — `validateRateCards` cu typed error codes pe platform / rate type / value |
| 4 | Form UI: secțiune "Rate Cards (EUR)" cu 4 cards collapsibile (auto-expanded când există date), inputs număr cu € suffix, tooltip pentru UR-30 / boost / dedicated |
| 5 | Detail page UI: section "Rate Cards (N activate)", câte un tabel per platformă cu subtotal; empty state global |

**Schema discovery findings (înainte de migrare):**
- `rate_post/story/reel/video` toate `numeric NULL`
- Doar 1 rând populat: SPEAK (post=2300, story=2000, reel=2500, video=null)
- Migrarea: SPEAK → `{instagram: {photo:2300, story_set:2000, video:2500}}` (video=null skipped via jsonb_strip_nulls). UR-30 ramane gol pentru SPEAK pe ratecard nou — acea sumă va trebui setată manual când Stefan o știe.

**Smoke executat 2026-05-08:**

| Caz | Rezultat |
|---|---|
| INSERT cu toate 4 platforme + rate types valide | persistă cu shape complet ✓ |
| SPEAK post-migrare | `{instagram: {photo:2300, video:2500, story_set:2000}}` ✓ |
| Partial update `instagram.video → 2700` | celelalte rate-uri preserved ✓ |
| Clear `instagram.story_set` cu `jsonb_strip_nulls` | cheie scoasă din shape ✓ |
| Validator: `instagram: {boost_7d: 100}` | `invalid_rate_type_instagram_boost_7d` (boost-urile sunt doar TikTok) ✓ |
| Validator: `instagram: {photo: -100}` | `invalid_rate_value_instagram_photo` ✓ |
| Validator: `xtwitter: {photo: 100}` | `invalid_rate_platform_xtwitter` ✓ |
| Cleanup → SPEAK intact | confirmed ✓ |

**Notă pentru UI sortable score column** (deferred din Sprint 10) — rămâne deferred,
nu intra în acest sprint.

## 13b — PDF export (next)

Outline din Stefan, neimplementat încă:
- React-PDF pentru render cu design branded (logo Influence Room, palette
  burnt amber, Fraunces titluri, Geist body)
- Supabase Storage bucket `rate-cards`, signed URLs cu TTL 24h
- Endpoint `/api/influencers/[id]/rate-card-pdf` (path A scoping —
  influencerul aparține account managerului sau e unassigned)
- UI button "Generează PDF" pe `/influencers/[id]` lângă Edit
- Decizie: regen on every download vs. cache 1h. Default cache 1h, force-fresh
  cu query `?fresh=1`
