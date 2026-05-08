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

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib'
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
import { WORDMARK_ASPECT_RATIO, WORDMARK_PNG_BASE64 } from './wordmark-asset'

// Wordmark PNG sizes in PDF points. Width chosen to match the visual footprint
// the previous text wordmark occupied at 14pt / 8pt Times-Bold. Height derived
// from the source aspect (11.8485 : 1) so the rasterised letters stay
// proportional.
const WORDMARK_COVER_WIDTH = 120
const WORDMARK_COVER_HEIGHT = WORDMARK_COVER_WIDTH / WORDMARK_ASPECT_RATIO
const WORDMARK_FOOTER_WIDTH = 70
const WORDMARK_FOOTER_HEIGHT = WORDMARK_FOOTER_WIDTH / WORDMARK_ASPECT_RATIO

function decodeWordmarkPng(): Uint8Array {
  // Atob is available in Node 16+ and Cloudflare Workers; using it keeps this
  // path runtime-agnostic (no Buffer reliance).
  const bin = atob(WORDMARK_PNG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

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

// Brand assets bundle — fonts + the embedded wordmark PNG, threaded through
// every page renderer so each page can drop the logo without re-embedding.
type Assets = Fonts & { wordmark: PDFImage }

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
  const wordmark = await doc.embedPng(decodeWordmarkPng())
  const assets: Assets = { ...fonts, wordmark }

  drawCoverPage(doc, assets, influencer)
  drawRatePages(doc, assets, influencer)

  return doc.save()
}

export function getRateCardStoragePath(influencerId: string, timestamp: number): string {
  return `${influencerId}/${timestamp}-rate-card.pdf`
}

// ────────────────────────────────────────────────────────────────────────────
// Page renderers
// ────────────────────────────────────────────────────────────────────────────

function drawCoverPage(doc: PDFDocument, assets: Assets, inf: Influencer): void {
  const page = doc.addPage([PAGE.width, PAGE.height])

  // ── Header band ──────────────────────────────────────────────────────
  // Wordmark image (PNG embed) anchors top-left; baseline of MEDIA KIT label
  // aligns with the visual center of the wordmark for an even header line.
  const wordmarkBottom = PAGE.height - MARGIN.y - WORDMARK_COVER_HEIGHT
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: wordmarkBottom,
    width: WORDMARK_COVER_WIDTH,
    height: WORDMARK_COVER_HEIGHT,
  })
  drawTextRight(page, 'MEDIA KIT 2026', {
    x: PAGE.width - MARGIN.x,
    y: wordmarkBottom + (WORDMARK_COVER_HEIGHT - 9) / 2 + 1,
    font: assets.sansBold,
    size: 9,
    color: COLORS.textFaint,
    tracking: 1.5,
  })

  // Brand divider — sits below the wordmark with a small breathing gap.
  const dividerY = wordmarkBottom - 8
  page.drawLine({
    start: { x: MARGIN.x, y: dividerY },
    end: { x: PAGE.width - MARGIN.x, y: dividerY },
    thickness: 1,
    color: COLORS.brand,
  })

  // ── Center identity block ────────────────────────────────────────────
  const nameY = PAGE.height * 0.62
  const nameSize = pickNameSize(inf.name, assets.serif)
  const nameWidth = assets.serif.widthOfTextAtSize(inf.name, nameSize)
  drawText(page, inf.name, {
    x: (PAGE.width - nameWidth) / 2,
    y: nameY,
    font: assets.serif,
    size: nameSize,
    color: COLORS.obsidian,
  })

  // Tier strap-line below name
  if (inf.tier) {
    const tierLabel = TIER_LABELS_RANGE[inf.tier].toUpperCase()
    const tierWidth = assets.sansBold.widthOfTextAtSize(tierLabel, 11)
    drawText(page, tierLabel, {
      x: (PAGE.width - tierWidth) / 2,
      y: nameY - 24,
      font: assets.sansBold,
      size: 11,
      color: COLORS.brand,
      tracking: 2,
    })
  }

  // Primary handle (e.g. @cartedor) directly under tier
  const ph = primaryHandle(inf.social_handles ?? {})
  if (ph) {
    const handleStr = `@${ph.entry.handle} · ${PLATFORM_LABEL[ph.platform]}`
    const handleWidth = assets.sans.widthOfTextAtSize(handleStr, 10)
    drawText(page, handleStr, {
      x: (PAGE.width - handleWidth) / 2,
      y: nameY - 42,
      font: assets.sans,
      size: 10,
      color: COLORS.textMuted,
    })
  }

  // ── Stats grid ───────────────────────────────────────────────────────
  drawStatsRow(page, assets, inf, PAGE.height * 0.35)

  // ── Footer ───────────────────────────────────────────────────────────
  drawCoverFooter(page, assets)
}

