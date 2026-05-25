# Campanii §12 Feedback Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementează cele 5 cerințe din feedback-ul Oanei (§12.1-12.5) — buton de ștergere doar pe draft/cancelled, fix filtru status, fix tab blocat, butoane Save Draft / Create Activate, fix eroare Save — fără să atingem structura generală a modulului.

**Architecture:** 3 schimbări backend (DELETE hard-delete cu status guard, POST cu validare condițională pe status, PATCH cu validare la draft→active) + UI refactor minimal pe `campaigns-ui.tsx` și `detail-ui.tsx` + un component partajat `<ConfirmModal>` în `lib/ui/`. Fix bug §12.3 prin adăugarea `router.refresh()` în onCreated. Bug §12.2 investigat la execution time (codul backend e corect — suspect: UX state pe chips).

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase service_role, Tailwind, lucide-react icons. Fără test framework — verificare prin `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` și smoke manual pe local + iPhone PWA.

**Spec:** `docs/superpowers/specs/2026-05-25-campaigns-feedback-client-design.md`

---

## File Map

| Fișier | Acțiune | Responsabilitate |
|--------|---------|------------------|
| `app/api/campaigns/route.ts` | Modify | Acceptă `status` în POST body + validare condițională |
| `app/api/campaigns/[id]/route.ts` | Modify | DELETE = hard delete cu status guard + PATCH valid draft→active |
| `app/campaigns/campaigns-ui.tsx` | Modify | 2 butoane în NewCampaignModal, row delete action, router.refresh() |
| `app/campaigns/[id]/detail-ui.tsx` | Modify | Butoane condiționate pe status (Activează / Șterge / Anulează) |
| `lib/ui/confirm-modal.tsx` | Create | Component reutilizabil pentru confirm/cancel cu titlu + descriere |

---

## Task 1: Reproduce și diagnostica bug-urile §12.2, §12.3, §12.5

**Files:**
- Read-only investigation, no edits yet

**Context:** Spec §2.4 enumeră 4 suspects pentru §12.3. Trebuie să le verificăm înainte să facem fix presumptiv, ca să nu introducem schimbări inutile.

- [ ] **Step 1: Pornește dev server**

Run: `pnpm dev`
Expected: `▲ Next.js 16.x` și port 3000 deschis fără erori.

- [ ] **Step 2: Reproduce §12.5 (eroare la Save)**

În browser: deschide `http://localhost:3000/campaigns` → click "+ Nouă campanie" → completează `name="Test §12.5"` + selectează un brand → click "Create".

Observă: ce status code returnează POST? Ce mesaj de eroare apare în UI? Verifică Network tab și Console pentru orice 500/422.

Documentează în jurnal (output text, nu commit): `[12.5] reproducere: <ce vezi>`.

- [ ] **Step 3: Reproduce §12.3 (tab blocat)**

În același dev server: după Create (sau dacă §12.5 eșuează, după dismiss eroare):
- click "Campanii" în nav → revin la `/campaigns`
- vezi campania nouă în listă?
- filtrează pe status "draft" + "active" simultan → toate chips apar selectate?
- după filter, click "Campanii" din nav → ce se întâmplă?

Documentează: `[12.3] reproducere: <ce vezi exact, ce nu funcționează>`.

- [ ] **Step 4: Reproduce §12.2 (filtru status)**

Selectează 2 chips (ex: "draft" + "active") → verifică URL bar — vezi `?status=draft&status=active`? În Network → API call către `/api/campaigns?status=...` — câte status-uri sunt în query string?

Lista campanii afișată conține DOAR draft + active sau și alte status-uri?

Documentează.

- [ ] **Step 5: Opresc dev server și sumarizez findings**

Apasă Ctrl+C în terminal-ul dev.

