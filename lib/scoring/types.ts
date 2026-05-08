// Sprint 10 scoring — shared types + display constants.
//
// Six criteria total: 4 manual (rated by team via slider modal) and 2 auto
// (derived in SQL by recalc_influencer_score). Bands: low <=40, medium <=65,
// high <=85, top_performer 86+. The DB function is the source of truth for
// banding; categoryFromScore() mirrors it for client-side preview only.

export const SCORING_CRITERIA = [
  'engagement_rate',
  'cpv',
  'audience_ro',
  'punctuality',
  'deliverable_quality',
  'collaboration_history',
] as const

export type ScoringCriterion = (typeof SCORING_CRITERIA)[number]

export const MANUAL_CRITERIA: ScoringCriterion[] = [
  'engagement_rate',
  'cpv',
  'audience_ro',
  'deliverable_quality',
]

export const AUTO_CRITERIA: ScoringCriterion[] = [
  'punctuality',
  'collaboration_history',
]

export const CRITERION_LABELS: Record<ScoringCriterion, string> = {
  engagement_rate: 'Engagement rate',
  cpv: 'CPV (cost-per-view)',
  audience_ro: 'Audiență România',
  punctuality: 'Punctualitate',
  deliverable_quality: 'Calitate livrabile',
  collaboration_history: 'Istoric colaborări',
}

// Helper text shown under each manual slider in the edit modal.
export const CRITERION_HELP: Record<ScoringCriterion, string> = {
  engagement_rate: '0 = engagement scăzut, 100 = excepțional pentru tier.',
  cpv: '0 = cost foarte mare per view, 100 = foarte eficient.',
  audience_ro: '0 = audiență complet în afara RO, 100 = aproape în întregime RO.',
  punctuality: 'Auto: % livrabile publicate la sau înainte de deadline.',
  deliverable_quality: '0 = sub aşteptări, 100 = peste briefing constant.',
  collaboration_history: 'Auto: 0/20/40/60/80/100 din numărul de campanii completate (cap 5+).',
}

export type ScoreCategory = 'low' | 'medium' | 'high' | 'top_performer'

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  top_performer: 'Top Performer',
}

export const CATEGORY_COLORS: Record<ScoreCategory, string> = {
  low: 'bg-rose-100 text-rose-900',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-emerald-100 text-emerald-900',
  top_performer: 'bg-violet-100 text-violet-900',
}

export function categoryFromScore(total: number): ScoreCategory {
  if (total <= 40) return 'low'
  if (total <= 65) return 'medium'
  if (total <= 85) return 'high'
  return 'top_performer'
}

export type InfluencerScore = {
  id: string
  influencer_id: string
  score_engagement_rate: number | null
  score_cpv: number | null
  score_audience_ro: number | null
  score_deliverable_quality: number | null
  score_punctuality: number | null
  score_collaboration_history: number | null
  total_score: number
  category: ScoreCategory
  explanation: string | null
  last_calculated_at: string
  updated_by: string | null
  updated_at: string
}

export type ScoringSettings = {
  id: 1
  weight_engagement_rate: number
  weight_cpv: number
  weight_audience_ro: number
  weight_punctuality: number
  weight_deliverable_quality: number
  weight_collaboration_history: number
  updated_by: string | null
  updated_at: string
}

export type ScoreChangeReason = 'manual_update' | 'auto_recalc' | 'weights_changed'

export type ScoreHistoryEntry = {
  id: string
  influencer_id: string
  total_score: number | null
  category: ScoreCategory | null
  changes: { old_total?: number; new_total?: number } | null
  change_reason: ScoreChangeReason
  changed_by: string | null
  changed_at: string
}

// Color band for a 0..100 progress bar — softer red for low, green for high.
export function progressColor(value: number | null): string {
  if (value == null) return 'bg-stone-200'
  if (value <= 40) return 'bg-rose-400'
  if (value <= 65) return 'bg-amber-400'
  if (value <= 85) return 'bg-emerald-400'
  return 'bg-violet-500'
}

export const DEFAULT_WEIGHTS: Pick<
  ScoringSettings,
  | 'weight_engagement_rate'
  | 'weight_cpv'
  | 'weight_audience_ro'
  | 'weight_punctuality'
  | 'weight_deliverable_quality'
  | 'weight_collaboration_history'
> = {
  weight_engagement_rate: 25,
  weight_cpv: 20,
  weight_audience_ro: 20,
  weight_punctuality: 15,
  weight_deliverable_quality: 10,
  weight_collaboration_history: 10,
}
