# Sprint 15 — Faza 1 §12: Campanii — fix-uri și extensii din feedback Oana

**Data:** 2026-05-25
**Sursă:** `Influence_Room_prompt_actualizat.docx`, secțiunea 12 ("Corecții și îmbunătățiri modul CAMPANII")
**Scop:** repară 3 bug-uri raportate de echipă + adaugă 2 extensii (ștergere drafturi/cancelled, butoane Save Draft vs Create & Activate) fără să modifici structura generală a modulului.

---

## 1. Context

Feedback-ul clientului semnalează 5 probleme distincte, dar toate atinge același set de fișiere (`app/campaigns/**`, `app/api/campaigns/**`). Le tratăm ca un singur PR pentru că:

- bug §12.3 (tab blocat) și bug §12.5 (eroare la Save) sunt aproape sigur același simptom (lipsă `router.refresh()` + un `useEffect` cu ESLint-disable suspect în `campaigns-ui.tsx:70-71`)
- §12.4 (Save as Draft vs Create & Activate) atinge același modal de creare ca §12.5
- §12.1 (ștergere) refolosește același pattern de confirm-modal ca §12.4 (activare)

Audit-ul preliminar a confirmat (vezi mesaj brainstorming):
- multi-influencer × multi-account (§7) ✅ deja livrat
- brand inline create (§8) ✅ deja livrat
- filtrarea status (§12.2) — codul backend e corect (`in('status', statuses)` în `lib/campaigns/search.ts:54`); investigăm UI state pe chips
- `useEffect(() => setItems(initialItems), [initialItems])` din `campaigns-ui.tsx:69-71` ESTE corect (dep-array conține `initialItems`). Disable-ul ESLint vizează regula `react-hooks/set-state-in-effect` (warning despre pattern), NU `exhaustive-deps`. Bug-ul §12.3 NU e în acest hook — investigăm alte suspects la execution time.

## 2. Cerințe funcționale

### 2.1 Ștergere campanii Draft / Cancelled (§12.1)

- buton "Șterge" apare **doar pe campanii cu `status ∈ {draft, cancelled}`**
- două locuri:
  - **detail page** (`/campaigns/[id]`): buton roșu ghost în header actions
  - **listă** (`/campaigns`): icon delete mic pe row (hover-revealed pe desktop, vizibil permanent pe mobile)
- confirm modal cu text: "Ești sigur că vrei să ștergi această campanie? Datele se pierd definitiv."
- **hard delete** (DELETE row) — cascade automat pe `campaign_participants`, `campaign_deliverables`, `campaign_milestones`, `task_groups`, `tasks` (toate FK sunt `ON DELETE CASCADE`, confirmat în migrațiile 007, 021, 023, 024)
- `notifications.related_campaign_id` e `ON DELETE SET NULL` → notificările vechi rămân valid în queue, doar pierd link-ul (acceptabil)
- după delete: redirect la `/campaigns` din detail, sau `router.refresh()` din listă

### 2.2 Anulare campanii Active / In_review (păstrat, redenumit)

- "Anulează" rămâne ca soft-status-change pentru `status ∈ {active, in_review}` (cum e acum)
- după Anulează → status devine `cancelled` și buton se transformă în "Șterge" (datele se păstrează până owner-ul confirmă delete)
- pentru `status='completed'` → niciun buton destructiv (campaniile finalizate sunt arhivă, nu cleanup)

### 2.3 Fix filtrare status (§12.2)

- reproducer manual: selectează 2 chips în filter bar → verifică în Network că query trimite `statuses=draft,active` (sau echivalent în URL params)
- dacă query e corect → investighează `toggleStatus` în `campaigns-ui.tsx:245-249` pentru off-by-one pe array
- soluție așteptată: nicio schimbare la backend; eventual o corectare la state-ul de chips sau la `useEffect` care nu re-sincronizează (vezi §12.3)

### 2.4 Fix tab CAMPANII blocat (§12.3)

- root cause necunoscut încă — necesită reproducere live cu DevTools + Network. Eliminăm o ipoteză falsă (vezi §1): `useEffect` cu deps `[initialItems]` e corect.
- suspects de investigat în ordine:
  1. **Lipsă `router.refresh()` după create**: în `campaigns-ui.tsx:203-206`, `onCreated` apelează doar `setShowNew(false)` + `router.push('/campaigns/${id}')`. Server cache-ul listei părinte nu se invalidează. Dacă userul navighează înapoi la `/campaigns` (din nav), vede lista veche.
  2. **URL params multi-status**: `pushFilters` în `campaigns-ui.tsx:76-85` folosește `params.append('status', s)` (linia 80). Verificăm că `lib/campaigns/search.ts` citește cu `searchParams.getAll('status')` (nu `.get`), altfel ia doar primul status.
  3. **Loading state stuck**: căutăm orice setState într-un branch de eroare care nu se resetează.
  4. **Optimistic update silently failing**: dacă există vreo logică de optimistic update care eșuează în background fără să dea revert.