Scrie un commit-message mental (nu commit încă) cu root cause-urile concrete identificate. Dacă §12.3 e cauzat de lipsa `router.refresh()` (suspect #1 din spec), continuă cu Task 9. Dacă e altceva (suspect #2-4), revin la spec pentru actualizare.

**NO COMMIT** — doar diagnostic.

---

## Task 2: Backend — DELETE hard delete cu status guard

**Files:**
- Modify: `app/api/campaigns/[id]/route.ts:199-222`

**Context:** Acum DELETE face soft-cancel pe orice status (`UPDATE campaigns SET status='cancelled'`). Spec §2.1 + §3.1 cere hard delete doar pentru `draft|cancelled`, altfel 409.

- [ ] **Step 1: Modifică handler-ul DELETE**

În `app/api/campaigns/[id]/route.ts`, înlocuiește funcția `DELETE` (liniile 199-222) cu:

```ts
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const denied = await requireCampaignWriter(id)
  if (denied) return denied

  const supabase = admin()

  const { data: current, error: fetchErr } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', id)
    .maybeSingle<{ status: string }>()

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: fetchErr.message }, { status: 500 })
  }
  if (!current) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!['draft', 'cancelled'].includes(current.status)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_status_for_delete', status: current.status },
      { status: 409 },
    )
  }

  const { error: delErr } = await supabase.from('campaigns').delete().eq('id', id)
  if (delErr) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: delErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke manual — DELETE pe draft**

Pornește dev: `pnpm dev`. În browser dev tools console:

```js
fetch('/api/campaigns/<id-unei-campanii-draft>', { method: 'DELETE' })
  .then(r => r.json()).then(console.log)
```

Înlocuiește `<id-unei-campanii-draft>` cu un id real din DB. Expected: `{ ok: true }` și campania dispare din listă după refresh.

- [ ] **Step 4: Smoke manual — DELETE pe active refuzat**

Aceeași comandă pe o campanie cu status='active'. Expected: `{ ok: false, error: 'invalid_status_for_delete', status: 'active' }` cu status code 409.

- [ ] **Step 5: Commit**

```bash
git add app/api/campaigns/[id]/route.ts
git commit -m "feat(campaigns): DELETE = hard delete cu status guard (doar draft/cancelled)"
```

---

## Task 3: Backend — POST acceptă `status` cu validare condițională

**Files:**
- Modify: `app/api/campaigns/route.ts:37-84`

**Context:** Spec §3.2 cere ca POST să accepte `status: 'draft' | 'active'` și să valideze `start_date + end_date + start ≤ end` doar când e active.

- [ ] **Step 1: Modifică CreateBody + POST handler**

În `app/api/campaigns/route.ts`, înlocuiește tipul `CreateBody` și funcția `POST` (liniile 37-84) cu:

```ts
type CreateBody = {
  brand_id?: string
  name?: string
  status?: 'draft' | 'active'
  start_date?: string | null
  end_date?: string | null
  total_budget?: number | null
  deliverables_count?: number | null
  brief?: string | null
  owner_id?: string | null
  internal_notes?: string | null
}

type FieldError = { field: string; code: string }

function validateCreateBody(body: CreateBody): FieldError[] {
  const errors: FieldError[] = []
  if (!body.brand_id) errors.push({ field: 'brand_id', code: 'missing' })
  if (!body.name?.trim()) errors.push({ field: 'name', code: 'missing' })

  if (body.status === 'active') {
    if (!body.start_date) errors.push({ field: 'start_date', code: 'missing' })
    if (!body.end_date) errors.push({ field: 'end_date', code: 'missing' })
    if (body.start_date && body.end_date && body.start_date > body.end_date) {
      errors.push({ field: 'end_date', code: 'before_start' })
    }
  }
  return errors
}

export async function POST(req: NextRequest) {
  const denied = await requireWriter()
  if (denied) return denied

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const errors = validateCreateBody(body)
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: 'validation_failed', errors }, { status: 422 })
  }

  const h = await headers()
  const createdBy = h.get('x-user-id')
  const supabase = admin()

  const { data, error } = await supabase.rpc('create_campaign', {
    p_brand_id: body.brand_id!,
    p_name: body.name!.trim(),
    p_start_date: body.start_date ?? null,
    p_end_date: body.end_date ?? null,
    p_total_budget: body.total_budget ?? null,
    p_deliverables_count: body.deliverables_count ?? null,
    p_brief: body.brief?.toString().trim() || null,
    p_owner_id: body.owner_id ?? createdBy,
    p_internal_notes: body.internal_notes?.toString().trim() || null,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'server_error', detail: error.message }, { status: 500 })
  }

  // create_campaign RPC creates with status='draft'. If user requested 'active', flip it.
  if (body.status === 'active' && data?.id) {
    const { error: updErr } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', data.id)
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: 'server_error', detail: updErr.message },
        { status: 500 },
      )
    }
    data.status = 'active'
  }

  return NextResponse.json({ ok: true, campaign: data })
}
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke manual — POST draft minimal**

În dev tools console:

```js
fetch('/api/campaigns', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ brand_id: '<id-brand>', name: 'Test Draft' }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, campaign: { id: '...', status: 'draft', ... } }`.

