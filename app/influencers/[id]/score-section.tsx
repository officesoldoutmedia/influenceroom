'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/lib/ui'
import {
  AUTO_CRITERIA,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CRITERION_HELP,
  CRITERION_LABELS,
  MANUAL_CRITERIA,
  SCORING_CRITERIA,
  progressColor,
  type InfluencerScore,
  type ScoreHistoryEntry,
  type ScoringCriterion,
} from '@/lib/scoring/types'

type ManualKey =
  | 'score_engagement_rate'
  | 'score_cpv'
  | 'score_audience_ro'
  | 'score_deliverable_quality'

const MANUAL_DB_FIELD: Record<Extract<ScoringCriterion, 'engagement_rate' | 'cpv' | 'audience_ro' | 'deliverable_quality'>, ManualKey> = {
  engagement_rate: 'score_engagement_rate',
  cpv: 'score_cpv',
  audience_ro: 'score_audience_ro',
  deliverable_quality: 'score_deliverable_quality',
}

function dbField(c: ScoringCriterion): keyof InfluencerScore {
  switch (c) {
    case 'engagement_rate': return 'score_engagement_rate'
    case 'cpv': return 'score_cpv'
    case 'audience_ro': return 'score_audience_ro'
    case 'deliverable_quality': return 'score_deliverable_quality'
    case 'punctuality': return 'score_punctuality'
    case 'collaboration_history': return 'score_collaboration_history'
  }
}

// PostgREST returns numeric columns as strings (e.g. "87.50") to preserve
// arbitrary precision. After migration 037 the score_* columns are numeric,
// so we coerce at read-time. This also handles the legacy integer-encoded
// values from before the migration without a hiccup.
function coerceScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function valueOf(score: InfluencerScore | null, c: ScoringCriterion): number | null {
  if (!score) return null
  return coerceScore(score[dbField(c)])
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'acum câteva secunde'
  if (min < 60) return `acum ${min} min`
  const hr = Math.round(min / 60)
  if (hr < 24) return `acum ${hr} h`
  const d = Math.round(hr / 24)
  return `acum ${d} z`
}