- după reproducere → fix targetat. Dacă root cause e (1), adăugăm `router.refresh()`. Dacă (2), schimbăm parsing-ul în search.ts.

### 2.5 Save as Draft vs Create & Activate (§12.4)

- `NewCampaignModal` afișează **două butoane** în footer:
  - `[Save as Draft]` (ghost, secondary)
  - `[Create & Activate]` (primary, brand amber)
- comportament:
  - **Save as Draft**: validare minimă (`name` + `brand_id`); creează campania cu `status='draft'`; redirect la detail
  - **Create & Activate**: validare extinsă (`name` + `brand_id` + `start_date` + `end_date` + `start ≤ end`); creează cu `status='active'`; redirect la detail
  - când validarea Activate eșuează → afișează inline errors pe fiecare câmp lipsă, ștergerea automată pe focus, fără să închidă modal-ul
- mesaj de eroare per câmp în română (ex: "Selectează data de start", "Selectează data de final", "Data de final trebuie să fie după start")

### 2.6 Activare retroactivă draft → active (§12.4)

- pe `/campaigns/[id]` cu `status='draft'`:
  - buton verde/amber "Activează campania" în header actions
  - click → validează aceleași câmpuri ca "Create & Activate"
  - dacă lipsesc câmpuri: confirm modal afișează lista cu link-uri către secțiunile relevante (ex: "Adaugă perioadă în secțiunea Detalii")
  - dacă valid: PATCH `/api/campaigns/[id]` cu `status: 'active'` → success → toast + refresh

### 2.7 Fix eroare la Save (§12.5)

- foarte probabil consecință a §12.3 (tab blocat post-save). După fix-urile §12.3 + §12.4 testăm flow-ul complet:
  - creare draft → success → redirect → tab refresh → ✅
  - creare active → success → redirect → tab refresh → ✅
- dacă mai apare eroare cu reproducer specific, investigăm separat (audit log în Network + console).

## 3. Schimbări API

### 3.1 `DELETE /api/campaigns/[id]`

**Before:** soft-cancel pe orice status (`UPDATE campaigns SET status='cancelled'`).

**After:**
```ts
const { data: current } = await supabase
  .from('campaigns')
  .select('status')
  .eq('id', id)
  .maybeSingle()

if (!current) return notFound404
if (!['draft', 'cancelled'].includes(current.status)) {
  return 409 { error: 'invalid_status_for_delete', status: current.status }
}

const { error } = await supabase.from('campaigns').delete().eq('id', id)
if (error) return 500
return { ok: true }
```

Notă: butonul "Anulează" pe campanii active rămâne — el folosește **PATCH `/api/campaigns/[id]`** cu `status: 'cancelled'`, **nu DELETE**. Pe partea de UI separăm clar cele două acțiuni:
- "Anulează" → PATCH status (soft)
- "Șterge" → DELETE (hard, doar pe draft/cancelled)

### 3.2 `POST /api/campaigns`

**Before:** RPC `create_campaign` cu default status=draft.

**After:**
- accept `status: 'draft' | 'active'` în body (default 'draft')
- validări:
  - `name.trim().length > 0` întotdeauna
  - `brand_id` UUID valid întotdeauna
  - dacă `status === 'active'`:
    - `start_date` populat (ISO date)
    - `end_date` populat (ISO date)
    - `start_date <= end_date`
- erori returnate ca array (`{ ok: false, errors: [{ field: 'start_date', code: 'missing' }, ...] }`) ca UI să le mapeze inline

### 3.3 `PATCH /api/campaigns/[id]` — tranziție draft → active

- când body conține `status: 'active'` și current status = `'draft'`:
  - re-validează `start_date` + `end_date` + `start ≤ end`
  - eroare → 422 cu același format `errors: []`
- alte tranziții de status (draft↔draft, active↔in_review etc.) rămân fără validare extinsă (cum sunt acum)

## 4. Schimbări UI