- [ ] **Step 4: Smoke manual — POST active fără date returnează 422**

```js
fetch('/api/campaigns', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ brand_id: '<id-brand>', name: 'Test Active Invalid', status: 'active' }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: false, error: 'validation_failed', errors: [{ field: 'start_date', code: 'missing' }, { field: 'end_date', code: 'missing' }] }` cu status 422.

- [ ] **Step 5: Smoke manual — POST active cu date OK**

```js
fetch('/api/campaigns', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    brand_id: '<id-brand>',
    name: 'Test Active OK',
    status: 'active',
    start_date: '2026-06-01',
    end_date: '2026-06-15',
  }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, campaign: { status: 'active', ... } }`.

- [ ] **Step 6: Commit**

```bash
git add app/api/campaigns/route.ts
git commit -m "feat(campaigns): POST acceptă status cu validare condițională pentru active"
```

---

## Task 4: Backend — PATCH re-valideaz tranziția draft→active

**Files:**
- Modify: `app/api/campaigns/[id]/route.ts:95-100` (inserare validare pre-update)

**Context:** Spec §3.3 cere ca tranziția `draft → active` prin PATCH să refacă validarea de date (start_date + end_date + start ≤ end). PATCH-ul actual schimbă status fără re-validare.

- [ ] **Step 1: Adaugă validare inline în PATCH handler**

În `app/api/campaigns/[id]/route.ts`, după blocul de construcție `update` (la linia ~107, înainte de `if (Object.keys(update).length === 0)`), inserează:

```ts
  // Tranziție draft → active necesită start_date + end_date valid.
  // Re-fetch current pentru a verifica status-ul actual.
  if (update.status === 'active') {
    const supabase = admin()
    const { data: current } = await supabase
      .from('campaigns')
      .select('status, start_date, end_date')
      .eq('id', id)
      .maybeSingle<{ status: string; start_date: string | null; end_date: string | null }>()

    if (current?.status === 'draft') {
      const sd = (update.start_date as string | null) ?? current.start_date
      const ed = (update.end_date as string | null) ?? current.end_date
      const errors: { field: string; code: string }[] = []
      if (!sd) errors.push({ field: 'start_date', code: 'missing' })
      if (!ed) errors.push({ field: 'end_date', code: 'missing' })
      if (sd && ed && sd > ed) errors.push({ field: 'end_date', code: 'before_start' })
      if (errors.length > 0) {
        return NextResponse.json(
          { ok: false, error: 'validation_failed', errors },
          { status: 422 },
        )
      }
    }
  }
```

Notă: `supabase = admin()` e re-declarat în acest bloc pentru izolare; pe linia 113 mai jos există deja `const supabase = admin()`. Va trebui să eviți shadow-warning — folosește nume diferit `const adminSb = admin()` în blocul nou, sau mută declararea originală mai sus. Recomandare: mută `const supabase = admin()` de pe linia 113 imediat după `if (Object.keys(update).length === 0)` block, înainte de validare. Apoi reutilizezi `supabase` în blocul de validare.

Layout final (după mutare):

```ts
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const supabase = admin()

  // Tranziție draft → active necesită start_date + end_date valid.
  if (update.status === 'active') {
    const { data: current } = await supabase
      .from('campaigns')
      .select('status, start_date, end_date')
      .eq('id', id)
      .maybeSingle<{ status: string; start_date: string | null; end_date: string | null }>()

    if (current?.status === 'draft') {
      const sd = (update.start_date as string | null) ?? current.start_date
      const ed = (update.end_date as string | null) ?? current.end_date
      const errors: { field: string; code: string }[] = []
      if (!sd) errors.push({ field: 'start_date', code: 'missing' })
      if (!ed) errors.push({ field: 'end_date', code: 'missing' })
      if (sd && ed && sd > ed) errors.push({ field: 'end_date', code: 'before_start' })
      if (errors.length > 0) {
        return NextResponse.json(
          { ok: false, error: 'validation_failed', errors },
          { status: 422 },
        )
      }
    }
  }

  // Capture previous status to detect draft → active transition for hooks
  const { data: prev } = await supabase
    ...
```

Șterge declarația duplicată `const supabase = admin()` care era pe linia 113 (acum mutată mai sus).

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke manual — PATCH draft cu status='active' fără date eșuează 422**

```js
fetch('/api/campaigns/<id-draft-fără-date>', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ status: 'active' }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: false, error: 'validation_failed', errors: [...] }` cu 422.

- [ ] **Step 4: Smoke manual — PATCH activează cu date OK**

