'use client'

import { useMemo, useState } from 'react'
import {
  TIERS,
  TIER_LABELS_RANGE,
  TIER_LABELS_FULL,
  PLATFORMS,
  PLATFORM_LABEL,
  STATUSES,
  PRESET_TAGS,
  inferUrl,
  validateUrl,
  normalizeHandle,
  maxFollowers,
  calcTier,
  type Tier,
  type Platform,
  type SocialHandle,
  type SocialHandles,
  type InfluencerStatus,
  type Influencer,
  type FiscalData,
  type ManagerSummary,
} from '@/lib/influencers/types'
import {
  ENGAGEMENT_LEVEL_COLORS,
  ENGAGEMENT_LEVEL_LABELS,
  engagementLevelFromRate,
} from '@/lib/influencers/social'
import {
  RATE_TYPES_PER_PLATFORM,
  RATE_TYPE_LABELS,
  RATE_TYPE_DESCRIPTIONS,
  type RateCards,
} from '@/lib/rate-cards/types'

// Form-side mirror of RateCards: values are strings because <input type=number>
// gives us strings until we coerce on submit. Empty string == "not set".
type RateCardsForm = Partial<Record<Platform, Partial<Record<string, string>>>>

export type FormValues = {
  name: string
  tier: Tier | ''
  tier_manual_override: boolean
  language: string
  location_city: string
  location_country: string
  niche_tags: string[]
  social_handles: SocialHandles
  rate_cards: RateCardsForm
  contact_email: string
  contact_phone: string
  agent_name: string
  agent_email: string
  fiscal_data: FiscalData
  exclusive: boolean
  status: InfluencerStatus
  notes: string
  account_manager_id: string
}

export function emptyForm(defaultManagerId: string = ''): FormValues {
  return {
    name: '',
    tier: '',
    tier_manual_override: false,
    language: 'ro',
    location_city: '',
    location_country: 'Romania',
    niche_tags: [],
    social_handles: {},
    rate_cards: {},
    contact_email: '',
    contact_phone: '',
    agent_name: '',
    agent_email: '',
    fiscal_data: {},
    exclusive: false,
    status: 'active',
    notes: '',
    account_manager_id: defaultManagerId,
  }
}

export function influencerToForm(i: Influencer): FormValues {
  return {
    name: i.name,
    tier: (i.tier ?? '') as Tier | '',
    tier_manual_override: i.tier_manual_override,
    language: i.language ?? 'ro',
    location_city: i.location_city ?? '',
    location_country: i.location_country ?? 'Romania',
    niche_tags: i.niche_tags ?? [],
    social_handles: i.social_handles ?? {},
    rate_cards: rateCardsToForm(i.rate_cards ?? {}),
    contact_email: i.contact_email ?? '',
    contact_phone: i.contact_phone ?? '',
    agent_name: i.agent_name ?? '',
    agent_email: i.agent_email ?? '',
    fiscal_data: i.fiscal_data ?? {},
    exclusive: i.exclusive,
    status: i.status,
    notes: i.notes ?? '',
    account_manager_id: i.account_manager_id ?? '',
  }
}

function rateCardsToForm(rc: RateCards): RateCardsForm {
  const out: RateCardsForm = {}
  for (const platform of PLATFORMS) {
    const card = rc[platform]
    if (!card) continue
    const formCard: Partial<Record<string, string>> = {}
    for (const rt of RATE_TYPES_PER_PLATFORM[platform] as readonly string[]) {
      const v = card[rt]
      if (typeof v === 'number') formCard[rt] = String(v)
    }
    if (Object.keys(formCard).length > 0) out[platform] = formCard
  }
  return out
}

function formToRateCards(rcf: RateCardsForm): RateCards {
  // Mirrors the API validator: drops empty/missing values, only keeps platforms
  // with at least one positive rate. The server is the source of truth and
  // re-validates, but pre-cleaning here keeps the wire payload compact.
  const out: RateCards = {}
  for (const platform of PLATFORMS) {
    const card = rcf[platform]
    if (!card) continue
    const cleaned: Record<string, number> = {}
    for (const rt of RATE_TYPES_PER_PLATFORM[platform] as readonly string[]) {
      const s = card[rt]
      if (s == null || s === '') continue
      const n = Number(s)
      if (Number.isFinite(n) && n >= 0) cleaned[rt] = n
    }
    if (Object.keys(cleaned).length > 0) out[platform] = cleaned
  }
  return out
}

