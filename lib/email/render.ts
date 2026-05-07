import { taskAssigned, type TaskAssignedParams } from './templates/task-assigned'
import { taskStatusChanged, type TaskStatusChangedParams } from './templates/task-status-changed'
import { deadlineReminder, type DeadlineReminderParams } from './templates/deadline-reminder'
import { dailyDigest, type DailyDigestParams } from './templates/daily-digest'
import { campaignStarted, type CampaignStartedParams } from './templates/campaign-started'
import { broadcast, type BroadcastParams } from './templates/broadcast'

export type EmailType =
  | 'task_assigned'
  | 'task_status_changed'
  | 'deadline_reminder'
  | 'daily_digest'
  | 'campaign_started'
  | 'broadcast'

export type RenderArgs =
  | { type: 'task_assigned'; params: TaskAssignedParams }
  | { type: 'task_status_changed'; params: TaskStatusChangedParams }
  | { type: 'deadline_reminder'; params: DeadlineReminderParams }
  | { type: 'daily_digest'; params: DailyDigestParams }
  | { type: 'campaign_started'; params: CampaignStartedParams }
  | { type: 'broadcast'; params: BroadcastParams }

export type RenderedEmail = { subject: string; html: string; text: string }

export function renderEmail(args: RenderArgs): RenderedEmail {
  switch (args.type) {
    case 'task_assigned':
      return taskAssigned(args.params)
    case 'task_status_changed':
      return taskStatusChanged(args.params)
    case 'deadline_reminder':
      return deadlineReminder(args.params)
    case 'daily_digest':
      return dailyDigest(args.params)
    case 'campaign_started':
      return campaignStarted(args.params)
    case 'broadcast':
      return broadcast(args.params)
  }
}
