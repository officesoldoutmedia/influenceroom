'use client'

import { useState } from 'react'
import {
  TIERS,
  PLATFORMS,
  STATUSES,
  PRESET_TAGS,
  type Tier,
  type Platform,
  type InfluencerStatus,
  type Influencer,
  type PlatformStats,
  type FiscalData,
} from '@/lib/influencers/types'

export type FormValues = {
  name: string
  primary_handle: string
  tier: Tier | ''
  language: string
  location_city: string
  location_country: string
  niche_tags: string[]
  platforms: Partial<Record<Platform, PlatformStats>>
  rate_post: string
  rate_story: string
  rate_reel: string
  rate_video: string
  contact_email: string
  contact_phone: string
  agent_name: string
  agent_email: string
  fiscal_data: FiscalData
  exclusive: boolean
  status: InfluencerStatus
  notes: string
}

export function emptyForm(): FormValues {
  return {
    name: '',
    primary_handle: '',
    tier: '',
    language: 'ro',
    location_city: '',
    location_country: 'Romania',
    niche_tags: [],
    platforms: {},
    rate_post: '',
    rate_story: '',
    rate_reel: '',
    rate_video: '',
    contact_email: '',
    contact_phone: '',
    agent_name: '',
    agent_email: '',
    fiscal_data: {},
    exclusive: false,
    status: 'active',
    notes: '',
  }
}

export function influencerToForm(i: Influencer): FormValues {
  return {
    name: i.name,
    primary_handle: i.primary_handle ?? '',
    tier: (i.tier ?? '') as Tier | '',
    language: i.language ?? 'ro',
    location_city: i.location_city ?? '',
    location_country: i.location_country ?? 'Romania',
    niche_tags: i.niche_tags ?? [],
    platforms: i.platforms ?? {},
    rate_post: i.rate_post == null ? '' : String(i.rate_post),
    rate_story: i.rate_story == null ? '' : String(i.rate_story),
    rate_reel: i.rate_reel == null ? '' : String(i.rate_reel),
    rate_video: i.rate_video == null ? '' : String(i.rate_video),
    contact_email: i.contact_email ?? '',
    contact_phone: i.contact_phone ?? '',
    agent_name: i.agent_name ?? '',
    agent_email: i.agent_email ?? '',
    fiscal_data: i.fiscal_data ?? {},
    exclusive: i.exclusive,
    status: i.status,
    notes: i.notes ?? '',
  }
}

export function formToPayload(f: FormValues): Record<string, unknown> {
  const numOrNull = (s: string) => (s === '' ? null : Number(s))
  // Strip empty platform sub-objects
  const platforms: Record<string, PlatformStats> = {}
  for (const k of PLATFORMS) {
    const p = f.platforms[k]
    if (!p) continue
    const cleaned: PlatformStats = {}
    if (p.handle) cleaned.handle = p.handle
    if (p.followers !== undefined && p.followers !== null && !Number.isNaN(p.followers)) cleaned.followers = p.followers
    if (p.engagement_rate !== undefined && p.engagement_rate !== null && !Number.isNaN(p.engagement_rate)) cleaned.engagement_rate = p.engagement_rate
    if (Object.keys(cleaned).length > 0) platforms[k] = cleaned
  }
  const fiscal: FiscalData = {}
  for (const k of ['entity_type', 'cui', 'iban', 'address'] as const) {
    const v = f.fiscal_data[k]
    if (v && v.trim()) fiscal[k] = v.trim()
  }
  return {
    name: f.name.trim(),
    primary_handle: f.primary_handle.trim() || null,
    tier: f.tier || null,
    language: f.language || 'ro',
    location_city: f.location_city.trim() || null,
    location_country: f.location_country.trim() || 'Romania',
    niche_tags: f.niche_tags,
    platforms,
    rate_post: numOrNull(f.rate_post),
    rate_story: numOrNull(f.rate_story),
    rate_reel: numOrNull(f.rate_reel),
    rate_video: numOrNull(f.rate_video),
    contact_email: f.contact_email.trim() || null,
    contact_phone: f.contact_phone.trim() || null,
    agent_name: f.agent_name.trim() || null,
    agent_email: f.agent_email.trim() || null,
    fiscal_data: Object.keys(fiscal).length > 0 ? fiscal : null,
    exclusive: f.exclusive,
    status: f.status,
    notes: f.notes.trim() || null,
  }
}

