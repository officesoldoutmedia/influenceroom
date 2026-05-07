import { layout, esc, button } from './_layout'

export type TaskSummary = {
  id: string
  title: string
  campaignName: string
  dueDate: string | null
  priority: string
  link: string
}

export type DailyDigestParams = {
  recipientName: string
  overdueTasks: TaskSummary[]
  todayTasks: TaskSummary[]
  weekTasks: TaskSummary[]
  appUrl: string
}

const ROMANIAN_DATE = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function todayLabel(): string {
  return ROMANIAN_DATE.format(new Date())
}

function section(title: string, tasks: TaskSummary[], color: string): string {
  if (tasks.length === 0) return ''
  return `
    <h2 style="font-size:13px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.04em;margin:20px 0 8px;">
      ${esc(title)} <span style="color:#a8a29e;font-weight:400;">(${tasks.length})</span>
    </h2>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
      ${tasks
        .map(
          (t) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;">
          <a href="${t.link}" style="color:#1c1917;text-decoration:none;font-weight:500;">${esc(t.title)}</a>
          <div style="color:#78716c;font-size:12px;">
            ${esc(t.campaignName)}
            ${t.dueDate ? ` · ${esc(t.dueDate)}` : ''}
            ${t.priority !== 'normal' ? ` · <span style="text-transform:uppercase;font-size:10px;">${esc(t.priority)}</span>` : ''}
          </div>
        </td>
      </tr>`,
        )
        .join('')}
    </table>
  `
}

export function dailyDigest(p: DailyDigestParams) {
  const subject = `Planul de azi — ${todayLabel()}`
  const total = p.overdueTasks.length + p.todayTasks.length + p.weekTasks.length

  const body =
    total === 0
      ? `<p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
         <p>Niciun task activ. Bună ziua. ☕</p>`
      : `<p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
         <p>Iată planul tău de azi:</p>
         ${section('Restanțe', p.overdueTasks, '#dc2626')}
         ${section('Astăzi', p.todayTasks, '#1c1917')}
         ${section('Săptămâna asta', p.weekTasks, '#57534e')}
         ${button('Deschide My Tasks', `${p.appUrl}/tasks`)}`

  const html = layout(body)

  const textSection = (title: string, tasks: TaskSummary[]): string => {
    if (tasks.length === 0) return ''
    return `\n${title.toUpperCase()} (${tasks.length})\n${tasks
      .map((t) => `  - ${t.title} (${t.campaignName})${t.dueDate ? ` · ${t.dueDate}` : ''}`)
      .join('\n')}\n`
  }

  const text = `Salut ${p.recipientName},

${total === 0 ? 'Niciun task activ. Bună ziua.' : 'Iată planul tău de azi:'}
${textSection('Restanțe', p.overdueTasks)}${textSection('Astăzi', p.todayTasks)}${textSection('Săptămâna asta', p.weekTasks)}
Deschide My Tasks: ${p.appUrl}/tasks
`
  return { subject, html, text }
}
