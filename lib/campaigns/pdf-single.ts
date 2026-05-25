// Sprint 15 Faza 3 §11 — generator PDF pentru o campanie individuală.
//
// Conţinut: Cover (brand + perioadă) → Detalii + Brief → Participanţi (tabel) →
// Livrabile (tabel) → Milestones (tabel). 3-5 pagini cu paginare auto.
//
// Pattern duplicat intenţionat din lib/rate-cards/pdf-generator.ts pentru a
// nu atinge cod stabil livrat în Sprint 13b. Dacă vreodată apare a treia
// nevoie de PDF, extragem brand-assets într-un modul shared.

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { WORDMARK_ASPECT_RATIO, WORDMARK_PNG_BASE64 } from '@/lib/rate-cards/wordmark-asset'
import { formatEur } from '@/lib/influencers/format'

const COLORS = {
  obsidian: rgb(0x0a / 255, 0x0a / 255, 0x0b / 255),
  brand: rgb(0xc2 / 255, 0x41 / 255, 0x0c / 255),
  textMuted: rgb(0x57 / 255, 0x53 / 255, 0x4e / 255),
  textFaint: rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255),
  rule: rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255),
  rowAlt: rgb(0xfa / 255, 0xfa / 255, 0xf9 / 255),
}

const PAGE = { width: 595.28, height: 841.89 } // A4 in points
const MARGIN = { x: 56, y: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2

const WORDMARK_COVER_WIDTH = 120
const WORDMARK_COVER_HEIGHT = WORDMARK_COVER_WIDTH / WORDMARK_ASPECT_RATIO
const WORDMARK_FOOTER_WIDTH = 70
const WORDMARK_FOOTER_HEIGHT = WORDMARK_FOOTER_WIDTH / WORDMARK_ASPECT_RATIO

type Fonts = {
  serif: PDFFont
  serifBold: PDFFont
  sans: PDFFont
  sansBold: PDFFont
  mono: PDFFont
}
type Assets = Fonts & { wordmark: PDFImage }

export type CampaignForPdf = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_budget: number | null
  deliverables_count: number | null
  brief: string | null
  brand?: { name: string } | null
  owner?: { name: string } | null
}

export type ParticipantForPdf = {
  id: string
  platform: string
  account_handle: string | null
  status: string
  agreed_fee: number | null
  influencer?: { name: string } | null
  is_adhoc: boolean
}

export type DeliverableForPdf = {
  id: string
  type: string
  custom_type_label: string | null
  quantity: number
  post_date: string | null
  status: string
  published_url: string | null
  participant_id: string
}

export type MilestoneForPdf = {
  id: string
  type: string
  name: string | null
  due_date: string | null
  responsible: string
  responsible_name: string | null
  completed_at: string | null
}