export function formToPayload(f: FormValues): Record<string, unknown> {
  // Strip empty handles, normalize the rest.
  const social: SocialHandles = {}
  for (const k of PLATFORMS) {
    const entry = f.social_handles[k]
    if (!entry) continue
    const handle = normalizeHandle(entry.handle ?? '')
    if (!handle) continue
    social[k] = {
      handle,
      url: entry.url?.trim() || inferUrl(k, handle),
      followers: Number.isFinite(entry.followers) ? entry.followers : 0,
    }
  }
  const fiscal: FiscalData = {}
  for (const k of ['entity_type', 'cui', 'iban', 'address'] as const) {
    const v = f.fiscal_data[k]
    if (v && v.trim()) fiscal[k] = v.trim()
  }
  const payload: Record<string, unknown> = {
    name: f.name.trim(),
    tier_manual_override: f.tier_manual_override,
    language: f.language || 'ro',
    location_city: f.location_city.trim() || null,
    location_country: f.location_country.trim() || 'Romania',
    niche_tags: f.niche_tags,
    social_handles: social,
    rate_cards: formToRateCards(f.rate_cards),
    contact_email: f.contact_email.trim() || null,
    contact_phone: f.contact_phone.trim() || null,
    agent_name: f.agent_name.trim() || null,
    agent_email: f.agent_email.trim() || null,
    fiscal_data: Object.keys(fiscal).length > 0 ? fiscal : null,
    exclusive: f.exclusive,
    status: f.status,
    notes: f.notes.trim() || null,
    account_manager_id: f.account_manager_id || null,
  }
  // Tier value only matters when override is on; the trigger ignores it
  // otherwise but include it to make audit logs unambiguous.
  if (f.tier_manual_override && f.tier) payload.tier = f.tier
  return payload
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20'
const inputErrorCls =
  'w-full px-3 py-2 border border-rose-400 rounded-lg text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
const textareaCls = `${inputCls} min-h-[60px]`
const labelCls = 'block text-xs font-medium text-stone-600 mb-1'
const sectionTitle = 'text-sm font-semibold text-stone-900 mt-5 mb-2'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  )
}