const inputCls =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
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

export function InfluencerFormFields({ form, set }: { form: FormValues; set: (f: FormValues) => void }) {
  const [tagInput, setTagInput] = useState('')

  function addTag(t: string) {
    const trimmed = t.trim().toLowerCase()
    if (!trimmed || form.niche_tags.includes(trimmed)) return
    set({ ...form, niche_tags: [...form.niche_tags, trimmed] })
  }
  function removeTag(t: string) {
    set({ ...form, niche_tags: form.niche_tags.filter((x) => x !== t) })
  }

  function setPlatform(p: Platform, patch: Partial<PlatformStats>) {
    const cur = form.platforms[p] ?? {}
    set({ ...form, platforms: { ...form.platforms, [p]: { ...cur, ...patch } } })
  }

  return (
    <div className="space-y-3">
      <h3 className={sectionTitle}>Basic</h3>
      <Field label="Name *">
        <input value={form.name} onChange={(e) => set({ ...form, name: e.target.value })} required className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary handle">
          <input value={form.primary_handle} onChange={(e) => set({ ...form, primary_handle: e.target.value })} className={inputCls} placeholder="@handle" />
        </Field>
        <Field label="Tier">
          <select value={form.tier} onChange={(e) => set({ ...form, tier: e.target.value as Tier | '' })} className={inputCls}>
            <option value="">—</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
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
        <div className="border border-stone-300 rounded-lg p-2 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {form.niche_tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="hover:text-indigo-900">×</button>
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

      <h3 className={sectionTitle}>Platforms</h3>
      {PLATFORMS.map((p) => {
        const stats = form.platforms[p] ?? {}
        return (
          <div key={p} className="border border-stone-200 rounded-lg p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-700 mb-2">{p}</div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Handle">
                <input
                  value={stats.handle ?? ''}
                  onChange={(e) => setPlatform(p, { handle: e.target.value })}
                  className={inputCls}
                  placeholder="@handle"
                />
              </Field>
              <Field label="Followers">
                <input
                  type="number"
                  min={0}
                  value={stats.followers ?? ''}
                  onChange={(e) => setPlatform(p, { followers: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Engagement rate (0-1)">
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  max={1}
                  value={stats.engagement_rate ?? ''}
                  onChange={(e) => setPlatform(p, { engagement_rate: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={inputCls}
                  placeholder="0.045"
                />
              </Field>
            </div>
          </div>
        )
      })}

      <h3 className={sectionTitle}>Rates (RON)</h3>
      <div className="grid grid-cols-4 gap-3">
        {(['rate_post', 'rate_story', 'rate_reel', 'rate_video'] as const).map((k) => (
          <Field key={k} label={k.replace('rate_', '')}>
            <input
              type="number"
              min={0}
              value={form[k]}
              onChange={(e) => set({ ...form, [k]: e.target.value })}
              className={inputCls}
            />
          </Field>
        ))}
      </div>

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

      <h3 className={sectionTitle}>Status & notes</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select value={form.status} onChange={(e) => set({ ...form, status: e.target.value as InfluencerStatus })} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 mt-5">
          <input type="checkbox" checked={form.exclusive} onChange={(e) => set({ ...form, exclusive: e.target.checked })} />
          <span className="text-sm text-stone-700">Exclusive</span>
        </label>
      </div>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => set({ ...form, notes: e.target.value })} className={textareaCls} />
      </Field>
    </div>
  )
}
