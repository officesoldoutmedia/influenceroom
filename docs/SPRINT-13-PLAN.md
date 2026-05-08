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

## 13b — PDF export ✅

| # | Item |
|---|------|
| 1 | Migration 036: Storage bucket `rate-cards` (private) + 3 `authenticated` RLS policies (insert/select/delete) |
| 2 | `lib/rate-cards/pdf-generator.ts` — pdf-lib generator with A4 portrait, brand wordmark, auto-shrink influencer name, stats row, per-platform rate tables, closing page |
| 3 | `/api/influencers/[id]/rate-card-pdf` POST (render + upload + prune-keep-5 + 1h signed URL) and GET `?path=` (re-mint signed URL with path-prefix scope guard) |
| 4 | `RateCardPdfButton` in Rate Cards section header — idle/loading/success/error states, disabled tooltip when no rates set |

**Library decision:** `pdf-lib` 1.17.1 over `@react-pdf/renderer`. Pure JS,
~340 KB, zero native deps, no font assets to fetch (uses standard PDF
fonts: Times-Roman / Helvetica / Courier-Bold). Cleanly bundles into
@opennextjs/cloudflare without fontkit-in-Workers issues.

**Design:**
- A4 portrait, 56pt margins, brand burnt amber `#C2410C` for accents
- Cover: "INFLUENCE ROOM" wordmark + "MEDIA KIT 2026" + amber divider,
  large serif name (auto-shrink), tier strap-line uppercased, primary
  handle, horizontal stats row per platform with > 0 followers
- Rate pages: per-platform blocks in canonical order from
  `RATE_TYPES_PER_PLATFORM`, subtotal in burnt amber, page-break when
  next block would clip the footer
- Closing: "Thank you for your interest. Reach out at
  contact@influenceroom.ro" + "© 2026 Influence Room" footer

**Storage path scheme:** `rate-cards/<influencer_id>/<timestamp>-rate-card.pdf`
(timestamp = `Date.now()`). Lexical sort matches chronological order.

**Cleanup:** keep 5 most-recent per influencer, drop the rest. Async,
non-blocking — failures don't fail the response.

**Smoke:**

| Caz | Rezultat |
|---|---|
| Local generator vs SPEAK fixture (4-platform full) | 6991 bytes, header `%PDF-1.7`, FlateDecode stream ✓ |
| Bucket created via migration 036 | `rate-cards` (public=false) ✓ |
| Live POST on SPEAK | TODO post-deploy: open signed URL, eyeball cover + tables, verify Storage object at `rate-cards/<speak_id>/<ts>-rate-card.pdf` |
| 6th regenerate prunes oldest | TODO post-deploy: trigger 6 generations, verify only 5 objects remain |
| `no_rates_to_export` for empty | TODO post-deploy on a fresh influencer with no rates |
| Path-prefix guard on GET | TODO post-deploy: try `?path=otherinfluencerid/...` → 400 invalid_path |