function decodeWordmarkPng(): Uint8Array {
  const bin = atob(WORDMARK_PNG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']

function formatDateRo(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS_RO[m - 1]} ${y}`
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return 'Perioadă nedefinită'
  if (!end) return `din ${formatDateRo(start)}`
  return `${formatDateRo(start)} – ${formatDateRo(end)}`
}

const STATUS_LABELS_RO: Record<string, string> = {
  draft: 'Draft',
  active: 'Activă',
  in_review: 'În review',
  completed: 'Finalizată',
  cancelled: 'Anulată',
  invited: 'Invitat',
  confirmed: 'Confirmat',
  declined: 'Refuzat',
  in_progress: 'În lucru',
  content_in_review: 'Content în review',
  approved: 'Aprobat',
  published: 'Publicat',
  sent_to_influencer: 'Trimis influencer',
}

function statusLabel(s: string): string {
  return STATUS_LABELS_RO[s] ?? s
}

const DELIVERABLE_LABELS: Record<string, string> = {
  story: 'Story',
  reel: 'Reel',
  tiktok: 'TikTok',
  carousel: 'Carousel',
  post: 'Post',
  youtube_long: 'YouTube long',
  youtube_short: 'YouTube Short',
  live: 'Live',
  custom: 'Custom',
}

function deliverableTypeLabel(type: string, custom_label: string | null): string {
  if (type === 'custom' && custom_label) return custom_label
  return DELIVERABLE_LABELS[type] ?? type
}

const MILESTONE_LABELS: Record<string, string> = {
  brief_sent: 'Brief trimis',
  materials_approved: 'Materiale aprobate',
  content_draft_submitted: 'Draft trimis',
  final_content_approved: 'Conţinut final aprobat',
  links_submitted: 'Link-uri trimise',
  report_delivered: 'Raport livrat',
  payment_processed: 'Plată procesată',
  other: 'Altă etapă',
}

function milestoneTypeLabel(type: string, name: string | null): string {
  if (type === 'other' && name) return name
  return MILESTONE_LABELS[type] ?? type
}

function drawTextRight(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size) + (opts.tracking ?? 0) * (text.length - 1)
  page.drawText(text, {
    x: opts.x - w,
    y: opts.y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
  })
}

function drawTextCenter(
  page: PDFPage,
  text: string,
  opts: { y: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; tracking?: number },
): void {
  const w = opts.font.widthOfTextAtSize(text, opts.size) + (opts.tracking ?? 0) * (text.length - 1)
  page.drawText(text, {
    x: (PAGE.width - w) / 2,
    y: opts.y,
    font: opts.font,
    size: opts.size,
    color: opts.color,
  })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(probe, size) <= maxWidth) {
      cur = probe
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function drawFooter(page: PDFPage, assets: Assets, pageNo: number, totalPages: number): void {
  const y = MARGIN.y - 24
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: y - WORDMARK_FOOTER_HEIGHT / 2,
    width: WORDMARK_FOOTER_WIDTH,
    height: WORDMARK_FOOTER_HEIGHT,
  })
  drawTextRight(page, `${pageNo} / ${totalPages}`, {
    x: PAGE.width - MARGIN.x,
    y: y - 3,
    font: assets.sans,
    size: 8,
    color: COLORS.textFaint,
  })
}

export async function generateCampaignPDF(
  campaign: CampaignForPdf,
  participants: ParticipantForPdf[],
  deliverables: DeliverableForPdf[],
  milestones: MilestoneForPdf[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Campanie — ${campaign.name}`)
  doc.setAuthor('Influence Room')
  doc.setProducer('Influence Room app')
  doc.setCreator('influenceroom.ro')

  const fonts: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.CourierBold),
  }
  const wordmark = await doc.embedPng(decodeWordmarkPng())
  const assets: Assets = { ...fonts, wordmark }

  drawCoverPage(doc, assets, campaign)
  drawDetailsPage(doc, assets, campaign)
  drawParticipantsPage(doc, assets, participants)
  drawDeliverablesPage(doc, assets, deliverables, participants)
  drawMilestonesPage(doc, assets, milestones)

  const pages = doc.getPages()
  const total = pages.length
  pages.forEach((p, i) => drawFooter(p, assets, i + 1, total))

  return doc.save()
}

export function getCampaignPdfStoragePath(campaignId: string, timestamp: number): string {
  return `${campaignId}/${timestamp}-campaign.pdf`
}

function drawCoverPage(doc: PDFDocument, assets: Assets, campaign: CampaignForPdf): void {
  const page = doc.addPage([PAGE.width, PAGE.height])

  const wordmarkBottom = PAGE.height - MARGIN.y - WORDMARK_COVER_HEIGHT
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: wordmarkBottom,
    width: WORDMARK_COVER_WIDTH,
    height: WORDMARK_COVER_HEIGHT,
  })
  drawTextRight(page, 'RAPORT CAMPANIE', {
    x: PAGE.width - MARGIN.x,
    y: wordmarkBottom + (WORDMARK_COVER_HEIGHT - 9) / 2 + 1,
    font: assets.sansBold,
    size: 9,
    color: COLORS.textFaint,
    tracking: 1.5,
  })

  const titleY = PAGE.height / 2 + 60
  let titleSize = 36
  while (titleSize > 18 && assets.serifBold.widthOfTextAtSize(campaign.name, titleSize) > CONTENT_WIDTH) {
    titleSize -= 2
  }
  drawTextCenter(page, campaign.name, {
    y: titleY,
    font: assets.serifBold,
    size: titleSize,
    color: COLORS.obsidian,
  })

  page.drawRectangle({
    x: (PAGE.width - 80) / 2,
    y: titleY - 18,
    width: 80,
    height: 2,
    color: COLORS.brand,
  })

  if (campaign.brand?.name) {
    drawTextCenter(page, `pentru ${campaign.brand.name}`, {
      y: titleY - 44,
      font: assets.sans,
      size: 14,
      color: COLORS.textMuted,
    })
  }

  drawTextCenter(page, formatPeriod(campaign.start_date, campaign.end_date), {
    y: titleY - 72,
    font: assets.serif,
    size: 12,
    color: COLORS.textMuted,
  })

  const statusText = statusLabel(campaign.status).toUpperCase()
  const statusW = assets.sansBold.widthOfTextAtSize(statusText, 10) + 24
  const statusX = (PAGE.width - statusW) / 2
  page.drawRectangle({
    x: statusX,
    y: titleY - 110,
    width: statusW,
    height: 22,
    color: COLORS.brand,
  })
  page.drawText(statusText, {
    x: statusX + 12,
    y: titleY - 104,
    font: assets.sansBold,
    size: 10,
    color: rgb(1, 1, 1),
  })

  const now = new Date().toISOString().slice(0, 10)
  drawTextCenter(page, `Generat la ${formatDateRo(now)}`, {
    y: MARGIN.y + 20,
    font: assets.sans,
    size: 9,
    color: COLORS.textFaint,
  })
}