export function ScoreSection({
  influencerId,
  initialScore,
  initialHistory,
  canEdit,
}: {
  influencerId: string
  initialScore: InfluencerScore | null
  initialHistory: ScoreHistoryEntry[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [score, setScore] = useState<InfluencerScore | null>(initialScore)
  const [history, setHistory] = useState<ScoreHistoryEntry[]>(initialHistory)
  const [editing, setEditing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  async function recalc() {
    setRecalculating(true)
    const res = await fetch(`/api/influencers/${influencerId}/score/recalculate`, {
      method: 'POST',
    })
    setRecalculating(false)
    if (res.ok) {
      const data = (await res.json()) as { score: InfluencerScore | null }
      setScore(data.score)
      // Refresh history too — the recalc may have written a new audit row.
      const r = await fetch(`/api/influencers/${influencerId}/score`)
      if (r.ok) {
        const d = (await r.json()) as { history: ScoreHistoryEntry[] }
        setHistory(d.history)
      }
      router.refresh()
    } else {
      alert('Recalculare eșuată — încearcă din nou.')
    }
  }

  const total = score?.total_score ?? 0
  const cat = score?.category ?? 'low'

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide">
            Scor influencer
          </h2>
          {score?.last_calculated_at && (
            <p className="text-[12px] text-stone-500 mt-1">
              Ultima calculare: {formatRelative(score.last_calculated_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={recalc}
              disabled={recalculating}
              className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200 disabled:opacity-60"
            >
              {recalculating ? 'Se recalculează...' : 'Recalculează'}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800"
            >
              Editează scoruri manuale
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5 mb-5 flex-wrap">
        <div
          className={`relative flex items-center justify-center w-24 h-24 rounded-full ${CATEGORY_COLORS[cat]} font-display`}
        >
          <span className="text-3xl font-semibold tabular-nums">{total}</span>
          <span className="absolute -bottom-1 right-0 bg-white rounded-full px-1.5 py-0.5 text-[10px] text-stone-500 border border-stone-200">
            /100
          </span>
        </div>
        <div>
          <span
            className={`inline-block text-xs uppercase tracking-wider font-medium px-2.5 py-1 rounded-full ${CATEGORY_COLORS[cat]}`}
          >
            {CATEGORY_LABELS[cat]}
          </span>
          {score?.explanation && (
            <p className="text-sm text-stone-600 mt-2 max-w-prose">{score.explanation}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCORING_CRITERIA.map((c) => {
          const v = valueOf(score, c)
          const isAuto = AUTO_CRITERIA.includes(c)
          return (
            <div key={c} className="border border-stone-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[12px] font-medium text-stone-800">
                  {CRITERION_LABELS[c]}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isAuto
                      ? 'bg-stone-100 text-stone-500'
                      : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  {isAuto ? 'Auto' : 'Manual'}
                </span>
              </div>
              <div className="text-xl font-semibold tabular-nums text-stone-900">
                {v == null ? '—' : formatScoreShort(v)}
                {v != null && <span className="text-sm font-normal text-stone-400 ml-1">/100</span>}
              </div>
              <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor(v)}`}
                  style={{ width: `${v ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-2">{CRITERION_HELP[c]}</p>
            </div>
          )
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-2">
            Istoric scor (ultimele {history.length})
          </h3>
          <ul className="divide-y divide-stone-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex items-center justify-between gap-3">
                <div className="text-stone-700">
                  {h.changes?.old_total != null && h.changes?.new_total != null ? (
                    <>
                      <span className="tabular-nums">{h.changes.old_total}</span>
                      <span className="mx-2 text-stone-400">→</span>
                      <span className="tabular-nums font-medium text-stone-900">
                        {h.changes.new_total}
                      </span>
                    </>
                  ) : (
                    <span className="tabular-nums font-medium">{h.total_score ?? '—'}</span>
                  )}
                  <span className="ml-3 text-[11px] uppercase tracking-wide text-stone-400">
                    {h.change_reason.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-[12px] text-stone-500">{formatRelative(h.changed_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <ManualEditDialog
          influencerId={influencerId}
          score={score}
          onClose={() => setEditing(false)}
          onSaved={(s) => {
            setScore(s)
            setEditing(false)
            // Pick up the new audit entry by refetching history.
            void fetch(`/api/influencers/${influencerId}/score`)
              .then((r) => (r.ok ? (r.json() as Promise<{ history?: ScoreHistoryEntry[] }>) : null))
              .then((d) => {
                if (d?.history) setHistory(d.history)
              })
            router.refresh()
          }}
        />
      )}
    </section>
  )
}

// Two decimals max — matches the column scale (numeric(5,2)).
function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  const clamped = Math.min(100, Math.max(0, n))
  return Math.round(clamped * 100) / 100
}

// Strip useless trailing zeros so 87.50 displays as 87.5 but 87 stays 87,
// and 0.31 stays 0.31. Used in the slider's value-readout chip.
function formatScoreShort(n: number): string {
  return Number(n.toFixed(2)).toString()
}

function CriterionInput({
  label,
  help,
  value,
  onChange,
}: {
  label: string
  help: string
  value: number | null
  onChange: (next: number | null) => void
}) {
  // The number input keeps its own draft string so users can type "0.31"
  // without the controlled input fighting them between keystrokes (e.g.
  // re-formatting "0." to "0" and forcing them to retype). Slider drags
  // update the draft via setDraft so the number input follows visually;
  // reset button clears both.
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value))

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <label className="text-sm font-medium text-stone-800">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            inputMode="decimal"
            value={draft}
            onChange={(e) => {
              const next = e.target.value
              setDraft(next)
              if (next === '') {
                onChange(null)
                return
              }
              const num = Number(next)
              if (Number.isFinite(num)) onChange(clampScore(num))
            }}
            onBlur={() => {
              if (draft === '') {
                onChange(null)
                return
              }
              const num = Number(draft)
              if (!Number.isFinite(num)) {
                setDraft(value == null ? '' : String(value))
                return
              }
              const cleaned = clampScore(num)
              setDraft(String(cleaned))
              onChange(cleaned)
            }}
            placeholder="—"
            className="w-20 px-2 py-1 text-sm tabular-nums text-right border border-stone-300 rounded-md focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-500/20"
            aria-label={`${label} (0..100, două zecimale)`}
          />
          <button
            type="button"
            onClick={() => {
              setDraft('')
              onChange(null)
            }}
            className="text-[11px] text-stone-500 hover:text-rose-600"
          >
            resetează
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={value ?? 0}
          onChange={(e) => {
            const num = clampScore(Number(e.target.value))
            setDraft(String(num))
            onChange(num)
          }}
          className="flex-1 accent-brand-700"
          aria-label={`${label} slider`}
        />
        <span className="w-12 text-[11px] text-stone-400 tabular-nums text-right">
          {value == null ? '—' : formatScoreShort(value)}
        </span>
      </div>
      <p className="text-[11px] text-stone-500 mt-1">{help}</p>
    </div>
  )
}

function ManualEditDialog({
  influencerId,
  score,
  onClose,
  onSaved,
}: {
  influencerId: string
  score: InfluencerScore | null
  onClose: () => void
  onSaved: (s: InfluencerScore) => void
}) {
  const [values, setValues] = useState<Record<ManualKey, number | null>>({
    score_engagement_rate: coerceScore(score?.score_engagement_rate),
    score_cpv: coerceScore(score?.score_cpv),
    score_audience_ro: coerceScore(score?.score_audience_ro),
    score_deliverable_quality: coerceScore(score?.score_deliverable_quality),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/influencers/${influencerId}/score`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string; field?: string }
      setError(`${d.error ?? 'eroare'}${d.field ? ` (${d.field})` : ''}`)
      return
    }
    const d = (await res.json()) as { score: InfluencerScore }
    onSaved(d.score)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Scoruri manuale"
      description="Setează valorile pentru cele 4 criterii manuale (0–100). Lasă gol dacă nu ai încă date — criteriul nu va contribui la total."
      size="lg"
    >
      <div className="space-y-4">
        {MANUAL_CRITERIA.map((c) => {
          const k = MANUAL_DB_FIELD[c as keyof typeof MANUAL_DB_FIELD]
          const v = values[k]
          return (
            <CriterionInput
              key={c}
              label={CRITERION_LABELS[c]}
              help={CRITERION_HELP[c]}
              value={v}
              onChange={(next) => setValues({ ...values, [k]: next })}
            />
          )
        })}

        {error && (
          <p className="text-sm text-rose-700 bg-rose-50 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm hover:bg-stone-200"
          >
            Anulează
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-60"
          >
            {saving ? 'Salvează...' : 'Salvează'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
