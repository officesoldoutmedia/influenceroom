// Sprint 13b — branded rate-card PDF generator.
//
// Pure pdf-lib (no external font assets, no React-PDF). Picks the 14 standard
// PDF fonts so we don't pay the bundle cost of embedding Fraunces/Geist or
// fight Workers' Node-compat layer over fontkit. The 3 standard families we
// use map close enough to the brand:
//   Times-Roman / Times-Bold       → serif headlines (Fraunces stand-in)
//   Helvetica / Helvetica-Bold     → body / labels (Geist stand-in)
//   Courier-Bold                   → monospace follower stat numbers
//
// Layout is imperative — every coordinate is `bottom-left origin`, in PDF
// points (1pt = 1/72 inch). A4 is 595 × 842 pt. Helpers below abstract the
// most common moves (right-aligned text, accent rule, etc.) so the page
// templates read like a recipe.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import {
  PLATFORMS,
  PLATFORM_LABEL,
  TIER_LABELS_RANGE,
  primaryHandle,
  type Influencer,
  type Platform,
} from '@/lib/influencers/types'
import { formatEur, formatFollowers } from '@/lib/influencers/format'
import {
  RATE_TYPES_PER_PLATFORM,
  RATE_TYPE_LABELS,
  countRatesForPlatform,
  hasAnyRate,
  totalRatesForPlatform,
} from './types'

// Brand palette — stays inline so the generator has zero project-config deps.
// (#C2410C burnt amber is the locked brand-700 from the project memory.)
const COLORS = {
  obsidian: rgb(0x0a / 255, 0x0a / 255, 0x0b / 255),
  brand: rgb(0xc2 / 255, 0x41 / 255, 0x0c / 255),
  textMuted: rgb(0x57 / 255, 0x53 / 255, 0x4e / 255),
  textFaint: rgb(0x9c / 255, 0xa3 / 255, 0xaf / 255),
  rule: rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255),
}

const PAGE = { width: 595.28, height: 841.89 } // A4 in points
const MARGIN = { x: 56, y: 56 }
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2

type Fonts = {
  serif: PDFFont
  serifBold: PDFFont
  sans: PDFFont
  sansBold: PDFFont
  mono: PDFFont
}

export class NoRatesError extends Error {
  constructor() {
    super('no_rates_to_export')
    this.name = 'NoRatesError'
  }
}

export async function generateRateCardPDF(influencer: Influencer): Promise<Uint8Array> {
  if (!hasAnyRate(influencer.rate_cards ?? {})) {
    throw new NoRatesError()
  }

  const doc = await PDFDocument.create()
  doc.setTitle(`Rate Card — ${influencer.name}`)
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

  drawCoverPage(doc, fonts, influencer)
  drawRatePages(doc, fonts, influencer)

  return doc.save()
}

export function getRateCardStoragePath(influencerId: string, timestamp: number): string {
  return `${influencerId}/${timestamp}-rate-card.pdf`
}

// ────────────────────────────────────────────────────────────────────────────
// Page renderers
// ────────────────────────────────────────────────────────────────────────────

