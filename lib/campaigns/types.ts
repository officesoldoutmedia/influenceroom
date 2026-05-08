export const CAMPAIGN_STATUSES = ['draft', 'active', 'in_review', 'completed', 'cancelled'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export type Campaign = {
  id: string
  brand_id: string
  name: string
  brief: string | null
  status: CampaignStatus
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  deliverables_count: number | null
  internal_notes: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type BrandRef = { id: string; name: string; logo_url: string | null }
export type TeamRef = { id: string; name: string; role: string; avatar_url: string | null }

export type CampaignWithJoins = Campaign & {
  brand: BrandRef | null
  owner: TeamRef | null
}

export type Task = {
  id: string
  campaign_id: string
  group_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  position: number
  created_at: string
  created_by: string | null
}

export type TaskGroup = {
  id: string
  campaign_id: string
  name: string
  position: number
  due_date: string | null
  created_at: string
  tasks: Task[]
}

// Sprint 9 Faza 3a — campaign_participants replaces campaign_influencers.
// One row per (campaign × influencer × platform) with optional ad-hoc handle.

export const PARTICIPANT_STATUSES = [
  'pitched',
  'negotiating',
  'confirmed',
  'content_in_review',
  'published',
  'paid',
  'cancelled',
] as const
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

// Forward-only workflow. cancelled is reachable from any non-terminal state.
export const NEXT_PARTICIPANT_STATES: Record<ParticipantStatus, ParticipantStatus[]> = {
  pitched: ['negotiating', 'cancelled'],
  negotiating: ['confirmed', 'cancelled'],
  confirmed: ['content_in_review', 'cancelled'],
  content_in_review: ['published', 'cancelled'],
  published: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

export const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
}

export type CampaignParticipant = {
  id: string
  campaign_id: string
  influencer_id: string | null
  platform: SocialPlatform
  account_handle: string
  is_adhoc: boolean
  agreed_fee: number | null
  status: ParticipantStatus
  publish_date: string | null
  post_url: string | null
  notes: string | null
  added_by: string | null
  added_at: string
  updated_at: string
}

export type ParticipantInfluencerRef = {
  id: string
  name: string
  primary_handle: string | null
  tier: string | null
  platforms: Record<string, { handle?: string; followers?: number; engagement_rate?: number }>
}

export type CampaignParticipantJoined = CampaignParticipant & {
  influencer: ParticipantInfluencerRef | null
}

// Sprint 9 Faza 3b — deliverables (per-participant) and milestones (per-campaign).

export const DELIVERABLE_TYPES = [
  'story', 'reel', 'tiktok', 'carousel', 'post',
  'youtube_long', 'youtube_short', 'live', 'custom',
] as const
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number]

export const DELIVERABLE_TYPE_LABEL: Record<DeliverableType, string> = {
  story: 'Story',
  reel: 'Reel',
  tiktok: 'TikTok',
  carousel: 'Carousel',
  post: 'Post',
  youtube_long: 'YouTube long-form',
  youtube_short: 'YouTube Short',
  live: 'Live',
  custom: 'Custom',
}

export const DELIVERABLE_STATUSES = [
  'draft', 'sent_to_influencer', 'content_in_review',
  'approved', 'published', 'cancelled',
] as const
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  draft: 'Schiță',
  sent_to_influencer: 'Trimis influencer',
  content_in_review: 'În review',
  approved: 'Aprobat',
  published: 'Publicat',
  cancelled: 'Anulat',
}

export type CampaignDeliverable = {
  id: string
  participant_id: string
  type: DeliverableType
  custom_type_label: string | null
  quantity: number
  post_date: string | null
  collab_handles: string[]
  hashtags: string[]
  brief: string | null
  caption: string | null
  notes: string | null
  status: DeliverableStatus
  published_url: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export const MILESTONE_TYPES = [
  'brief_sent', 'materials_approved', 'content_draft_submitted',
  'final_content_approved', 'links_submitted', 'report_delivered',
  'payment_processed', 'other',
] as const
export type MilestoneType = (typeof MILESTONE_TYPES)[number]

export const MILESTONE_TYPE_LABEL: Record<MilestoneType, string> = {
  brief_sent: 'Brief trimis',
  materials_approved: 'Materiale aprobate',
  content_draft_submitted: 'Draft conținut primit',
  final_content_approved: 'Conținut final aprobat',
  links_submitted: 'Link-uri trimise',
  report_delivered: 'Raport livrat',
  payment_processed: 'Plată procesată',
  other: 'Altul',
}

export const MILESTONE_RESPONSIBLES = [
  'account_manager', 'influencer', 'brand', 'other',
] as const
export type MilestoneResponsible = (typeof MILESTONE_RESPONSIBLES)[number]

export const MILESTONE_RESPONSIBLE_LABEL: Record<MilestoneResponsible, string> = {
  account_manager: 'Account manager',
  influencer: 'Influencer',
  brand: 'Brand',
  other: 'Altul',
}

export type CampaignMilestone = {
  id: string
  campaign_id: string
  type: MilestoneType
  name: string | null
  due_date: string
  responsible: MilestoneResponsible
  responsible_name: string | null
  completed_at: string | null
  completed_by: string | null
  notes: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}
