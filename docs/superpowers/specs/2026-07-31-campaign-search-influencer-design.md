# Căutare campanii extinsă pe influenceri — design

**Data:** 2026-07-31 · **Cerere:** Oana (PROMPT APLICATIE.docx + clarificare
Stefan: "fa si extinderea search-ului pe influenceri")

## Problema

Bara de căutare de pe `/campaigns` (`q`) căuta doar în numele campaniei.
Echipa scrie numele unui influencer și se așteaptă să vadă campaniile în
care participă.

## Decizii de scope

- `q` acoperă: **nume campanie** (comportamentul existent) ∪ **nume
  influencer** al participanților ∪ **account_handle** al participanților.
  Handle-ul acoperă și participanții externi (fără profil de influencer).
- **Nu** caută în brand (există filtru dedicat de brand) — YAGNI.
- Un `@` inițial în termen e ignorat la potrivirea pe handle (handle-urile
  sunt stocate fără `@`, vezi `normalizeHandle`).
- Placeholder actualizat: „Caută campanie sau influencer…".

## Implementare

`lib/campaigns/search.ts` — la `p.q`, trei interogări paralele (nume
campanie, participanți cu `influencers!inner` name ilike, participanți cu
account_handle ilike) → uniune de campaign ids → un singur `.in('id', ...)`
pe query-ul principal. Sentinel uuid zero când uniunea e goală (pattern
identic cu filtrul de influencer existent). S-a evitat `.or()` PostgREST
deliberat: termenul e input de utilizator, iar sintaxa `.or()` se rupe la
virgule/paranteze în valoare.

Scoping (Path A), count-ul și paginarea rămân pe query-ul principal, deci
exacte pe setul filtrat.

## Verificare

Playwright (local + prod): q=nume influencer → campaniile lui vizibile;
q=handle → idem; regresie q=nume campanie; q fără rezultate → 0.