function drawCoverPage(doc: PDFDocument, fonts: Fonts, inf: Influencer): void {
  const page = doc.addPage([PAGE.width, PAGE.height])

  // ── Header band ──────────────────────────────────────────────────────
  const wordmarkY = PAGE.height - MARGIN.y
  drawText(page, 'INFLUENCE ROOM', {
    x: MARGIN.x,
    y: wordmarkY,
    font: fonts.serifBold,
    size: 14,
    color: COLORS.obsidian,
    tracking: 1.2,
  })
  drawTextRight(page, 'MEDIA KIT 2026', {
    x: PAGE.width - MARGIN.x,
    y: wordmarkY,
    font: fonts.sansBold,
    size: 9,
    color: COLORS.textFaint,
    tracking: 1.5,
  })

  // Brand divider
  page.drawLine({
    start: { x: MARGIN.x, y: wordmarkY - 14 },
    end: { x: PAGE.width - MARGIN.x, y: wordmarkY - 14 },
    thickness: 1,
    color: COLORS.brand,
  })

  // ── Center identity block ────────────────────────────────────────────
  const nameY = PAGE.height * 0.62
  const nameSize = pickNameSize(inf.name, fonts.serif)
  const nameWidth = fonts.serif.widthOfTextAtSize(inf.name, nameSize)
  drawText(page, inf.name, {
    x: (PAGE.width - nameWidth) / 2,
    y: nameY,
    font: fonts.serif,
    size: nameSize,
    color: COLORS.obsidian,
  })

  // Tier strap-line below name
  if (inf.tier) {
    const tierLabel = TIER_LABELS_RANGE[inf.tier].toUpperCase()
    const tierWidth = fonts.sansBold.widthOfTextAtSize(tierLabel, 11)
    drawText(page, tierLabel, {
      x: (PAGE.width - tierWidth) / 2,
      y: nameY - 24,
      font: fonts.sansBold,
      size: 11,
      color: COLORS.brand,
      tracking: 2,
    })
  }

  // Primary handle (e.g. @cartedor) directly under tier
  const ph = primaryHandle(inf.social_handles ?? {})
  if (ph) {
    const handleStr = `@${ph.entry.handle} · ${PLATFORM_LABEL[ph.platform]}`
    const handleWidth = fonts.sans.widthOfTextAtSize(handleStr, 10)
    drawText(page, handleStr, {
      x: (PAGE.width - handleWidth) / 2,
      y: nameY - 42,
      font: fonts.sans,
      size: 10,
      color: COLORS.textMuted,
    })
  }

  // ── Stats grid ───────────────────────────────────────────────────────
  drawStatsRow(page, fonts, inf, PAGE.height * 0.35)

  // ── Footer ───────────────────────────────────────────────────────────
  drawCoverFooter(page, fonts)
}

function drawRatePages(doc: PDFDocument, fonts: Fonts, inf: Influencer): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let cursor = drawSimpleHeader(page, fonts, 'RATE CARDS', inf.name)

  for (const platform of PLATFORMS) {
    const card = inf.rate_cards?.[platform]
    if (!card || countRatesForPlatform(card) === 0) continue

    // Estimate the height the next platform block needs and start a fresh
    // page if it would clip the footer. Title + spacer + N rows + subtotal +
    // gap = ~28 + 10*rowCount + 32 pt.
    const rowCount = (RATE_TYPES_PER_PLATFORM[platform] as readonly string[]).filter(
      (rt) => typeof card[rt] === 'number',
    ).length
    const blockHeight = 28 + rowCount * 18 + 36
    if (cursor - blockHeight < MARGIN.y + 60) {
      drawPageFooter(page, fonts)
      page = doc.addPage([PAGE.width, PAGE.height])
      cursor = drawSimpleHeader(page, fonts, 'RATE CARDS', inf.name)
    }

    cursor = drawPlatformRateBlock(page, fonts, platform, card, cursor)
  }

  // Final page: closing line + page-footer.
  if (cursor - 80 < MARGIN.y + 80) {
    drawPageFooter(page, fonts)
    page = doc.addPage([PAGE.width, PAGE.height])
    cursor = drawSimpleHeader(page, fonts, 'CONTACT', inf.name)
  }
  drawClosingLine(page, fonts, cursor - 30)
  drawPageFooter(page, fonts)
}

// ────────────────────────────────────────────────────────────────────────────
// Block renderers
// ────────────────────────────────────────────────────────────────────────────