```js
fetch('/api/campaigns/<id-draft>', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    status: 'active',
    start_date: '2026-06-01',
    end_date: '2026-06-15',
  }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true, campaign: { status: 'active', ... } }`.

- [ ] **Step 5: Commit**

```bash
git add app/api/campaigns/[id]/route.ts
git commit -m "feat(campaigns): PATCH validează tranziția draft → active cu date obligatorii"
```

---

## Task 5: UI — ConfirmModal partajat

**Files:**
- Create: `lib/ui/confirm-modal.tsx`

**Context:** Avem nevoie de confirm modal în 3 locuri (delete row, delete detail, activate draft). DRY: component partajat în `lib/ui/`, primește titlu + descriere + label-uri butoane + onConfirm/onCancel.

- [ ] **Step 1: Creează componentul**

Fișier nou `/Volumes/SSD BRUTURI/NU SE STERGE/INFLUENCER ROOM APP/lib/ui/confirm-modal.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export type ConfirmModalProps = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Anulează',
  variant = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const confirmCls =
    variant === 'danger'
      ? 'px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-60'
      : 'px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-stone-900 mb-2">{title}</h2>
        {description && <p className="text-sm text-stone-600 mb-5">{description}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmCls}>
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ui/confirm-modal.tsx
git commit -m "feat(ui): componentă ConfirmModal partajată pentru confirm/cancel"
```

---

## Task 6: UI — NewCampaignModal cu 2 butoane + inline errors + router.refresh()

**Files:**
- Modify: `app/campaigns/campaigns-ui.tsx` (NewCampaignModal: liniile ~395-514, plus secțiunea onCreated liniile 196-208)

**Context:** Spec §2.5 + §4.1. Două butoane (Save Draft / Create Activate) cu validări diferite + erori inline per câmp. Bonus: `router.refresh()` în onCreated (fix §12.3).

- [ ] **Step 1: Înlocuiește submit function + footer-ul cu butoane**

În `app/campaigns/campaigns-ui.tsx`, înlocuiește funcția `submit` (în NewCampaignModal, ~liniile 411-438) cu:

```tsx
  const [submitMode, setSubmitMode] = useState<'draft' | 'active' | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function submit(mode: 'draft' | 'active') {
    if (!brandId) {
      setError('Selectează un brand')
      return
    }
    if (!name.trim()) {
      setError('Numele este obligatoriu')
      return
    }
    setSubmitMode(mode)
    setError(null)
    setFieldErrors({})
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        name,
        status: mode,
        start_date: startDate || null,
        end_date: endDate || null,
        total_budget: budget === '' ? null : Number(budget),
        deliverables_count: deliverables === '' ? null : Number(deliverables),
        brief: brief || null,
        owner_id: ownerId || null,
        internal_notes: internalNotes || null,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ApiResp<{ id: string }> & {
      errors?: { field: string; code: string }[]
    }
    setSubmitMode(null)
    if (res.ok && data.campaign?.id) {
      onCreated(data.campaign.id)
      return
    }
    if (res.status === 422 && data.errors) {
      const m: Record<string, string> = {}
      for (const e of data.errors) {
        m[e.field] = fieldErrorMessage(e.field, e.code)
      }
      setFieldErrors(m)
      setError('Completează câmpurile lipsă pentru a activa campania')
    } else {
      setError(ErrorMap(data.error ?? 'server_error'))
    }
  }

  function fieldErrorMessage(field: string, code: string): string {
    if (field === 'start_date' && code === 'missing') return 'Selectează data de start'
    if (field === 'end_date' && code === 'missing') return 'Selectează data de final'
    if (field === 'end_date' && code === 'before_start') return 'Data de final trebuie să fie după start'
    if (field === 'brand_id' && code === 'missing') return 'Selectează un brand'
    if (field === 'name' && code === 'missing') return 'Numele este obligatoriu'
    return `${field}: ${code}`
  }
```

- [ ] **Step 2: Înlocuiește footer-ul de butoane + form-ul (`onSubmit`)**

În același NewCampaignModal, găsește `<form onSubmit={submit}` (~linia 444) și schimbă în `<form onSubmit={(e) => { e.preventDefault(); submit('draft') }}`.

Înlocuiește footer-ul de butoane (~liniile 492-495):

```tsx
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? '...' : 'Create'}</button>
          </div>
```

Cu:

