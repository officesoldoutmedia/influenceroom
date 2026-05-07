export const CAMPAIGN_STATUSES = ['draft', 'active', 'in_review', 'completed', 'cancelled'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export type Campaign = {
  id: string
  brand_id: string
  template_id: string | null
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

export type TemplateTaskDef = {
  title: string
  role_default?: string
  priority?: TaskPriority
  description?: string | null
}

export type TemplateGroupDef = {
  name: string
  position: number
  due_offset_days: number
  tasks: TemplateTaskDef[]
}

export type CampaignTemplate = {
  id: string
  name: string
  description: string | null
  default_task_groups: TemplateGroupDef[]
  active: boolean
  created_at: string
}
