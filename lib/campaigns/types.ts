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

export const JUNCTION_STATUSES = [
  'pitched',
  'negotiating',
  'confirmed',
  'content_in_review',
  'published',
  'paid',
  'cancelled',
] as const
export type JunctionStatus = (typeof JUNCTION_STATUSES)[number]

// Forward-only workflow. cancelled is reachable from any non-terminal state.
export const NEXT_JUNCTION_STATES: Record<JunctionStatus, JunctionStatus[]> = {
  pitched: ['negotiating', 'cancelled'],
  negotiating: ['confirmed', 'cancelled'],
  confirmed: ['content_in_review', 'cancelled'],
  content_in_review: ['published', 'cancelled'],
  published: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

export type Performance = {
  views?: number
  likes?: number
  saves?: number
  reach?: number
  comments?: number
  shares?: number
}

export type CampaignInfluencer = {
  id: string
  campaign_id: string
  influencer_id: string
  agreed_fee: number | null
  deliverables: string | null
  status: JunctionStatus
  publish_date: string | null
  post_url: string | null
  performance: Performance
  notes: string | null
  created_at: string
}

export type CampaignInfluencerJoined = CampaignInfluencer & {
  influencer: {
    id: string
    name: string
    primary_handle: string | null
    tier: string | null
    platforms: Record<string, { handle?: string; followers?: number; engagement_rate?: number }>
  } | null
}
