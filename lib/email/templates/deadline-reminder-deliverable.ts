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
}

const SUBJECT_BY_KIND: Record<DeliverableDeadlineKind, (label: string) => string> = {
  '7d': (l) => `Reminder: livrabil cu deadline în 7 zile — ${l}`,
  '3d': (l) => `Atenție: livrabil cu deadline în 3 zile — ${l}`,
  '1d': (l) => `URGENT: livrabil cu deadline mâine — ${l}`,
  overdue: (l) => `DEPĂȘIT: livrabil cu deadline trecut — ${l}`,
}

const LEAD_BY_KIND: Record<DeliverableDeadlineKind, string> = {
  '7d': 'Reminder: ai un livrabil cu deadline în <strong>7 zile</strong>.',
  '3d': 'Atenție: ai un livrabil cu deadline în <strong>3 zile</strong>.',
  '1d': 'URGENT: ai un livrabil cu deadline <strong>mâine</strong>.',
  overdue: 'Acest livrabil are deadline <strong>depășit</strong> — necesită acțiune.',
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
  const subject = SUBJECT_BY_KIND[p.kind](`${label} (${p.campaignName})`)

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
    <p>${LEAD_BY_KIND[p.kind]}</p>
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
    LEAD_BY_KIND[p.kind].replace(/<[^>]+>/g, ''),
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