function drawStatsRow(page: PDFPage, fonts: Fonts, inf: Influencer, y: number): void {
  const stats = PLATFORMS.map((p) => {
    const entry = inf.social_handles?.[p]
    return entry && entry.followers > 0
      ? { platform: p, followers: entry.followers }
      : null
  }).filter((s): s is { platform: Platform; followers: number } => s !== null)

  if (stats.length === 0) return

  // Equal-width columns spanning the content area; min cell width 90pt so
  // labels don't get squashed when only one platform is populated.
  const cellWidth = Math.max(90, CONTENT_WIDTH / stats.length)
  const totalWidth = cellWidth * stats.length
  const startX = (PAGE.width - totalWidth) / 2

  stats.forEach((s, i) => {
    const cellX = startX + cellWidth * i
    const label = PLATFORM_LABEL[s.platform].toUpperCase()
    const value = formatFollowers(s.followers)

    const labelWidth = fonts.sans.widthOfTextAtSize(label, 9)
    drawText(page, label, {
      x: cellX + (cellWidth - labelWidth) / 2,
      y: y + 18,
      font: fonts.sans,
      size: 9,
      color: COLORS.textFaint,
      tracking: 1.5,
    })

    const valueWidth = fonts.mono.widthOfTextAtSize(value, 22)
    drawText(page, value, {
      x: cellX + (cellWidth - valueWidth) / 2,
      y: y - 4,
      font: fonts.mono,
      size: 22,
      color: COLORS.obsidian,
    })
  })
}

function drawPlatformRateBlock(
  page: PDFPage,
  fonts: Fonts,
  platform: Platform,
  card: Partial<Record<string, number>>,
  yStart: number,
): number {
  const title = PLATFORM_LABEL[platform].toUpperCase()
  drawText(page, title, {
    x: MARGIN.x,
    y: yStart,
    font: fonts.sansBold,
    size: 13,
    color: COLORS.obsidian,
    tracking: 2,
  })
  // Accent rule under the section title.
  page.drawLine({
    start: { x: MARGIN.x, y: yStart - 6 },
    end: { x: MARGIN.x + 36, y: yStart - 6 },
    thickness: 1.5,
    color: COLORS.brand,
  })

  let y = yStart - 22
  const rows = (RATE_TYPES_PER_PLATFORM[platform] as readonly string[])
    .map((rt) => ({ rt, value: card[rt] }))
    .filter((r): r is { rt: string; value: number } => typeof r.value === 'number')

  for (const { rt, value } of rows) {
    drawText(page, RATE_TYPE_LABELS[rt] ?? rt, {
      x: MARGIN.x + 8,
      y,
      font: fonts.sans,
      size: 11,
      color: COLORS.textMuted,
    })
    drawTextRight(page, formatEur(value), {
      x: PAGE.width - MARGIN.x - 4,
      y,
      font: fonts.sansBold,
      size: 11,
      color: COLORS.obsidian,
    })
    y -= 16
  }

  // Subtotal — separated by a thin rule.
  page.drawLine({
    start: { x: MARGIN.x + 8, y: y + 8 },
    end: { x: PAGE.width - MARGIN.x - 4, y: y + 8 },
    thickness: 0.5,
    color: COLORS.rule,
  })
  drawText(page, 'Subtotal', {
    x: MARGIN.x + 8,
    y: y - 4,
    font: fonts.sansBold,
    size: 9,
    color: COLORS.textFaint,
    tracking: 1.5,
  })
  drawTextRight(page, formatEur(totalRatesForPlatform(card)), {
    x: PAGE.width - MARGIN.x - 4,
    y: y - 4,
    font: fonts.sansBold,
    size: 12,
    color: COLORS.brand,
  })

  return y - 26 // gap before the next platform block
}

function drawSimpleHeader(page: PDFPage, fonts: Fonts, title: string, name: string): number {
  const y = PAGE.height - MARGIN.y
  drawText(page, title, {
    x: MARGIN.x,
    y,
    font: fonts.serifBold,
    size: 14,
    color: COLORS.obsidian,
    tracking: 1.2,
  })
  drawTextRight(page, name, {
    x: PAGE.width - MARGIN.x,
    y,
    font: fonts.sans,
    size: 10,
    color: COLORS.textMuted,
  })
  page.drawLine({
    start: { x: MARGIN.x, y: y - 10 },
    end: { x: PAGE.width - MARGIN.x, y: y - 10 },
    thickness: 0.5,
    color: COLORS.rule,
  })
  return y - 36
}