export function InfluencerFormFields({
  form,
  set,
  managers,
}: {
  form: FormValues
  set: (f: FormValues) => void
  managers: ManagerSummary[]
}) {
  const [tagInput, setTagInput] = useState('')
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<Platform>>(
    () => new Set((Object.keys(form.social_handles) as Platform[]).filter((k) => form.social_handles[k]))
  )

  function addTag(t: string) {
    const trimmed = t.trim().toLowerCase()
    if (!trimmed || form.niche_tags.includes(trimmed)) return
    set({ ...form, niche_tags: [...form.niche_tags, trimmed] })
  }
  function removeTag(t: string) {
    set({ ...form, niche_tags: form.niche_tags.filter((x) => x !== t) })
  }

  function togglePlatform(p: Platform) {
    const next = new Set(expandedPlatforms)
    if (next.has(p)) {
      next.delete(p)
      // Drop the entry from social_handles when collapsing.
      const updated = { ...form.social_handles }
      delete updated[p]
      set({ ...form, social_handles: updated })
    } else {
      next.add(p)
      // Initialize empty entry; user fills it.
      if (!form.social_handles[p]) {
        set({
          ...form,
          social_handles: {
            ...form.social_handles,
            [p]: { handle: '', url: '', followers: 0 } as SocialHandle,
          },
        })
      }
    }
    setExpandedPlatforms(next)
  }

  function setHandle(p: Platform, handle: string) {
    const cleanHandle = handle
    const cur = form.social_handles[p] ?? { handle: '', url: '', followers: 0 }
    // Auto-fill URL if empty or matches the previous inferred URL.
    const prevInferred = inferUrl(p, cur.handle)
    const nextUrl =
      cur.url === '' || cur.url === prevInferred ? inferUrl(p, normalizeHandle(cleanHandle)) : cur.url
    set({
      ...form,
      social_handles: {
        ...form.social_handles,
        [p]: { ...cur, handle: cleanHandle, url: nextUrl },
      },
    })
  }

  function setUrl(p: Platform, url: string) {
    const cur = form.social_handles[p] ?? { handle: '', url: '', followers: 0 }
    set({
      ...form,
      social_handles: { ...form.social_handles, [p]: { ...cur, url } },
    })
  }

  function setFollowers(p: Platform, val: string) {
    const cur = form.social_handles[p] ?? { handle: '', url: '', followers: 0 }
    const num = val === '' ? 0 : Number(val)
    set({
      ...form,
      social_handles: { ...form.social_handles, [p]: { ...cur, followers: num } },
    })
  }

  function setEngagementRate(p: Platform, val: string) {
    const cur = form.social_handles[p] ?? { handle: '', url: '', followers: 0 }
    // Empty input → remove the field entirely so the validator drops it
    // from the persisted JSONB. Non-empty → coerce to number; we let the
    // validator do the 0..100 bounds check on submit and just keep the
    // raw entry between renders.
    if (val === '') {
      const { engagement_rate: _drop, ...rest } = cur
      void _drop
      set({
        ...form,
        social_handles: { ...form.social_handles, [p]: rest as SocialHandle },
      })
      return
    }
    const num = Number(val)
    set({
      ...form,
      social_handles: { ...form.social_handles, [p]: { ...cur, engagement_rate: num } },
    })
  }

  const autoTier = useMemo(() => calcTier(maxFollowers(form.social_handles)), [form.social_handles])

  return (
    <div className="space-y-3">
      <h3 className={sectionTitle}>Basic</h3>
      <Field label="Name *">
        <input
          value={form.name}
          onChange={(e) => set({ ...form, name: e.target.value })}
          required
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Language">
          <input value={form.language} onChange={(e) => set({ ...form, language: e.target.value })} className={inputCls} />
        </Field>
        <Field label="City">
          <input value={form.location_city} onChange={(e) => set({ ...form, location_city: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Country">
          <input value={form.location_country} onChange={(e) => set({ ...form, location_country: e.target.value })} className={inputCls} />
        </Field>
      </div>

      <Field label="Niche tags">
        <div className="border border-stone-300 rounded-lg p-2 focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-500/20">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {form.niche_tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-800 px-2 py-0.5 rounded-full">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="hover:text-brand-900">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag(tagInput)
                  setTagInput('')
                } else if (e.key === 'Backspace' && !tagInput && form.niche_tags.length > 0) {
                  removeTag(form.niche_tags[form.niche_tags.length - 1])
                }
              }}
              placeholder="Type + Enter or pick below"
              className="flex-1 min-w-[120px] text-sm focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESET_TAGS.filter((t) => !form.niche_tags.includes(t)).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addTag(t)}
                className="text-[10px] uppercase tracking-wide text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-400 px-2 py-0.5 rounded-full"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
      </Field>

      <h3 className={sectionTitle}>Social media</h3>
      <div className="space-y-2">
        {PLATFORMS.map((p) => {
          const expanded = expandedPlatforms.has(p)
          const entry = form.social_handles[p]
          const urlValid = !entry?.url || validateUrl(p, entry.url)
          return (
            <div
              key={p}
              className={`border rounded-lg ${expanded ? 'border-brand-300 bg-brand-50/30' : 'border-stone-200'}`}
            >
              <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expanded}
                  onChange={() => togglePlatform(p)}
                />
                <span className="text-sm font-medium text-stone-800">{PLATFORM_LABEL[p]}</span>
                {entry?.handle && (
                  <span className="text-[12px] text-stone-500">
                    @{normalizeHandle(entry.handle)}
                    {entry.followers > 0 && ` · ${entry.followers.toLocaleString('ro-RO')} followers`}
                  </span>
                )}
              </label>
              {expanded && (
                <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Handle">
                    <input
                      value={entry?.handle ?? ''}
                      onChange={(e) => setHandle(p, e.target.value)}
                      placeholder="cartedor (fără @)"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="URL">
                    <input
                      type="url"
                      value={entry?.url ?? ''}
                      onChange={(e) => setUrl(p, e.target.value)}
                      placeholder="https://..."
                      className={urlValid ? inputCls : inputErrorCls}
                    />
                  </Field>
                  <Field label="Followers">
                    <input
                      type="number"
                      min={0}
                      value={entry?.followers ?? 0}
                      onChange={(e) => setFollowers(p, e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Engagement %">
                    <EngagementRateInput
                      value={entry?.engagement_rate}
                      onChange={(v) => setEngagementRate(p, v)}
                    />
                  </Field>
                  {!urlValid && (
                    <p className="sm:col-span-3 text-[12px] text-rose-600 -mt-1">
                      URL trebuie să fie HTTPS și pe domeniul {PLATFORM_LABEL[p]}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h3 className={sectionTitle}>Tier</h3>
      <div className="border border-stone-200 rounded-lg p-3 space-y-3">
        <p className="text-[13px] text-stone-700">
          Auto-calculat: <strong>{TIER_LABELS_FULL[autoTier]}</strong>
          <span className="text-stone-500"> (max followers: {maxFollowers(form.social_handles).toLocaleString('ro-RO')})</span>
        </p>
        <label className="flex items-center gap-2 text-[13px] text-stone-700">
          <input
            type="checkbox"
            checked={form.tier_manual_override}
            onChange={(e) => {
              const on = e.target.checked
              set({
                ...form,
                tier_manual_override: on,
                tier: on ? (form.tier || autoTier) : '',
              })
            }}
          />
          <span>Override manual</span>
        </label>
        {form.tier_manual_override && (
          <Field label="Tier (manual)">
            <select
              value={form.tier || autoTier}
              onChange={(e) => set({ ...form, tier: e.target.value as Tier })}
              className={inputCls}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>{TIER_LABELS_RANGE[t]}</option>
              ))}
            </select>
          </Field>
        )}
        <p className="text-[12px] text-stone-500">
          Tier-ul se actualizează automat când modifici follower count-ul. Activează override
          manual doar pentru cazuri speciale.
        </p>
      </div>

      <h3 className={sectionTitle}>Rate Cards (EUR)</h3>
      <p className="text-[12px] text-stone-500 -mt-1 mb-2">
        Tarife per platformă. Lasă gol dacă nu se aplică. UR-30 = drept de
        utilizare conținut în brand assets pentru 30 zile.
      </p>
      <RateCardsFields form={form} set={set} />

      <h3 className={sectionTitle}>Contact</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input type="email" value={form.contact_email} onChange={(e) => set({ ...form, contact_email: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={form.contact_phone} onChange={(e) => set({ ...form, contact_phone: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Agent name">
          <input value={form.agent_name} onChange={(e) => set({ ...form, agent_name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Agent email">
          <input type="email" value={form.agent_email} onChange={(e) => set({ ...form, agent_email: e.target.value })} className={inputCls} />
        </Field>
      </div>

      <h3 className={sectionTitle}>Fiscal</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entity type">
          <input
            value={form.fiscal_data.entity_type ?? ''}
            onChange={(e) => set({ ...form, fiscal_data: { ...form.fiscal_data, entity_type: e.target.value } })}
            className={inputCls}
            placeholder="PFA / SRL / persoană fizică"
          />
        </Field>
        <Field label="CUI">
          <input
            value={form.fiscal_data.cui ?? ''}
            onChange={(e) => set({ ...form, fiscal_data: { ...form.fiscal_data, cui: e.target.value } })}
            className={inputCls}
          />
        </Field>
        <Field label="IBAN">
          <input
            value={form.fiscal_data.iban ?? ''}
            onChange={(e) => set({ ...form, fiscal_data: { ...form.fiscal_data, iban: e.target.value } })}
            className={inputCls}
          />
        </Field>
        <Field label="Address">
          <input
            value={form.fiscal_data.address ?? ''}
            onChange={(e) => set({ ...form, fiscal_data: { ...form.fiscal_data, address: e.target.value } })}
            className={inputCls}
          />
        </Field>
      </div>

      <h3 className={sectionTitle}>Status & ownership</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select value={form.status} onChange={(e) => set({ ...form, status: e.target.value as InfluencerStatus })} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Account manager">
          <select
            value={form.account_manager_id}
            onChange={(e) => set({ ...form, account_manager_id: e.target.value })}
            className={inputCls}
          >
            <option value="">— Unassigned —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.exclusive} onChange={(e) => set({ ...form, exclusive: e.target.checked })} />
        <span className="text-sm text-stone-700">Exclusive</span>
      </label>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => set({ ...form, notes: e.target.value })} className={textareaCls} />
      </Field>
    </div>
  )
}

function RateCardsFields({
  form,
  set,
}: {
  form: FormValues
  set: (f: FormValues) => void
}) {
  // Auto-expand platforms that already have at least one rate. Closed
  // platforms hide their inputs but preserve any value already typed in this
  // session via React state — toggling collapse only affects visibility.
  const [expanded, setExpanded] = useState<Set<Platform>>(
    () =>
      new Set(
        PLATFORMS.filter((p) => {
          const card = form.rate_cards[p]
          return card && Object.values(card).some((v) => v != null && v !== '')
        }),
      ),
  )

  function toggle(p: Platform) {
    const next = new Set(expanded)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setExpanded(next)
  }

  function setRate(p: Platform, rateType: string, val: string) {
    const card = { ...(form.rate_cards[p] ?? {}) }
    if (val === '') {
      delete card[rateType]
    } else {
      card[rateType] = val
    }
    const nextCards: RateCardsForm = { ...form.rate_cards }
    if (Object.keys(card).length === 0) {
      delete nextCards[p]
    } else {
      nextCards[p] = card
    }
    set({ ...form, rate_cards: nextCards })
  }

  function isInvalid(val: string): boolean {
    if (val === '') return false
    const n = Number(val)
    return !Number.isFinite(n) || n < 0
  }

  return (
    <div className="space-y-2">
      {PLATFORMS.map((p) => {
        const types = RATE_TYPES_PER_PLATFORM[p]
        const card = form.rate_cards[p] ?? {}
        const filled = Object.values(card).filter((v) => v != null && v !== '').length
        const isOpen = expanded.has(p)
        return (
          <div
            key={p}
            className={`border rounded-lg ${isOpen ? 'border-brand-300 bg-brand-50/30' : 'border-stone-200'}`}
          >
            <button
              type="button"
              onClick={() => toggle(p)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-medium text-stone-800">
                {PLATFORM_LABEL[p]}
              </span>
              <span className="flex items-center gap-2 text-[12px] text-stone-500">
                {filled > 0 ? `${filled} rate${filled === 1 ? '' : '-uri'} completat${filled === 1 ? '' : 'e'}` : 'gol'}
                <span className="text-stone-400">{isOpen ? '▾' : '▸'}</span>
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {types.map((rt) => {
                  const val = card[rt] ?? ''
                  const invalid = isInvalid(val)
                  const desc = RATE_TYPE_DESCRIPTIONS[rt]
                  return (
                    <Field key={rt} label={`${RATE_TYPE_LABELS[rt] ?? rt} (€)`}>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={val}
                          onChange={(e) => setRate(p, rt, e.target.value)}
                          className={`${invalid ? inputErrorCls : inputCls} pr-8`}
                          aria-invalid={invalid}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-stone-400 pointer-events-none">
                          €
                        </span>
                      </div>
                      {invalid && (
                        <p className="text-[11px] text-rose-600 mt-1">Valoare invalidă</p>
                      )}
                      {desc && (
                        <p className="text-[11px] text-stone-500 mt-1">{desc}</p>
                      )}
                    </Field>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ER input with a live level badge preview to the right of the field. The
// badge appears as soon as the typed value falls in a valid 0..100 band; an
// empty / invalid input shows no badge. Two decimals (step 0.01) match the
// validator's storage precision.
function EngagementRateInput({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (next: string) => void
}) {
  // Keep a local draft string so users can type "0." or "3." without the
  // controlled value re-rendering them away from the decimal point.
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value))

  const numericDraft = draft === '' ? null : Number(draft)
  const previewRate = numericDraft != null && Number.isFinite(numericDraft) ? numericDraft : null
  const outOfRange = previewRate != null && (previewRate < 0 || previewRate > 100)
  const level = !outOfRange ? engagementLevelFromRate(previewRate) : null

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.01}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            onChange(e.target.value)
          }}
          onBlur={() => {
            // Sync local draft with the canonical value (round to 2 dp)
            // so e.g. "3.4500" tidies up to "3.45" on blur.
            if (draft === '') return
            const n = Number(draft)
            if (Number.isFinite(n)) setDraft(String(Math.round(n * 100) / 100))
          }}
          placeholder="ex: 3.45"
          className={`${outOfRange ? inputErrorCls : inputCls} pr-7`}
          aria-invalid={outOfRange}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-stone-400 pointer-events-none">
          %
        </span>
      </div>
      {level && (
        <span
          className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ENGAGEMENT_LEVEL_COLORS[level]}`}
        >
          {ENGAGEMENT_LEVEL_LABELS[level]}
        </span>
      )}
      {outOfRange && (
        <span className="text-[11px] text-rose-600 whitespace-nowrap">0–100</span>
      )}
    </div>
  )
}