```tsx
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={submitMode !== null} className={btnSecondary}>
              Anulează
            </button>
            <button
              type="button"
              onClick={() => submit('draft')}
              disabled={submitMode !== null}
              className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-60"
            >
              {submitMode === 'draft' ? '...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => submit('active')}
              disabled={submitMode !== null}
              className={btnPrimary}
            >
              {submitMode === 'active' ? '...' : 'Create & Activate'}
            </button>
          </div>
```

Șterge varianta veche cu `{error && ...}` care era deasupra footer-ului (acum e mutată în footer).

Șterge state-ul `busy` și `setBusy(...)` (înlocuit de `submitMode`). Caută `setBusy(true)` și `setBusy(false)` și elimină-le.

- [ ] **Step 3: Atașează inline errors la câmpurile start_date și end_date**

În același NewCampaignModal, găsește grid-ul `Start (T+0) / Final` (~linia 464-471) și adaugă mesaj de eroare sub fiecare input:

```tsx
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start (T+0)">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
              {fieldErrors.start_date && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.start_date}</p>
              )}
            </Field>
            <Field label="Final">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
              {fieldErrors.end_date && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.end_date}</p>
              )}
            </Field>
          </div>
```

- [ ] **Step 4: Fix §12.3 — adaugă router.refresh() în onCreated**

În același fișier, găsește (~liniile 203-206):

```tsx
          onCreated={(id) => {
            setShowNew(false)
            router.push(`/campaigns/${id}`)
          }}
```

Înlocuiește cu:

```tsx
          onCreated={(id) => {
            setShowNew(false)
            router.refresh()
            router.push(`/campaigns/${id}`)
          }}
```

- [ ] **Step 5: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 6: Verifică lint**

Run: `pnpm run lint`
Expected: no errors (warning-uri OK dacă sunt pre-existente).

- [ ] **Step 7: Smoke manual — flow Save as Draft**

`pnpm dev` → `/campaigns` → "+ Nouă campanie" → completează doar `name` + brand → click "Save as Draft".
Expected: modal close, redirect la `/campaigns/<id>`, campania apare ca draft, status="draft" în header.

- [ ] **Step 8: Smoke manual — flow Create & Activate cu validare**

Repetă pașii: "+ Nouă campanie" → completează doar name + brand → click "Create & Activate".
Expected: erori inline sub start_date + end_date ("Selectează data de start" / "Selectează data de final") + mesaj general "Completează câmpurile lipsă...". Modal NU se închide.

- [ ] **Step 9: Smoke manual — flow Create & Activate cu date OK**

Completează start_date și end_date → click "Create & Activate".
Expected: modal close, redirect la detail page, campania ca `status='active'`.

- [ ] **Step 10: Commit**

```bash
git add app/campaigns/campaigns-ui.tsx
git commit -m "feat(campaigns): butoane Save Draft / Create Activate + inline errors + router.refresh()"
```

---

## Task 7: UI — Detail page cu butoane condiționate pe status

**Files:**
- Modify: `app/campaigns/[id]/detail-ui.tsx:30-109` (CampaignDetailUI: schimbare logică butoane)

**Context:** Spec §2.6 + §4.2. Înlocuim butonul unic "Cancel" cu butoane condiționate: draft→{Activează, Șterge}, cancelled→{Șterge}, active|in_review→{Anulează}, completed→nimic destructiv.

- [ ] **Step 1: Import ConfirmModal**

În `app/campaigns/[id]/detail-ui.tsx`, la imports (după linia 5):

```tsx
import { ConfirmModal } from '@/lib/ui/confirm-modal'
```

- [ ] **Step 2: Adaugă state pentru noile modaluri și logica**

În `CampaignDetailUI`, după linia 46 (`const [cancelling, setCancelling] = useState(false)`), adaugă:

```tsx
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmActivate, setConfirmActivate] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activating, setActivating] = useState(false)

  async function hardDelete() {
    setDeleting(true)
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      router.push('/campaigns')
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp & { status?: string }
      setConfirmDelete(false)
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }

  async function activate() {
    const missing: string[] = []
    if (!campaign.start_date) missing.push('Data de start')
    if (!campaign.end_date) missing.push('Data de final')
    if (missing.length > 0) {
      setConfirmActivate(false)
      alert(`Nu se poate activa: lipsesc ${missing.join(', ')}. Editează campania înainte.`)
      return
    }
    setActivating(true)
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    setActivating(false)
    if (res.ok) {
      setConfirmActivate(false)
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp & {
        errors?: { field: string; code: string }[]
      }
      setConfirmActivate(false)
      if (data.errors && data.errors.length > 0) {
        const lst = data.errors.map((e) => `${e.field}: ${e.code}`).join(', ')
        alert(`Validare eșuată: ${lst}`)
      } else {
        alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
      }
    }
  }
```