function drawCoverFooter(page: PDFPage, fonts: Fonts): void {
  const y = MARGIN.y + 6
  page.drawLine({
    start: { x: MARGIN.x, y: y + 22 },
    end: { x: PAGE.width - MARGIN.x, y: y + 22 },
    thickness: 0.5,
    color: COLORS.rule,
  })
  drawText(page, 'contact@influenceroom.ro', {
    x: MARGIN.x,
    y,
    font: fonts.sans,
    size: 10,
    color: COLORS.textMuted,
  })
  drawTextRight(page, '© 2026', {
    x: PAGE.width - MARGIN.x,
    y,
    font: fonts.sans,
    size: 10,
    color: COLORS.textFaint,
  })
}

function drawClosingLine(page: PDFPage, fonts: Fonts, y: number): void {
  drawText(page, 'Thank you for your interest.', {
    x: MARGIN.x,
    y,
    font: fonts.serifBold,
    size: 14,
    color: COLORS.obsidian,
  })
  drawText(page, 'Reach out at contact@influenceroom.ro', {
    x: MARGIN.x,
    y: y - 18,
    font: fonts.sans,
    size: 11,
    color: COLORS.textMuted,
  })
}

function drawPageFooter(page: PDFPage, fonts: Fonts): void {
  const y = MARGIN.y - 14
  drawText(page, 'INFLUENCE ROOM', {
    x: MARGIN.x,
    y,
    font: fonts.serifBold,
    size: 8,
    color: COLORS.textFaint,
    tracking: 1.5,
  })
  drawTextRight(page, '© 2026 Influence Room', {
    x: PAGE.width - MARGIN.x,
    y,
    font: fonts.sans,
    size: 8,
    color: COLORS.textFaint,
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ────────────────────────────────────────────────────────────────────────────

type DrawTextOpts = {
  x: number
  y: number
  font: PDFFont
  size: number
  color: ReturnType<typeof rgb>
  /** Extra letter-spacing in points; pdf-lib has no built-in tracking. */
  tracking?: number
}

function drawText(page: PDFPage, text: string, opts: DrawTextOpts): void {
  if (!opts.tracking) {
    page.drawText(text, {
      x: opts.x,
      y: opts.y,
      font: opts.font,
      size: opts.size,
      color: opts.color,
    })
    return
  }
  // Manual tracking by drawing one glyph at a time. Times faster than
  // shaping; only used for the few uppercase wordmark labels.
  let cursor = opts.x
  for (const ch of text) {
    page.drawText(ch, {
      x: cursor,
      y: opts.y,
      font: opts.font,
      size: opts.size,
      color: opts.color,
    })
    cursor += opts.font.widthOfTextAtSize(ch, opts.size) + opts.tracking
  }
}

function drawTextRight(page: PDFPage, text: string, opts: DrawTextOpts): void {
  if (!opts.tracking) {
    const width = opts.font.widthOfTextAtSize(text, opts.size)
    page.drawText(text, {
      x: opts.x - width,
      y: opts.y,
      font: opts.font,
      size: opts.size,
      color: opts.color,
    })
    return
  }
  // Compute total tracked width so we can right-align the run.
  let total = 0
  for (const ch of text) total += opts.font.widthOfTextAtSize(ch, opts.size)
  total += opts.tracking * (text.length - 1)
  drawText(page, text, { ...opts, x: opts.x - total })
}

function pickNameSize(name: string, font: PDFFont): number {
  // Auto-shrink long names so they always fit on one line within the content
  // width. The cover is the only place where the name appears at display size.
  for (const size of [48, 42, 36, 30, 24]) {
    const w = font.widthOfTextAtSize(name, size)
    if (w <= CONTENT_WIDTH) return size
  }
  return 22
}
