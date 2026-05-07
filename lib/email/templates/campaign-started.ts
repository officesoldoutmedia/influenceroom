import { layout, esc, button, card } from './_layout'

export type CampaignStartedParams = {
  recipientName: string
  campaignName: string
  brandName: string
  ownerName: string
  startDate: string | null
  endDate?: string | null
  confirmedInfluencersCount: number
  campaignUrl: string
}

export function campaignStarted(p: CampaignStartedParams) {
  const subject = `Campanie live: ${p.campaignName}`
  const period = `${p.startDate ?? 'TBD'} – ${p.endDate ?? 'TBD'}`
  const html = layout(`
    <p>Salut <strong>${esc(p.recipientName)}</strong>,</p>
    <p>O nouă campanie a fost activată de <strong>${esc(p.ownerName)}</strong>.</p>
    ${card(`
      <div style="font-weight:600;color:#1c1917;font-size:16px;margin-bottom:8px;">${esc(p.campaignName)}</div>
      <div style="color:#57534e;font-size:13px;">Brand: ${esc(p.brandName)}</div>
      <div style="color:#57534e;font-size:13px;">Perioadă: ${esc(period)}</div>
      <div style="color:#57534e;font-size:13px;">Influenceri confirmați: ${p.confirmedInfluencersCount}</div>
    `)}
    ${button('Deschide campania', p.campaignUrl)}
  `)
  const text = `Salut ${p.recipientName},

O nouă campanie a fost activată de ${p.ownerName}.

Campania: ${p.campaignName}
Brand: ${p.brandName}
Perioadă: ${period}
Influenceri confirmați: ${p.confirmedInfluencersCount}

Deschide campania: ${p.campaignUrl}
`
  return { subject, html, text }
}