### 4.1 `app/campaigns/campaigns-ui.tsx` (NewCampaignModal)

- two-button footer (Save as Draft / Create & Activate)
- state: `submitting: 'draft' | 'active' | null` ca butoanele să afișeze spinner doar pe cel apăsat
- inline error display: state `fieldErrors: Record<string, string>` populat din response 422
- pe row în listă: icon `Trash2` din `lucide-react` revealed pe `hover:opacity-100` (desktop) / vizibil mereu pe mobile (sub `[@media(hover:none)]`)
- click icon → confirm modal partajat

### 4.2 `app/campaigns/[id]/detail-ui.tsx`

- înlocuiește singurul buton "Cancel" actual (linia 91-94) cu logică de status:
  ```tsx
  {status === 'draft' && (
    <>
      <ActivateButton />  {/* amber primary */}
      <DeleteButton />    {/* red ghost */}
    </>
  )}
  {status === 'cancelled' && <DeleteButton />}
  {(['active','in_review'].includes(status)) && <CancelButton />}
  {/* completed: nimic destructiv */}
  ```
- `DeleteButton` și `ActivateButton` au confirm modal propriu (reuse pattern existent dacă există, sau component nou `<ConfirmModal>` în `lib/ui/`)

### 4.3 Fix bug §12.3 (la execution time)

Începem cu adăugarea `router.refresh()` în `onCreated` (cel mai probabil suspect):

```diff
  onCreated={(id) => {
    setShowNew(false)
+   router.refresh()
    router.push(`/campaigns/${id}`)
  }}
```

Dacă reproducerea live arată că problema persistă, urmărim ipotezele 2-4 din §2.4. Hook-ul `useEffect` rămâne neatins (e corect așa cum e).

## 5. Non-goals

- ❌ audit log pentru schimbări de cost/status (separat, în lista lipsuri §5 din feedback — discuție viitoare)
- ❌ refactor general al modulului Campanii (clientul explicit cere "să nu modifici structura generală")
- ❌ schimbare de schema DB (cascade-urile FK există deja)
- ❌ atingerea altor module (Influenceri, Brands, Tasks)

## 6. Risc & mitigare

| Risc | Mitigare |
|------|----------|
| Hard delete pe draft șterge accidental ceva important | Confirm modal cu text explicit + buton de delete vizibil numai pe draft/cancelled |
| Validarea extinsă la "Create & Activate" frustrează echipa | Mesaje clare per câmp + buton "Save as Draft" oferă mereu o cale alternativă |
| Bug-urile §12.2 / §12.5 nu se reproduc local | Testare pe iPhone PWA + login cu PIN echipă; dacă tot nu se reproduc, request reproducer video de la Oana |
| `router.refresh()` invalidează prea agresiv lista (perceived slow) | Server component pe `/campaigns` e deja fast (RLS bypass, paginare); acceptabil |

## 7. Definition of done

- [ ] DELETE /api/campaigns/[id] refuză 409 pe non-draft/non-cancelled
- [ ] POST /api/campaigns acceptă `status` și validează extinde pe `active`
- [ ] PATCH /api/campaigns/[id] re-validează la draft→active
- [ ] NewCampaignModal are 2 butoane funcționale cu inline errors
- [ ] Lista `/campaigns` are icon delete pe row (draft/cancelled)
- [ ] Detail page are butoane condiționate pe status (Draft/Cancelled/Active+InReview/Completed)
- [ ] `useEffect` reparat în campaigns-ui.tsx, `router.refresh()` adăugat în NewCampaignModal
- [ ] Filtru multi-status pe lista campanii merge corect (Active + Draft selectate → doar acestea apar)
- [ ] Tab CAMPANII nu se mai blochează după save/edit
- [ ] `pnpm run typecheck` + `pnpm run lint` clean
- [ ] Smoke manual: creare draft, creare active cu validare, activare retroactivă, ștergere draft, ștergere cancelled, refuz delete pe active, anulare active → ștergere → all OK
- [ ] Commit conventional + push + GHA deploy verificat

## 8. Out of scope (next phases)

- **Faza 2:** §10 sort + extensii lista influenceri (sort tier, sort followers, links + ER badges pe listă)
- **Faza 3:** §11 PDF export campanie + month filter
- **Faza 4 (deferred):** §5 audit pentru cost/status changes, §5 Reporting (Sprint 11), §5 Missive (Sprint 12)
- **Refuzat:** §9 self-service PIN reset — Stefan a confirmat status quo (admin reset via /admin/team)
