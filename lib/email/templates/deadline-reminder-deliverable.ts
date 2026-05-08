import { layout, esc, button, card } from './_layout'

export type DeliverableDeadlineKind = '7d' | '3d' | '1d' | 'overdue'
export type DeliverableRecipientType = 'account_manager' | 'influencer'

export type DeliverableReminderParams = {
  kind: DeliverableDeadlineKind
  recipientType: DeliverableRecipientType
  recipientName: string
  campaignName: string
  brandName: string
  /** Display label for the deliverable type (already localized). */
  typeLabel: string
  quantity: number
  postDate: string
  /** Status label (already localized). */
  statusLabel: string
  /** Influencer/handle behind this deliverable (account label sees this; influencer sees their own name). */
  participantLabel: string
  brief: string | null
  caption: string | null
  collabHandles: string[]
  hashtags: string[]
  campaignUrl: string
  // True only when kind='1d' AND post_date == today. Drives "AZI" vs "mâine"
  // copy in subject + lead. reminder_kind in the dedupe log stays '1d' for both
  // days so idempotency carries across them for the same deliverable.
  isToday?: boolean
}

function subjectFor(kind: DeliverableDeadlineKind, label: string, isToday: boolean): string {
  switch (kind) {
    case '7d':
      return `Reminder: livrabil cu deadline în 7 zile — ${label}`
    case '3d':
      return `Atenție: livrabil cu deadline în 3 zile — ${label}`
    case '1d':
      return isToday
        ? `URGENT: livrabil cu deadline AZI — ${label}`
        : `URGENT: livrabil cu deadline mâine — ${label}`
    case 'overdue':
      return `DEPĂȘIT: livrabil cu deadline trecut — ${label}`
  }
}

function leadFor(kind: DeliverableDeadlineKind, isToday: boolean): string {
  switch (kind) {
    case '7d':
      return 'Reminder: ai un livrabil cu deadline în <strong>7 zile</strong>.'
    case '3d':
      return 'Atenție: ai un livrabil cu deadline în <strong>3 zile</strong>.'
    case '1d':
      return isToday
        ? 'URGENT: ai un livrabil cu deadline <strong>AZI</strong>.'
        : 'URGENT: ai un livrabil cu deadline <strong>mâine</strong>.'
    case 'overdue':
      return 'Acest livrabil are deadline <strong>depășit</strong> — necesită acțiune.'
  }
}

function chips(items: string[]): string {
  if (items.length === 0) return ''
  return items
    .map(
      (t) =>
        `<span style="display:inline-block;background:#fff7ed;color:#9a3412;padding:2px 8px;border-radius:9999px;font-size:11px;margin:2px;">${esc(t)}</span>`,
    )
    .join('')
}

export function deliverableDeadlineReminder(p: DeliverableReminderParams) {
  const label = `${p.quantity}× ${p.typeLabel}`
  const isToday = p.isToday === true
  const subject = subjectFor(p.kind, `${label} (${p.campaignName})`, isToday)
  const lead = leadFor(p.kind, isToday)

  const showInfluencerSpecific = p.recipientType === 'influencer'
  const briefBlock = p.brief
    ? `<div style="color:#57534e;font-size:13px;margin-top:6px;"><strong>Brief:</strong> ${esc(p.brief)}</div>`
    : ''
  const captionBlock = showInfluencerSpecific && p.caption
    ? `<div style="color:#57534e;font-size:13px;margin-top:6px;"><strong>Caption draft:</strong><br/>${esc(p.caption)}</div>`
    : ''
  const accountSpecific = !showInfluencerSpecific
    ? `<div style="color:#57534e;font-size:13px;margin-top:6px;">Status curent: <strong>${esc(p.statusLabel)}</strong> · Influencer: <strong>${esc(p.participantLabel)}</strong></div>`
    : ''
  const collabRow = p.collabHandles.length
    ? `<div style="margin-top:8px;"><strong style="font-size:12px;color:#78716c;">Colaboratori:</strong> ${chips(p.collabHandles)}</div>`
    : ''
  const tagsRow = p.hashtags.length
    ? `<div style="margin-top:4px;"><strong style="font-size:12px;color:#78716c;">Hashtags:</strong> ${chips(p.hashtags)}</div>`
    : ''

  const html = layout(`
    <p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
    <p>${lead}</p>
    ${card(`
      <div style="font-weight:600;color:#1c1917;margin-bottom:6px;">${esc(label)}</div>
      <div style="color:#57534e;font-size:13px;">Campania: <strong>${esc(p.campaignName)}</strong> · Brand: ${esc(p.brandName)}</div>
      <div style="color:#57534e;font-size:13px;">Data postării: <strong>${esc(p.postDate)}</strong></div>
      ${accountSpecific}
      ${briefBlock}
      ${captionBlock}
      ${collabRow}
      ${tagsRow}
    `)}
    ${button('Vezi în aplicație', p.campaignUrl)}
  `)

  const textParts = [
    `Salut ${p.recipientName},`,
    '',
    lead.replace(/<[^>]+>/g, ''),
    '',
    `${label}`,
    `Campania: ${p.campaignName} · Brand: ${p.brandName}`,
    `Data postării: ${p.postDate}`,
  ]
  if (!showInfluencerSpecific) textParts.push(`Status: ${p.statusLabel} · Influencer: ${p.participantLabel}`)
  if (p.brief) textParts.push('', `Brief: ${p.brief}`)
  if (showInfluencerSpecific && p.caption) textParts.push('', `Caption draft:`, p.caption)
  if (p.collabHandles.length) textParts.push('', `Colaboratori: ${p.collabHandles.join(', ')}`)
  if (p.hashtags.length) textParts.push(`Hashtags: ${p.hashtags.join(' ')}`)
  textParts.push('', `Vezi: ${p.campaignUrl}`)

  return { subject, html, text: textParts.join('\n') }
}
