import { layout, esc, button, card } from './_layout'

export type MilestoneDeadlineKind = '7d' | '3d' | '1d' | 'overdue'

export type MilestoneReminderParams = {
  kind: MilestoneDeadlineKind
  recipientName: string
  campaignName: string
  brandName: string
  /** Already-localized milestone label (e.g. "Brief trimis" or the custom name). */
  milestoneLabel: string
  dueDate: string
  /** Already-localized responsible label (e.g. "Account manager" or "Brand"). */
  responsibleLabel: string
  notes: string | null
  campaignUrl: string
  // True only when kind='1d' AND due_date == today. Drives "AZI" vs "mâine"
  // copy in subject + lead. reminder_kind in the dedupe log stays '1d' so a
  // milestone due today doesn't get re-sent if it was already pinged yesterday
  // as the tomorrow-warning.
  isToday?: boolean
}

function subjectFor(kind: MilestoneDeadlineKind, label: string, isToday: boolean): string {
  switch (kind) {
    case '7d':
      return `Reminder: milestone ${label} — 7 zile`
    case '3d':
      return `Atenție: milestone ${label} — 3 zile`
    case '1d':
      return isToday
        ? `URGENT: milestone ${label} — AZI`
        : `URGENT: milestone ${label} — mâine`
    case 'overdue':
      return `DEPĂȘIT: milestone ${label} — trebuie acțiune`
  }
}

function leadFor(kind: MilestoneDeadlineKind, isToday: boolean): string {
  switch (kind) {
    case '7d':
      return 'Reminder: o etapă din campanie are deadline în <strong>7 zile</strong>.'
    case '3d':
      return 'Atenție: o etapă are deadline în <strong>3 zile</strong>.'
    case '1d':
      return isToday
        ? 'URGENT: o etapă are deadline <strong>AZI</strong>.'
        : 'URGENT: o etapă are deadline <strong>mâine</strong>.'
    case 'overdue':
      return 'Această etapă are deadline <strong>depășit</strong> și nu a fost marcată finalizată.'
  }
}

export function milestoneDeadlineReminder(p: MilestoneReminderParams) {
  const isToday = p.isToday === true
  const subject = subjectFor(p.kind, `${p.milestoneLabel} (${p.campaignName})`, isToday)
  const lead = leadFor(p.kind, isToday)

  const notesBlock = p.notes
    ? `<div style="color:#57534e;font-size:13px;margin-top:6px;"><strong>Note:</strong> ${esc(p.notes)}</div>`
    : ''

  const html = layout(`
    <p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
    <p>${lead}</p>
    ${card(`
      <div style="font-weight:600;color:#1c1917;margin-bottom:6px;">${esc(p.milestoneLabel)}</div>
      <div style="color:#57534e;font-size:13px;">Campania: <strong>${esc(p.campaignName)}</strong> · Brand: ${esc(p.brandName)}</div>
      <div style="color:#57534e;font-size:13px;">Termen: <strong>${esc(p.dueDate)}</strong></div>
      <div style="color:#57534e;font-size:13px;">Responsabil: <strong>${esc(p.responsibleLabel)}</strong></div>
      ${notesBlock}
    `)}
    ${button('Vezi în aplicație', p.campaignUrl)}
  `)

  const text = [
    `Salut ${p.recipientName},`,
    '',
    lead.replace(/<[^>]+>/g, ''),
    '',
    p.milestoneLabel,
    `Campania: ${p.campaignName} · Brand: ${p.brandName}`,
    `Termen: ${p.dueDate}`,
    `Responsabil: ${p.responsibleLabel}`,
    p.notes ? `Note: ${p.notes}` : '',
    '',
    `Vezi: ${p.campaignUrl}`,
  ]
    .filter((l) => l !== '')
    .join('\n')

  return { subject, html, text }
}
