import { renderEmail, type RenderArgs } from '../lib/email/render'

const cases: RenderArgs[] = [
  {
    type: 'task_assigned',
    params: {
      assigneeName: 'Ana',
      taskTitle: 'Send pitch',
      campaignName: 'Q4 Brand Boost',
      dueDate: '2026-06-06',
      assignedByName: 'Founder',
      taskUrl: 'https://example.test/campaigns/abc/tasks/xyz',
    },
  },
  {
    type: 'task_status_changed',
    params: {
      taskTitle: 'Sign contract',
      campaignName: 'Q4 Brand Boost',
      oldStatus: 'todo',
      newStatus: 'done',
      changedByName: 'Ana',
      taskUrl: 'https://example.test/campaigns/abc/tasks/xyz',
    },
  },
  {
    type: 'deadline_reminder',
    params: {
      recipientName: 'Ana',
      taskTitle: 'Live monitoring first 2h',
      campaignName: 'Q4 Brand Boost',
      daysUntilDue: 1,
      taskUrl: 'https://example.test/campaigns/abc/tasks/xyz',
      markDoneUrl: 'https://example.test/api/tasks/xyz/done',
    },
  },
  {
    type: 'daily_digest',
    params: {
      recipientName: 'Ana',
      overdueTasks: [
        { id: '1', title: 'Send pitch', campaignName: 'Q4', dueDate: '2026-05-05', priority: 'high', link: 'https://x' },
      ],
      todayTasks: [
        { id: '2', title: 'Brief approval', campaignName: 'Q4', dueDate: '2026-05-07', priority: 'normal', link: 'https://x' },
      ],
      weekTasks: [
        { id: '3', title: 'Issue invoice', campaignName: 'Q4', dueDate: '2026-05-13', priority: 'low', link: 'https://x' },
      ],
      appUrl: 'https://example.test',
    },
  },
  {
    type: 'campaign_started',
    params: {
      recipientName: 'Ana',
      campaignName: 'Q4 Brand Boost',
      brandName: 'ACME',
      ownerName: 'Founder',
      startDate: '2026-06-06',
      endDate: '2026-06-13',
      confirmedInfluencersCount: 3,
      campaignUrl: 'https://example.test/campaigns/abc',
    },
  },
]

for (const c of cases) {
  const r = renderEmail(c)
  const undef = /undefined/.test(r.html) || /undefined/.test(r.text)
  const escapeLeak = /\$\{/.test(r.html) || /\$\{/.test(r.text)
  console.log(`[${c.type}]`)
  console.log(`  subject: ${r.subject}`)
  console.log(`  html (first 100): ${r.html.replace(/\s+/g, ' ').slice(0, 100)}`)
  console.log(`  text (first 100): ${r.text.replace(/\s+/g, ' ').slice(0, 100)}`)
  console.log(`  has 'undefined': ${undef ? 'FAIL' : 'ok'}`)
  console.log(`  has unresolved \${...}: ${escapeLeak ? 'FAIL' : 'ok'}`)
  console.log()
}
