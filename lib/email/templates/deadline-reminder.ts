import { layout, esc, button, card } from './_layout'

export type DeadlineReminderParams = {
  recipientName: string
  taskTitle: string
  campaignName: string
  daysUntilDue: number
  taskUrl: string
  markDoneUrl: string
}

export function deadlineReminder(p: DeadlineReminderParams) {
  const dayWord = p.daysUntilDue === 1 ? 'zi' : 'zile'
  const subject = `Reminder: ${p.taskTitle} — deadline în ${p.daysUntilDue} ${dayWord}`
  const html = layout(`
    <p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
    <p>Task-ul tău are deadline în <strong>${p.daysUntilDue} ${dayWord}</strong>.</p>
    ${card(`
      <div style="font-weight:600;color:#1c1917;margin-bottom:6px;">${esc(p.taskTitle)}</div>
      <div style="color:#57534e;font-size:13px;">Campania: ${esc(p.campaignName)}</div>
    `)}
    <p style="margin:18px 0;">
      <a href="${p.markDoneUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;margin-right:8px;">Marchează ca done</a>
      <a href="${p.taskUrl}" style="display:inline-block;background:#f5f5f4;color:#292524;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">Vezi detalii</a>
    </p>
  `)
  const text = `Salut ${p.recipientName},

Task-ul "${p.taskTitle}" (${p.campaignName}) are deadline în ${p.daysUntilDue} ${dayWord}.

Marchează ca done: ${p.markDoneUrl}
Vezi detalii: ${p.taskUrl}
`
  return { subject, html, text }
}
