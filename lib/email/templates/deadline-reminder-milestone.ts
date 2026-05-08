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
}

const SUBJECT_BY_KIND: Record<MilestoneDeadlineKind, (label: string) => string> = {
  '7d': (l) => `Reminder: milestone ${l} — 7 zile`,
  '3d': (l) => `Atenție: milestone ${l} — 3 zile`,
  '1d': (l) => `URGENT: milestone ${l} — mâine`,
  overdue: (l) => `DEPĂȘIT: milestone ${l} — trebuie acțiune`,
}

const LEAD_BY_KIND: Record<MilestoneDeadlineKind, string> = {
  '7d': 'Reminder: o etapă din campanie are deadline în <strong>7 zile</strong>.',
  '3d': 'Atenție: o etapă are deadline în <strong>3 zile</strong>.',
  '1d': 'URGENT: o etapă are deadline <strong>mâine</strong>.',
  overdue: 'Această etapă are deadline <strong>depășit</strong> și nu a fost marcată finalizată.',
}

export function milestoneDeadlineReminder(p: MilestoneReminderParams) {
  const subject = SUBJECT_BY_KIND[p.kind](`${p.milestoneLabel} (${p.campaignName})`)

  const notesBlock = p.notes
    ? `<div style="color:#57534e;font-size:13px;margin-top:6px;"><strong>Note:</strong> ${esc(p.notes)}</div>`
    : ''

  const html = layout(`
    <p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
    <p>${LEAD_BY_KIND[p.kind]}</p>
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
    LEAD_BY_KIND[p.kind].replace(/<[^>]+>/g, ''),
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
