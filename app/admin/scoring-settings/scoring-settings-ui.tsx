'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/lib/ui'
import {
  CRITERION_LABELS,
  DEFAULT_WEIGHTS,
  SCORING_CRITERIA,
  type ScoringSettings,
  type ScoringCriterion,
} from '@/lib/scoring/types'

const FIELD_BY_CRITERION: Record<
  ScoringCriterion,
  keyof typeof DEFAULT_WEIGHTS
> = {
  engagement_rate: 'weight_engagement_rate',
  cpv: 'weight_cpv',
  audience_ro: 'weight_audience_ro',
  punctuality: 'weight_punctuality',
  deliverable_quality: 'weight_deliverable_quality',
  collaboration_history: 'weight_collaboration_history',
}

type Weights = typeof DEFAULT_WEIGHTS

function formatRelative(iso: string | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'acum câteva secunde'
  if (min < 60) return `acum ${min} min`
  const hr = Math.round(min / 60)
  if (hr < 24) return `acum ${hr} h`
  const d = Math.round(hr / 24)
  return `acum ${d} z`
}

export function ScoringSettingsUI({
  initialSettings,
  influencerCount,
  updaterName,
}: {
  initialSettings: ScoringSettings | null
  influencerCount: number
  updaterName: string | null
}) {
  const router = useRouter()
  const [settings, setSettings] = useState<ScoringSettings | null>(initialSettings)
  const [weights, setWeights] = useState<Weights>(() =>
    initialSettings
      ? {
          weight_engagement_rate: initialSettings.weight_engagement_rate,
          weight_cpv: initialSettings.weight_cpv,
          weight_audience_ro: initialSettings.weight_audience_ro,
          weight_punctuality: initialSettings.weight_punctuality,
          weight_deliverable_quality: initialSettings.weight_deliverable_quality,
          weight_collaboration_history: initialSettings.weight_collaboration_history,
        }
      : DEFAULT_WEIGHTS,
  )
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const sum = useMemo(
    () =>
      weights.weight_engagement_rate +
      weights.weight_cpv +
      weights.weight_audience_ro +
      weights.weight_punctuality +
      weights.weight_deliverable_quality +
      weights.weight_collaboration_history,
    [weights],
  )

  const dirty = useMemo(() => {
    if (!settings) return true
    return (Object.keys(weights) as Array<keyof Weights>).some(
      (k) => weights[k] !== settings[k],
    )
  }, [weights, settings])

  function resetToDefaults() {
    setWeights(DEFAULT_WEIGHTS)
  }

  async function save() {
    setSaving(true)
    setFeedback(null)
    const res = await fetch('/api/admin/scoring-settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(weights),
    })
    setSaving(false)
    setConfirming(false)
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string; field?: string }
      setFeedback(`Eroare: ${d.error ?? 'necunoscută'}${d.field ? ` (${d.field})` : ''}`)
      return
    }
    const d = (await res.json()) as {
      settings: ScoringSettings | null
      recalculated: number
    }
    setSettings(d.settings)
    setFeedback(`Salvat. ${d.recalculated} influenceri recalculați.`)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div className="space-y-4">
        {SCORING_CRITERIA.map((c) => {
          const k = FIELD_BY_CRITERION[c]
          const v = weights[k]
          return (
            <div key={c}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-stone-800">
                  {CRITERION_LABELS[c]}
                </label>
                <span className="text-sm tabular-nums text-stone-700 font-medium">
                  {v}
                  <span className="text-stone-400 font-normal">/100</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                onChange={(e) =>
                  setWeights({ ...weights, [k]: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
          )
        })}
      </div>

      <div
        className={`rounded-md px-3 py-2 text-sm ${
          sum === 100
            ? 'bg-emerald-50 text-emerald-900'
            : 'bg-amber-50 text-amber-900'
        }`}
      >
        Total: <span className="tabular-nums font-medium">{sum}%</span>
        {sum === 100 ? ' (echilibrat)' : ' — re-normalizat la calcul'}
      </div>

      <div className="text-xs text-stone-500">
        {settings?.updated_at && (
          <>
            Ultima modificare: {formatRelative(settings.updated_at)}
            {updaterName ? ` de ${updaterName}` : ''}.
          </>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            feedback.startsWith('Eroare')
              ? 'bg-rose-50 text-rose-900'
              : 'bg-emerald-50 text-emerald-900'
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
        <button
          onClick={resetToDefaults}
          className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200"
        >
          Resetează la default
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60"
        >
          Salvează
        </button>
      </div>

      {confirming && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title="Confirmă salvarea"
          description={`Asta va recalcula scorurile pentru toți cei ${influencerCount} influenceri. Continui?`}
          size="sm"
        >
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200"
            >
              Anulează
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Se recalculează...' : 'Confirmă'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