- [ ] **Step 3: Înlocuiește `softCancel` ca să meargă doar pentru active/in_review**

Lasă funcția `softCancel` cum este — comportamentul ei (PATCH status='cancelled') rămâne corect pentru tranziția active→cancelled. Dar acum vom apela DELETE doar din `hardDelete`.

Modifică `softCancel` să folosească PATCH în loc de DELETE (DELETE acum e hard-delete):

```tsx
  async function softCancel() {
    if (!confirm(`Anulezi campaign "${campaign.name}"? (status → cancelled)`)) return
    setCancelling(true)
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setCancelling(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as ApiResp
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }
```

- [ ] **Step 4: Înlocuiește JSX-ul butoanelor**

Găsește blocul:

```tsx
      <button type="button" onClick={() => setEditing(true)} className={btnPrimary}>Edit</button>
      {campaign.status !== 'cancelled' && (
        <button type="button" onClick={softCancel} disabled={cancelling} className={btnDanger}>
          {cancelling ? '...' : 'Cancel'}
        </button>
      )}
```

Și înlocuiește cu:

```tsx
      <button type="button" onClick={() => setEditing(true)} className={btnPrimary}>Edit</button>

      {campaign.status === 'draft' && (
        <>
          <button
            type="button"
            onClick={() => setConfirmActivate(true)}
            disabled={activating}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
          >
            {activating ? '...' : 'Activează'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className={btnDanger}
          >
            {deleting ? '...' : 'Șterge'}
          </button>
        </>
      )}

      {campaign.status === 'cancelled' && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className={btnDanger}
        >
          {deleting ? '...' : 'Șterge'}
        </button>
      )}

      {(campaign.status === 'active' || campaign.status === 'in_review') && (
        <button type="button" onClick={softCancel} disabled={cancelling} className={btnDanger}>
          {cancelling ? '...' : 'Anulează'}
        </button>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Ștergi campania?"
          description={`"${campaign.name}" și toate datele asociate (participanți, livrabile, task-uri) vor fi șterse definitiv.`}
          confirmLabel="Șterge definitiv"
          variant="danger"
          busy={deleting}
          onConfirm={hardDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmActivate && (
        <ConfirmModal
          title="Activezi campania?"
          description={`"${campaign.name}" va trece în status Active și echipa va fi notificată.`}
          confirmLabel="Activează"
          variant="primary"
          busy={activating}
          onConfirm={activate}
          onCancel={() => setConfirmActivate(false)}
        />
      )}
```

- [ ] **Step 5: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 6: Smoke manual — Șterge draft**

`pnpm dev` → deschide o campanie draft → buton "Șterge" → confirm modal → "Șterge definitiv".
Expected: redirect la `/campaigns`, campania dispare din listă.

- [ ] **Step 7: Smoke manual — Activează draft fără date eșuează**

Crează un draft fără start/end date → buton "Activează" → modal confirm → click "Activează" → alert cu "lipsesc Data de start, Data de final".

- [ ] **Step 8: Smoke manual — Activează draft cu date OK**

Edit campania → adaugă start + end → salvează → buton "Activează" → modal → "Activează".
Expected: status se schimbă în `active`, refresh imediat.

- [ ] **Step 9: Smoke manual — Anulează active**

Campanie active → buton "Anulează" → confirm `window.confirm()` (pattern existent) → status devine `cancelled`.
Apoi pe aceeași campanie: vezi buton "Șterge" (pentru că status=cancelled). Click → confirm → ștergere reală.

- [ ] **Step 10: Commit**

```bash
git add app/campaigns/[id]/detail-ui.tsx
git commit -m "feat(campaigns): butoane condiționate pe status (Activează/Șterge/Anulează) pe detail page"
```

---

## Task 8: UI — Row delete icon în lista de campanii

**Files:**
- Modify: `app/campaigns/campaigns-ui.tsx` (CampaignRow sau echivalent — căutat la execution time)

**Context:** Spec §2.1 + §4.1. Icon delete vizibil pe row pentru status draft/cancelled, hover-revealed desktop / mereu vizibil mobile.

- [ ] **Step 1: Localizează componenta de row**

Run: `grep -n "function CampaignRow\|function CampaignsList\|items.map\|<tr" "app/campaigns/campaigns-ui.tsx" | head -20`

