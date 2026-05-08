# Sprint 9 — Plan & Scope

## Decizii confirmate de Stefan

| # | Decizie |
|---|---------|
| 1 | Templates eliminate ca entitate; starter pack hardcoded "Pre-Launch / Briefing / Content Production / Post-Launch" auto-applied la orice campanie nouă |
| 2 | Deliverables: nou tabel campaign_deliverables cu fields: id, campaign_id, position, type (story/reel/tiktok/carousel/post/youtube_long/youtube_short/live/custom), quantity, post_date, collab_handles[], hashtags[], brief, caption, notes, status (draft/sent_to_influencer/content_in_review/approved/published), published_url. NU target_metrics. |
| 3 | Milestones: nou tabel campaign_milestones cu type ENUM (brief_sent, materials_approved, content_draft_submitted, final_content_approved, links_submitted, report_delivered, payment_processed, other) + name, due_date, responsible_role, completed_at, notes |
| 4 | Notificări deadline: 7 zile / 3 zile / 1 zi înainte + post-deadline. Trimite la account + influencer (via email). Frecvențele ajustabile ulterior. |
| 5 | Email obligatoriu pe influencers.email — notificările lor pleacă direct la inbox-ul lor (NU au cont în app) |
| 6 | Multi-account: nou tabel campaign_accounts (campaign_id, account_id, is_primary). Primary: edit all + delete + manage accounts. Secondary: edit deliverables/milestones/tasks/status (NU șterge campania, NU schimbă primary). Owner: bypass tot. |
| 7 | Currency RON → EUR pe influenceri (rate fields) |

## Phases

| Faza | Scope | Estimare |
|------|-------|----------|
| 0 | Frontend audit (code-driven; screenshots TBD by Stefan) + design system | ✅ |
| 1 | Currency RON → EUR pe influenceri | ✅ |
| 2 | Eliminate templates (campaigns start empty) + tier consolidation (mega→macro&VIP) | ✅ — starter pack deferred until pattern visible from 10–20 real campaigns |
| 3 | Deliverables + Milestones schema + UI pe /campaigns/[id] | ~2h |
| 4 | Multi-account junction | ~45 min |
| 5 | RLS refactor — account scoping pe influencers + campaigns + tasks; owner bypass | ~1.5h |
| 6 | Email obligatoriu pe influencers + sistem notificări deadline (necesită Workers Paid + cron) | ~1.5h |
| 7 | Frontend polish — design system applied to all pages + mobile/PWA polish | ✅ partial — campaign board mobile + per-page modals → <Dialog> deferred |

## Dependencies critice

- Faza 6 depinde de Workers Paid + cron (deadline reminder daily run)
- Faza 7 depinde de Faza 0 audit completat
- Faza 5 (RLS refactor) afectează toate API endpoints existente — smoke test extensiv post

## Pending Stefan-side

- ~~Upgrade Workers Paid $5/mo (pentru Faza 6)~~ ✅ DONE; cron `*/5 * * * *` LIVE
- Browser test push notifications
- Schimbat PIN Stefan din 1234 (/profile → Schimbă PIN)
- Rotire CLOUDFLARE_API_TOKEN

## Notes

- App LIVE și beta-ready FĂRĂ Sprint 9. Sprint 9 = îmbunătățiri iterative.
- Sprint 9 cumulativ > Sprinturi 1-8. Pas cu pas, faza cu fază.

---

Update secțiunea "Phases" cu ✅ când o fază e LIVE.