function drawDetailsPage(doc: PDFDocument, assets: Assets, campaign: CampaignForPdf): void {
  const page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText('Detalii', {
    x: MARGIN.x,
    y: y - 20,
    font: assets.serifBold,
    size: 22,
    color: COLORS.obsidian,
  })
  y -= 50

  const pairs: Array<[string, string]> = [
    ['Status', statusLabel(campaign.status)],
    ['Owner', campaign.owner?.name ?? '—'],
    ['Brand', campaign.brand?.name ?? '—'],
    ['Buget total', campaign.total_budget != null ? formatEur(campaign.total_budget) : '—'],
    ['Început', formatDateRo(campaign.start_date)],
    ['Final', formatDateRo(campaign.end_date)],
    ['Deliverables', String(campaign.deliverables_count ?? '—')],
  ]
  const colW = CONTENT_WIDTH / 2
  for (let i = 0; i < pairs.length; i++) {
    const [label, value] = pairs[i]
    const col = i % 2
    const x = MARGIN.x + col * colW
    if (col === 0 && i > 0) y -= 36
    page.drawText(label, {
      x,
      y: y - 4,
      font: assets.sans,
      size: 9,
      color: COLORS.textFaint,
    })
    page.drawText(value, {
      x,
      y: y - 20,
      font: assets.sansBold,
      size: 12,
      color: COLORS.obsidian,
    })
  }
  y -= 56

  page.drawText('Brief', {
    x: MARGIN.x,
    y: y - 20,
    font: assets.serifBold,
    size: 18,
    color: COLORS.obsidian,
  })
  y -= 36

  const briefRaw = (campaign.brief ?? '').trim()
  const brief = briefRaw.length > 3000 ? briefRaw.slice(0, 3000) + '…' : briefRaw
  if (!brief) {
    page.drawText('—', { x: MARGIN.x, y: y - 12, font: assets.sans, size: 11, color: COLORS.textMuted })
  } else {
    const lines = wrapText(brief, assets.sans, 11, CONTENT_WIDTH)
    for (const line of lines) {
      if (y < MARGIN.y + 40) break
      page.drawText(line, {
        x: MARGIN.x,
        y: y - 12,
        font: assets.sans,
        size: 11,
        color: COLORS.obsidian,
      })
      y -= 16
    }
  }
}