Identifică unde sunt renderate rândurile de campanii. Notează line range.

- [ ] **Step 2: Adaugă state pentru confirm delete row + handler**

În componenta CampaignsUI (după state-ul existent), adaugă:

```tsx
  const [rowToDelete, setRowToDelete] = useState<CampaignWithJoins | null>(null)
  const [rowDeleting, setRowDeleting] = useState(false)

  async function deleteRow(c: CampaignWithJoins) {
    setRowDeleting(true)
    const res = await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' })
    setRowDeleting(false)
    setRowToDelete(null)
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== c.id))
      router.refresh()
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Eroare: ${ErrorMap(data.error ?? 'server_error')}`)
    }
  }
```

- [ ] **Step 3: Importă icon Trash2 + ConfirmModal**

În top of file, după imports existente:

```tsx
import { Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/lib/ui/confirm-modal'
```

- [ ] **Step 4: Adaugă icon pe row (doar pentru draft/cancelled)**

În renderingul rândului (din Step 1 — locul exact depinde de structură), adaugă la finalul fiecărui row, în coloana de acțiuni sau ca trailing element:

```tsx
{(c.status === 'draft' || c.status === 'cancelled') && (
  <button
    type="button"
    aria-label="Șterge campania"
    onClick={(e) => {
      e.preventDefault()
      e.stopPropagation()
      setRowToDelete(c)
    }}
    className="p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
  >
    <Trash2 className="w-4 h-4" />
  </button>
)}
```

**Important:** dacă row-ul există ca `<Link>` sau e wrap-uit într-un `onClick` general, e nevoie de `e.preventDefault() + e.stopPropagation()` pentru ca butonul de delete să nu trigger-eze navigarea.

Asigură-te că parent-ul rândului are class `group` ca `group-hover` să meargă (ex: `<tr className="group ...">` sau `<a className="group ...">`).

- [ ] **Step 5: Adaugă ConfirmModal-ul la finalul componentei**

Înainte de closing `</>` în CampaignsUI, după `{showNew && (...)}`:

```tsx
      {rowToDelete && (
        <ConfirmModal
          title="Ștergi campania?"
          description={`"${rowToDelete.name}" și toate datele asociate vor fi șterse definitiv.`}
          confirmLabel="Șterge definitiv"
          variant="danger"
          busy={rowDeleting}
          onConfirm={() => deleteRow(rowToDelete)}
          onCancel={() => setRowToDelete(null)}
        />
      )}
```

- [ ] **Step 6: Verifică typecheck**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 7: Verifică lint**

Run: `pnpm run lint`
Expected: no new errors.

- [ ] **Step 8: Smoke manual desktop**

`pnpm dev` → `/campaigns` → hover pe row cu status draft → vezi iconul de Trash2 apare → click → confirm modal → "Șterge definitiv" → row dispare.
Repetă pentru un row cu status active → iconul de Trash2 NU apare.

- [ ] **Step 9: Smoke manual mobile/touch**

Simulate touch device: DevTools → Device toolbar → Pixel/iPhone. Sau testează pe iPhone direct dacă posibil.
Expected: iconul apare permanent pe rows draft/cancelled (nu hover-only).

- [ ] **Step 10: Commit**

```bash
git add app/campaigns/campaigns-ui.tsx
git commit -m "feat(campaigns): icon șterge pe row în lista pentru status draft/cancelled"
```

---

## Task 9: Verificare bug §12.2 (filtru status)

**Files:**
- Investigate-only or modify `app/campaigns/campaigns-ui.tsx` if needed

**Context:** Codul backend e corect (`sp.getAll('status')` → `in('status', statuses)`). Suspect UX state. Investigăm live.

- [ ] **Step 1: Pornește dev server**

Run: `pnpm dev`

- [ ] **Step 2: Reproduce filtru multi-status**

`/campaigns` → click chip "draft" → click chip "active" → vezi URL? Conține `?status=draft&status=active`?

Verifică Network → API call `/api/campaigns?status=draft&status=active` returnează doar campanii cu acele status-uri?

Lista randată conține doar draft + active?

- [ ] **Step 3: Decide**

- Dacă lista e corectă → bug-ul §12.2 e rezolvat indirect prin `router.refresh()` din Task 6 step 4. Nu mai e nevoie de fix.
- Dacă lista e INCORECTĂ → identifică unde se pierde info. Posibile cauze:
  - chips state nu reflectă URL params (verifică `initialFilters.statuses` în page.tsx)
  - `toggleStatus` (linia ~245-249) face replace în loc de append corect
  - server component nu re-fetch după URL change

- [ ] **Step 4: Fix dacă e nevoie**

Aplică fix-ul targetat. Probabil în `app/campaigns/page.tsx` sau în logica `toggleStatus` din `campaigns-ui.tsx`.

- [ ] **Step 5: Smoke reverificare**

Re-testează filtru multi-status. Confirmă funcționarea.

- [ ] **Step 6: Commit (dacă a fost nevoie de fix)**

```bash
git add <files-modificate>
git commit -m "fix(campaigns): filtru status multi-select afișează corect campanii"
```

Dacă nu a fost nevoie de fix, sari pasul ăsta.

---

## Task 10: Verificare finală + raport

**Files:**
- N/A (verification only)

- [ ] **Step 1: Typecheck complet**

Run: `pnpm run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Lint complet**

Run: `pnpm run lint`
Expected: 0 errors (warning-uri pre-existente acceptabile).

- [ ] **Step 3: Build production**

Run: `pnpm run build`
Expected: build success, fără erori. Notează size-ul output-ului (`.next/`).

- [ ] **Step 4: Smoke matrix completă**

Verifică în browser local pe `pnpm dev`:

| # | Scenariu | Expected |
|---|----------|----------|
| 1 | Creare draft cu doar nume+brand | OK, status=draft |
| 2 | Creare active fără date | 422 cu erori inline pe start_date+end_date |
| 3 | Creare active cu date complete | OK, status=active |
| 4 | Activează draft fără date (din detail) | Alert "lipsesc..." |
| 5 | Activează draft cu date (din detail) | OK, status=active, refresh |
| 6 | Anulează active (din detail) | OK, status=cancelled |
| 7 | Șterge draft (din detail) | Hard delete, redirect /campaigns |
| 8 | Șterge cancelled (din detail) | Hard delete, redirect /campaigns |
| 9 | Șterge draft (din row în listă) | Hard delete, row dispare |
| 10 | Șterge active (încerc DELETE direct via fetch) | 409 invalid_status_for_delete |
| 11 | Filtru status multi-select (draft+active) | Doar campaniile cu acele status-uri |
| 12 | După creare, click "Campanii" în nav | Lista actualizată, nu blocată |

- [ ] **Step 5: Push pe main**

```bash
git push origin main
```

- [ ] **Step 6: Verifică GHA deploy**

Așteaptă ~2 min, apoi verifică:
- run-ul GitHub Actions deploy pe `https://github.com/officesoldoutmedia/influenceroom/actions`
- live URL: `https://influenceroom.office-2e5.workers.dev/campaigns`

Smoke quick pe live cu 1 user de test.

- [ ] **Step 7: Raport final pentru Stefan**

Output format (per memoria `feedback_report_format`):
- typecheck: ✅/❌
- build: ✅/❌
- smoke matrix: tabel 12 scenarii cu ✅/❌
- git log: ultimii 8 commits
- GHA run: link + status
- bug-uri rămase (dacă există)
- token rotation: N/A (nu am atins secrete)

---

## Self-Review

**Spec coverage:** §12.1 (Task 2 + 5 + 7 + 8), §12.2 (Task 9), §12.3 (Task 6 step 4), §12.4 (Task 3 + 4 + 6 + 7), §12.5 (Task 1 + 6). Toate cele 5 puncte din feedback acoperite.

**Placeholder scan:** Nu există "TBD" sau "implement later". Task 9 step 4 zice "aplică fix-ul targetat" — acceptabil pentru că depinde de root cause-ul descoperit la execution time; alternativele sunt enumerate explicit la step 3.

**Type consistency:** `validateCreateBody` returnează `FieldError[]`. `validation_failed` error shape e consistent între POST și PATCH (`errors: { field, code }[]`). ConfirmModal props consistente între Task 7 și Task 8.

**Files changed:**
- `app/api/campaigns/route.ts` (Task 3)
- `app/api/campaigns/[id]/route.ts` (Task 2 + 4)
- `app/campaigns/campaigns-ui.tsx` (Task 6 + 8)
- `app/campaigns/[id]/detail-ui.tsx` (Task 7)
- `lib/ui/confirm-modal.tsx` (Task 5 — new file)

Total: 4 files modified, 1 new, ~10 commits planificate.

**Risk reminder:** spec §6 — hard delete cu confirm modal e protecția de bază; cascade-urile FK sunt confirmate la Task 2 step 4 prin reproducerea live.