function drawRatePages(doc: PDFDocument, assets: Assets, inf: Influencer): void {
  let page = doc.addPage([PAGE.width, PAGE.height])
  let cursor = drawSimpleHeader(page, assets, 'RATE CARDS', inf.name)

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
      drawPageFooter(page, assets)
      page = doc.addPage([PAGE.width, PAGE.height])
      cursor = drawSimpleHeader(page, assets, 'RATE CARDS', inf.name)
    }

    cursor = drawPlatformRateBlock(page, assets, platform, card, cursor)
  }

  // Final page: closing line + page-footer.
  if (cursor - 80 < MARGIN.y + 80) {
    drawPageFooter(page, assets)
    page = doc.addPage([PAGE.width, PAGE.height])
    cursor = drawSimpleHeader(page, assets, 'CONTACT', inf.name)
  }
  drawClosingLine(page, assets, cursor - 30)
  drawPageFooter(page, assets)
}

// ────────────────────────────────────────────────────────────────────────────
// Block renderers
// ────────────────────────────────────────────────────────────────────────────

function drawStatsRow(page: PDFPage, assets: Assets, inf: Influencer, y: number): void {
  const fonts = assets
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
  assets: Assets,
  platform: Platform,
  card: Partial<Record<string, number>>,
  yStart: number,
): number {
  const fonts = assets
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

function drawSimpleHeader(page: PDFPage, assets: Assets, title: string, name: string): number {
  // Inner pages use a smaller, embossed-style header: the wordmark image
  // anchors top-left so every page is visibly branded, with the section
  // title (e.g. RATE CARDS) sitting directly under it.
  const wordmarkBottom = PAGE.height - MARGIN.y - WORDMARK_FOOTER_HEIGHT
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: wordmarkBottom,
    width: WORDMARK_FOOTER_WIDTH,
    height: WORDMARK_FOOTER_HEIGHT,
  })
  drawTextRight(page, name, {
    x: PAGE.width - MARGIN.x,
    y: wordmarkBottom + (WORDMARK_FOOTER_HEIGHT - 9) / 2 + 1,
    font: assets.sans,
    size: 9,
    color: COLORS.textMuted,
  })

  const titleY = wordmarkBottom - 16
  drawText(page, title, {
    x: MARGIN.x,
    y: titleY,
    font: assets.serifBold,
    size: 14,
    color: COLORS.obsidian,
    tracking: 1.2,
  })
  page.drawLine({
    start: { x: MARGIN.x, y: titleY - 8 },
    end: { x: PAGE.width - MARGIN.x, y: titleY - 8 },
    thickness: 0.5,
    color: COLORS.rule,
  })
  return titleY - 30
}

function drawCoverFooter(page: PDFPage, assets: Assets): void {
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
    font: assets.sans,
    size: 10,
    color: COLORS.textMuted,
  })
  drawTextRight(page, '© 2026', {
    x: PAGE.width - MARGIN.x,
    y,
    font: assets.sans,
    size: 10,
    color: COLORS.textFaint,
  })
}

function drawClosingLine(page: PDFPage, assets: Assets, y: number): void {
  drawText(page, 'Thank you for your interest.', {
    x: MARGIN.x,
    y,
    font: assets.serifBold,
    size: 14,
    color: COLORS.obsidian,
  })
  drawText(page, 'Reach out at contact@influenceroom.ro', {
    x: MARGIN.x,
    y: y - 18,
    font: assets.sans,
    size: 11,
    color: COLORS.textMuted,
  })
}

function drawPageFooter(page: PDFPage, assets: Assets): void {
  const y = MARGIN.y - 14
  // Inline wordmark image as the footer mark; copyright sits flush right.
  // The image baseline sits a touch above the copyright baseline so the two
  // optically align even though the wordmark glyphs are taller than 8pt text.
  const footerHeight = WORDMARK_FOOTER_HEIGHT * 0.75
  const footerWidth = WORDMARK_FOOTER_WIDTH * 0.75
  page.drawImage(assets.wordmark, {
    x: MARGIN.x,
    y: y - 1,
    width: footerWidth,
    height: footerHeight,
  })
  drawTextRight(page, '© 2026 Influence Room', {
    x: PAGE.width - MARGIN.x,
    y: y + (footerHeight - 8) / 2,
    font: assets.sans,
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