function drawParticipantsPage(doc: PDFDocument, assets: Assets, participants: ParticipantForPdf[]): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText(`Participanţi (${participants.length})`, {
    x: MARGIN.x,
    y: y - 20,
    font: assets.serifBold,
    size: 22,
    color: COLORS.obsidian,
  })
  y -= 50

  if (participants.length === 0) {
    page.drawText('Niciun participant.', { x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted })
    return
  }

  const cols = [
    { label: 'Influencer', w: 150 },
    { label: 'Platformă', w: 70 },
    { label: 'Handle', w: 100 },
    { label: 'Status', w: 80 },
    { label: 'Fee (€)', w: 80 },
  ]
  const drawHeader = (target: PDFPage, yy: number) => {
    let cx = MARGIN.x
    target.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      target.drawText(c.label.toUpperCase(), {
        x: cx + 6,
        y: yy + 4,
        font: assets.sansBold,
        size: 8,
        color: COLORS.textMuted,
      })
      cx += c.w
    }
  }
  drawHeader(page, y)
  y -= 18

  let totalFee = 0
  let row = 0
  for (const p of participants) {
    if (y < MARGIN.y + 40) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(page, y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const values = [
      p.influencer?.name ?? (p.is_adhoc ? 'Ad-hoc' : '—'),
      p.platform,
      p.account_handle ?? '—',
      statusLabel(p.status),
      p.agreed_fee != null ? formatEur(p.agreed_fee).replace('€', '') : '—',
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6,
        y: y,
        font: assets.sans,
        size: 10,
        color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    if (p.agreed_fee != null) totalFee += p.agreed_fee
    y -= 18
    row++
  }

  y -= 12
  drawTextRight(page, `Total fee: ${formatEur(totalFee)}`, {
    x: PAGE.width - MARGIN.x,
    y,
    font: assets.sansBold,
    size: 11,
    color: COLORS.brand,
  })
}

function drawDeliverablesPage(
  doc: PDFDocument,
  assets: Assets,
  deliverables: DeliverableForPdf[],
  participants: ParticipantForPdf[],
): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText(`Livrabile (${deliverables.length})`, {
    x: MARGIN.x,
    y: y - 20,
    font: assets.serifBold,
    size: 22,
    color: COLORS.obsidian,
  })
  y -= 50

  if (deliverables.length === 0) {
    page.drawText('Niciun livrabil.', { x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted })
    return
  }

  const participantMap = new Map(participants.map((p) => [p.id, p.influencer?.name ?? 'Ad-hoc']))

  const cols = [
    { label: 'Influencer', w: 130 },
    { label: 'Tip', w: 110 },
    { label: 'Qty', w: 40 },
    { label: 'Data', w: 80 },
    { label: 'Status', w: 120 },
  ]
  const drawHeader = (target: PDFPage, yy: number) => {
    let cx = MARGIN.x
    target.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      target.drawText(c.label.toUpperCase(), {
        x: cx + 6,
        y: yy + 4,
        font: assets.sansBold,
        size: 8,
        color: COLORS.textMuted,
      })
      cx += c.w
    }
  }
  drawHeader(page, y)
  y -= 18

  let row = 0
  for (const d of deliverables) {
    if (y < MARGIN.y + 40) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(page, y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const values = [
      participantMap.get(d.participant_id) ?? '—',
      deliverableTypeLabel(d.type, d.custom_type_label),
      String(d.quantity),
      formatDateRo(d.post_date),
      statusLabel(d.status),
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6,
        y: y,
        font: assets.sans,
        size: 10,
        color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    y -= 18
    row++
  }
}

function drawMilestonesPage(doc: PDFDocument, assets: Assets, milestones: MilestoneForPdf[]): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN.y

  page.drawText(`Etape (${milestones.length})`, {
    x: MARGIN.x,
    y: y - 20,
    font: assets.serifBold,
    size: 22,
    color: COLORS.obsidian,
  })
  y -= 50

  if (milestones.length === 0) {
    page.drawText('Nicio etapă.', { x: MARGIN.x, y, font: assets.sans, size: 11, color: COLORS.textMuted })
    return
  }

  const RESP_LABELS: Record<string, string> = {
    account_manager: 'Account manager',
    influencer: 'Influencer',
    brand: 'Brand',
    other: 'Alt responsabil',
  }

  const cols = [
    { label: 'Tip', w: 160 },
    { label: 'Deadline', w: 90 },
    { label: 'Responsabil', w: 130 },
    { label: 'Completat', w: 100 },
  ]
  const drawHeader = (target: PDFPage, yy: number) => {
    let cx = MARGIN.x
    target.drawRectangle({ x: MARGIN.x, y: yy - 4, width: CONTENT_WIDTH, height: 22, color: COLORS.rule })
    for (const c of cols) {
      target.drawText(c.label.toUpperCase(), {
        x: cx + 6,
        y: yy + 4,
        font: assets.sansBold,
        size: 8,
        color: COLORS.textMuted,
      })
      cx += c.w
    }
  }
  drawHeader(page, y)
  y -= 18

  let row = 0
  for (const m of milestones) {
    if (y < MARGIN.y + 40) {
      page = doc.addPage([PAGE.width, PAGE.height])
      y = PAGE.height - MARGIN.y
      drawHeader(page, y)
      y -= 18
    }
    if (row % 2 === 1) {
      page.drawRectangle({ x: MARGIN.x, y: y - 4, width: CONTENT_WIDTH, height: 18, color: COLORS.rowAlt })
    }
    const respLabel = m.responsible === 'other' && m.responsible_name
      ? m.responsible_name
      : RESP_LABELS[m.responsible] ?? m.responsible
    const values = [
      milestoneTypeLabel(m.type, m.name),
      formatDateRo(m.due_date),
      respLabel,
      m.completed_at ? formatDateRo(m.completed_at) : '—',
    ]
    let cx = MARGIN.x
    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cx + 6,
        y: y,
        font: assets.sans,
        size: 10,
        color: COLORS.obsidian,
      })
      cx += cols[i].w
    }
    y -= 18
    row++
  }
}
